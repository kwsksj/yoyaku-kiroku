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
 * =================================================================
 */

// --- メニューからの処理実行 ---

/** 昨日までのデータを処理します */
function processYesterdayData() {
  processReservations('yesterday');
}

/** 今日のデータを処理します */
function processTodayData() {
  processReservations('today');
}

/** 最も古い日付のデータを処理します */
function processOldestDate() {
  processReservations('oldest');
}

/**
 * 予約処理のメイン関数。過去の予約をアーカイブし、売上データを転記する。
 * @param {string} mode - 'yesterday', 'today', 'oldest' のいずれか
 */
function processReservations(mode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const activeSheetName = activeSheet.getName();
  if (!CLASSROOM_SHEET_NAMES.includes(activeSheetName)) {
    handleError(`エラー：アクティブなシート「${activeSheetName}」は処理対象外です。`, true);
    return;
  }
  let options = {};
  if (mode === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(23, 59, 59, 999);
    options = { endDate: d };
  } else if (mode === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    options = { targetDates: [d] };
  } else if (mode === 'oldest') {
    const oldestDate = activeSheet.getRange(RESERVATION_DATA_START_ROW, 2).getValue();
    if (!(oldestDate instanceof Date)) {
      handleError('エラー：2行目の日付列に有効な日付が見つかりませんでした。', true);
      return;
    }
    options = { targetDates: [oldestDate] };
  }

  const rowsToDelete = transferPastReservationsToArchive({ sheet: activeSheet, ...options });
  if (rowsToDelete.length > 0) {
    deleteProcessedReservations(activeSheet, rowsToDelete);
    logActivity(
      'system',
      'system',
      'ARCHIVE_BATCH',
      'SUCCESS',
      `シート: ${activeSheetName}, 処理件数: ${rowsToDelete.length}`,
    );
  }
  handleError(`${mode} のデータ処理が完了しました。`, false);
}

/**
 * アーカイブデータから会計情報を抽出し、売上ログに転記する。
 * @param {Array<Array<any>>} archivedData - アーカイブ対象の行データ配列
 * @param {Map<string, number>} headerMap - 予約シートのヘッダーマップ
 * @param {string} classroomName - 教室名
 */
function logSalesFromArchivedData(archivedData, headerMap, classroomName) {
  const salesSpreadsheet = SpreadsheetApp.openById(SALES_SPREADSHEET_ID);
  const salesSheet = salesSpreadsheet.getSheetByName('売上ログ');
  if (!salesSheet) {
    Logger.log('売上スプレッドシートに「売上ログ」シートが見つかりません。');
    return;
  }

  const accountingColIdx = headerMap.get(HEADER_ACCOUNTING_DETAILS);
  const dateColIdx = headerMap.get(HEADER_DATE);
  const nameColIdx = headerMap.get(HEADER_NAME);
  const studentIdColIdx = headerMap.get(HEADER_STUDENT_ID);
  const venueColIdx = headerMap.get(HEADER_VENUE);

  if (accountingColIdx === undefined) return;

  const rowsToTransfer = [];
  archivedData.forEach((row) => {
    const jsonStr = row[accountingColIdx];
    if (jsonStr && typeof jsonStr === 'string') {
      try {
        const details = JSON.parse(jsonStr);
        const baseInfo = {
          date: row[dateColIdx],
          studentId: row[studentIdColIdx],
          name: row[nameColIdx],
          classroom: classroomName,
          venue: row[venueColIdx] || '',
          paymentMethod: details.paymentMethod || '不明',
        };

        if (details.tuition && details.tuition.items) {
          details.tuition.items.forEach((item) => {
            rowsToTransfer.push(createSalesRow(baseInfo, '授業料', item.name, item.price));
          });
        }
        if (details.sales && details.sales.items) {
          details.sales.items.forEach((item) => {
            rowsToTransfer.push(createSalesRow(baseInfo, '物販', item.name, item.price));
          });
        }
      } catch (e) {
        Logger.log(`売上ログ転記中のJSON解析エラー: ${e.message}`);
      }
    }
  });

  if (rowsToTransfer.length > 0) {
    salesSheet
      .getRange(salesSheet.getLastRow() + 1, 1, rowsToTransfer.length, rowsToTransfer[0].length)
      .setValues(rowsToTransfer);
  }
}

/**
 * 過去の予約をアーカイブシートに移動し、売上データと名簿情報を更新する。
 * @param {object} options - 処理オプション
 * @returns {Array<number>} 削除対象の行インデックス配列
 */
function transferPastReservationsToArchive(options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = options.sheet;
  const archiveSheetName = HEADER_ARCHIVE_PREFIX + activeSheet.getName().slice(0, -2);
  const archiveSheet = ss.getSheetByName(archiveSheetName);
  if (!archiveSheet) return [];

  const lastRow = activeSheet.getLastRow();
  if (lastRow < RESERVATION_DATA_START_ROW) return [];

  const allData = activeSheet
    .getRange(
      RESERVATION_DATA_START_ROW,
      1,
      lastRow - RESERVATION_DATA_START_ROW + 1,
      activeSheet.getLastColumn(),
    )
    .getValues();
  const sourceHeaderMap = createHeaderMap(
    activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0],
  );
  const dateColIdx = sourceHeaderMap.get(HEADER_DATE);
  if (dateColIdx === undefined) return [];

  const rowsToDeleteIndices = [];
  const timezone = ss.getSpreadsheetTimeZone();
  const rowsToArchive = allData.filter((row, index) => {
    if (shouldProcessRowByDate(row[dateColIdx], timezone, options)) {
      rowsToDeleteIndices.push(RESERVATION_DATA_START_ROW + index);
      return true;
    }
    return false;
  });

  if (rowsToArchive.length > 0) {
    // 1. 売上ログに転記
    logSalesFromArchivedData(rowsToArchive, sourceHeaderMap, activeSheet.getName());

    // 2. アーカイブシートに転記
    archiveSheet
      .getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
      .setValues(rowsToArchive);
    formatSheetWithBordersSafely(archiveSheet);

    // 3. 【NF-11】名簿の「きろく」キャッシュを更新
    updateRosterWithRecordCache(rowsToArchive, sourceHeaderMap, activeSheet.getName());

    // 4. 【NF-12】アーカイブされた予約の「よやくキャッシュ」を更新
    const studentIdColIdx = sourceHeaderMap.get(HEADER_STUDENT_ID);
    if (studentIdColIdx !== undefined) {
      const uniqueStudentIds = [
        ...new Set(rowsToArchive.map((row) => row[studentIdColIdx]).filter((id) => id)),
      ];
      uniqueStudentIds.forEach((studentId) => {
        _rebuildFutureBookingsCacheForStudent(studentId);
      });
    }

    // 5. 【サマリー更新】アーカイブされた予約の日付のサマリーを更新
    const uniqueDateAndClassroom = new Map();
    const classroomName = activeSheet.getName();

    rowsToArchive.forEach((row) => {
      const date = row[dateColIdx];
      if (date instanceof Date) {
        const dateString = Utilities.formatDate(date, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
        const key = `${dateString}|${classroomName}`;
        if (!uniqueDateAndClassroom.has(key)) {
          uniqueDateAndClassroom.set(key, { date: date, classroom: classroomName });
        }
      }
    });
    uniqueDateAndClassroom.forEach((item) => updateSummaryAndForm(item.classroom, item.date));
  }
  return rowsToDeleteIndices;
}

/**
 * アーカイブされた予約データに基づき、生徒名簿の「きろく」キャッシュを更新する。
 * @param {Array<Array<any>>} archivedData - アーカイブされた行のデータ配列。
 * @param {Map<string, number>} reservationHeaderMap - 予約シートのヘッダーマップ。
 * @param {string} classroomName - 教室名
 */
function updateRosterWithRecordCache(archivedData, reservationHeaderMap, classroomName) {
  const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
  if (!rosterSheet || archivedData.length === 0) return;

  const rosterHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
  const rosterHeaderMap = createHeaderMap(rosterHeader);
  const rosterDataRange = rosterSheet.getRange(
    2,
    1,
    rosterSheet.getLastRow() - 1,
    rosterSheet.getLastColumn(),
  );
  const rosterValues = rosterDataRange.getValues();

  const studentIdColRoster = rosterHeaderMap.get(HEADER_STUDENT_ID);
  if (studentIdColRoster === undefined) return;

  // 生徒IDをキーとして、行のインデックスをマップ化（高速化のため）
  const rosterRowIndexMap = new Map();
  rosterValues.forEach((row, index) => {
    rosterRowIndexMap.set(row[studentIdColRoster], index);
  });

  // アーカイブデータを生徒IDと年でグループ化
  const studentIdColRes = reservationHeaderMap.get(HEADER_STUDENT_ID);
  const dateColRes = reservationHeaderMap.get(HEADER_DATE);
  const venueColRes = reservationHeaderMap.get(HEADER_VENUE);
  const wipColRes = reservationHeaderMap.get(HEADER_WORK_IN_PROGRESS);
  const resIdColRes = reservationHeaderMap.get(HEADER_RESERVATION_ID);
  const accColRes = reservationHeaderMap.get(HEADER_ACCOUNTING_DETAILS);

  // 日付の降順でソートし、最新のメモが優先されるようにする
  archivedData.sort((a, b) => new Date(b[dateColRes]) - new Date(a[dateColRes]));

  for (const row of archivedData) {
    const studentId = row[studentIdColRes];
    const date = row[dateColRes];

    if (!studentId || !(date instanceof Date)) continue;

    const year = date.getFullYear();
    const colName = `きろく_${year}`;
    let recordColIdx = rosterHeaderMap.get(colName);

    // 年の列がなければ追加
    if (recordColIdx === undefined) {
      rosterSheet.insertColumnAfter(rosterSheet.getLastColumn());
      recordColIdx = rosterSheet.getLastColumn() - 1;
      rosterSheet.getRange(1, recordColIdx + 1).setValue(colName);
      rosterHeaderMap.set(colName, recordColIdx); // マップも更新
    }

    const rowIndex = rosterRowIndexMap.get(studentId);
    if (rowIndex !== undefined) {
      const archiveSheetName = HEADER_ARCHIVE_PREFIX + classroomName.slice(0, -2);
      const newRecord = {
        reservationId: row[resIdColRes] || '',
        sheetName: archiveSheetName,
        date: Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        classroom: classroomName,
        venue: row[venueColRes] || '',
        workInProgress: row[wipColRes] || '',
        accountingDetails: row[accColRes] || null,
      };

      const cell = rosterSheet.getRange(rowIndex + 2, recordColIdx + 1);
      const existingJson = cell.getValue();
      let records = [];
      if (existingJson) {
        try {
          records = JSON.parse(existingJson);
        } catch (e) {
          /* JSONが不正な場合は新しい配列で上書き */
        }
      }

      // 重複チェック（同じ日付の記録は追加しない）
      if (!records.some((r) => r.date === newRecord.date)) {
        records.push(newRecord);
        records.sort((a, b) => new Date(b.date) - new Date(a.date)); // 日付の降順でソート
        cell.setValue(JSON.stringify(records));
      }
    }
  }
}

/**
 * 処理済みの予約行をシートから削除します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のシート
 * @param {Array<number>} rowsToDelete - 削除対象の行番号の配列
 */
function deleteProcessedReservations(sheet, rowsToDelete) {
  rowsToDelete
    .sort((a, b) => b - a)
    .forEach((rowIndex) => {
      try {
        sheet.deleteRow(rowIndex);
      } catch (e) {
        Logger.log(`行 ${rowIndex} の削除中にエラー: ${e.message}`);
      }
    });
}

/**
 * 売上表に書き込むための単一の行データを作成する。
 * @param {object} baseInfo - 日付、名前などの基本情報。
 * @param {string} category - '授業料' or '物販'
 * @param {string} itemName - 商品名や授業内容。
 * @param {number} price - 金額。
 * @returns {Array} 売上表の1行分の配列。
 */
function createSalesRow(baseInfo, category, itemName, price) {
  return [
    baseInfo.date,
    baseInfo.classroom,
    baseInfo.venue,
    baseInfo.studentId,
    baseInfo.name,
    category,
    itemName,
    1,
    price,
    baseInfo.paymentMethod,
  ];
}

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
    SpreadsheetApp.getActiveSpreadsheet().toast('テスト環境を作成中です...', '処理中', -1);

    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceFile = DriveApp.getFileById(sourceSpreadsheet.getId());

    // 1. スプレッドシートをコピー
    const newFileName = `【テスト用】${sourceSpreadsheet.getName()}`;
    const copiedFile = sourceFile.makeCopy(newFileName);
    const copiedSpreadsheet = SpreadsheetApp.openById(copiedFile.getId());

    // 2. コピーしたスプレッドシートの情報を取得
    const newUrl = copiedSpreadsheet.getUrl();
    const newId = copiedSpreadsheet.getId();

    SpreadsheetApp.getActiveSpreadsheet().toast('テスト環境の作成が完了しました。', '完了', 5);

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
    handleError(`テスト環境の作成中にエラーが発生しました: ${err.message}`, true);
  }
}
