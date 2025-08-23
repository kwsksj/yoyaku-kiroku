/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.js
 * 【バージョン】: 5.0
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
 * PropertiesServiceの古いキャッシュデータをクリーンアップする関数
 * 重要な設定値（ADMIN_EMAIL、CALENDAR_IDS等）は保護し、不要な古いキャッシュデータのみ削除します。
 *
 * 保護される設定値:
 * - ADMIN_EMAIL: 管理者メールアドレス
 * - CALENDAR_IDS: Googleカレンダー連携設定
 * - GOOGLE_FORM_IDS: Googleフォーム連携設定
 * - SALES_SPREADSHEET_ID: 売上管理スプレッドシート連携設定
 * - SPECIAL_NO_PHONE_LOGIN_COMMAND: 特別ログインコマンド
 *
 * @throws {Error} PropertiesServiceの操作中にエラーが発生した場合
 */
function cleanupPropertiesServiceCache() {
  const userInterface = SpreadsheetApp.getUi();
  const userConfirmation = userInterface.alert(
    'PropertiesService キャッシュクリーンアップ',
    'PropertiesServiceに残っている古いキャッシュデータをクリーンアップします。\n\n' +
      '⚠️ 重要: 管理者設定（メール、カレンダーID等）は保護されます。\n' +
      '⚠️ この操作により古い形式のキャッシュが削除されます。\n\n' +
      '実行しますか？',
    userInterface.ButtonSet.YES_NO,
  );

  if (userConfirmation !== userInterface.Button.YES) {
    userInterface.alert('処理を中断しました。');
    return;
  }

  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(LOCK_WAIT_TIME_MS)) {
    userInterface.alert('現在、他の重い処理が実行中です。しばらく経ってから再度お試しください。');
    return;
  }

  try {
    const spreadsheet = getActiveSpreadsheet();
    spreadsheet.toast('PropertiesServiceをクリーンアップ中...', 'クリーンアップ処理', -1);

    const scriptProperties = PropertiesService.getScriptProperties();
    const allStoredProperties = scriptProperties.getProperties();

    // 保護対象の重要設定値を定義
    const protectedPropertyKeys = [
      'ADMIN_EMAIL',
      'CALENDAR_IDS',
      'GOOGLE_FORM_IDS',
      'SALES_SPREADSHEET_ID',
      'SPECIAL_NO_PHONE_LOGIN_COMMAND',
    ];

    // 保護対象の設定値をバックアップ
    const protectedSettings = {};
    protectedPropertyKeys.forEach(protectedKey => {
      if (allStoredProperties[protectedKey]) {
        protectedSettings[protectedKey] = allStoredProperties[protectedKey];
        Logger.log(
          `保護設定確認: ${protectedKey} = ${allStoredProperties[protectedKey].substring(0, 50)}...`,
        );
      }
    });

    // 削除対象のキーを特定（保護対象以外の全て）
    const allPropertyKeys = Object.keys(allStoredProperties);
    const deletablePropertyKeys = allPropertyKeys.filter(
      propertyKey => !protectedPropertyKeys.includes(propertyKey),
    );

    Logger.log(
      `PropertiesService分析完了: 全${allPropertyKeys.length}件中、${deletablePropertyKeys.length}件を削除対象、${Object.keys(protectedSettings).length}件を保護`,
    );

    // 古いキャッシュデータを削除
    deletablePropertyKeys.forEach(keyToDelete => {
      scriptProperties.deleteProperty(keyToDelete);
    });

    spreadsheet.toast('PropertiesServiceのクリーンアップが完了しました。', '完了', 3);

    // 結果報告
    const protectedCount = Object.keys(protectedSettings).length;
    userInterface.alert(
      `PropertiesServiceクリーンアップが完了しました。\n\n` +
        `✅ 削除した古いキャッシュ: ${deletablePropertyKeys.length}件\n` +
        `✅ 保護した重要設定: ${protectedCount}件\n\n` +
        `PropertiesServiceが整理されました。`,
    );

    // アクティビティログに記録
    logActivity(
      Session.getActiveUser().getEmail(),
      'PropertiesServiceクリーンアップ',
      '成功',
      `削除:${deletablePropertyKeys.length}件, 保護:${protectedCount}件`,
    );
  } catch (error) {
    Logger.log(`PropertiesServiceクリーンアップでエラー: ${error.message}`);
    handleError(
      `PropertiesServiceのクリーンアップ中にエラーが発生しました。\n\n` +
        `詳細: ${error.message}\n\n` +
        `システム管理者に連絡してください。`,
      true,
    );
  } finally {
    scriptLock.releaseLock();
  }
}

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
    getActiveSpreadsheet().toast('キャッシュデータの一括再構築を開始しました...', '処理中', -1);

    // 全てのキャッシュを順次再構築
    rebuildAllReservationsCache();
    rebuildAllStudentsBasicCache();
    rebuildAccountingMasterCache();
    rebuildScheduleMasterCache();

    getActiveSpreadsheet().toast('キャッシュデータの一括再構築が完了しました。', '成功', 5);

    logActivity(
      'system',
      'キャッシュ一括再構築',
      '成功',
      '全キャッシュ（予約、生徒、会計マスター、日程マスター）を再構築完了',
    );
  } catch (error) {
    handleError(`キャッシュデータの一括再構築中にエラーが発生しました: ${error.message}`, true);
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
    if (!integratedReservationSheet || integratedReservationSheet.getLastRow() < 2) {
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

    Logger.log(`全予約データキャッシュを更新しました。件数: ${allReservationRows.length}`);
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
    const startDate =
      fromDate || Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    const endDate =
      toDate || Utilities.formatDate(oneYearLater, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const scheduleDataList = getScheduleDataFromSheet(startDate, endDate);

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
    throw new Error(`日程マスターのキャッシュ作成に失敗しました: ${error.message}`);
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
    const sheet = getSheetByName(ACCOUNTING_MASTER_SHEET_NAME);
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
    const timezone = getSpreadsheetTimezone();

    // 時間列のインデックスを特定
    const timeColumnNames = [
      HEADER_CLASS_START,
      HEADER_CLASS_END,
      HEADER_BREAK_START,
      HEADER_BREAK_END,
    ];
    const timeColumnIndices = timeColumnNames.map(columnName => headers.indexOf(columnName));

    // データを処理してオブジェクト形式に変換
    const processedItems = allData.map(rowData => {
      const item = {};
      headers.forEach((headerName, columnIndex) => {
        const cellValue = rowData[columnIndex];

        // 時間列の場合は HH:mm 形式にフォーマット
        if (timeColumnIndices.includes(columnIndex) && cellValue instanceof Date) {
          item[headerName] = Utilities.formatDate(cellValue, timezone, 'HH:mm');
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

    Logger.log(`会計マスターデータキャッシュを更新しました。件数: ${processedItems.length}`);
    return cacheData;
  } catch (error) {
    Logger.log(`rebuildAccountingMasterCacheでエラー: ${error.message}`);
    throw new Error(`会計マスターのキャッシュ作成に失敗しました: ${error.message}`);
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
      studentId: headerColumnMap.get(HEADER_STUDENT_ID),
      realName: headerColumnMap.get(HEADER_REAL_NAME),
      nickname: headerColumnMap.get(HEADER_NICKNAME),
      phone: headerColumnMap.get(HEADER_PHONE),
    };

    // 必須列の存在確認
    const missingColumns = Object.entries(requiredColumns)
      .filter(([, index]) => index === undefined)
      .map(([columnName]) => columnName);

    if (missingColumns.length > 0) {
      throw new Error(`生徒名簿の必須ヘッダーが見つかりません: ${missingColumns.join(', ')}`);
    }

    // データ行を取得
    const dataRowCount = studentRosterSheet.getLastRow() - 1;
    const allStudentRows = studentRosterSheet
      .getRange(2, 1, dataRowCount, studentRosterSheet.getLastColumn())
      .getValues();

    // 生徒データをオブジェクト形式に変換
    const studentsDataMap = {};
    allStudentRows.forEach(studentRow => {
      const studentId = studentRow[requiredColumns.studentId];
      if (studentId && String(studentId).trim()) {
        studentsDataMap[studentId] = {
          studentId: studentId,
          realName: studentRow[requiredColumns.realName] || '',
          nickname: studentRow[requiredColumns.nickname] || '',
          phone: studentRow[requiredColumns.phone] || '',
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
    Logger.log('定期キャッシュ再構築: 他の処理が実行中のためスキップしました。');
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
    logActivity('system', '定期キャッシュ再構築', '失敗', `エラー: ${error.message}`);
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
      Logger.log(`${cacheKey}キャッシュが見つかりません。自動再構築を開始します...`);
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
        Logger.log(`${cacheKey}キャッシュ再構築エラー: ${rebuildError.message}`);
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
      dataCount = Array.isArray(parsedData.data) ? parsedData.data.length : null;
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
      return parsedData.data ? (Array.isArray(parsedData.data) ? parsedData.data.length : 0) : 0;
  }
}
