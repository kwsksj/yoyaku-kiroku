/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.js
 * 【バージョン】: 5.5
 * 【役割】: CacheServiceベースの統合キャッシュ管理システム
 *
 * 【主要機能】:
 * ✅ 統合データキャッシュ管理
 *   - 全予約データ（統合予約シート）
 *   - 生徒基本情報（生徒名簿）
 *   - 日程マスターデータ
 *   - 会計マスターデータ
 *
 * ✅ キャッシュ操作API
 *   - getCachedData(): 統一キャッシュ取得インターフェース
 *   - 自動再構築機能（キャッシュ未存在時）
 *   - キャッシュ情報管理（バージョン、件数、更新日時）
 *
 * ✅ 管理・保守機能
 *   - 一括キャッシュ再構築（UI付き）
 *   - 定期自動再構築（トリガー実行）
 *   - PropertiesServiceクリーンアップ（古いキャッシュ削除）
 *
 * 【v5.0での変更点】:
 * - rebuild系関数名を統一（rebuildAll***Cache, rebuild***Cache）
 * - getCachedData()による統一キャッシュアクセスAPI導入
 * - CACHE_KEYS定数による一元管理
 * - JSDocとエラーハンドリングの全面改善
 * - PropertiesService整理機能の責任分離と特化
 * =================================================================
 */

/**
 * 全てのキャッシュデータを一括で再構築するエントリーポイント関数
 * UI確認ダイアログを表示してから、全種類のキャッシュを順次再構築します。
 * スプレッドシートのメニューから手動実行される場合に使用されます。
 *
 * 再構築対象:
 * - 統合予約データキャッシュ
 * - 生徒基本情報キャッシュ
 * - 会計マスターキャッシュ
 * - 日程マスターキャッシュ
 *
 * @throws {Error} いずれかのキャッシュ再構築中にエラーが発生した場合
 */
function rebuildAllCachesEntryPoint() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'キャッシュデータの一括再構築',
    '全てのキャッシュデータ（予約、生徒、会計マスター、日程マスター）を再構築します。よろしいですか？',
    ui.ButtonSet.OK_CANCEL,
  );
  if (response !== ui.Button.OK) {
    ui.alert('処理を中断しました。');
    return;
  }

  try {
    getActiveSpreadsheet().toast(
      'キャッシュデータの一括再構築を開始しました...',
      '処理中',
      -1,
    );

    // 全てのキャッシュを順次再構築
    rebuildAllReservationsCache();
    rebuildAllStudentsBasicCache();
    rebuildAccountingMasterCache();
    rebuildScheduleMasterCache();

    getActiveSpreadsheet().toast(
      'キャッシュデータの一括再構築が完了しました。',
      '成功',
      5,
    );

    logActivity(
      'system',
      'キャッシュ一括再構築',
      '成功',
      '全キャッシュ（予約、生徒、会計マスター、日程マスター）を再構築完了',
    );
  } catch (error) {
    handleError(
      `キャッシュデータの一括再構築中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * 統合予約シートから全予約データを読み込み、CacheServiceに保存する
 * 日付・時刻列を適切にフォーマットして配列形式でキャッシュに保存します。
 *
 * @throws {Error} 統合予約シートが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
function rebuildAllReservationsCache() {
  try {
    const integratedReservationSheet = getSheetByName('統合予約シート');
    if (
      !integratedReservationSheet ||
      integratedReservationSheet.getLastRow() < 2
    ) {
      Logger.log('統合予約シートが見つからないか、データが空です。');
      // 空データの場合もキャッシュを作成
      const emptyCacheData = {
        version: new Date().getTime(),
        reservations: [],
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_RESERVATIONS,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    // ヘッダー行を取得してマッピングを作成
    const headerRow = integratedReservationSheet
      .getRange(1, 1, 1, integratedReservationSheet.getLastColumn())
      .getValues()[0];
    const headerColumnMap = createHeaderMap(headerRow);

    // 日付・時刻列のインデックスを取得
    const dateColumnIndex = headerColumnMap.get(HEADER_DATE);
    const startTimeColumnIndex = headerColumnMap.get(HEADER_START_TIME);
    const endTimeColumnIndex = headerColumnMap.get(HEADER_END_TIME);

    // データ行を取得
    const dataRowCount = integratedReservationSheet.getLastRow() - 1;
    const allReservationRows = integratedReservationSheet
      .getRange(2, 1, dataRowCount, integratedReservationSheet.getLastColumn())
      .getValues();

    // 日付・時刻のフォーマット関数
    const formatDateString = dateValue => {
      if (!(dateValue instanceof Date)) return dateValue;
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formatTimeString = dateValue => {
      if (!(dateValue instanceof Date)) return dateValue;
      const hours = String(dateValue.getHours()).padStart(2, '0');
      const minutes = String(dateValue.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    // 日付・時刻列をフォーマット
    const dateTimeColumns = [
      { index: dateColumnIndex, formatter: formatDateString },
      { index: startTimeColumnIndex, formatter: formatTimeString },
      { index: endTimeColumnIndex, formatter: formatTimeString },
    ].filter(column => column.index !== undefined);

    // データを処理
    allReservationRows.forEach(reservationRow => {
      dateTimeColumns.forEach(({ index, formatter }) => {
        const originalValue = reservationRow[index];
        if (originalValue instanceof Date) {
          reservationRow[index] = formatter(originalValue);
        }
      });
    });

    const cacheData = {
      version: new Date().getTime(),
      reservations: allReservationRows,
      headerMap: Object.fromEntries(headerColumnMap), // MapオブジェクトをPlainオブジェクトに変換
      metadata: {
        totalCount: allReservationRows.length,
        lastUpdated: new Date().toISOString(),
      },
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_RESERVATIONS,
      JSON.stringify(cacheData),
      CACHE_EXPIRY_SECONDS,
    );

    Logger.log(
      `全予約データキャッシュを更新しました。件数: ${allReservationRows.length}`,
    );
  } catch (e) {
    Logger.log(`rebuildAllReservationsCacheでエラー: ${e.message}`);
    throw e;
  }
}

/**
 * 日程マスターデータを読み込み、CacheServiceに保存する
 * 今日から1年後までの日程データを取得し、キャッシュに保存します。
 *
 * @param {string} [fromDate] - 取得開始日（YYYY-MM-DD形式、省略時は今日）
 * @param {string} [toDate] - 取得終了日（YYYY-MM-DD形式、省略時は1年後）
 * @throws {Error} 日程データの取得や処理中にエラーが発生した場合
 */
function rebuildScheduleMasterCache(fromDate, toDate) {
  try {
    // デフォルトの日付範囲を設定（今日から1年後まで）
    const today = new Date();

    const oldestDate = new Date(
      today.getFullYear() - 10,
      today.getMonth(),
      today.getDate(),
    );
    const startDate =
      fromDate ||
      Utilities.formatDate(oldestDate, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');

    const oneYearLater = new Date(
      today.getFullYear() + 1,
      today.getMonth(),
      today.getDate(),
    );
    const endDate =
      toDate ||
      Utilities.formatDate(oneYearLater, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');

    // 日程マスターシートから直接データを取得
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) {
      Logger.log(
        '日程マスターシートが見つかりません。空のキャッシュを保存します。',
      );
      const emptyCacheData = { schedule: [], version: Date.now() };
      CacheService.getScriptCache().put(
        CACHE_KEYS.MASTER_SCHEDULE_DATA,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();

    // 時間列のインデックスを特定
    const timeColumnNames = [
      CONSTANTS.HEADERS.SCHEDULE.FIRST_START,
      CONSTANTS.HEADERS.SCHEDULE.FIRST_END,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_START,
      CONSTANTS.HEADERS.SCHEDULE.SECOND_END,
      CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START,
    ];

    const scheduleDataList = allData
      .filter(row => {
        const dateValue = row[headers.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE)];
        if (!dateValue) return false;

        // Date オブジェクトを文字列形式に変換して比較
        const dateStr =
          dateValue instanceof Date
            ? Utilities.formatDate(dateValue, CONSTANTS.TIMEZONE, 'yyyy-MM-dd')
            : String(dateValue);

        return dateStr >= startDate && dateStr <= endDate;
      })
      .map(row => {
        const scheduleObj = {};
        headers.forEach((header, index) => {
          let value = row[index];
          // 時間列の処理
          if (timeColumnNames.includes(header) && value instanceof Date) {
            value = Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'HH:mm');
          }
          // 日付列の処理
          else if (
            header === CONSTANTS.HEADERS.SCHEDULE.DATE &&
            value instanceof Date
          ) {
            value = Utilities.formatDate(
              value,
              CONSTANTS.TIMEZONE,
              'yyyy-MM-dd',
            );
          }

          // 日本語ヘッダーを英語プロパティ名に変換
          let propertyName = header;
          switch (header) {
            case CONSTANTS.HEADERS.SCHEDULE.DATE:
              propertyName = 'date';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.CLASSROOM:
              propertyName = 'classroom';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.VENUE:
              propertyName = 'venue';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.TYPE:
              propertyName = 'classroomType';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.FIRST_START:
              propertyName = 'firstStart';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.FIRST_END:
              propertyName = 'firstEnd';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.SECOND_START:
              propertyName = 'secondStart';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.SECOND_END:
              propertyName = 'secondEnd';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START:
              propertyName = 'beginnerStart';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.TOTAL_CAPACITY:
              propertyName = 'totalCapacity';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.BEGINNER_CAPACITY:
              propertyName = 'beginnerCapacity';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.STATUS:
              propertyName = 'status';
              break;
            case CONSTANTS.HEADERS.SCHEDULE.NOTES:
              propertyName = 'notes';
              break;
            // その他はそのまま
          }

          scheduleObj[propertyName] = value;
        });
        return scheduleObj;
      });

    // ★ 日付順でソート処理を追加
    if (scheduleDataList && scheduleDataList.length > 0) {
      scheduleDataList.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    const cacheData = {
      version: new Date().getTime(),
      schedule: scheduleDataList || [],
      dateRange: {
        from: startDate,
        to: endDate,
        cached: new Date().toISOString(),
      },
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
      JSON.stringify(cacheData),
      CACHE_EXPIRY_SECONDS,
    );

    Logger.log(
      `日程マスターデータキャッシュを更新しました。件数: ${scheduleDataList?.length || 0}、期間: ${startDate} ～ ${endDate}`,
    );
    return cacheData;
  } catch (error) {
    Logger.log(`rebuildScheduleMasterCacheでエラー: ${error.message}`);
    throw new Error(
      `日程マスターのキャッシュ作成に失敗しました: ${error.message}`,
    );
  }
}

/**
 * 会計マスターデータを読み込み、CacheServiceに保存する
 * スプレッドシートの「会計マスタ」シートから直接データを読み込み、
 * 時間列を適切にフォーマットしてキャッシュに保存します。
 *
 * @throws {Error} 会計マスタシートが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
function rebuildAccountingMasterCache() {
  try {
    const sheet = getSheetByName(CONSTANTS.SHEET_NAMES.ACCOUNTING);
    if (!sheet) {
      throw new Error('会計マスタシートが見つかりません');
    }

    if (sheet.getLastRow() < 2) {
      Logger.log('会計マスタシートにデータがありません');
      const emptyCacheData = {
        version: new Date().getTime(),
        items: [],
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.MASTER_ACCOUNTING_DATA,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    const allData = sheet.getDataRange().getValues();
    const headers = allData.shift();

    // 時間列のインデックスを特定
    const timeColumnNames = [
      HEADER_CLASS_START,
      HEADER_CLASS_END,
      HEADER_BREAK_START,
      HEADER_BREAK_END,
    ];
    const timeColumnIndices = timeColumnNames.map(columnName =>
      headers.indexOf(columnName),
    );

    // データを処理してオブジェクト形式に変換
    const processedItems = allData.map(rowData => {
      const item = {};
      headers.forEach((headerName, columnIndex) => {
        const cellValue = rowData[columnIndex];

        // 時間列の場合は HH:mm 形式にフォーマット
        if (
          timeColumnIndices.includes(columnIndex) &&
          cellValue instanceof Date
        ) {
          item[headerName] = Utilities.formatDate(
            cellValue,
            CONSTANTS.TIMEZONE,
            'HH:mm',
          );
        } else {
          item[headerName] = cellValue;
        }
      });
      return item;
    });

    const cacheData = {
      version: new Date().getTime(),
      items: processedItems,
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.MASTER_ACCOUNTING_DATA,
      JSON.stringify(cacheData),
      CACHE_EXPIRY_SECONDS,
    );

    Logger.log(
      `会計マスターデータキャッシュを更新しました。件数: ${processedItems.length}`,
    );
    return cacheData;
  } catch (error) {
    Logger.log(`rebuildAccountingMasterCacheでエラー: ${error.message}`);
    throw new Error(
      `会計マスターのキャッシュ作成に失敗しました: ${error.message}`,
    );
  }
}

/**
 * 生徒名簿から基本情報（ID、本名、ニックネーム、電話番号）を読み込み、CacheServiceに保存する
 * 生徒IDをキーとしたオブジェクト形式でキャッシュに保存します。
 *
 * @throws {Error} 生徒名簿シートが見つからない場合
 * @throws {Error} 必須ヘッダーが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
function rebuildAllStudentsBasicCache() {
  try {
    const studentRosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!studentRosterSheet || studentRosterSheet.getLastRow() < 2) {
      Logger.log('生徒名簿シートが見つからないか、データが空です。');
      // 空データの場合もキャッシュを作成
      const emptyCacheData = {
        version: new Date().getTime(),
        students: {},
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ALL_STUDENTS_BASIC,
        JSON.stringify(emptyCacheData),
        CACHE_EXPIRY_SECONDS,
      );
      return;
    }

    // ヘッダー行を取得してマッピングを作成
    const headerRow = studentRosterSheet
      .getRange(1, 1, 1, studentRosterSheet.getLastColumn())
      .getValues()[0];
    const headerColumnMap = createHeaderMap(headerRow);

    // 必須列のインデックスを取得
    const requiredColumns = {
      studentId: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.STUDENT_ID),
      realName: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.REAL_NAME),
      nickname: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.NICKNAME),
      phone: headerColumnMap.get(CONSTANTS.HEADERS.ROSTER.PHONE),
    };

    // 必須列の存在確認
    const missingColumns = Object.entries(requiredColumns)
      .filter(([, index]) => index === undefined)
      .map(([columnName]) => columnName);

    if (missingColumns.length > 0) {
      throw new Error(
        `生徒名簿の必須ヘッダーが見つかりません: ${missingColumns.join(', ')}`,
      );
    }

    // データ行を取得
    const dataRowCount = studentRosterSheet.getLastRow() - 1;
    const allStudentRows = studentRosterSheet
      .getRange(2, 1, dataRowCount, studentRosterSheet.getLastColumn())
      .getValues();

    // 生徒データをオブジェクト形式に変換
    const studentsDataMap = {};
    allStudentRows.forEach((studentRow, index) => {
      const studentId = studentRow[requiredColumns.studentId];
      if (studentId && String(studentId).trim()) {
        studentsDataMap[studentId] = {
          studentId: studentId,
          realName: studentRow[requiredColumns.realName] || '',
          nickname: studentRow[requiredColumns.nickname] || '',
          phone: studentRow[requiredColumns.phone] || '',
          rowIndex: index + 2, // 【修正】ヘッダー行を考慮した実際の行番号を追加 (1-based + header)
        };
      }
    });

    const cacheData = {
      version: new Date().getTime(),
      students: studentsDataMap,
      metadata: {
        totalCount: Object.keys(studentsDataMap).length,
        lastUpdated: new Date().toISOString(),
      },
    };

    CacheService.getScriptCache().put(
      CACHE_KEYS.ALL_STUDENTS_BASIC,
      JSON.stringify(cacheData),
      CACHE_EXPIRY_SECONDS,
    );

    Logger.log(
      `生徒基本情報キャッシュを更新しました。件数: ${Object.keys(studentsDataMap).length}`,
    );
  } catch (e) {
    Logger.log(`rebuildAllStudentsBasicCacheでエラー: ${e.message}`);
    throw e;
  }
}

/**
 * 時間主導型トリガーから自動実行されるキャッシュ再構築関数
 * 定期的にスケジュールされたトリガーが呼び出す関数です。
 * スクリプトロックを使用して同時実行を防止します。
 *
 * 処理内容:
 * - 全キャッシュデータの定期再構築
 * - エラー発生時のログ記録
 * - アクティビティログの記録
 *
 * @throws {Error} ロック取得失敗やキャッシュ再構築中のエラーは内部でキャッチされログに記録
 */
function triggerScheduledCacheRebuild() {
  const scriptLock = LockService.getScriptLock();

  // 他の処理が実行中の場合はスキップ
  if (!scriptLock.tryLock(LOCK_WAIT_TIME_MS)) {
    Logger.log(
      '定期キャッシュ再構築: 他の処理が実行中のためスキップしました。',
    );
    return;
  }

  try {
    Logger.log('定期キャッシュ再構築: 開始します。');

    // 全てのキャッシュを順次再構築
    rebuildAllReservationsCache();
    rebuildAllStudentsBasicCache();
    rebuildScheduleMasterCache();
    rebuildAccountingMasterCache();

    Logger.log('定期キャッシュ再構築: 正常に完了しました。');

    logActivity(
      'system',
      '定期キャッシュ再構築',
      '成功',
      '時間主導型トリガーによる全キャッシュ自動再構築完了',
    );
  } catch (error) {
    Logger.log(`定期キャッシュ再構築: エラーが発生しました - ${error.message}`);
    logActivity(
      'system',
      '定期キャッシュ再構築',
      '失敗',
      `エラー: ${error.message}`,
    );
  } finally {
    scriptLock.releaseLock();
  }
}

// =================================================================
// キャッシュサービスからのデータ取得関数群
// =================================================================

/**
 * 指定されたキャッシュキーからデータを取得する汎用関数（キャッシュがない場合は自動再構築）
 * @param {string} cacheKey - キャッシュキー（CACHE_KEYS定数の使用推奨）
 * @param {boolean} autoRebuild - キャッシュがない場合に自動再構築するか（デフォルト: true）
 * @returns {object|null} キャッシュされたデータまたはnull
 */
function getCachedData(cacheKey, autoRebuild = true) {
  try {
    let cachedData = CacheService.getScriptCache().get(cacheKey);

    if (!cachedData && autoRebuild) {
      Logger.log(
        `${cacheKey}キャッシュが見つかりません。自動再構築を開始します...`,
      );
      try {
        // キャッシュキーに応じて適切な再構築関数を呼び出し
        switch (cacheKey) {
          case CACHE_KEYS.ALL_RESERVATIONS:
            rebuildAllReservationsCache();
            break;
          case CACHE_KEYS.ALL_STUDENTS_BASIC:
            rebuildAllStudentsBasicCache();
            break;
          case CACHE_KEYS.MASTER_SCHEDULE_DATA:
            rebuildScheduleMasterCache();
            break;
          case CACHE_KEYS.MASTER_ACCOUNTING_DATA:
            rebuildAccountingMasterCache();
            break;
          default:
            Logger.log(`${cacheKey}の自動再構築方法が不明です`);
            return null;
        }
        cachedData = CacheService.getScriptCache().get(cacheKey);
      } catch (rebuildError) {
        Logger.log(
          `${cacheKey}キャッシュ再構築エラー: ${rebuildError.message}`,
        );
        return null;
      }
    }

    if (!cachedData) {
      Logger.log(`${cacheKey}キャッシュが見つかりません`);
      return null;
    }

    const parsedData = JSON.parse(cachedData);
    const dataCount = getDataCount(parsedData, cacheKey);
    Logger.log(`${cacheKey}キャッシュから取得完了。件数: ${dataCount}`);
    return parsedData;
  } catch (e) {
    Logger.log(`getCachedData(${cacheKey})でエラー: ${e.message}`);
    return null;
  }
}

/**
 * キャッシュの存在確認とバージョン情報を取得する
 * @param {string} cacheKey - キャッシュキー
 * @returns {object} { exists: boolean, version: number|null, dataCount: number|null }
 */
function getCacheInfo(cacheKey) {
  try {
    const cachedData = CacheService.getScriptCache().get(cacheKey);
    if (!cachedData) {
      return { exists: false, version: null, dataCount: null };
    }

    const parsedData = JSON.parse(cachedData);
    let dataCount = null;

    if (parsedData.reservations) {
      dataCount = parsedData.reservations.length;
    } else if (parsedData.students) {
      dataCount = Object.keys(parsedData.students).length;
    } else if (parsedData.schedule) {
      dataCount = parsedData.schedule.length;
    } else if (parsedData.items) {
      dataCount = parsedData.items.length;
    } else if (parsedData.data) {
      dataCount = Array.isArray(parsedData.data)
        ? parsedData.data.length
        : null;
    }

    return {
      exists: true,
      version: parsedData.version || null,
      dataCount: dataCount,
    };
  } catch (e) {
    Logger.log(`getCacheInfo(${cacheKey})でエラー: ${e.message}`);
    return { exists: false, version: null, dataCount: null, error: e.message };
  }
}

/**
 * すべてのキャッシュの状態を取得する
 * @returns {object} 各キャッシュの状態情報
 */
function getAllCacheInfo() {
  const result = {};
  Object.values(CACHE_KEYS).forEach(key => {
    result[key] = getCacheInfo(key);
  });

  return result;
}

/**
 * 使いやすさのための定数定義
 */
const CACHE_KEYS = {
  ALL_RESERVATIONS: 'all_reservations',
  ALL_STUDENTS_BASIC: 'all_students_basic',
  MASTER_SCHEDULE_DATA: 'master_schedule_data',
  MASTER_ACCOUNTING_DATA: 'master_accounting_data',
};

/**
 * 各キャッシュキーに対応するデータ件数取得関数
 * @param {object} parsedData - パース済みキャッシュデータ
 * @param {string} cacheKey - キャッシュキー
 * @returns {number} データ件数
 */
function getDataCount(parsedData, cacheKey) {
  switch (cacheKey) {
    case CACHE_KEYS.ALL_RESERVATIONS:
      return parsedData.reservations?.length || 0;
    case CACHE_KEYS.ALL_STUDENTS_BASIC:
      return Object.keys(parsedData.students || {}).length;
    case CACHE_KEYS.MASTER_SCHEDULE_DATA:
      return parsedData.schedule?.length || 0;
    case CACHE_KEYS.MASTER_ACCOUNTING_DATA:
      return parsedData.items?.length || 0;
    default:
      return parsedData.data
        ? Array.isArray(parsedData.data)
          ? parsedData.data.length
          : 0
        : 0;
  }
}

/**
 * Schedule Master キャッシュの診断・修復機能
 * シートの存在確認とキャッシュの整合性チェックを実行
 * GASエディタから直接実行可能（メニューからトリガー登録推奨）
 */
function diagnoseAndFixScheduleMasterCache() {
  Logger.log('=== Schedule Master キャッシュ診断・修復開始 ===');

  try {
    // 1. シートの存在確認
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!sheet) {
      Logger.log('⚠️ Schedule Masterシートが存在しません');
      Logger.log('既存予約データから自動生成を試行します...');

      // 既存予約データから自動生成を試行
      try {
        const result = generateScheduleMasterFromExistingReservations();
        if (result && result.success !== false) {
          Logger.log('✅ Schedule Masterシートの自動生成完了');
        } else {
          Logger.log('❌ Schedule Masterシートの自動生成失敗');
          Logger.log('手動でSchedule Masterシートを作成してください');
          return false;
        }
      } catch (error) {
        Logger.log(`❌ 自動生成でエラー発生: ${error.message}`);
        return false;
      }
    } else {
      Logger.log('✅ Schedule Masterシートが存在します');

      // シートのデータ数を確認
      const dataRange = sheet.getDataRange();
      const rowCount = dataRange.getNumRows();
      Logger.log(`シートデータ行数: ${rowCount}行（ヘッダー含む）`);

      if (rowCount <= 1) {
        Logger.log(
          '⚠️ Schedule Masterシートにデータがありません（ヘッダーのみ）',
        );
      }
    }

    // 2. キャッシュ再構築
    Logger.log('キャッシュを再構築します...');
    rebuildScheduleMasterCache();

    // 3. キャッシュ検証
    const cacheData = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    if (!cacheData || !cacheData.schedule) {
      Logger.log('❌ キャッシュ再構築後もデータが空です');
      return false;
    }

    Logger.log(
      `✅ キャッシュ診断・修復完了 - Schedule データ件数: ${cacheData.schedule.length}`,
    );
    return true;
  } catch (error) {
    Logger.log(`❌ 診断・修復中にエラー: ${error.message}`);
    Logger.log(`スタックトレース: ${error.stack}`);
    return false;
  }
}
