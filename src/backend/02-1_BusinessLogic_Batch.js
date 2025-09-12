/**
 * =================================================================
 * 【ファイル名】: 02-1_BusinessLogic_Batch.gs
 * 【バージョン】: 1.1
 * 【役割】: メニューから手動で実行される、重いバッチ処理を集約します。
 * - 過去予約のアーカイブ処理
 * - 売上データの集計と転記
 * 【構成】: 14ファイル構成のうちの3番目
 * 【v1.1での変更点】:
 * - NF-11: 予約アーカイブ時に、名簿の「きろく」キャッシュを更新する
 * updateRosterWithRecordCache() を呼び出すように変更。
 * ===================================================================
 */

/**
 * 【開発用】テスト環境をセットアップします。
 * 現在のスプレッドシートをコピーし、テスト用の新しい環境を作成します。
 */
function setupTestEnvironment() {
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
    getActiveSpreadsheet().toast('テスト環境を作成中です...', '処理中', -1);

    const sourceSpreadsheet = getActiveSpreadsheet();
    const sourceFile = DriveApp.getFileById(sourceSpreadsheet.getId());

    // 1. スプレッドシートをコピー
    const newFileName = `【テスト用】${sourceSpreadsheet.getName()}`;
    const copiedFile = sourceFile.makeCopy(newFileName);
    const copiedSpreadsheet = SpreadsheetApp.openById(copiedFile.getId());

    // 2. コピーしたスプレッドシートの情報を取得
    const newUrl = copiedSpreadsheet.getUrl();
    const newId = copiedSpreadsheet.getId();

    getActiveSpreadsheet().toast('テスト環境の作成が完了しました。', '完了', 5);

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
 * 【移行用】データモデル再設計に基づき、統合予約シートを作成する。
 */
function createIntegratedSheet() {
  const ss = getActiveSpreadsheet();
  const sheetName = '統合予約シート';

  if (ss.getSheetByName(sheetName)) {
    ss.toast(`シート「${sheetName}」は既に存在します。`, '情報', 5);
    return;
  }

  try {
    const newSheet = ss.insertSheet(sheetName);
    const headers = [
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
      CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
      CONSTANTS.HEADERS.RESERVATIONS.DATE,
      CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM,
      CONSTANTS.HEADERS.RESERVATIONS.VENUE,
      CONSTANTS.HEADERS.RESERVATIONS.START_TIME,
      CONSTANTS.HEADERS.RESERVATIONS.END_TIME,
      CONSTANTS.HEADERS.RESERVATIONS.STATUS,
      CONSTANTS.HEADERS.RESERVATIONS.CHISEL_RENTAL,
      CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE,
      CONSTANTS.HEADERS.RESERVATIONS.TRANSPORTATION,
      CONSTANTS.HEADERS.RESERVATIONS.PICKUP,
      CONSTANTS.HEADERS.RESERVATIONS.WORK_IN_PROGRESS,
      CONSTANTS.HEADERS.RESERVATIONS.ORDER,
      CONSTANTS.HEADERS.RESERVATIONS.MESSAGE_TO_TEACHER,
      CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
    ];

    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    newSheet.setFrozenRows(1);

    // 列幅の調整（任意）
    newSheet.setColumnWidths(1, headers.length, 120);
    newSheet.setColumnWidth(1, 150); // 予約ID
    newSheet.setColumnWidth(2, 150); // 生徒ID
    newSheet.setColumnWidth(3, 100); // 日付
    newSheet.setColumnWidth(4, 100); // 教室
    newSheet.setColumnWidth(13, 200); // 制作メモ
    newSheet.setColumnWidth(15, 200); // メッセージ
    newSheet.setColumnWidth(16, 300); // 会計詳細

    ss.toast(`シート「${sheetName}」を正常に作成しました。`, '成功', 5);
    logActivity('system', '移行作業', '成功', '統合予約シートを作成しました。');
  } catch (e) {
    handleError(
      `統合予約シートの作成中にエラーが発生しました: ${e.message}`,
      true,
    );
  }
}

/**
 * 【移行用】既存の教室別シートから統合予約シートへデータを移行する。
 */
function migrateDataToIntegratedSheet() {
  const ss = getActiveSpreadsheet();
  const integratedSheetName = '統合予約シート';
  const integratedSheet = ss.getSheetByName(integratedSheetName);

  if (!integratedSheet) {
    handleError(
      `エラー: シート「${integratedSheetName}」が見つかりません。先に作成してください。`,
      true,
    );
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'データ移行の確認',
    `「${integratedSheetName}」の既存データをクリアし、教室別シートからデータを移行します。この操作は元に戻せません。よろしいですか？`,
    ui.ButtonSet.OK_CANCEL,
  );

  if (response !== ui.Button.OK) {
    ss.toast('データ移行をキャンセルしました。', '情報', 5);
    return;
  }

  try {
    ss.toast('データ移行を開始します...', '処理中', -1);

    // 統合シートの既存データをクリア（ヘッダーは残す）
    if (integratedSheet.getLastRow() > 1) {
      integratedSheet
        .getRange(
          2,
          1,
          integratedSheet.getLastRow() - 1,
          integratedSheet.getLastColumn(),
        )
        .clearContent();
    }

    const allMigratedRows = [];

    [
      CONSTANTS.CLASSROOMS.TOKYO,
      CONSTANTS.CLASSROOMS.NUMAZU,
      CONSTANTS.CLASSROOMS.TSUKUBA,
      'old東京',
      'oldつくば',
      'old沼津',
    ].forEach(sheetName => {
      const sourceSheet = ss.getSheetByName(sheetName);
      if (!sourceSheet) {
        Logger.log(
          `シート「${sheetName}」が見つからないため、スキップします。`,
        );
        return;
      }

      const lastRow = sourceSheet.getLastRow();
      if (lastRow < RESERVATION_DATA_START_ROW) return; // データなし

      const sourceData = sourceSheet
        .getRange(
          RESERVATION_DATA_START_ROW,
          1,
          lastRow - 1,
          sourceSheet.getLastColumn(),
        )
        .getValues();
      const sourceHeaderMap = createHeaderMap(
        sourceSheet
          .getRange(1, 1, 1, sourceSheet.getLastColumn())
          .getValues()[0],
      );

      sourceData.forEach(row => {
        // 名前列が空の行は、空の予約枠とみなしスキップする
        const name = row[sourceHeaderMap.get('名前')];
        if (!name) {
          return;
        }

        const statusValue = row[sourceHeaderMap.get('人数')];
        let status = '確定';
        if (isNaN(parseInt(statusValue, 10))) {
          status = statusValue; // waiting, cancelなど
        }

        // "初講"列の特別処理（古いデータ用）
        let firstLectureValue =
          row[
            sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE)
          ];
        // 古いシートで"初講"列が存在する場合のフォールバック
        if (!firstLectureValue && sourceHeaderMap.get('初講')) {
          firstLectureValue = row[sourceHeaderMap.get('初講')];
        }

        const migratedRow = [
          row[
            sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID)
          ] || '',
          row[sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID)] ||
            '',
          row[sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.DATE)] || null,
          sheetName, // 教室
          row[sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.VENUE)] || '',
          row[sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.START_TIME)] ||
            null,
          row[sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.END_TIME)] ||
            null,
          status, // ステータス
          row[
            sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.CHISEL_RENTAL)
          ] || false,
          firstLectureValue || false, // 初回受講（"初講"からのマッピング含む）
          '', // 来場手段 (旧シートにないため空)
          '', // 送迎 (旧シートにないため空)
          row[
            sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.WORK_IN_PROGRESS)
          ] || '',
          row[sourceHeaderMap.get(CONSTANTS.HEADERS.RESERVATIONS.ORDER)] || '',
          row[
            sourceHeaderMap.get(
              CONSTANTS.HEADERS.RESERVATIONS.MESSAGE_TO_TEACHER,
            )
          ] || '',
          row[
            sourceHeaderMap.get(
              CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
            )
          ] ||
            row[sourceHeaderMap.get('会計詳細')] ||
            '', // 会計詳細（フォールバック含む）
        ];
        allMigratedRows.push(migratedRow);
      });
    });

    if (allMigratedRows.length > 0) {
      integratedSheet
        .getRange(2, 1, allMigratedRows.length, allMigratedRows[0].length)
        .setValues(allMigratedRows);
      ss.toast(
        `全${allMigratedRows.length}件の予約データを「${integratedSheetName}」に移行しました。`,
        '成功',
        10,
      );
      logActivity(
        'system',
        '移行作業',
        '成功',
        `統合予約シートへ${allMigratedRows.length}件のデータを移行しました。`,
      );
    } else {
      ss.toast('移行対象のデータが見つかりませんでした。', '情報', 5);
    }
  } catch (e) {
    handleError(`データ移行中にエラーが発生しました: ${e.message}`, true);
  }
}

/**
 * 【移行用】移行したデータの整合性をチェックする。
 */
function verifyMigratedData() {
  const ss = getActiveSpreadsheet();
  const integratedSheetName = '統合予約シート';
  const integratedSheet = ss.getSheetByName(integratedSheetName);

  if (!integratedSheet) {
    handleError(
      `エラー: シート「${integratedSheetName}」が見つかりません。`,
      true,
    );
    return;
  }

  try {
    ss.toast('データ整合性チェックを開始します...', '処理中', -1);

    // 1. 元のシートの予約件数をカウント
    let originalCount = 0;
    [
      CONSTANTS.CLASSROOMS.TOKYO,
      CONSTANTS.CLASSROOMS.NUMAZU,
      CONSTANTS.CLASSROOMS.TSUKUBA,
      'old東京',
      'oldつくば',
      'old沼津',
    ].forEach(sheetName => {
      const sourceSheet = ss.getSheetByName(sheetName);
      if (!sourceSheet) return;

      const lastRow = sourceSheet.getLastRow();
      if (lastRow < RESERVATION_DATA_START_ROW) return;

      const sourceHeaderMap = createHeaderMap(
        sourceSheet
          .getRange(1, 1, 1, sourceSheet.getLastColumn())
          .getValues()[0],
      );
      const nameColIdx = sourceHeaderMap.get('名前');
      if (nameColIdx === undefined) return;

      const names = sourceSheet
        .getRange(RESERVATION_DATA_START_ROW, nameColIdx + 1, lastRow - 1, 1)
        .getValues();
      originalCount += names.filter(name => name[0] !== '').length;
    });

    // 2. 統合シートの予約件数をカウント
    const integratedCount = integratedSheet.getLastRow() - 1;

    // 3. 結果を比較して表示
    let message = `データ整合性チェック完了\n\n`;
    message += `元の教室シートの合計予約件数: ${originalCount}件\n`;
    message += `統合予約シートの件数: ${integratedCount}件\n\n`;

    if (originalCount === integratedCount) {
      message += '✅ 件数は一致しており、正常に移行された可能性が高いです。';
      logActivity('system', '移行データ検証', '成功', message);
      SpreadsheetApp.getUi().alert(
        '整合性チェック: 成功',
        message,
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
    } else {
      message +=
        '❌ 件数が一致しません。データが正常に移行されていない可能性があります。\nもう一度移行を試すか、手動で確認してください。';
      logActivity('system', '移行データ検証', '失敗', message);
      SpreadsheetApp.getUi().alert(
        '整合性チェック: 失敗',
        message,
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
    }
  } catch (e) {
    handleError(
      `データ整合性チェック中にエラーが発生しました: ${e.message}`,
      true,
    );
  }
}
