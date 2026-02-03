/**
 * =================================================================
 * 【ファイル名】  : 02-1_BusinessLogic_Batch.gs
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 管理メニューから手動実行される重いバッチ処理（アーカイブ・集計）をまとめる。
 *
 * 【主な責務】
 *   - 予約記録のアーカイブ転送や売上ログの再集計など、定期実行では重過ぎる処理を提供
 *   - テスト環境構築や各種ベースデータ初期化のユーティリティ関数を提供
 *   - エラー時は `handleError` を通じて統一ログに記録
 *
 * 【関連モジュール】
 *   - `08_Utilities.js`: エラーハンドリング・共通処理で連携
 *   - `07_CacheManager.js`: バッチ後にキャッシュ整合性を保つための再構築を呼び出すケースがある
 *   - `05-2_Backend_Write.js`: アーカイブ対象のよやくデータフォーマットを共有
 *
 * 【利用時の留意点】
 *   - 本番環境での実行は手動確認が必要。データ破壊的操作が含まれるため十分にバックアップを取る
 *   - UI からの操作では進捗トーストを表示するが、長時間バッチの場合はログも併用する
 *   - 処理を分割したい場合は個別関数化してメニューから呼び出せるようにする
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { SS_MANAGER } from './00_SpreadsheetManager.js';
import { sendAdminNotification } from './02-6_Notification_Admin.js';
import { logSalesForSingleReservation } from './05-2_Backend_Write.js';
import {
  rebuildScheduleMasterCache,
  updateScheduleStatusToCompleted,
} from './07_CacheManager.js';
import {
  getCachedReservationsAsObjects,
  getSheetData,
  handleError,
  logActivity,
  sortReservationRows,
} from './08_Utilities.js';

/**
 * 【開発用】テスト環境をセットアップします。
 * 現在のスプレッドシートをコピーし、テスト用の新しい環境を作成します。
 */
export function setupTestEnvironment() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'テスト環境の作成',
    '現在のスプレッドシートの完全なコピーを作成し、テスト環境としてセットアップします。よろしいですか？',
    ui.ButtonSet.OK_CANCEL,
  );

  if (response !== ui.Button.OK) {
    ui.alert('処理を中断しました。');
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'テスト環境を作成中です...',
      '処理中',
      -1,
    );

    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceFile = DriveApp.getFileById(sourceSpreadsheet.getId());

    // 1. スプレッドシートをコピー
    const newFileName = `【テスト用】${sourceSpreadsheet.getName()}`;
    const copiedFile = sourceFile.makeCopy(newFileName);
    const copiedSpreadsheet = SpreadsheetApp.openById(copiedFile.getId());

    // 2. コピーしたスプレッドシートの情報を取得
    const newUrl = copiedSpreadsheet.getUrl();
    const newId = copiedSpreadsheet.getId();

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'テスト環境の作成が完了しました。',
      '完了',
      5,
    );

    // 3. ユーザーに情報を提示
    const htmlOutput = HtmlService.createHtmlOutput(
      `<h4>テスト環境のセットアップが完了しました</h4>
       <p>新しいテスト用スプレッドシートと、それに紐づくApps Scriptプロジェクトが作成されました。</p>
       <p><b>ファイル名:</b> ${newFileName}</p>
       <p><b>スプレッドシートURL:</b> <a href="${newUrl}" target="_blank">ここをクリックして開く</a></p>
       <p><b>スプレッドシートID:</b> <code>${newId}</code></p>
       <hr>
       <h4>次のステップ: ローカル開発環境の接続とトリガー設定</h4>
       <ol style="text-align: left; padding-left: 20px;">
           <li>
               <b>新しいスクリプトIDの確認:</b>
               上記URLから新しいスプレッドシートを開き、拡張機能 &gt; Apps Script からスクリプトエディタを開いてください。
               開いたら、左側の「プロジェクトの設定」（歯車のアイコン）をクリックし、<b>「スクリプトID」</b>をコピーしてください。
           </li>
           <li>
               <b>ローカル環境（.clasp.json）の更新:</b>
               ターミナルで以下のコマンドを実行し、<code>.clasp.json</code>の<code>scriptId</code>をコピーした<b>スクリプトID</b>に更新してください。<br>
               <pre style="background-color:#f0f0f0; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 0.9em;"><code>clasp setting scriptId &lt;ここにコピーしたスクリプトIDをペースト&gt;</code></pre>
           </li>
           <li>
               <b>コードのプッシュ:</b>
               その後、<code>clasp push</code>でコードをデプロイしてください。
           </li>
           <li>
               <b>トリガーの再設定:</b>
               新しいスクリプトプロジェクトのエディタで、左側の「トリガー」（時計のアイコン）をクリックし、<code>handleOnChange</code>と<code>handleEdit</code>のトリガーを再設定してください。<br>
               (イベントの種類: <code>変更時</code> と <code>編集時</code>)
           </li>
       </ol>
       <br>
       <input type="button" value="閉じる" onclick="google.script.host.close()" style="background-color: #f0f0f0; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">`,
    )
      .setWidth(600)
      .setHeight(400);

    ui.showModalDialog(htmlOutput, 'セットアップ完了');
  } catch (err) {
    handleError(
      `テスト環境の作成中にエラーが発生しました: ${err.message}`,
      true,
    );
  }
}

/**
 * 直近60日間の会計済みよやく日を取得する
 * @returns {string[]} 日付文字列の配列（YYYY-MM-DD形式、降順）
 */
export function getRecentCompletedReservationDates() {
  try {
    const reservations = getCachedReservationsAsObjects();
    if (!reservations || reservations.length === 0) {
      return [];
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const completedReservations = reservations.filter(reservation => {
      if (!reservation) return false;
      if (reservation.status !== CONSTANTS.STATUS.COMPLETED) return false;
      return typeof reservation.reservationId === 'string';
    });

    const reservationIds = completedReservations
      .map(reservation => reservation.reservationId)
      .filter(id => typeof id === 'string' && id !== '');
    const accountingDetailsMap = getAccountingDetailsMap(reservationIds);

    // 会計済みよやくの日付を収集
    const dateSet = new Set();
    completedReservations.forEach(reservation => {
      if (!reservation.date) return;
      if (!accountingDetailsMap.has(reservation.reservationId)) return;
      const dateCandidate = new Date(`${reservation.date}T00:00:00+09:00`);
      if (!isNaN(dateCandidate.getTime()) && dateCandidate >= sixtyDaysAgo) {
        dateSet.add(reservation.date);
      }
    });

    // 配列に変換して降順ソート
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  } catch (err) {
    Logger.log(`[getRecentCompletedReservationDates] Error: ${err.message}`);
    return [];
  }
}

/**
 * 指定した日付の予約記録から売上ログを再転載する（ダイアログ表示版）
 * カスタムメニューから手動実行する想定
 */
export function repostSalesLogByDate() {
  const ui = SpreadsheetApp.getUi();

  // HTMLダイアログを表示
  const htmlOutput = HtmlService.createHtmlOutputFromFile('dialog_repost_sales')
    .setWidth(450)
    .setHeight(300);

  ui.showModalDialog(htmlOutput, '売上記録の再転載');
}

/**
 * 指定した予約ID群の会計詳細をシートから取得してマップで返す
 * @param {string[]} reservationIds
 * @returns {Map<string, AccountingDetailsCore>}
 */
function getAccountingDetailsMap(reservationIds) {
  const resultMap = new Map();
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    return resultMap;
  }

  const reservationIdSet = new Set(
    reservationIds.map(id => String(id || '')).filter(id => id !== ''),
  );
  if (reservationIdSet.size === 0) {
    return resultMap;
  }

  const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
  if (!sheet) {
    Logger.log(
      '[getAccountingDetailsMap] よやくシートが取得できなかったため、会計詳細を取得できません。',
    );
    return resultMap;
  }

  const headerRow = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  const reservationIdColIndex = headerRow.indexOf(
    CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
  );
  const accountingColIndex = headerRow.indexOf(
    CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
  );

  if (reservationIdColIndex === -1 || accountingColIndex === -1) {
    Logger.log(
      '[getAccountingDetailsMap] 必要な列が見つからないため、会計詳細を取得できません。',
    );
    return resultMap;
  }

  const dataRowCount = sheet.getLastRow() - 1;
  if (dataRowCount <= 0) {
    return resultMap;
  }

  const allValues = sheet
    .getRange(2, 1, dataRowCount, sheet.getLastColumn())
    .getValues();

  for (const row of allValues) {
    const rawId = row[reservationIdColIndex];
    const reservationId = String(rawId || '');
    if (!reservationIdSet.has(reservationId)) continue;

    let accountingDetails = row[accountingColIndex] || null;
    if (
      typeof accountingDetails === 'string' &&
      accountingDetails.trim().startsWith('{')
    ) {
      try {
        accountingDetails = JSON.parse(accountingDetails);
      } catch (error) {
        Logger.log(
          `[getAccountingDetailsMap] 会計詳細のJSONパースに失敗しました (reservationId=${reservationId}): ${error.message}`,
        );
        accountingDetails = null;
      }
    }

    if (accountingDetails && typeof accountingDetails === 'object') {
      resultMap.set(
        reservationId,
        /** @type {AccountingDetailsCore} */ (accountingDetails),
      );
    }
  }

  return resultMap;
}

/**
 * 指定した日付の予約記録から売上ログを転載する
 * HTMLダイアログ（手動再転載）またはバッチ処理（日次転載）から呼び出される
 * @param {string} [targetDate] - 対象日付（YYYY-MM-DD形式）。省略時は当日。
 * @returns {{ success: boolean, totalCount: number, successCount: number }} 転載結果
 */
export function transferSalesLogByDate(targetDate) {
  // 日付が指定されていない場合は当日を使用
  if (!targetDate) {
    const today = new Date();
    targetDate = Utilities.formatDate(today, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  }
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `${targetDate}の売上記録を転載中...`,
      '処理中',
      -1,
    );

    const reservations = getCachedReservationsAsObjects();
    if (!reservations || reservations.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
      Logger.log(
        `[transferSalesLogByDate] 対象なし: ${targetDate}のよやくデータがキャッシュに存在しません`,
      );
      return {
        success: true,
        totalCount: 0,
        successCount: 0,
      };
    }

    /** @type {ReservationCore[]} */
    const targetReservations = reservations.filter(reservation => {
      if (!reservation) return false;
      if (reservation.date !== targetDate) return false;
      if (reservation.status !== CONSTANTS.STATUS.COMPLETED) return false;
      return true;
    });

    if (targetReservations.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
      Logger.log(
        `[transferSalesLogByDate] 対象なし: ${targetDate}の会計済みよやくはありません`,
      );
      return {
        success: true,
        totalCount: 0,
        successCount: 0,
      };
    }

    const reservationIdList = targetReservations
      .map(reservation => reservation.reservationId)
      .filter(id => typeof id === 'string' && id !== '');
    const accountingDetailsMap = getAccountingDetailsMap(reservationIdList);

    // 各よやくから売上記録を書き込み（既存の関数を再利用）
    let successCount = 0;
    for (const targetReservation of targetReservations) {
      try {
        let accountingDetails = targetReservation.accountingDetails;
        if (!accountingDetails) {
          accountingDetails = accountingDetailsMap.get(
            targetReservation.reservationId,
          );
        }
        if (!accountingDetails || typeof accountingDetails !== 'object') {
          Logger.log(
            `[transferSalesLogByDate] 会計詳細が不正なためスキップ: ${targetReservation.reservationId}`,
          );
          continue;
        }

        // 既存の売上記録書き込み関数を呼び出し
        const result = logSalesForSingleReservation(
          targetReservation,
          /** @type {AccountingDetailsCore} */ (accountingDetails),
        );

        if (result.success) {
          successCount++;
        } else {
          Logger.log(
            `[transferSalesLogByDate] 失敗: よやく ${targetReservation.reservationId} - ${result.error?.message}`,
          );
        }
      } catch (err) {
        Logger.log(
          `[transferSalesLogByDate] よやく ${targetReservation.reservationId} の処理で予期せぬエラー: ${err.message}`,
        );
      }
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    Logger.log(
      `[transferSalesLogByDate] 完了: ${targetDate}, よやく${targetReservations.length}件, 成功${successCount}件`,
    );

    return {
      success: true,
      totalCount: targetReservations.length,
      successCount: successCount,
    };
  } catch (err) {
    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    const errorMessage = `売上記録の転載中にエラーが発生しました: ${err.message}`;
    Logger.log(`[transferSalesLogByDate] エラー: ${errorMessage}`);

    // エラーをスロー（HTMLダイアログ側でキャッチ）
    throw new Error(errorMessage);
  }
}

/**
 * よやくシート全体をソートします（バッチ処理用）
 *
 * @description
 * よやくシートのデータを以下の順序でソートします:
 * 1. 日付順（降順: 新しい日付が上）
 * 2. ステータス順（完了=確定 > 待機 > 取消）
 * 3. 開始時間順（昇順）
 * 4. 終了時間順（昇順）
 * 5. 初回順（初回=true > 空白/false）
 *
 * @returns {{success: boolean, message: string, sortedCount: number}}
 */
export function sortReservationSheet() {
  try {
    Logger.log('[sortReservationSheet] 開始');

    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
    if (!sheet) {
      const errorMsg = 'よやくシートが取得できませんでした';
      Logger.log(`[sortReservationSheet] エラー: ${errorMsg}`);
      return { success: false, message: errorMsg, sortedCount: 0 };
    }

    const { header, headerMap, dataRows } = getSheetData(sheet);

    if (!dataRows || dataRows.length === 0) {
      Logger.log('[sortReservationSheet] ソート対象データなし');
      return { success: true, message: 'ソート対象データなし', sortedCount: 0 };
    }

    // ソート実行（RawSheetRowをキャスト）
    const sortedRows = sortReservationRows(
      /** @type {Array<Array<string|number|Date>>} */ (dataRows),
      headerMap,
    );

    // シート全体を上書き（ヘッダー + データ）
    const allData = [header, ...sortedRows];
    sheet.getRange(1, 1, allData.length, header.length).setValues(allData);
    SpreadsheetApp.flush();

    Logger.log(`[sortReservationSheet] 完了: ${sortedRows.length}件`);

    return {
      success: true,
      message: `よやくシートをソートしました（${sortedRows.length}件）`,
      sortedCount: sortedRows.length,
    };
  } catch (err) {
    Logger.log(`[sortReservationSheet] エラー: ${err.message}`);
    return {
      success: false,
      message: `ソート処理でエラーが発生: ${err.message}`,
      sortedCount: 0,
    };
  }
}

/**
 * 【トリガー関数】毎日20時に実行: 当日の会計済みよやくを売上表に転載する
 * スクリプトのトリガー設定から呼び出される
 *
 * @description
 * このバッチ処理により、会計修正は当日20時まで可能となり、
 * 20時以降は確定された会計データが売上表に転載される。
 * これにより、会計処理時の売上ログ記録が不要になり、
 * 何度修正しても売上表に影響がない運用が実現できる。
 */
export function dailySalesTransferBatch() {
  const today = new Date();
  const targetDate = Utilities.formatDate(
    today,
    CONSTANTS.TIMEZONE,
    'yyyy-MM-dd',
  );

  try {
    Logger.log(`[dailySalesTransferBatch] 開始: ${new Date().toISOString()}`);

    // LOGシートにバッチ開始を記録
    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_START,
      '実行中',
      `対象日: ${targetDate}`,
    );

    // 引数なしで呼び出すと当日の売上を転載
    const result = transferSalesLogByDate();

    Logger.log(
      `[dailySalesTransferBatch] 完了: よやく${result.totalCount}件, 成功${result.successCount}件`,
    );

    // LOGシートにバッチ完了を記録
    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_SUCCESS,
      '成功',
      `対象日: ${targetDate}, 処理件数: ${result.totalCount}件, 成功: ${result.successCount}件`,
    );

    // 管理者にメール通知
    const emailSubject = `売上転載バッチ処理完了 (${targetDate})`;
    const emailBody =
      `売上転載バッチ処理が完了しました。\n\n` +
      `対象日: ${targetDate}\n` +
      `処理件数: ${result.totalCount}件\n` +
      `成功: ${result.successCount}件\n` +
      `失敗: ${result.totalCount - result.successCount}件\n\n` +
      `処理時刻: ${Utilities.formatDate(today, CONSTANTS.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}\n\n` +
      `詳細はスプレッドシートのLOGシートを確認してください。`;

    sendAdminNotification(emailSubject, emailBody);

    // 売上転載のタイミングで日程ステータスを更新
    const updatedStatusCount = updateScheduleStatusToCompleted();
    if (updatedStatusCount > 0) {
      Logger.log(
        `[dailySalesTransferBatch] 日程ステータス更新: ${updatedStatusCount}件を開催済みに更新`,
      );
      rebuildScheduleMasterCache();
    }

    // 売上転載後によやくシート全体をソート
    Logger.log('[dailySalesTransferBatch] よやくシートソート開始');
    const sortResult = sortReservationSheet();

    if (sortResult.success) {
      Logger.log(
        `[dailySalesTransferBatch] ソート完了: ${sortResult.sortedCount}件`,
      );
      logActivity(
        'SYSTEM',
        CONSTANTS.LOG_ACTIONS.BATCH_SORT_SUCCESS,
        '成功',
        sortResult.message,
      );
    } else {
      Logger.log(`[dailySalesTransferBatch] ソート失敗: ${sortResult.message}`);
      logActivity(
        'SYSTEM',
        CONSTANTS.LOG_ACTIONS.BATCH_SORT_ERROR,
        '失敗',
        sortResult.message,
      );
      // ソート失敗してもバッチ全体は継続
    }
  } catch (err) {
    const errorMessage = `売上表転載バッチ処理でエラーが発生しました: ${err.message}`;
    Logger.log(`[dailySalesTransferBatch] エラー: ${errorMessage}`);

    // LOGシートにエラーを記録
    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_ERROR,
      '失敗',
      `対象日: ${targetDate}, エラー: ${err.message}`,
    );

    // 管理者にエラーメール通知
    const errorEmailSubject = `【エラー】売上転載バッチ処理失敗 (${targetDate})`;
    const errorEmailBody =
      `売上転載バッチ処理でエラーが発生しました。\n\n` +
      `対象日: ${targetDate}\n` +
      `エラー内容: ${err.message}\n\n` +
      `処理時刻: ${Utilities.formatDate(today, CONSTANTS.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}\n\n` +
      `詳細はスプレッドシートのLOGシートおよびApps Scriptのログを確認してください。`;

    sendAdminNotification(errorEmailSubject, errorEmailBody);

    handleError(errorMessage, false);
  }
}
