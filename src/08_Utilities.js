/**
 * =================================================================
 * 【ファイル名】: 08_Utilities.gs
 * 【バージョン】: 2.0
 * 【役割】: プロジェクト全体で利用される、業務ドメインに依存しない
 * 汎用的なヘルパー関数を格納します。
 * 【構成】: 10ファイル構成のうちの8番目
 * 【v2.0での変更点】:
 * - ARC-11: WebAppのファイルをインクルードするための include() ヘルパー関数を追加。
 * =================================================================
 */

/**
 * ヘッダー行の配列から、ヘッダー名をキー、列インデックス(0-based)を値とするマップを作成します。
 * @param {string[]} headerRow - ヘッダーの行データ
 * @returns {Map<string, number>}
 */
function createHeaderMap(headerRow) {
  const map = new Map();
  headerRow.forEach((c, i) => {
    if (c && typeof c === 'string') {
      map.set(c.trim(), i);
    }
  });
  return map;
}

/**
 * 指定された日付が、指定されたオプション（期間や特定日）に合致するかを判定します。
 * @param {Date} rowDate - 判定対象のセルの日付
 * @param {string} timezone - スプレッドシートのタイムゾーン
 * @param {object} options - { endDate?: Date, targetDates?: Date[] }
 * @returns {boolean}
 */
function shouldProcessRowByDate(rowDate, timezone, options) {
  if (!(rowDate instanceof Date)) return false;
  const d = Utilities.formatDate(rowDate, timezone, 'yyyy/MM/dd');
  if (options.endDate) {
    return new Date(d) <= new Date(Utilities.formatDate(options.endDate, timezone, 'yyyy/MM/dd'));
  }
  if (options.targetDates) {
    return options.targetDates
      .map((dt) => Utilities.formatDate(dt, timezone, 'yyyy/MM/dd'))
      .includes(d);
  }
  return true; // オプションがなければ常にtrue
}

/**
 * エラーまたは情報メッセージをログとUIに表示します。
 * @param {string} message - 表示するメッセージ
 * @param {boolean} isError - エラーかどうか
 */
function handleError(message, isError) {
  const logMessage = isError ? `エラー: ${message}` : `情報: ${message}`;
  Logger.log(logMessage);
  if (isError) {
    // isErrorがtrueの場合、ログと通知を行う
    const userEmail = Session.getActiveUser() ? Session.getActiveUser().getEmail() : 'system';
    logActivity(userEmail, 'N/A', 'SYSTEM_ERROR', 'FAILURE', message);
    sendAdminNotification('予約システムでエラーが発生しました', `エラー詳細:\n\n${message}`);
  }
  try {
    SpreadsheetApp.getUi().alert(
      isError ? 'エラー' : '完了',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } catch (e) {
    // UIが使えない環境（例：トリガー実行時）では何もしない
  }
}

/**
 * 指定された列の特定の値を持つ行のインデックスを見つけます。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {number} col - 検索対象の列番号 (1-based)
 * @param {*} value - 検索する値
 * @returns {number} - 見つかった行のインデックス (1-based)。見つからない場合は-1。
 */
function findRowIndexByValue(sheet, col, value) {
  if (sheet.getLastRow() < RESERVATION_DATA_START_ROW) return -1;
  const allValues = sheet
    .getRange(
      RESERVATION_DATA_START_ROW,
      col,
      sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1,
      1,
    )
    .getValues();
  for (let i = 0; i < allValues.length; i++) {
    if (allValues[i][0] == value) {
      return i + RESERVATION_DATA_START_ROW;
    }
  }
  return -1;
}

/**
 * 特定の日付が含まれるデータブロックの最後の行を見つけます。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {Date} date - 対象の日付
 * @param {number} dateColIdx - 日付列のインデックス (0-based)
 * @returns {number} - 見つかった最後の行番号。見つからない場合は-1。
 */
function findLastRowOfDateBlock(sheet, date, dateColIdx) {
  const data = sheet
    .getRange(
      RESERVATION_DATA_START_ROW,
      dateColIdx + 1,
      sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1,
      1,
    )
    .getValues();
  const timezone = sheet.getParent().getSpreadsheetTimeZone();
  const targetDateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
  let lastRow = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    if (
      data[i][0] instanceof Date &&
      Utilities.formatDate(data[i][0], timezone, 'yyyy-MM-dd') === targetDateString
    ) {
      lastRow = i + RESERVATION_DATA_START_ROW;
      break;
    }
  }
  return lastRow;
}

/**
 * 【復活】罫線描画ライブラリを安全に呼び出すためのラッパー関数。
 * ライブラリが存在する場合のみ、その中の描画関数を実行します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 */
function formatSheetWithBordersSafely(sheet) {
  if (typeof drawBorders !== 'undefined') {
    try {
      drawBorders.formatSheetWithBorders(sheet);
    } catch (err) {
      Logger.log(
        `The 'drawBorders' library exists but failed to execute for sheet '${sheet.getName()}': ${err.message}`,
      );
    }
  }
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
  // 注意：この配列の順序は、実際の「売上ログ」シートの列の順序と一致させる必要があります。
  return [
    baseInfo.date, // 日付
    baseInfo.classroom, // 教室
    baseInfo.venue, // 会場
    baseInfo.studentId, // 生徒ID
    baseInfo.name, // 名前
    category, // 大項目 (授業料/物販)
    itemName, // 中項目 (商品名など)
    1, // 数量 (常に1として計上)
    price, // 金額
    baseInfo.paymentMethod, // 支払手段
  ];
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * アプリケーションのアクティビティをログシートに記録します。
 * ログシートが存在しない場合は自動的に作成します。
 * @param {string} userId - 操作を行ったユーザーのID。'N/A'も可。
 * @param {string} userName - 操作を行ったユーザーの名前。'N/A'も可。
 * @param {string} action - 操作の種類 (例: 'LOGIN_SUCCESS', 'RESERVATION_CREATE')。
 * @param {string} result - 操作の結果 ('SUCCESS' or 'FAILURE')。
 * @param {string} details - 操作の詳細情報。
 */
function logActivity(userId, userName, action, result, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET_NAME, 0); // 先頭にシートを作成
      logSheet.appendRow([
        'タイムスタンプ',
        'ユーザーID',
        'ユーザー名',
        'アクション',
        '結果',
        '詳細',
      ]);
      logSheet.setFrozenRows(1);
      logSheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
      logSheet.setColumnWidth(1, 150);
      logSheet.setColumnWidth(6, 400);
    }
    const timestamp = new Date();
    // appendRowは遅いことがあるため、insertRowとsetValuesを使う
    logSheet.insertRowAfter(1);
    logSheet
      .getRange(2, 1, 1, 6)
      .setValues([[timestamp, userId, userName, action, result, details]]);
  } catch (e) {
    Logger.log(`ログの記録に失敗しました: ${e.message}`);
    // ここでエラーが発生しても、メインの処理は続行させる
  }
}

/**
 * 管理者にメールで通知を送信します。
 * @param {string} subject - メールの件名。
 * @param {string} body - メールの本文。
 */
function sendAdminNotification(subject, body) {
  try {
    if (!ADMIN_EMAIL || ADMIN_EMAIL === 'your-admin-email@example.com') {
      Logger.log('管理者メールアドレスが設定されていないため、通知をスキップしました。');
      return;
    }
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: `[予約システム通知] ${subject}`,
      body: body,
    });
  } catch (e) {
    Logger.log(`管理者への通知メール送信に失敗しました: ${e.message}`);
  }
}
