/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.js
 * 【バージョン】: 4.1
 * 【役割】: 新しい統合予約シートとキャッシュサービスベースの高速データ管理システム
 * 【v4.1での変更点】:
 * - 会計マスタをCacheServiceに保存・管理する機能を追加。
 * - buildAndCacheAccountingMasterToCache関数を新設。
 * - 各種一括更新トリガーに上記関数呼び出しを追加。
 * =================================================================
 */

// ... (DEPRECATED functions are omitted for brevity but remain in the actual file) ...

/**
 * PropertiesServiceのキャッシュデータをクリアして新しい形式で再構築する関数
 * 重要な設定値（ADMIN_EMAIL, CALENDAR_IDS等）は保護し、キャッシュデータのみクリア
 */
function clearAndRebuildAllCaches() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'プロパティサービスのキャッシュデータクリア・再構築',
    '\n\nプロパティサービスのキャッシュデータをクリアして、現在の形式で新しいキャッシュサービスを構築します。' +
      '\n重要: ADMIN_EMAIL、CALENDAR_IDS等の設定値は保護されます。' +
      '実行しますか？',
    ui.ButtonSet.YES_NO,
  );

  if (response !== ui.Button.YES) {
    ui.alert('処理を中断しました。');
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) {
    ui.alert('現在、他の重い処理が実行中です。しばらく経ってから再度お試しください。');
    return;
  }

  try {
    getActiveSpreadsheet().toast('プロパティサービスのキャッシュデータをクリア中...', '処理中', -1);

    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();

    const protectedKeys = [
      'ADMIN_EMAIL',
      'CALENDAR_IDS',
      'GOOGLE_FORM_IDS',
      'SALES_SPREADSHEET_ID',
      'SPECIAL_NO_PHONE_LOGIN_COMMAND',
    ];

    const protectedData = {};
    protectedKeys.forEach(key => {
      if (allProperties[key]) {
        protectedData[key] = allProperties[key];
      }
    });

    const allKeys = Object.keys(allProperties);
    const keysToDelete = allKeys.filter(key => !protectedKeys.includes(key));

    keysToDelete.forEach(key => {
      properties.deleteProperty(key);
    });

    getActiveSpreadsheet().toast('新しいキャッシュサービスを構築中...', '処理中', -1);

    CacheService.getScriptCache().removeAll([
      'all_reservations',
      'all_students_basic',
      'master_schedule_data',
      'master_accounting_data',
    ]);

    rebuildAllReservationsToCache();
    rebuildAllStudentsBasicToCache();
    buildAndCacheScheduleMasterToCache();
    buildAndCacheAccountingMasterToCache(); // ★★★ 追加 ★★★

    getActiveSpreadsheet().toast('キャッシュサービスの完全再構築が完了しました。', '完了', 5);

    const protectedKeysCount = Object.keys(protectedData).length;
    ui.alert(`プロパティサービスのキャッシュデータクリア・再構築が完了しました。

削除キー数: ${keysToDelete.length}
保護された設定: ${protectedKeysCount}
新しい形式で再構築されました。`);

    logActivity(
      Session.getActiveUser().getEmail(),
      'プロパティサービスキャッシュ再構築',
      '成功',
      `${keysToDelete.length}件のキーをクリア、${protectedKeysCount}件を保護、新形式で再構築`,
    );
  } catch (e) {
    Logger.log(`プロパティサービスのキャッシュ再構築でエラー: ${e.message}`);
    handleError(
      `プロパティサービスのキャッシュ再構築中にエラーが発生しました。

詳細: ${e.message}`,
      true,
    );
  } finally {
    lock.releaseLock();
  }
}

// ... (Other functions like cleanupOldCaches remain) ...

/**
 * 【移行】新しいキャッシュサービス（予約、生徒基本情報）を一括で再構築するエントリーポイント
 */
function rebuildNewCaches_entryPoint() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '新しいキャッシュサービスの構築',
    '「統合予約シート」と「生徒名簿」から新しいキャッシュサービスを構築します。よろしいですか？',
    ui.ButtonSet.OK_CANCEL,
  );
  if (response !== ui.Button.OK) {
    ui.alert('処理を中断しました。');
    return;
  }

  try {
    getActiveSpreadsheet().toast('新しいキャッシュサービスの構築を開始しました...', '処理中', -1);
    rebuildAllReservationsToCache();
    rebuildAllStudentsBasicToCache();
    buildAndCacheAccountingMasterToCache();
    buildAndCacheScheduleMasterToCache(); // ★★★ 追加 ★★★
    getActiveSpreadsheet().toast('新しいキャッシュサービスの構築が完了しました。', '成功', 5);
    logActivity(
      'system',
      '新キャッシュサービス構築',
      '成功',
      'all_reservations, all_students_basic, master_accounting_data, master_schedule_dataキャッシュサービスを構築',
    );
  } catch (e) {
    handleError(`新しいキャッシュサービスの構築中にエラーが発生しました: ${e.message}`, true);
  }
}

/**
 * 「統合予約シート」から全予約データを読み込み、CacheServiceに保存する
 */
function rebuildAllReservationsToCache() {
  try {
    const integratedSheet = getSheetByName('統合予約シート');
    if (!integratedSheet || integratedSheet.getLastRow() < 2) {
      Logger.log('統合予約シートが見つからないか、データが空です。');
      return;
    }
    const header = integratedSheet
      .getRange(1, 1, 1, integratedSheet.getLastColumn())
      .getValues()[0];
    const headerMap = createHeaderMap(header);
    const startTimeCol = headerMap.get(HEADER_START_TIME);
    const endTimeCol = headerMap.get(HEADER_END_TIME);
    const dateCol = headerMap.get(HEADER_DATE);

    const reservationValues = integratedSheet
      .getRange(2, 1, integratedSheet.getLastRow() - 1, integratedSheet.getLastColumn())
      .getValues();

    // カスタム高速日付フォーマット関数
    const fastFormatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const fastFormatTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    // 列インデックスが有効な場合のみ処理
    const columnsToProcess = [];
    if (dateCol !== undefined) columnsToProcess.push({ col: dateCol, formatter: fastFormatDate });
    if (startTimeCol !== undefined) columnsToProcess.push({ col: startTimeCol, formatter: fastFormatTime });
    if (endTimeCol !== undefined) columnsToProcess.push({ col: endTimeCol, formatter: fastFormatTime });

    if (columnsToProcess.length > 0) {
      reservationValues.forEach(row => {
        columnsToProcess.forEach(({ col, formatter }) => {
          const cellValue = row[col];
          if (cellValue instanceof Date) {
            row[col] = formatter(cellValue);
          }
        });
      });
    }

    const cacheData = {
      version: new Date().getTime(),
      reservations: reservationValues,
    };

    CacheService.getScriptCache().put('all_reservations', JSON.stringify(cacheData), 21600);
    Logger.log(
      `all_reservationsキャッシュサービスを更新しました。件数: ${reservationValues.length}`,
    );
  } catch (e) {
    Logger.log(`rebuildAllReservationsToCacheでエラー: ${e.message}`);
    throw e;
  }
}

/**
 * ★★★ 新規作成 ★★★
 * 会計マスタを読み込み、CacheServiceに保存する
 */
function buildAndCacheAccountingMasterToCache() {
  try {
    const masterDataResult = getAccountingMasterData();

    if (masterDataResult.success && masterDataResult.data.length > 0) {
      const cacheData = {
        version: new Date().getTime(),
        items: masterDataResult.data,
      };
      CacheService.getScriptCache().put('master_accounting_data', JSON.stringify(cacheData), 21600);
      Logger.log(
        `master_accounting_dataキャッシュを更新しました。件数: ${masterDataResult.data.length}`,
      );
      return cacheData;
    } else {
      Logger.log('キャッシュする会計マスターデータがありませんでした。');
      if (!masterDataResult.success) {
        throw new Error(masterDataResult.message);
      }
    }
  } catch (e) {
    Logger.log(`buildAndCacheAccountingMasterToCacheでエラー: ${e.message}`);
    throw new Error(`会計マスタのキャッシュ作成に失敗しました: ${e.message}`);
  }
}

/**
 * 日程マスタを読み込み、CacheServiceに保存する
 */
function buildAndCacheScheduleMasterToCache() {
  try {
    const today = new Date();
    const fromDate = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    const toDate = Utilities.formatDate(oneYearLater, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const scheduleData = getScheduleDataFromSheet(fromDate, toDate);

    if (scheduleData && scheduleData.length > 0) {
      const cacheData = {
        version: new Date().getTime(),
        schedule: scheduleData,
      };
      CacheService.getScriptCache().put('master_schedule_data', JSON.stringify(cacheData), 21600);
      Logger.log(`master_schedule_dataキャッシュを更新しました。件数: ${scheduleData.length}`);
    } else {
      Logger.log('キャッシュする日程マスターデータがありませんでした。');
    }
  } catch (e) {
    Logger.log(`buildAndCacheScheduleMasterToCacheでエラー: ${e.message}`);
    throw new Error(`日程マスタのキャッシュ作成に失敗しました: ${e.message}`);
  }
}

/**
 * 会計マスタデータをキャッシュに保存する
 */
function rebuildAccountingMasterToCache() {
  try {
    const sheet = getSheetByName(ACCOUNTING_MASTER_SHEET_NAME);
    if (!sheet) {
      Logger.log('会計マスタシートが見つかりません');
      return;
    }

    if (sheet.getLastRow() < 2) {
      Logger.log('会計マスタシートにデータがありません');
      return;
    }

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const timezone = getSpreadsheetTimezone();

    const timeColumns = [
      HEADER_CLASS_START,
      HEADER_CLASS_END,
      HEADER_BREAK_START,
      HEADER_BREAK_END,
    ];
    const timeColumnIndices = timeColumns.map(h => header.indexOf(h));

    const processedData = data.map(row => {
      let item = {};
      header.forEach((key, index) => {
        if (timeColumnIndices.includes(index) && row[index] instanceof Date) {
          item[key] = Utilities.formatDate(row[index], timezone, 'HH:mm');
        } else {
          item[key] = row[index];
        }
      });
      return item;
    });

    const cacheData = {
      version: new Date().getTime(),
      data: processedData,
    };
    
    CacheService.getScriptCache().put('accounting_master_data', JSON.stringify(cacheData), 21600); // 6時間
    Logger.log(`会計マスタデータキャッシュを更新しました。件数: ${processedData.length}`);
  } catch (e) {
    Logger.log(`rebuildAccountingMasterToCacheでエラー: ${e.message}`);
    throw new Error(`会計マスタのキャッシュ作成に失敗しました: ${e.message}`);
  }
}

/**
 * 「生徒名簿」から主要4項目を読み込み、CacheServiceに保存する
 */
function rebuildAllStudentsBasicToCache() {
  try {
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet || rosterSheet.getLastRow() < 2) {
      Logger.log('生徒名簿シートが見つからないか、データが空です。');
      return;
    }

    const header = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);

    const studentIdCol = headerMap.get(HEADER_STUDENT_ID);
    const realNameCol = headerMap.get(HEADER_REAL_NAME);
    const nicknameCol = headerMap.get(HEADER_NICKNAME);
    const phoneCol = headerMap.get(HEADER_PHONE);

    if (
      studentIdCol === undefined ||
      realNameCol === undefined ||
      nicknameCol === undefined ||
      phoneCol === undefined
    ) {
      throw new Error(
        '生徒名簿の必須ヘッダー（生徒ID, 本名, ニックネーム, 電話番号）が見つかりません。',
      );
    }

    const allRosterData = rosterSheet
      .getRange(2, 1, rosterSheet.getLastRow() - 1, rosterSheet.getLastColumn())
      .getValues();
    const studentsBasicData = {};

    allRosterData.forEach(row => {
      const studentId = row[studentIdCol];
      if (studentId) {
        studentsBasicData[studentId] = {
          studentId: studentId,
          realName: row[realNameCol],
          nickname: row[nicknameCol],
          phone: row[phoneCol],
        };
      }
    });

    const cacheData = {
      version: new Date().getTime(),
      students: studentsBasicData,
    };

    CacheService.getScriptCache().put(
      'all_students_basic',
      JSON.stringify(cacheData),
      CACHE_EXPIRY_SECONDS,
    );
    Logger.log(
      `all_students_basicキャッシュサービスを更新しました。件数: ${Object.keys(studentsBasicData).length}`,
    );
  } catch (e) {
    Logger.log(`rebuildAllStudentsBasicToCacheでエラー: ${e.message}`);
    throw e;
  }
}

/**
 * 時間主導型トリガーから実行されるキャッシュ再構築関数
 */
function trigger_rebuildAllCaches() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) {
    Logger.log('trigger_rebuildAllCaches: 他の処理が実行中のためスキップしました。');
    return;
  }

  try {
    Logger.log('trigger_rebuildAllCaches: キャッシュ再構築を開始します。');
    rebuildAllReservationsToCache();
    rebuildAllStudentsBasicToCache();
    buildAndCacheScheduleMasterToCache();
    buildAndCacheAccountingMasterToCache(); // ★★★ 追加 ★★★
    Logger.log('trigger_rebuildAllCaches: キャッシュ再構築が完了しました。');
    logActivity(
      'system',
      '定期キャッシュ再構築',
      '成功',
      '時間主導型トリガーによる全キャッシュ再構築',
    );
  } catch (e) {
    Logger.log(`trigger_rebuildAllCaches: キャッシュ再構築中にエラーが発生しました: ${e.message}`);
    logActivity('system', '定期キャッシュ再構築', '失敗', `エラー: ${e.message}`);
  } finally {
    lock.releaseLock();
  }
}
