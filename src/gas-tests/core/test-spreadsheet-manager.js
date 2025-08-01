/**
 * =================================================================
 * 【ファイル名】: test_spreadsheet_manager_functionality.js
 * 【バージョン】: 1.0
 * 【役割】: SpreadsheetManager最適化後の機能性テスト
 * 【説明】: 最適化による機能への影響がないことを検証
 * =================================================================
 */

/**
 * SpreadsheetManager最適化後の機能性テスト実行
 */
function runSpreadsheetManagerFunctionalityTests() {
  console.log('=== SpreadsheetManager最適化後 機能性テスト開始 ===');

  const testResults = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  // テスト関数一覧
  const tests = [
    testSpreadsheetManagerBasicFunctionality,
    testCacheManagerFunctionality,
    testSheetUtilsFunctionality,
    testBatchProcessingFunctionality,
    testExternalServicesFunctionality,
    testBackendReadFunctionality,
    testDataConsistency,
    testPerformanceBaseline,
  ];

  // 各テストを実行
  tests.forEach(testFunc => {
    try {
      console.log(`\n--- ${testFunc.name} 実行中 ---`);
      const result = testFunc();
      if (result.success) {
        testResults.passed++;
        console.log(`✅ ${testFunc.name}: 成功`);
      } else {
        testResults.failed++;
        testResults.errors.push(`❌ ${testFunc.name}: ${result.message}`);
        console.error(`❌ ${testFunc.name}: ${result.message}`);
      }
    } catch (error) {
      testResults.failed++;
      testResults.errors.push(`💥 ${testFunc.name}: ${error.message}`);
      console.error(`💥 ${testFunc.name}: ${error.message}`);
    }
  });

  // 総合結果
  console.log('\n=== テスト結果総括 ===');
  console.log(`✅ 成功: ${testResults.passed}`);
  console.log(`❌ 失敗: ${testResults.failed}`);
  console.log(
    `📊 成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`,
  );

  if (testResults.errors.length > 0) {
    console.log('\n🚨 エラー詳細:');
    testResults.errors.forEach(error => console.log(error));
  }

  return testResults;
}

/**
 * SpreadsheetManagerの基本機能テスト
 */
function testSpreadsheetManagerBasicFunctionality() {
  try {
    // 1. SpreadsheetManagerインスタンスの取得
    const spreadsheet1 = getActiveSpreadsheet();
    const spreadsheet2 = getActiveSpreadsheet();

    // 2. 同一インスタンスが返されることを確認（キャッシュ機能）
    if (spreadsheet1 !== spreadsheet2) {
      return { success: false, message: 'SpreadsheetManagerのキャッシュが機能していません' };
    }

    // 3. 基本メソッドの動作確認
    const spreadsheetId = spreadsheet1.getId();
    const timezone = getSpreadsheetTimezone();
    const testSheet = getSheetByName(ROSTER_SHEET_NAME);

    if (!spreadsheetId || !timezone || !testSheet) {
      return {
        success: false,
        message: 'SpreadsheetManagerの基本メソッドでnull/undefinedが返されました',
      };
    }

    // 4. シート取得の一貫性確認
    const testSheet2 = getSheetByName(ROSTER_SHEET_NAME);
    if (testSheet.getName() !== testSheet2.getName()) {
      return { success: false, message: 'getSheetByNameの結果が一貫していません' };
    }

    return { success: true, message: 'SpreadsheetManager基本機能テスト成功' };
  } catch (error) {
    return { success: false, message: `SpreadsheetManager基本機能テストエラー: ${error.message}` };
  }
}

/**
 * CacheManagerの機能テスト
 */
function testCacheManagerFunctionality() {
  try {
    // 1. 名簿データ取得の動作確認
    const studentNames = getAllStudentNames();
    if (!(studentNames instanceof Set)) {
      return { success: false, message: 'getAllStudentNamesがSetを返していません' };
    }

    // 2. 予約データ取得の動作確認
    const reservations = getAllReservations();
    if (!Array.isArray(reservations)) {
      return { success: false, message: 'getAllReservationsが配列を返していません' };
    }

    // 3. アーカイブデータ取得の動作確認
    const archivedReservations = getAllArchivedReservations();
    if (!Array.isArray(archivedReservations)) {
      return { success: false, message: 'getAllArchivedReservationsが配列を返していません' };
    }

    // 4. 将来の予約データ取得の動作確認
    const futureReservations = getAllFutureReservations();
    if (!Array.isArray(futureReservations)) {
      return { success: false, message: 'getAllFutureReservationsが配列を返していません' };
    }

    return { success: true, message: 'CacheManager機能テスト成功' };
  } catch (error) {
    return { success: false, message: `CacheManager機能テストエラー: ${error.message}` };
  }
}

/**
 * SheetUtilsの機能テスト
 */
function testSheetUtilsFunctionality() {
  try {
    // 1. シート存在確認
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) {
      return { success: false, message: '生徒名簿シートが取得できません' };
    }

    // 2. ヘッダーマップ作成テスト
    const headerRow = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(headerRow);

    if (!headerMap || !(headerMap instanceof Map)) {
      return { success: false, message: 'createHeaderMapがMapオブジェクトを返していません' };
    }

    // 3. 必要なヘッダーの存在確認
    const requiredHeaders = [HEADER_STUDENT_ID, HEADER_REAL_NAME, HEADER_NICKNAME];
    for (const header of requiredHeaders) {
      if (!headerMap.has(header)) {
        return { success: false, message: `必要なヘッダー「${header}」が見つかりません` };
      }
    }

    return { success: true, message: 'SheetUtils機能テスト成功' };
  } catch (error) {
    return { success: false, message: `SheetUtils機能テストエラー: ${error.message}` };
  }
}

/**
 * BatchProcessingの機能テスト
 */
function testBatchProcessingFunctionality() {
  try {
    // 1. 教室シート存在確認
    let validSheetsCount = 0;
    CLASSROOM_SHEET_NAMES.forEach(sheetName => {
      const sheet = getSheetByName(sheetName);
      if (sheet) {
        validSheetsCount++;
      }
    });

    if (validSheetsCount === 0) {
      return { success: false, message: '有効な教室シートが見つかりません' };
    }

    // 2. アーカイブシート存在確認
    let validArchiveSheetsCount = 0;
    ARCHIVE_SHEET_NAMES.forEach(sheetName => {
      const sheet = getSheetByName(sheetName);
      if (sheet) {
        validArchiveSheetsCount++;
      }
    });

    if (validArchiveSheetsCount === 0) {
      return { success: false, message: '有効なアーカイブシートが見つかりません' };
    }

    return { success: true, message: 'BatchProcessing機能テスト成功' };
  } catch (error) {
    return { success: false, message: `BatchProcessing機能テストエラー: ${error.message}` };
  }
}

/**
 * ExternalServicesの機能テスト
 */
function testExternalServicesFunctionality() {
  try {
    // 1. サマリーシート取得テスト
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);
    if (!summarySheet) {
      return { success: false, message: 'サマリーシートが取得できません' };
    }

    // 2. 教室名リストでのテスト（実際の教室名を使用）
    if (CLASSROOM_SHEET_NAMES.length > 0) {
      const testClassroom = CLASSROOM_SHEET_NAMES[0].slice(0, -2); // 「01」を除去
      const stringArray = createStringArrayFromCounts(testClassroom);

      if (!Array.isArray(stringArray)) {
        return { success: false, message: 'createStringArrayFromCountsが配列を返していません' };
      }
    }

    return { success: true, message: 'ExternalServices機能テスト成功' };
  } catch (error) {
    return { success: false, message: `ExternalServices機能テストエラー: ${error.message}` };
  }
}

/**
 * BackendReadの機能テスト
 */
function testBackendReadFunctionality() {
  try {
    // 1. 会計マスタデータ取得テスト
    const accountingData = getAccountingMasterData();
    if (!accountingData || !accountingData.success || !Array.isArray(accountingData.data)) {
      return { success: false, message: 'getAccountingMasterDataが正しい形式を返していません' };
    }

    // 2. 予約可能枠データ取得テスト
    const availableSlots = getAvailableSlotsFromSummary();
    if (!Array.isArray(availableSlots)) {
      return { success: false, message: 'getAvailableSlotsFromSummaryが配列を返していません' };
    }

    return { success: true, message: 'BackendRead機能テスト成功' };
  } catch (error) {
    return { success: false, message: `BackendRead機能テストエラー: ${error.message}` };
  }
}

/**
 * データ整合性テスト
 */
function testDataConsistency() {
  try {
    // 1. スプレッドシートIDの整合性確認
    const managedSpreadsheet = getActiveSpreadsheet();
    const directSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (managedSpreadsheet.getId() !== directSpreadsheet.getId()) {
      return { success: false, message: 'SpreadsheetManagerと直接取得のIDが一致しません' };
    }

    // 2. タイムゾーンの整合性確認
    const managedTimezone = getSpreadsheetTimezone();
    const directTimezone = directSpreadsheet.getSpreadsheetTimeZone();

    if (managedTimezone !== directTimezone) {
      return {
        success: false,
        message: 'SpreadsheetManagerと直接取得のタイムゾーンが一致しません',
      };
    }

    // 3. シート取得の整合性確認
    const managedSheet = getSheetByName(ROSTER_SHEET_NAME);
    const directSheet = directSpreadsheet.getSheetByName(ROSTER_SHEET_NAME);

    if (!managedSheet || !directSheet || managedSheet.getName() !== directSheet.getName()) {
      return { success: false, message: 'SpreadsheetManagerと直接取得のシートが一致しません' };
    }

    return { success: true, message: 'データ整合性テスト成功' };
  } catch (error) {
    return { success: false, message: `データ整合性テストエラー: ${error.message}` };
  }
}

/**
 * パフォーマンスベースラインテスト
 */
function testPerformanceBaseline() {
  try {
    const iterations = 10;

    // 1. SpreadsheetManager使用時の測定
    const startTime1 = new Date();
    for (let i = 0; i < iterations; i++) {
      const ss = getActiveSpreadsheet();
      const sheet = getSheetByName(ROSTER_SHEET_NAME);
      const timezone = getSpreadsheetTimezone();
    }
    const endTime1 = new Date();
    const managedTime = endTime1 - startTime1;

    // 2. 直接呼び出し時の測定（比較用）
    const startTime2 = new Date();
    for (let i = 0; i < iterations; i++) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
      const timezone = ss.getSpreadsheetTimeZone();
    }
    const endTime2 = new Date();
    const directTime = endTime2 - startTime2;

    // 3. パフォーマンス改善率の計算
    const improvementRatio = ((directTime - managedTime) / directTime) * 100;

    console.log(`SpreadsheetManager: ${managedTime}ms`);
    console.log(`直接呼び出し: ${directTime}ms`);
    console.log(`改善率: ${improvementRatio.toFixed(1)}%`);

    // 期待値: SpreadsheetManagerの方が高速、または同等
    if (managedTime > directTime * 1.2) {
      // 20%以上遅い場合は失敗
      return {
        success: false,
        message: `パフォーマンスが期待値を下回っています (改善率: ${improvementRatio.toFixed(1)}%)`,
      };
    }

    return {
      success: true,
      message: `パフォーマンステスト成功 (改善率: ${improvementRatio.toFixed(1)}%)`,
    };
  } catch (error) {
    return { success: false, message: `パフォーマンステストエラー: ${error.message}` };
  }
}

/**
 * 簡易テスト実行（メニューから呼び出し可能）
 */
function quickSpreadsheetManagerTest() {
  try {
    console.log('=== SpreadsheetManager 簡易テスト ===');

    // 基本機能テスト
    const spreadsheet = getActiveSpreadsheet();
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    const timezone = getSpreadsheetTimezone();

    if (!spreadsheet || !rosterSheet || !timezone) {
      throw new Error('基本機能が動作していません');
    }

    // データ取得テスト
    const studentNames = getAllStudentNames();
    const reservations = getAllReservations();

    if (!Array.isArray(studentNames) || !Array.isArray(reservations)) {
      throw new Error('データ取得機能が動作していません');
    }

    console.log('✅ 全ての簡易テストが成功しました');

    getActiveSpreadsheet().toast(
      '✅ SpreadsheetManager簡易テスト成功\n全ての基本機能が正常に動作しています',
      'テスト結果',
      5,
    );
  } catch (error) {
    console.error('❌ 簡易テスト失敗:', error.message);

    getActiveSpreadsheet().toast(
      `❌ SpreadsheetManager簡易テスト失敗\n${error.message}`,
      'テスト結果',
      10,
    );
  }
}
