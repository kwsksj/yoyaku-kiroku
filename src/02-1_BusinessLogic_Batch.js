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
 * =============================================    con    // 2. コピーしたスプレッドシートの情報を取得
    const newUrl = copiedSpreadsheet.getUrl();
    const newId = copiedSpreadsheet.getId();

    getActiveSpreadsheet().toast('テスト環境の作成が完了しました。', '完了', 5);

    // 3. ユーザーに情報を提示
    const htmlOutput = HtmlService.createHtmlOutput(
      `<h4>テスト環境のセットアップが完了しました</h4>
       <p>新しいテスト用スプレッドシートと、それに紐づくApps Scriptプロジェクトが作成されました。</p>`
    );
    const newUrl = copiedSpreadsheet.getUrl();
    const newId = copiedSpreadsheet.getId();

    getActiveSpreadsheet().toast('テスト環境の作成が完了しました。', '完了', 5);

    // 3. ユーザーに情報を提示
    const htmlOutput = HtmlService.createHtmlOutput(
      `<h4>テスト環境のセットアップが完了しました</h4>
       <p>新しいテスト用スプレッドシートと、それに紐づくApps Scriptプロジェクトが作成されました。</p>`
    );
=========== 
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
  const ss = getActiveSpreadsheet();
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
      'バッチ処理(アーカイブ)',
      '成功',
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
  archivedData.forEach(row => {
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
          details.tuition.items.forEach(item => {
            rowsToTransfer.push(createSalesRow(baseInfo, '授業料', item.name, item.price));
          });
        }
        if (details.sales && details.sales.items) {
          details.sales.items.forEach(item => {
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
  const ss = getActiveSpreadsheet();
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
  const timezone = getSpreadsheetTimezone();
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
        ...new Set(rowsToArchive.map(row => row[studentIdColIdx]).filter(id => id)),
      ];
      uniqueStudentIds.forEach(studentId => {
        _rebuildFutureBookingsCacheForStudent(studentId);
      });
    }

    // 5. 【サマリー更新】アーカイブされた予約の日付のサマリーを更新
    const uniqueDateAndClassroom = new Map();
    const classroomName = activeSheet.getName();

    rowsToArchive.forEach(row => {
      const date = row[dateColIdx];
      if (date instanceof Date) {
        const dateString = Utilities.formatDate(date, getSpreadsheetTimezone(), 'yyyy-MM-dd');
        const key = `${dateString}|${classroomName}`;
        if (!uniqueDateAndClassroom.has(key)) {
          uniqueDateAndClassroom.set(key, { date: date, classroom: classroomName });
        }
      }
    });
    // サマリーシート更新は廃止 (05-3_Backend_AvailableSlots.jsに置き換え)
    // uniqueDateAndClassroom.forEach(item => updateSummaryAndForm(item.classroom, item.date));
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
  const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
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
      if (!records.some(r => r.date === newRecord.date)) {
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
    .forEach(rowIndex => {
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
    handleError(`テスト環境の作成中にエラーが発生しました: ${err.message}`, true);
  }
}

/**
 * 【新規】毎日定刻に実行され、全教室の当日分予約シートを整理するトリガー用メイン関数
 */
function archiveTodaysLeftovers_trigger() {
  const allSheetNames = CLASSROOM_SHEET_NAMES; // グローバル定数を参照
  allSheetNames.forEach(sheetName => {
    try {
      const sheet = getSheetByName(sheetName);
      if (sheet) {
        _archiveTodaysLeftoversForSheet(sheet);
      }
    } catch (e) {
      logActivity(
        'system',
        '当日予約枠の自動整理',
        'エラー',
        `シート[${sheetName}]の処理中にエラーが発生: ${e.message}`,
      );
    }
  });
}

/**
 * 【新規】指定された1枚のシートに対して、当日分の不要な行を整理（削除またはアーカイブ）するコア関数
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 対象の予約シート
 */
function _archiveTodaysLeftoversForSheet(sheet) {
  const sheetName = sheet.getName();
  const lastRow = sheet.getLastRow();
  if (lastRow < RESERVATION_DATA_START_ROW) return; // 処理対象データなし

  // 1. アーカイブシートを準備
  const archiveSheetName = HEADER_ARCHIVE_PREFIX + sheetName.slice(0, -2);
  const archiveSheet = getSheetByName(archiveSheetName);
  if (!archiveSheet) {
    logActivity(
      'system',
      '当日予約枠の自動整理',
      '失敗',
      `アーカイブシート[${archiveSheetName}]が見つかりません。`,
    );
    return;
  }

  // 2. 必要な情報を一度に読み込む
  const fullDataRange = sheet.getRange(
    RESERVATION_DATA_START_ROW,
    1,
    lastRow - RESERVATION_DATA_START_ROW + 1,
    sheet.getLastColumn(),
  );
  const allData = fullDataRange.getValues();
  const headerMap = createHeaderMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);

  const dateColIdx = headerMap.get(HEADER_DATE);
  const nameColIdx = headerMap.get(HEADER_NAME);
  const statusColIdx = headerMap.get(HEADER_PARTICIPANT_COUNT);

  if (dateColIdx === undefined || nameColIdx === undefined || statusColIdx === undefined) {
    logActivity(
      'system',
      '当日予約枠の自動整理',
      '失敗',
      `シート[${sheetName}]の必須ヘッダーが見つかりません。`,
    );
    return;
  }

  const todayString = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const rowsToArchive = [];
  const rowNumbersToDelete = [];

  // 3. 安全のため、末尾から行をスキャンする
  for (let i = allData.length - 1; i >= 0; i--) {
    const row = allData[i];
    const rowDate = row[dateColIdx];

    if (
      rowDate instanceof Date &&
      Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd') === todayString
    ) {
      const currentPhysicalRow = i + RESERVATION_DATA_START_ROW;
      const name = row[nameColIdx];
      const status = String(row[statusColIdx]).toLowerCase();

      // ケース1: 空席の行
      if (!name) {
        rowNumbersToDelete.push(currentPhysicalRow);
      }
      // ケース2: キャンセルまたはキャンセル待ちの行
      else if (status === STATUS_CANCEL || status === STATUS_WAITING) {
        rowsToArchive.push(row); // アーカイブ対象としてデータを保持
        rowNumbersToDelete.push(currentPhysicalRow); // 削除対象として行番号を保持
      }
      // ケース3: 会計未処理の参加者の行は、このifブロックの条件に合致しないため、何もしない
    }
  }

  // 4. アーカイブ処理
  if (rowsToArchive.length > 0) {
    // データを日付の昇順に戻す
    rowsToArchive.reverse();
    archiveSheet
      .getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
      .setValues(rowsToArchive);
    logActivity(
      'system',
      '当日予約枠の自動整理',
      '成功',
      `シート[${sheetName}]から ${rowsToArchive.length} 件をアーカイブしました。`,
    );
  }

  // 5. 削除処理
  if (rowNumbersToDelete.length > 0) {
    // 行番号は既に降順になっているので、そのまま削除
    rowNumbersToDelete.forEach(rowNum => {
      sheet.deleteRow(rowNum);
    });
    logActivity(
      'system',
      '当日予約枠の自動整理',
      '成功',
      `シート[${sheetName}]から ${rowNumbersToDelete.length} 件の不要な行を削除しました。`,
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
      '予約ID',
      '生徒ID',
      '日付',
      '教室',
      '会場',
      '開始時刻',
      '終了時刻',
      'ステータス',
      '彫刻刻レンタル',
      '初講',
      '来場手段',
      '送迎',
      '制作メモ',
      'order',
      'メッセージ',
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

    ss.toast(`シート「${sheetName}」を正常に作成しました。`, '成功', 5);
    logActivity('system', '移行作業', '成功', '統合予約シートを作成しました。');
  } catch (e) {
    handleError(`統合予約シートの作成中にエラーが発生しました: ${e.message}`, true);
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
        .getRange(2, 1, integratedSheet.getLastRow() - 1, integratedSheet.getLastColumn())
        .clearContent();
    }

    const allMigratedRows = [];

    CLASSROOM_SHEET_NAMES.forEach(sheetName => {
      const sourceSheet = ss.getSheetByName(sheetName);
      if (!sourceSheet) {
        Logger.log(`シート「${sheetName}」が見つからないため、スキップします。`);
        return;
      }

      const lastRow = sourceSheet.getLastRow();
      if (lastRow < RESERVATION_DATA_START_ROW) return; // データなし

      const sourceData = sourceSheet
        .getRange(RESERVATION_DATA_START_ROW, 1, lastRow - 1, sourceSheet.getLastColumn())
        .getValues();
      const sourceHeaderMap = createHeaderMap(
        sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0],
      );

      sourceData.forEach(row => {
        // 名前列が空の行は、空の予約枠とみなしスキップする
        const name = row[sourceHeaderMap.get(HEADER_NAME)];
        if (!name) {
          return;
        }

        const statusValue = row[sourceHeaderMap.get(HEADER_PARTICIPANT_COUNT)];
        let status = '確定';
        if (isNaN(parseInt(statusValue, 10))) {
          status = statusValue; // waiting, cancelなど
        }

        const migratedRow = [
          row[sourceHeaderMap.get(HEADER_RESERVATION_ID)] || '',
          row[sourceHeaderMap.get(HEADER_STUDENT_ID)] || '',
          row[sourceHeaderMap.get(HEADER_DATE)] || null,
          sheetName, // 教室
          row[sourceHeaderMap.get(HEADER_VENUE)] || '',
          row[sourceHeaderMap.get(HEADER_START_TIME)] || null,
          row[sourceHeaderMap.get(HEADER_END_TIME)] || null,
          status, // ステータス
          row[sourceHeaderMap.get(HEADER_CHISEL_RENTAL)] || false,
          row[sourceHeaderMap.get(HEADER_FIRST_LECTURE)] || false,
          '', // 来場手段 (旧シートにないため空)
          '', // 送迎 (旧シートにないため空)
          row[sourceHeaderMap.get(HEADER_WORK_IN_PROGRESS)] || '',
          row[sourceHeaderMap.get(HEADER_ORDER)] || '',
          row[sourceHeaderMap.get(HEADER_MESSAGE_TO_TEACHER)] || '',
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
    handleError(`エラー: シート「${integratedSheetName}」が見つかりません。`, true);
    return;
  }

  try {
    ss.toast('データ整合性チェックを開始します...', '処理中', -1);

    // 1. 元のシートの予約件数をカウント
    let originalCount = 0;
    CLASSROOM_SHEET_NAMES.forEach(sheetName => {
      const sourceSheet = ss.getSheetByName(sheetName);
      if (!sourceSheet) return;

      const lastRow = sourceSheet.getLastRow();
      if (lastRow < RESERVATION_DATA_START_ROW) return;

      const sourceHeaderMap = createHeaderMap(
        sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0],
      );
      const nameColIdx = sourceHeaderMap.get(HEADER_NAME);
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
    handleError(`データ整合性チェック中にエラーが発生しました: ${e.message}`, true);
  }
}
