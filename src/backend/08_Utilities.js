/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/constants.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

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
 * エラーまたは情報メッセージをログとUIに表示します。
 * @param {string} message - 表示する
 * @param {boolean} isError - エラーかどうか
 */
function handleError(message, isError) {
  const logMessage = isError ? `エラー: ${message}` : `情報: ${message}`;
  Logger.log(logMessage);
  if (isError) {
    // isErrorがtrueの場合、ログと通知を行う
    const userEmail = Session.getActiveUser()
      ? Session.getActiveUser().getEmail()
      : 'system';
    logActivity(userEmail, 'システムエラー', '失敗', message);
    sendAdminNotification(
      '予約システムでエラーが発生しました',
      `エラー詳細:\n\n${message}`,
    );
  }
  try {
    SpreadsheetApp.getUi().alert(
      isError ? 'エラー' : '完了',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } catch {
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
 * 売上表に書き込むための単一の行データを作成する。
 * @param {SalesBaseInfo} baseInfo - 日付、名前などの基本情報。
 * @param {string} category - '授業料' or '物販'
 * @param {string} itemName - 商品名や授業内容。
 * @param {number} price - 金額。
 * @returns {SalesRowArray} 売上表の1行分の配列。
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
    logSheet
      .getRange('A2:G2')
      .setValues([[timestamp, userId, '', '', action, result, details]]);
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
      Logger.log(
        '管理者メールアドレスが設定されていないため、通知をスキップしました。',
      );
      return;
    }

    // 現在のユーザーが管理者自身の場合は通知をスキップ
    const currentUserEmail = Session.getActiveUser()
      ? Session.getActiveUser().getEmail()
      : null;
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
    lightGreen: '#d9ead3', // 成功
    lightRed: '#f4cccc', // 失敗・エラー
    lightBlue: '#cfe2f3', // ユーザーの主要アクション
    lightOrange: '#fce5cd', // 編集・変更系アクション
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

  SpreadsheetApp.getUi().alert(
    'アクティビティログの条件付き書式を更新しました。',
  );
}

// ===================================================================
// データ形式統一のためのユーティリティ関数群
// ===================================================================

/**
 * 配列形式の予約データをオブジェクト形式に変換
 * フロントエンドの transformReservationArrayToObject と同じロジック
 * @param {ReservationArrayData} resArray - 配列形式の予約データ
 * @returns {RawReservationObject|null} オブジェクト形式の予約データ（生データ）
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
    firstLecture, // 来場手段をスキップ
    ,
    ,
    // 送迎をスキップ
    workInProgress,
    order,
    message, // 先生へのメッセージ
  ] = resArray;

  return {
    reservationId: String(reservationId || ''),
    studentId: String(studentId || ''),
    date: date instanceof Date ? date : String(date || ''),
    classroom: String(classroom || ''),
    venue: String(venue || ''),
    startTime:
      startTime instanceof Date
        ? Utilities.formatDate(startTime, CONSTANTS.TIMEZONE, 'HH:mm')
        : String(startTime || ''),
    endTime:
      endTime instanceof Date
        ? Utilities.formatDate(endTime, CONSTANTS.TIMEZONE, 'HH:mm')
        : String(endTime || ''),
    status: String(status || ''),
    chiselRental: Boolean(chiselRental),
    firstLecture: Boolean(firstLecture),
    workInProgress: String(workInProgress || ''),
    order: String(order || ''),
    messageToTeacher: String(message || ''),
  };
}

/**
 * ヘッダーマップを使用して予約配列データをオブジェクトに変換します
 * @param {ReservationArrayData} resArray - 予約データの配列
 * @param {HeaderMapType} headerMap - ヘッダー名とインデックスのマッピング
 * @returns {RawReservationObject|null} - 変換された予約オブジェクト、失敗時はnull
 */
function transformReservationArrayToObjectWithHeaders(resArray, headerMap) {
  if (!Array.isArray(resArray) || !headerMap) {
    return transformReservationArrayToObject(resArray); // フォールバック
  }

  // ヘッダーマップから各フィールドのインデックスを取得
  // CacheServiceでシリアライゼーション後はMapオブジェクトが通常のオブジェクトになる可能性がある
  /**
   * @param {string} headerName
   * @returns {number|undefined}
   */
  const getIndex = headerName => {
    if (headerMap && typeof headerMap === 'object') {
      if (headerMap.get && typeof headerMap.get === 'function') {
        return /** @type {Map<string,number>} */ (headerMap).get(headerName);
      } else {
        return /** @type {Record<string,number>} */ (headerMap)[headerName];
      }
    }
    return undefined;
  };

  // デバッグ情報を追加
  const reservationIdIndex = getIndex(
    CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
  );
  const studentIdIndex = getIndex(CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID);
  const dateIndex = getIndex(CONSTANTS.HEADERS.RESERVATIONS.DATE);

  // インデックスが取得できているか確認
  if (
    reservationIdIndex === undefined ||
    studentIdIndex === undefined ||
    dateIndex === undefined
  ) {
    Logger.log(
      `ヘッダーマップエラー: reservationId=${reservationIdIndex}, studentId=${studentIdIndex}, date=${dateIndex}`,
    );

    // headerMapの型とプロパティを安全に確認
    if (headerMap && typeof headerMap === 'object') {
      if (headerMap.keys && typeof headerMap.keys === 'function') {
        const headerKeys = Array.from(headerMap.keys());
        Logger.log(`利用可能なヘッダー(Map): ${headerKeys.join(', ')}`);
        Logger.log(`ヘッダー数: ${headerKeys.length}`);
      } else {
        const headerKeys = Object.keys(headerMap);
        Logger.log(`利用可能なヘッダー(Object): ${headerKeys.join(', ')}`);
        Logger.log(`ヘッダー数: ${headerKeys.length}`);
        Logger.log(`ヘッダーマップ内容: ${JSON.stringify(headerMap)}`);
      }
    } else {
      Logger.log(
        `headerMapの型: ${typeof headerMap}, 値: ${JSON.stringify(headerMap)}`,
      );
    }

    // フォールバックとして従来の変換関数を使用
    return transformReservationArrayToObject(resArray);
  }

  return {
    reservationId: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID)] || '',
    ),
    studentId: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID)] || '',
    ),
    date: (() => {
      const dateValue = resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.DATE)];
      return dateValue instanceof Date ? dateValue : String(dateValue || '');
    })(),
    classroom: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM)] ||
        resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.VENUE)] ||
        '',
    ),
    venue: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.VENUE)] || '',
    ),
    startTime: (() => {
      const time =
        resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.START_TIME)];
      return time instanceof Date
        ? Utilities.formatDate(time, CONSTANTS.TIMEZONE, 'HH:mm')
        : String(time || '');
    })(),
    endTime: (() => {
      const time = resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.END_TIME)];
      return time instanceof Date
        ? Utilities.formatDate(time, CONSTANTS.TIMEZONE, 'HH:mm')
        : String(time || '');
    })(),
    status: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.STATUS)] || '',
    ),
    chiselRental: Boolean(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.CHISEL_RENTAL)],
    ),
    firstLecture: Boolean(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE)],
    ),
    workInProgress: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.WORK_IN_PROGRESS)] || '',
    ),
    order: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.ORDER)] || '',
    ),
    messageToTeacher: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.MESSAGE_TO_TEACHER)] ||
        '',
    ),
  };
}

/**
 * 生データの予約オブジェクトを正規化済みオブジェクトに変換
 * @param {RawReservationObject} rawReservation - 生データの予約オブジェクト
 * @returns {ReservationObject|null} 正規化済み予約オブジェクト
 */
function normalizeReservationObject(rawReservation) {
  if (!rawReservation) return null;

  try {
    return {
      reservationId: String(rawReservation.reservationId || ''),
      studentId: String(rawReservation.studentId || ''),
      date:
        rawReservation.date instanceof Date
          ? rawReservation.date
          : String(rawReservation.date || ''),
      classroom: String(rawReservation.classroom || ''),
      venue: rawReservation.venue ? String(rawReservation.venue) : undefined,
      startTime:
        rawReservation.startTime instanceof Date
          ? rawReservation.startTime
          : String(rawReservation.startTime || ''),
      endTime:
        rawReservation.endTime instanceof Date
          ? rawReservation.endTime
          : String(rawReservation.endTime || ''),
      status: String(rawReservation.status || ''),
      chiselRental: Boolean(rawReservation.chiselRental),
      firstLecture: Boolean(rawReservation.firstLecture),
      workInProgress: rawReservation.workInProgress
        ? String(rawReservation.workInProgress)
        : undefined,
      order: rawReservation.order ? String(rawReservation.order) : undefined,
      messageToTeacher: rawReservation.messageToTeacher
        ? String(rawReservation.messageToTeacher)
        : undefined,
    };
  } catch (error) {
    Logger.log(`予約データ正規化エラー: ${error.message}`);
    return null;
  }
}

// ===================================================================
// トランザクション管理ユーティリティ関数
// ===================================================================

/**
 * スクリプトロックを利用して処理をアトミックに実行する
 * @param {TransactionCallback} callback - 実行する処理
 * @returns {*} callbackの戻り値
 */
function withTransaction(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

/**
 * シートからヘッダーとデータを一度に取得する共通関数。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のシート
 * @returns {SheetDataResult} - { header, headerMap, allData, dataRows }
 */
function getSheetData(sheet) {
  if (!sheet) throw new Error('シートが見つかりません。');

  // 全データを一度で取得（ヘッダー含む）
  const allData = sheet.getDataRange().getValues();
  if (allData.length === 0) throw new Error('シートにデータがありません。');

  const header = allData[0];
  const headerMap = createHeaderMap(header);
  const dataRows = allData.slice(1);

  return {
    header,
    headerMap,
    allData,
    dataRows,
  };
}

/**
 * シートからヘッダーとデータを一度に取得し、指定した条件でレコードを検索する共通関数。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のシート
 * @param {string} searchColumn - 検索対象のヘッダー名
 * @param {string|number|Date|boolean|null} searchValue - 検索する値
 * @returns {SheetSearchResult} - { header, headerMap, allData, dataRows, foundRow, rowIndex, searchColIdx }
 */
function getSheetDataWithSearch(sheet, searchColumn, searchValue) {
  const { header, headerMap, allData, dataRows } = getSheetData(sheet);

  // 検索列のインデックスを取得
  const searchColIdx = headerMap.get(searchColumn);
  if (searchColIdx === undefined)
    throw new Error(`ヘッダー「${searchColumn}」が見つかりません。`);

  // データ行から対象レコードを検索（防御的プログラミング）
  const foundRow = dataRows.find(row => {
    if (!row || !Array.isArray(row)) {
      Logger.log(`⚠️ 無効なデータ行をスキップ: ${JSON.stringify(row)}`);
      return false;
    }
    return row[searchColIdx] === searchValue;
  });
  const rowIndex = foundRow ? dataRows.indexOf(foundRow) + 2 : -1; // 1-based + header row

  return {
    header,
    headerMap,
    allData,
    dataRows,
    foundRow,
    rowIndex,
    searchColIdx,
  };
}

// ===================================================================
// キャッシュデータ処理のヘルパー関数群
// ===================================================================

/**
 * 特定日・教室の予約データを取得する（生データ）
 * @param {string} date - 検索対象の日付（yyyy-MM-dd形式）
 * @param {string} classroom - 教室名
 * @param {string} status - ステータス（省略可、デフォルトは確定済み予約のみ）
 * @returns {CachedReservationResult[]} 条件に合致する予約配列
 */
function getCachedReservationsFor(
  date,
  classroom,
  status = CONSTANTS.STATUS.CONFIRMED,
) {
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  if (!reservationsCache?.['reservations']) return [];

  const reservations = reservationsCache['reservations'];
  const headerMap = reservationsCache['headerMap'];

  // ヘッダーマップの有効性確認
  if (!headerMap) {
    Logger.log('⚠️ ヘッダーマップが存在しません');
    return [];
  }

  const typedHeaderMap = /** @type {{ [key: string]: number }} */ (headerMap);
  const dateColIdx = typedHeaderMap[CONSTANTS.HEADERS.RESERVATIONS.DATE];
  const classroomColIdx =
    typedHeaderMap[CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM];
  const statusColIdx = typedHeaderMap[CONSTANTS.HEADERS.RESERVATIONS.STATUS];

  // 必要なインデックスが取得できているか確認
  if (
    dateColIdx === undefined ||
    classroomColIdx === undefined ||
    statusColIdx === undefined
  ) {
    Logger.log(
      `⚠️ 必要なヘッダーインデックスが見つかりません - Date: ${dateColIdx}, Classroom: ${classroomColIdx}, Status: ${statusColIdx}`,
    );
    return [];
  }

  return /** @type {ReservationArrayData[]} */ (reservations)
    .filter(
      /** @param {ReservationArrayData} row */ row => {
        // データ構造修正: キャッシュは直接配列を格納しているため、r.dataではなくrを直接使用
        if (!row || !Array.isArray(row)) {
          Logger.log(`⚠️ 無効な予約データをスキップ: ${JSON.stringify(row)}`);
          return false;
        }
        return (
          row[dateColIdx] === date &&
          row[classroomColIdx] === classroom &&
          (!status || row[statusColIdx] === status)
        );
      },
    )
    .map(/** @param {ReservationArrayData} row */ row => ({ data: row })); // 戻り値を既存のAPIに合わせる
}

/**
 * 特定日・教室の正規化済み予約データを取得する（推奨API）
 * @param {string} date - 検索対象の日付（yyyy-MM-dd形式）
 * @param {string} classroom - 教室名
 * @param {string} status - ステータス（省略可、デフォルトは確定済み予約のみ）
 * @returns {ReservationObject[]} 条件に合致する正規化済み予約配列
 */
function getNormalizedReservationsFor(
  date,
  classroom,
  status = CONSTANTS.STATUS.CONFIRMED,
) {
  const rawReservations = getCachedReservationsFor(date, classroom, status);
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  if (!reservationsCache?.['headerMap']) return [];

  const headerMap = reservationsCache['headerMap'];

  return rawReservations
    .map(result =>
      transformReservationArrayToObjectWithHeaders(
        result.data,
        /** @type {{ [key: string]: number }} */ (headerMap),
      ),
    )
    .map(rawReservation => normalizeReservationObject(rawReservation))
    .filter(reservation => reservation !== null);
}

/**
 * 生徒IDから生徒情報を取得する
 * @param {string} studentId - 生徒ID
 * @returns {StudentData|null} 生徒オブジェクト、見つからない場合はnull
 */
function getCachedStudentById(studentId) {
  const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
  if (!studentsCache?.['students']) return null;

  const students = /** @type {{ [key: string]: StudentData }} */ (
    studentsCache['students']
  );
  return students[studentId] || null;
}

/**
 * 予約配列データを統一的にオブジェクト配列に変換する
 * @param {ReservationArrayData[]} reservations - 予約配列データ
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @returns {RawReservationObject[]} 変換済み予約オブジェクト配列（生データ）
 */
function convertReservationsToObjects(reservations, headerMap) {
  return reservations
    .map(reservation => {
      if (Array.isArray(reservation)) {
        return transformReservationArrayToObjectWithHeaders(
          reservation,
          headerMap,
        );
      }
      return reservation;
    })
    .filter(reservation => reservation !== null);
}

/**
 * ヘッダーマップから安全にインデックスを取得する
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @param {string} headerName - ヘッダー名
 * @returns {number|undefined} 列インデックス
 */
function getHeaderIndex(headerMap, headerName) {
  if (!headerMap) return undefined;
  if (typeof headerMap.get === 'function') {
    return headerMap.get(headerName);
  }
  if (typeof headerMap === 'object' && headerName in headerMap) {
    return /** @type {Record<string,number>} */ (headerMap)[headerName];
  }
  return undefined;
}

// ===================================================================
// 電話番号処理ユーティリティ関数群
// ===================================================================

/**
 * 電話番号を正規化します（全角→半角、ハイフン削除、バリデーション）
 * @param {string} phoneInput - 入力された電話番号
 * @returns {PhoneNormalizationResult} 正規化結果
 */
function normalizePhoneNumber(phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') {
    return {
      normalized: '',
      isValid: false,
      error: '電話番号を入力してください',
    };
  }

  // 全角数字を半角に変換
  let normalized = phoneInput.replace(/[０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 65248),
  );

  // 各種区切り文字と+記号を削除（ハイフン、スペース、括弧、ピリオド、+など）
  normalized = normalized.replace(/[-‐－—–\s\(\)\[\]\.\+]/g, '');

  // 国番号の自動修正処理（桁数チェック前に実行）
  // 行頭の81を0に置き換え（日本の国番号81 → 0）
  if (normalized.startsWith('81') && normalized.length >= 12) {
    normalized = '0' + normalized.substring(2);
  }

  // 数字以外の文字をチェック
  if (!/^\d+$/.test(normalized)) {
    return {
      normalized: '',
      isValid: false,
      error: '電話番号は数字のみ入力してください',
    };
  }

  // 桁数チェック（携帯電話番号は11桁のみ）
  if (normalized.length !== 11) {
    return {
      normalized: '',
      isValid: false,
      error: '携帯電話番号は11桁で入力してください',
    };
  }

  // 先頭番号チェック（携帯電話番号は0から始まる）
  if (!normalized.startsWith('0')) {
    return {
      normalized: '',
      isValid: false,
      error: '携帯電話番号は0から始まる必要があります',
    };
  }

  return { normalized, isValid: true };
}

/**
 * 電話番号を表示用にフォーマットします（3-4-4桁区切り）
 * @param {string} phoneNumber - 正規化済み電話番号
 * @returns {string} フォーマット済み電話番号
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return '';
  }

  // 正規化処理
  const result = normalizePhoneNumber(phoneNumber);
  if (!result.isValid) {
    return phoneNumber; // 無効な場合は元の値を返す
  }

  const normalized = result.normalized;

  if (normalized.length === 11) {
    // 11桁の場合: 090-1234-5678
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    // 10桁の場合: 03-1234-5678
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }

  return normalized;
}
