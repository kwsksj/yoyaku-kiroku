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
 *   - `05-2_Backend_Write.js`: アーカイブ対象の予約データフォーマットを共有
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
import { logSalesForSingleReservation } from './05-2_Backend_Write.js';
import { getReservationCoreById, handleError } from './08_Utilities.js';

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
 * 直近60日間の会計済み予約日を取得する
 * @returns {string[]} 日付文字列の配列（YYYY-MM-DD形式、降順）
 */
export function getRecentCompletedReservationDates() {
  try {
    const ss = SS_MANAGER.getSpreadsheet();
    const reservationSheet = ss.getSheetByName(
      CONSTANTS.SHEET_NAMES.RESERVATIONS,
    );

    if (!reservationSheet) {
      return [];
    }

    // ヘッダー行を取得
    const headers = reservationSheet
      .getRange(1, 1, 1, reservationSheet.getLastColumn())
      .getValues()[0];
    const dateColIndex = headers.indexOf(CONSTANTS.HEADERS.RESERVATIONS.DATE);
    const statusColIndex = headers.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.STATUS,
    );
    const accountingColIndex = headers.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
    );

    if (
      dateColIndex === -1 ||
      statusColIndex === -1 ||
      accountingColIndex === -1
    ) {
      return [];
    }

    // データ行を取得
    const dataRange = reservationSheet.getRange(
      CONSTANTS.SYSTEM.DATA_START_ROW,
      1,
      reservationSheet.getLastRow() - CONSTANTS.SYSTEM.DATA_START_ROW + 1,
      reservationSheet.getLastColumn(),
    );
    const data = dataRange.getValues();

    // 60日前の日付を計算
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 会計済み予約の日付を収集
    const dateSet = new Set();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const dateValue = row[dateColIndex];
      const status = row[statusColIndex];
      const accountingDetailsJson = row[accountingColIndex];

      // 会計済みステータスかつ会計詳細があるもののみ
      if (
        status === CONSTANTS.STATUS.COMPLETED &&
        accountingDetailsJson &&
        dateValue
      ) {
        const date =
          dateValue instanceof Date ? dateValue : new Date(dateValue);

        // 60日以内のもののみ
        if (date >= sixtyDaysAgo) {
          const dateStr = Utilities.formatDate(
            date,
            CONSTANTS.TIMEZONE,
            'yyyy-MM-dd',
          );
          dateSet.add(dateStr);
        }
      }
    }

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

    // 予約記録シートを取得
    const ss = SS_MANAGER.getSpreadsheet();
    const reservationSheet = ss.getSheetByName(
      CONSTANTS.SHEET_NAMES.RESERVATIONS,
    );

    if (!reservationSheet) {
      throw new Error(
        `${CONSTANTS.SHEET_NAMES.RESERVATIONS}シートが見つかりません。`,
      );
    }

    // ヘッダー行を取得
    const headers = reservationSheet
      .getRange(1, 1, 1, reservationSheet.getLastColumn())
      .getValues()[0];
    const reservationIdColIndex = headers.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    const dateColIndex = headers.indexOf(CONSTANTS.HEADERS.RESERVATIONS.DATE);
    const statusColIndex = headers.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.STATUS,
    );
    const accountingColIndex = headers.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
    );

    if (
      reservationIdColIndex === -1 ||
      dateColIndex === -1 ||
      statusColIndex === -1 ||
      accountingColIndex === -1
    ) {
      throw new Error(
        '必要な列が見つかりません（予約ID、日付、ステータス、会計詳細）。',
      );
    }

    // データ行を取得
    const dataRange = reservationSheet.getRange(
      CONSTANTS.SYSTEM.DATA_START_ROW,
      1,
      reservationSheet.getLastRow() - CONSTANTS.SYSTEM.DATA_START_ROW + 1,
      reservationSheet.getLastColumn(),
    );
    const data = dataRange.getValues();

    // 指定日付の予約を検索（予約IDと会計詳細をペアで保持）
    /** @type {Array<{reservationId: string, accountingDetailsJson: string}>} */
    const targetReservations = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const reservationId = row[reservationIdColIndex];
      const dateValue = row[dateColIndex];
      const status = row[statusColIndex];
      const accountingDetailsJson = row[accountingColIndex];

      // 日付を文字列に変換（Dateオブジェクトの場合）
      let dateStr = '';
      if (dateValue instanceof Date) {
        dateStr = Utilities.formatDate(
          dateValue,
          CONSTANTS.TIMEZONE,
          'yyyy-MM-dd',
        );
      } else {
        dateStr = String(dateValue);
      }

      // 指定日付で、かつ会計済み（完了）のステータス、かつ会計詳細があるもののみ対象
      if (
        dateStr === targetDate &&
        status === CONSTANTS.STATUS.COMPLETED &&
        accountingDetailsJson
      ) {
        targetReservations.push({
          reservationId: String(reservationId),
          accountingDetailsJson: String(accountingDetailsJson),
        });
      }
    }

    if (targetReservations.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
      throw new Error(`${targetDate}の会計済み予約は見つかりませんでした。`);
    }

    // 各予約から売上記録を書き込み（既存の関数を再利用）
    let successCount = 0;
    for (const targetReservation of targetReservations) {
      try {
        // 予約データを完全な形で取得
        const reservation = getReservationCoreById(
          targetReservation.reservationId,
        );
        if (!reservation) {
          Logger.log(
            `[transferSalesLogByDate] 予約が見つかりません: ${targetReservation.reservationId}`,
          );
          continue;
        }

        /** @type {AccountingDetailsCore} */
        const accountingDetails = JSON.parse(
          targetReservation.accountingDetailsJson,
        );

        // 既存の売上記録書き込み関数を呼び出し
        logSalesForSingleReservation(reservation, accountingDetails);
        successCount++;
      } catch (err) {
        Logger.log(
          `[transferSalesLogByDate] 予約 ${targetReservation.reservationId} の処理でエラー: ${err.message}`,
        );
      }
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    Logger.log(
      `[transferSalesLogByDate] 完了: ${targetDate}, 予約${targetReservations.length}件, 成功${successCount}件`,
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
 * 【トリガー関数】毎日20時に実行: 当日の会計済み予約を売上表に転載する
 * スクリプトのトリガー設定から呼び出される
 *
 * @description
 * このバッチ処理により、会計修正は当日20時まで可能となり、
 * 20時以降は確定された会計データが売上表に転載される。
 * これにより、会計処理時の売上ログ記録が不要になり、
 * 何度修正しても売上表に影響がない運用が実現できる。
 */
export function dailySalesTransferBatch() {
  try {
    Logger.log(`[dailySalesTransferBatch] 開始: ${new Date().toISOString()}`);

    // 引数なしで呼び出すと当日の売上を転載
    const result = transferSalesLogByDate();

    Logger.log(
      `[dailySalesTransferBatch] 完了: 予約${result.totalCount}件, 成功${result.successCount}件`,
    );
  } catch (err) {
    const errorMessage = `売上表転載バッチ処理でエラーが発生しました: ${err.message}`;
    Logger.log(`[dailySalesTransferBatch] エラー: ${errorMessage}`);
    handleError(errorMessage, false);
  }
}
