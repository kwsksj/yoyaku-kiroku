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
      .map(dt => Utilities.formatDate(dt, timezone, 'yyyy/MM/dd'))
      .includes(d);
  }
  return true; // オプションがなければ常にtrue
}

/**
 * エラーまたは情報メッセージをログとUIに表示します。
 * @param {string} message - 表示する
 * @param {boolean} isError - エラーかどうか
 */
function handleError(message, isError) {
  const logMessage = isError ? `エラー: ${message}` : `情報: ${message}`;
  Logger.log(logMessage);
  if (isError) {
    // isErrorがtrueの場合、ログと通知を行う
    const userEmail = Session.getActiveUser() ? Session.getActiveUser().getEmail() : 'system';
    logActivity(userEmail, 'システムエラー', '失敗', message);
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
  const timezone = getSpreadsheetTimezone();
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
 * 新しい行は常に2行目に挿入されます。
 * 本名とニックネームはスプレッドシートのARRAYFORMULAによって自動的に表示されます。
 * @param {string} userId - 操作を行ったユーザーのID。'system'なども可。
 * @param {string} action - 操作の種類 (日本語推奨)。
 * @param {string} result - 操作の結果 ('成功' or '失敗')。
 * @param {string} details - 操作の詳細情報。
 */
function logActivity(userId, action, result, details) {
  try {
    const ss = getActiveSpreadsheet();
    const logSheet = ss.getSheetByName('アクティビティログ');
    // シートや数式が未設定の場合は、エラーを出さずに処理を中断する
    if (!logSheet) {
      console.log('ログシートが見つかりません。処理をスキップしました。');
      return;
    }

    logSheet.insertRowAfter(1); // 常にヘッダーの直下(2行目)に行を挿入
    const timestamp = new Date();
    // A, B, E, F, G列に値を設定。C,D列は数式が自動計算するため書き込まない。
    logSheet.getRange('A2:G2').setValues([[timestamp, userId, '', '', action, result, details]]);
  } catch (e) {
    Logger.log(`ログの記録に失敗しました: ${e.message}`);
  }
}

/**
 * 管理者にメールで通知を送信します。
 * 現在のユーザーが管理者自身の場合は通知を送信しません。
 * @param {string} subject - メールの件名。
 * @param {string} body - メールの本文。
 */
function sendAdminNotification(subject, body) {
  try {
    if (!ADMIN_EMAIL || ADMIN_EMAIL === 'your-admin-email@example.com') {
      Logger.log('管理者メールアドレスが設定されていないため、通知をスキップしました。');
      return;
    }

    // 現在のユーザーが管理者自身の場合は通知をスキップ
    const currentUserEmail = Session.getActiveUser() ? Session.getActiveUser().getEmail() : null;
    if (currentUserEmail === ADMIN_EMAIL) {
      Logger.log('管理者自身の操作のため、通知をスキップしました。');
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

/**
 * アクティビティログシートに、定義済みの条件付き書式を一括で設定します。
 * F列は自身の値、G列はE列の値に基づいて背景色が設定されます。
 * 実行前に既存のルールはすべてクリアされるため、常に新しい状態でルールが適用されます。
 */
function setupConditionalFormattingForLogSheet() {
  const sheetName = 'アクティビティログ';
  const ss = getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(`シート「${sheetName}」が見つかりません。`);
    return;
  }

  // --- 書式ルールの定義 ---
  const colors = {
    lightGreen: COLOR_LIGHT_GREEN, // 成功
    lightRed: COLOR_LIGHT_RED, // 失敗・エラー
    lightBlue: COLOR_LIGHT_BLUE, // ユーザーの主要アクション
    lightOrange: COLOR_LIGHT_ORANGE, // 編集・変更系アクション
    lightPurple: '#d9d2e9', // システム・バッチ処理
  };

  const rules = [];

  // --- 「結果」列 (F列) のルール ---
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('成功')
      .setBackground(colors.lightGreen)
      .setRanges([sheet.getRange('F:F')])
      .build(),
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('失敗')
      .setBackground(colors.lightRed)
      .setRanges([sheet.getRange('F:F')])
      .build(),
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('エラー')
      .setBackground(colors.lightRed)
      .setRanges([sheet.getRange('F:F')])
      .build(),
  );

  // --- 「アクション」列 (E列) と「詳細」列 (G列) のルール定義 ---
  const actionRules = [
    {
      text: [
        'ログイン試行',
        '特殊ログイン試行',
        '電話番号なしユーザー検索',
        '新規ユーザー登録',
        '予約作成',
      ],
      color: colors.lightBlue,
    },
    {
      text: [
        'プロフィール更新',
        '予約詳細更新',
        '制作メモ更新',
        '予約キャンセル',
        '名簿編集',
        '予約シート編集',
        '行挿入',
      ],
      color: colors.lightOrange,
    },
    {
      text: [
        '会計記録保存',
        'バッチ処理(アーカイブ)',
        '手動ソート実行',
        'サマリー再構築',
        'カレンダー同期',
        '名簿キャッシュ更新',
        '履歴キャッシュ移行',
        '予約キャッシュ移行',
        'フォーム選択肢更新',
        'サマリー更新',
        'サマリー更新(トリガー)',
      ],
      color: colors.lightPurple,
    },
  ];

  actionRules.forEach(rule => {
    rule.text.forEach(text => {
      // 【E列用のルール】E列自身のテキストを評価します
      const ruleForE = SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(text)
        .setBackground(rule.color)
        .setRanges([sheet.getRange('E:E')]);
      rules.push(ruleForE.build());

      // 【G列用のルール】カスタム数式を使い、E列のテキストを評価します
      const formula = `=$E1="${text}"`;
      const ruleForG = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(formula) // 正しいメソッドを使用します
        .setBackground(rule.color)
        .setRanges([sheet.getRange('G:G')]);
      rules.push(ruleForG.build());
    });
  });

  // --- ルールの適用 ---
  sheet.clearConditionalFormatRules();
  sheet.setConditionalFormatRules(rules);

  SpreadsheetApp.getUi().alert('アクティビティログの条件付き書式を更新しました。');
}

// ===================================================================
// データ形式統一のためのユーティリティ関数群
// ===================================================================

/**
 * 配列形式の予約データをオブジェクト形式に変換
 * フロントエンドの transformReservationArrayToObject と同じロジック
 * @param {Array} resArray - 配列形式の予約データ
 * @returns {Object|null} オブジェクト形式の予約データ
 */
function transformReservationArrayToObject(resArray) {
  if (!Array.isArray(resArray) || resArray.length < 15) {
    return null;
  }

  const [
    reservationId,
    studentId,
    date,
    classroom,
    venue,
    startTime,
    endTime,
    status,
    chiselRental,
    firstLecture,
    _,
    __,
    workInProgress,
    order,
    message, // 来場手段, 送迎はまだ使わないのでスキップ
  ] = resArray;

  return {
    reservationId,
    studentId,
    date,
    classroom,
    venue,
    startTime,
    endTime,
    status,
    chiselRental,
    firstLecture,
    workInProgress,
    order,
    messageToTeacher: message,
  };
}

/**
 * 統一されたAPIレスポンス形式を作成
 * 注: この関数は 08_ErrorHandler.js の createApiResponse に統合されました
 * より包括的なエラーハンドリングと統一性のため、そちらを使用してください
 */
// createApiResponse 関数は 08_ErrorHandler.js に移動されました

/**
 * 特定ユーザーの予約データをフィルタリング
 * @param {Array} allReservations - 全予約データ（配列形式）
 * @param {string} studentId - 生徒ID
 * @param {string} today - 今日の日付（YYYY-MM-DD）
 * @returns {Object} フィルタリングされたユーザーデータ
 */
function filterUserReservations(allReservations, studentId, today) {
  const myBookings = [];
  const myHistory = [];

  if (Array.isArray(allReservations)) {
    allReservations.forEach(resArray => {
      const resObj = transformReservationArrayToObject(resArray);
      if (resObj && resObj.studentId === studentId && resObj.status !== STATUS_CANCEL) {
        if (resObj.date >= today) {
          myBookings.push(resObj);
        } else {
          myHistory.push(resObj);
        }
      }
    });
  }

  return {
    myBookings: myBookings.sort((a, b) => a.date.localeCompare(b.date)),
    myHistory: myHistory.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
