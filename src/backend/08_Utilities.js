/// <reference path="../../types/backend-index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 08_Utilities.gs
 * 【バージョン】: 2.3
 * 【役割】: プロジェクト全体で利用される、業務ドメインに依存しない
 * 汎用的なヘルパー関数を格納します。
 * 【v2.3での変更点】:
 * - 予約オブジェクト変換時の生徒情報取得を最適化（N+1問題の解消）
 * =================================================================
 */

/**
 * 環境別ログ制御システム - パフォーマンス最適化
 */
export const PerformanceLog = {
  /**
   * デバッグログ（開発環境でのみ出力）
   */
  debug(/** @type {string} */ message, /** @type {...any} */ ...args) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      Logger.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * 情報ログ（重要な処理完了時のみ出力）
   */
  info(/** @type {string} */ message, /** @type {...any} */ ...args) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      Logger.log(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * エラーログ（常に出力）
   */
  error(/** @type {string} */ message, /** @type {...any} */ ...args) {
    Logger.log(`[ERROR] ${message}`, ...args);
  },

  /**
   * パフォーマンス測定
   */
  performance(
    /** @type {string} */ operation,
    /** @type {number} */ startTime,
  ) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      const duration = Date.now() - startTime;
      Logger.log(`[PERF] ${operation}: ${duration}ms`);
    }
  },
};


/**
 * 予約データの事前バリデーション（パフォーマンス最適化）
 * 冗長なデータ検証を削減するため、一度だけ全体構造を検証
 * @param {any[]} reservations - 予約データ配列
 * @returns {any[]} 有効な予約データのみを含む配列
 */
export function validateReservationsStructure(reservations) {
  if (!Array.isArray(reservations)) {
    PerformanceLog.error('予約データは配列である必要があります');
    return [];
  }

  // 一度だけ全体構造を検証し、有効なデータのみを返す
  return reservations.filter(r => {
    if (!r || typeof r !== 'object') return false;
    if (!r.data || !Array.isArray(r.data)) return false;
    return true;
  });
}

/**
 * ヘッダー行の配列から、ヘッダー名をキー、列インデックス(0-based)を値とするマップを作成します。
 * @param {string[]} headerRow - ヘッダーの行データ
 * @returns {HeaderMapType}
 */
export function createHeaderMap(headerRow) {
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
export function handleError(message, isError) {
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
export function findRowIndexByValue(sheet, col, value) {
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
export function createSalesRow(baseInfo, category, itemName, price) {
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
export function logActivity(userId, action, result, details) {
  try {
    const ss = getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(CONSTANTS.SHEET_NAMES.LOG);
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
 * ログシートシートに、定義済みの条件付き書式を一括で設定します。
 * F列は自身の値、G列はE列の値に基づいて背景色が設定されます。
 * 実行前に既存のルールはすべてクリアされるため、常に新しい状態でルールが適用されます。
 */
export function setupConditionalFormattingForLogSheet() {
  const sheetName = 'ログシート';
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

  SpreadsheetApp.getUi().alert('ログシートの条件付き書式を更新しました。');
}

// ===================================================================
// データ形式統一のためのユーティリティ関数群
// ===================================================================

/**
 * 配列形式の予約データをオブジェクト形式に変換
 * フロントエンドの transformReservationArrayToObject と同じロジック
 * @param {ReservationArrayData} resArray - 配列形式の予約データ
 * @returns {ReservationCore|null} オブジェクト形式の予約データ（生データ）
 */
export function transformReservationArrayToObject(resArray) {
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

  /** @type {ReservationCore} */
  const reservation = {
    reservationId: String(reservationId || ''),
    studentId: String(studentId || ''),
    date:
      date instanceof Date
        ? Utilities.formatDate(date, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')
        : String(date || ''),
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
  return reservation;
}

/**
 * ヘッダーマップを使用して予約配列データをオブジェクトに変換します
 * @param {ReservationArrayData} resArray - 予約データの配列
 * @param {HeaderMapType} headerMap - ヘッダー名とインデックスのマッピング
 * @param {Record<string, UserCore>} studentsMap - 全生徒のマップ（パフォーマンス最適化用）
 * @returns {ReservationCore|null} - 変換された予約オブジェクト、失敗時はnull
 */
export function transformReservationArrayToObjectWithHeaders(
  resArray,
  headerMap,
  studentsMap,
) {
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

  const studentId = String(
    resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID)] || '',
  );

  /** @type {ReservationCore} */
  const reservation = {
    reservationId: String(
      resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID)] || '',
    ),
    studentId: studentId,
    date: (() => {
      const dateValue = resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.DATE)];
      return dateValue instanceof Date
        ? Utilities.formatDate(dateValue, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')
        : String(dateValue || '');
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
    chiselRental: (() => {
      const value =
        resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.CHISEL_RENTAL)];
      return value === true || String(value).toUpperCase() === 'TRUE';
    })(),
    firstLecture: (() => {
      const value =
        resArray[getIndex(CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE)];
      return value === true || String(value).toUpperCase() === 'TRUE';
    })(),
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

  // ユーザー情報を付与（引数で渡されたマップから取得）
  if (studentId && studentsMap && studentsMap[studentId]) {
    reservation.user = studentsMap[studentId];
  }

  return reservation;
}

/**
 * 生データの予約オブジェクトを正規化済みオブジェクトに変換
 * @param {RawReservationObject} rawReservation - 生データの予約オブジェクト
 * @returns {ReservationObject|null} 正規化済み予約オブジェクト
 */
export function normalizeReservationObject(rawReservation) {
  if (!rawReservation) return null;

  try {
    return {
      reservationId: String(rawReservation.reservationId || ''),
      studentId: String(rawReservation.studentId || ''),
      date:
        rawReservation.date instanceof Date
          ? rawReservation.date.toISOString()
          : String(rawReservation.date || ''),
      classroom: String(rawReservation.classroom || ''),
      venue: rawReservation.venue ? String(rawReservation.venue) : undefined,
      startTime:
        rawReservation.startTime instanceof Date
          ? rawReservation.startTime.toISOString()
          : String(rawReservation.startTime || ''),
      endTime:
        rawReservation.endTime instanceof Date
          ? rawReservation.endTime.toISOString()
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
export function withTransaction(callback) {
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
export function getSheetData(sheet) {
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
export function getSheetDataWithSearch(sheet, searchColumn, searchValue) {
  const { header, headerMap, allData, dataRows } = getSheetData(sheet);

  // 検索列のインデックスを取得
  const searchColIdx = headerMap.get(searchColumn);
  if (searchColIdx === undefined)
    throw new Error(`ヘッダー「${searchColumn}」が見つかりません。`);

  // データ行から対象レコードを検索（防御的プログラミング）
  const foundRow = dataRows.find(row => {
    if (!row || !Array.isArray(row)) {
      PerformanceLog.debug(
        `⚠️ 無効なデータ行をスキップ: ${JSON.stringify(row)}`,
      );
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
 * 特定日・教室の正規化済み予約データを取得する（推奨API）
 * @param {string} date - 検索対象の日付（yyyy-MM-dd形式）
 * @param {string} classroom - 教室名
 * @param {string} status - ステータス（省略可、デフォルトは確定済み予約のみ）
 * @returns {ReservationCore[]} 条件に合致する正規化済み予約配列
 */
export function getNormalizedReservationsFor(
  date,
  classroom,
  status = CONSTANTS.STATUS.CONFIRMED,
) {
  // ★改善: getCachedReservationsAsObjects を利用して直接オブジェクトを取得し、フィルタリングする
  const allReservations = getCachedReservationsAsObjects();
  const filteredReservations = allReservations.filter(
    r =>
      r.date === date &&
      r.classroom === classroom &&
      (!status || r.status === status),
  );
  return filteredReservations;
}

/**
 * 生徒IDから生徒情報を取得する
 * @param {string} studentId - 生徒ID
 * @returns {StudentData|null} 生徒オブジェクト、見つからない場合はnull
 */
export function getCachedStudentById(studentId) {
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
 * @param {Record<string, UserCore>} studentsMap - 全生徒のマップ（パフォーマンス最適化用）
 * @returns {ReservationCore[]} 変換済み予約オブジェクト配列
 */
export function convertReservationsToObjects(reservations, headerMap, studentsMap) {
  return reservations
    .map(reservation => {
      if (Array.isArray(reservation)) {
        return transformReservationArrayToObjectWithHeaders(
          reservation,
          headerMap,
          studentsMap,
        );
      }
      return reservation;
    })
    .filter(reservation => reservation !== null);
}

/**
 * キャッシュから全ての予約データを取得し、オブジェクトの配列として返す
 * @returns {ReservationCore[]} 変換済みの予約オブジェクト配列
 */
export function getCachedReservationsAsObjects() {
  const reservationCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);

  if (!reservationCache) {
    return [];
  }
  // 型アサーションを追加して安全性を高める
  const reservationsData = /** @type {ReservationArrayData[]} */ (
    reservationCache.reservations || []
  );
  const headerMapData = /** @type {HeaderMapType | null} */ (
    reservationCache.headerMap || null
  );
  const studentsMap = /** @type {Record<string, UserCore> | undefined} */ (
    studentsCache?.students
  );

  if (!headerMapData) {
    return [];
  }

  return convertReservationsToObjects(
    reservationsData,
    headerMapData,
    studentsMap,
  );
}

/**
 * 予約IDを指定して、キャッシュから単一のReservationCoreオブジェクトを取得する
 * @param {string} reservationId - 取得する予約のID
 * @returns {ReservationCore | null} ReservationCoreオブジェクト、見つからない場合はnull
 */
export function getReservationCoreById(reservationId) {
  if (!reservationId) return null;

  const reservationRow = getReservationByIdFromCache(reservationId);
  if (!reservationRow) {
    Logger.log(
      `[CORE] 予約ID ${reservationId} はキャッシュに見つかりませんでした。`,
    );
    return null;
  }

  // ヘッダーマップをキャッシュから取得
  const cache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS, false);
  if (!cache || !cache.headerMap) {
    Logger.log(`[CORE] 予約キャッシュのヘッダーマップが取得できませんでした。`);
    return null;
  }

  // ★修正: 生徒マップも渡して変換処理を最適化
  const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC, false);
  const studentsMap = /** @type {Record<string, UserCore> | undefined} */ (
    studentsCache?.students
  );

  const reservationCore = transformReservationArrayToObjectWithHeaders(
    reservationRow,
    /** @type {HeaderMapType} */ (cache.headerMap),
    studentsMap,
  );

  return reservationCore;
}

/**
 * ヘッダーマップから安全にインデックスを取得する
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @param {string} headerName - ヘッダー名
 * @returns {number|undefined} 列インデックス
 */
export function getHeaderIndex(headerMap, headerName) {
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
export function normalizePhoneNumber(phoneInput) {
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
export function formatPhoneNumber(phoneNumber) {
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

// ===================================================================
// 型変換関数群（Phase 3: 型システム統一）
// ===================================================================

/**
 * Sheets生データ（配列）→ UserCore に変換
 *
 * Google Sheetsから取得した配列データを統一Core型に変換
 * Phase 3: 型システム統一の一環として実装
 *
 * @param {RawSheetRow} row - Sheets生データ（配列）
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @returns {UserCore} 統一Core型のユーザーデータ
 */
export function convertRowToUser(row, headerMap) {
  // ヘッダーマップを適切な型にキャスト
  const hm = /** @type {Record<string, number>} */ (
    headerMap instanceof Map ? Object.fromEntries(headerMap) : headerMap
  );

  /** @type {UserCore} */
  const user = {
    studentId: String(row[hm[CONSTANTS.HEADERS.ROSTER.STUDENT_ID]] || ''),
    phone: String(row[hm[CONSTANTS.HEADERS.ROSTER.PHONE]] || ''),
    realName: String(row[hm[CONSTANTS.HEADERS.ROSTER.REAL_NAME]] || ''),
    displayName:
      String(row[hm[CONSTANTS.HEADERS.ROSTER.NICKNAME]]) ||
      String(row[hm[CONSTANTS.HEADERS.ROSTER.REAL_NAME]]) ||
      '',
    nickname: row[hm[CONSTANTS.HEADERS.ROSTER.NICKNAME]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.NICKNAME]])
      : undefined,
    email: row[hm[CONSTANTS.HEADERS.ROSTER.EMAIL]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.EMAIL]])
      : undefined,
    wantsEmail: Boolean(
      row[hm[CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL]],
    ),
    wantsScheduleNotification: Boolean(
      row[hm[CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO]],
    ),
    notificationDay: row[hm[CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY]]
      ? Number(row[hm[CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY]])
      : undefined,
    notificationHour: row[hm[CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR]]
      ? Number(row[hm[CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR]])
      : undefined,
    ageGroup: row[hm[CONSTANTS.HEADERS.ROSTER.AGE_GROUP]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.AGE_GROUP]])
      : undefined,
    gender: row[hm[CONSTANTS.HEADERS.ROSTER.GENDER]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.GENDER]])
      : undefined,
    dominantHand: row[hm[CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND]])
      : undefined,
    address: row[hm[CONSTANTS.HEADERS.ROSTER.ADDRESS]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.ADDRESS]])
      : undefined,
    experience: row[hm[CONSTANTS.HEADERS.ROSTER.EXPERIENCE]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.EXPERIENCE]])
      : undefined,
    pastWork: row[hm[CONSTANTS.HEADERS.ROSTER.PAST_WORK]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.PAST_WORK]])
      : undefined,
    futureParticipation: row[hm[CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION]])
      : undefined,
    futureCreations: row[hm[CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS]]
      ? String(row[hm[CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS]])
      : undefined,
  };

  return user;
}

/**
 * UserCore → Sheets行データ（配列）に変換
 *
 * 統一Core型からSheets書き込み用の配列データに変換
 * Phase 3: 型システム統一の一環として実装
 *
 * @param {UserCore} user - 統一Core型のユーザーデータ
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @returns {RawSheetRow} Sheets書き込み用配列データ
 */
export function convertUserToRow(user, headerMap) {
  // ヘッダーマップを適切な型にキャスト
  const hm = /** @type {Record<string, number>} */ (
    headerMap instanceof Map ? Object.fromEntries(headerMap) : headerMap
  );

  // 配列を初期化（全カラム分の長さ）
  const columnCount = Object.keys(hm).length;
  /** @type {RawSheetRow} */
  const row = new Array(columnCount).fill('');

  // 必須フィールド
  row[hm[CONSTANTS.HEADERS.ROSTER.STUDENT_ID]] = user.studentId;
  row[hm[CONSTANTS.HEADERS.ROSTER.PHONE]] = user.phone;
  row[hm[CONSTANTS.HEADERS.ROSTER.REAL_NAME]] = user.realName;

  // オプションフィールド
  if (user.nickname !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.NICKNAME]] = user.nickname;
  }
  if (user.email !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.EMAIL]] = user.email;
  }
  if (user.wantsEmail !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL]] = user.wantsEmail;
  }
  if (user.wantsScheduleNotification !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO]] =
      user.wantsScheduleNotification;
  }
  if (user.notificationDay !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY]] = user.notificationDay;
  }
  if (user.notificationHour !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR]] = user.notificationHour;
  }
  if (user.ageGroup !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.AGE_GROUP]] = user.ageGroup;
  }
  if (user.gender !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.GENDER]] = user.gender;
  }
  if (user.dominantHand !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND]] = user.dominantHand;
  }
  if (user.address !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.ADDRESS]] = user.address;
  }
  if (user.experience !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.EXPERIENCE]] = user.experience;
  }
  if (user.pastWork !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.PAST_WORK]] = user.pastWork;
  }
  if (user.futureParticipation !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION]] =
      user.futureParticipation;
  }
  if (user.futureCreations !== undefined) {
    row[hm[CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS]] = user.futureCreations;
  }

  return row;
}

/**
 * ReservationCore → Sheets行データ（配列）に変換
 *
 * 統一Core型からSheets書き込み用の配列データに変換
 *
 * @param {ReservationCore} reservation - 統一Core型の予約データ
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @param {string[]} header - ヘッダー配列（列数決定用）
 * @returns {RawSheetRow} Sheets書き込み用配列データ
 */
export function convertReservationToRow(reservation, headerMap, header) {
  const hm =
    headerMap instanceof Map ? Object.fromEntries(headerMap) : headerMap;
  const row = new Array(header.length).fill('');

  // 必須・基本フィールド
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID]] =
    reservation.reservationId;
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID]] = reservation.studentId;
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.STATUS]] = reservation.status;
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.CLASSROOM]] = reservation.classroom;
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.VENUE]] = reservation.venue || '';

  // 日付・時刻フィールド（Dateオブジェクトに変換）
  if (reservation.date) {
    row[hm[CONSTANTS.HEADERS.RESERVATIONS.DATE]] = new Date(
      reservation.date + 'T00:00:00+09:00',
    );
  }
  if (reservation.startTime) {
    row[hm[CONSTANTS.HEADERS.RESERVATIONS.START_TIME]] = new Date(
      `1900-01-01T${reservation.startTime}:00+09:00`,
    );
  }
  if (reservation.endTime) {
    row[hm[CONSTANTS.HEADERS.RESERVATIONS.END_TIME]] = new Date(
      `1900-01-01T${reservation.endTime}:00+09:00`,
    );
  }

  // オプショナルフィールド
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.CHISEL_RENTAL]] =
    reservation.chiselRental ? 'TRUE' : '';
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.FIRST_LECTURE]] =
    reservation.firstLecture ? 'TRUE' : '';
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.WORK_IN_PROGRESS]] =
    reservation.workInProgress || '';
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.ORDER]] = reservation.order || '';
  row[hm[CONSTANTS.HEADERS.RESERVATIONS.MESSAGE_TO_TEACHER]] =
    reservation.messageToTeacher || '';

  // 会計詳細（JSON文字列として保存）
  const accountingDetailsColIdx =
    hm[CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS];
  if (accountingDetailsColIdx !== undefined && reservation.accountingDetails) {
    row[accountingDetailsColIdx] = JSON.stringify(
      reservation.accountingDetails,
    );
  }

  // 動的プロパティ（material/otherSales系）
  Object.keys(reservation).forEach(key => {
    if (
      key.startsWith('material') ||
      key.startsWith('otherSales') ||
      key === 'discountApplied' ||
      key === '計算時間' ||
      key === 'breakTime'
    ) {
      if (hm[key] !== undefined) {
        row[hm[key]] = reservation[key];
      }
    }
  });

  return row;
}
