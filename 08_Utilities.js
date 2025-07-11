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
        return options.targetDates.map(dt => Utilities.formatDate(dt, timezone, 'yyyy/MM/dd')).includes(d);
    }
    return true; // オプションがなければ常にtrue
}

/**
 * エラーまたは情報メッセージをログとUIに表示します。
 * @param {string} message - 表示するメッセージ
 * @param {boolean} isError - エラーかどうか
 */
function handleError(message, isError) {
    Logger.log(isError ? `エラー: ${message}` : `情報: ${message}`);
    try {
        SpreadsheetApp.getUi().alert(isError ? 'エラー' : '完了', message, SpreadsheetApp.getUi().ButtonSet.OK);
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
    const allValues = sheet.getRange(RESERVATION_DATA_START_ROW, col, sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1, 1).getValues();
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
    const data = sheet.getRange(RESERVATION_DATA_START_ROW, dateColIdx + 1, sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1, 1).getValues();
    const timezone = sheet.getParent().getSpreadsheetTimeZone();
    const targetDateString = Utilities.formatDate(date, timezone, "yyyy-MM-dd");
    let lastRow = -1;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][0] instanceof Date && Utilities.formatDate(data[i][0], timezone, "yyyy-MM-dd") === targetDateString) {
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
      Logger.log(`The 'drawBorders' library exists but failed to execute for sheet '${sheet.getName()}': ${err.message}`);
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
    baseInfo.date,          // 日付
    baseInfo.classroom,     // 教室
    baseInfo.venue,         // 会場
    baseInfo.studentId,     // 生徒ID
    baseInfo.name,          // 名前
    category,               // 大項目 (授業料/物販)
    itemName,               // 中項目 (商品名など)
    1,                      // 数量 (常に1として計上)
    price,                  // 金額
    baseInfo.paymentMethod  // 支払手段
  ];
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}