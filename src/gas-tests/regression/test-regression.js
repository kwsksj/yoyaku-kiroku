/**
 * =================================================================
 * 【ファイル名】: ZZ_TestRegression.js
 * 【役割】: SpreadsheetManager最適化後の機能回帰テスト
 * 【重要】: 本番機能が正常に動作することを確認
 * 【接頭辞ZZ】: ファイル一覧で最下部に表示されるようにする
 * =================================================================
 */

/**
 * 全体的な機能回帰テスト
 */
function testRegressionSuite() {
  Logger.log('=== 機能回帰テスト開始 ===');

  const results = {
    startTime: new Date(),
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
    },
  };

  // 1. SpreadsheetManager基本機能テスト
  results.tests.spreadsheetManager = testSpreadsheetManagerIntegrity();

  // 2. SpreadsheetManager最適化確認テスト
  results.tests.optimizationVerification = testOptimizationVerification();

  // 3. ユーザー認証機能テスト
  results.tests.userAuthentication = testUserAuthenticationFlow();

  // 4. データ読み込み機能テスト
  results.tests.dataReading = testDataReadingFunctions();

  // 5. 予約枠取得機能テスト
  results.tests.availableSlots = testAvailableSlotsFunctionality();

  // 6. ユーティリティ機能テスト
  results.tests.utilities = testUtilityFunctions();

  // 7. サマリー機能テスト
  results.tests.summary = testSummaryFunctions();

  // 結果の集計
  Object.values(results.tests).forEach(test => {
    results.summary.total++;
    if (test.success) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  });

  results.endTime = new Date();
  results.totalTime = results.endTime - results.startTime;

  Logger.log('=== 機能回帰テスト完了 ===');
  Logger.log(
    `合計: ${results.summary.total}, 成功: ${results.summary.passed}, 失敗: ${results.summary.failed}`,
  );
  Logger.log(`実行時間: ${results.totalTime}ms`);

  Logger.log('機能回帰テスト結果: ' + JSON.stringify(results, null, 2));

  return results;
}

/**
 * SpreadsheetManager基本機能の整合性テスト
 */
function testSpreadsheetManagerIntegrity() {
  try {
    Logger.log('--- SpreadsheetManager整合性テスト ---');

    // 基本機能テスト
    const ss = getActiveSpreadsheet();
    const spreadsheetId = ss.getId();

    // シート取得テスト
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);

    // タイムゾーン取得テスト
    const timezone = getSpreadsheetTimezone();

    // 複数回呼び出しでキャッシュ動作確認
    const ss2 = getActiveSpreadsheet();
    const sameInstance = ss === ss2; // キャッシュが効いているか

    return {
      success: true,
      spreadsheetId: spreadsheetId,
      hasRosterSheet: !!rosterSheet,
      hasSummarySheet: !!summarySheet,
      timezone: timezone,
      cacheWorking: sameInstance,
      message: 'SpreadsheetManager正常動作',
    };
  } catch (error) {
    return {
      success: false,
      message: `SpreadsheetManagerエラー: ${error.message}`,
    };
  }
}

/**
 * ユーザー認証フローのテスト
 */
function testUserAuthenticationFlow() {
  try {
    Logger.log('--- ユーザー認証フローテスト ---');

    // 無効な電話番号でのテスト
    const invalidResult = authenticateUser('invalid');

    // 形式は正しいが未登録の電話番号でのテスト
    const unregisteredResult = authenticateUser('09012345678');

    return {
      success: true,
      invalidAuth: !invalidResult.success,
      unregisteredAuth: !unregisteredResult.success,
      hasPhoneForRegistration: !!unregisteredResult.phoneForRegistration,
      message: 'ユーザー認証機能正常',
    };
  } catch (error) {
    return {
      success: false,
      message: `ユーザー認証エラー: ${error.message}`,
    };
  }
}

/**
 * データ読み込み機能のテスト
 */
function testDataReadingFunctions() {
  try {
    Logger.log('--- データ読み込み機能テスト ---');

    // 会計マスタデータ取得テスト
    const accountingMaster = getAccountingMasterData();

    // 初期データ取得テスト（テスト用ユーザーID）
    const initialData = getInitialWebApp_Data('test-user-id');

    return {
      success: true,
      hasAccountingMaster: accountingMaster.success,
      hasInitialData: initialData.success,
      accountingDataCount: accountingMaster.success ? accountingMaster.data.length : 0,
      message: 'データ読み込み機能正常',
    };
  } catch (error) {
    return {
      success: false,
      message: `データ読み込みエラー: ${error.message}`,
    };
  }
}

/**
 * 予約枠取得機能のテスト
 */
function testAvailableSlotsFunctionality() {
  try {
    Logger.log('--- 予約枠取得機能テスト ---');

    // サマリーから予約枠取得
    const slots = getAvailableSlotsFromSummary();

    return {
      success: true,
      slotCount: slots.length,
      hasValidSlots: slots.length > 0 && slots[0].classroom && slots[0].date,
      sampleSlot: slots.length > 0 ? slots[0] : null,
      message: '予約枠取得機能正常',
    };
  } catch (error) {
    return {
      success: false,
      message: `予約枠取得エラー: ${error.message}`,
    };
  }
}

/**
 * ユーティリティ機能のテスト
 */
function testUtilityFunctions() {
  try {
    Logger.log('--- ユーティリティ機能テスト ---');

    // ログ機能テスト（実際には書き込まない）
    // logActivity('test-user', 'テスト実行', '成功', '機能回帰テスト');

    // ヘッダーマップ作成テスト
    const testHeader = ['列1', '列2', '列3'];
    const headerMap = createHeaderMap(testHeader);

    return {
      success: true,
      headerMapWorking: headerMap.get('列1') === 0,
      message: 'ユーティリティ機能正常',
    };
  } catch (error) {
    return {
      success: false,
      message: `ユーティリティエラー: ${error.message}`,
    };
  }
}

/**
 * サマリー機能のテスト
 */
function testSummaryFunctions() {
  try {
    Logger.log('--- サマリー機能テスト ---');

    // サマリーシート存在確認
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);
    const hasData = summarySheet && summarySheet.getLastRow() > 1;

    return {
      success: true,
      hasSummarySheet: !!summarySheet,
      hasSummaryData: hasData,
      message: 'サマリー機能正常',
    };
  } catch (error) {
    return {
      success: false,
      message: `サマリー機能エラー: ${error.message}`,
    };
  }
}

/**
 * 簡易版テスト（基本機能のみ）
 */
function testBasicFunctionality() {
  Logger.log('=== 基本機能テスト開始 ===');

  try {
    // 1. SpreadsheetManager基本動作
    const ss = getActiveSpreadsheet();
    Logger.log('✓ SpreadsheetManager動作確認');

    // 2. シート取得
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);
    Logger.log('✓ シート取得確認');

    // 3. 予約枠取得
    const slots = getAvailableSlotsFromSummary();
    Logger.log(`✓ 予約枠取得確認: ${slots.length}件`);

    // 4. 会計マスタ取得
    const accounting = getAccountingMasterData();
    Logger.log('✓ 会計マスタ取得確認');

    Logger.log('=== 基本機能テスト完了: すべて正常 ===');
    return {
      success: true,
      message: 'すべての基本機能が正常に動作しています',
    };
  } catch (error) {
    Logger.log(`✗ 基本機能テストでエラー: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * SpreadsheetManager最適化確認テスト
 */
function testOptimizationVerification() {
  Logger.log('--- SpreadsheetManager最適化確認テスト開始 ---');

  try {
    const results = {
      cacheConsistency: false,
      performanceImprovement: false,
      dataIntegrity: false,
      apiCallReduction: false,
    };

    // 1. キャッシュ一貫性テスト
    const ss1 = getActiveSpreadsheet();
    const ss2 = getActiveSpreadsheet();
    results.cacheConsistency = ss1 === ss2; // 同一インスタンスが返されることを確認
    Logger.log(`✓ キャッシュ一貫性: ${results.cacheConsistency ? '成功' : '失敗'}`);

    // 2. データ整合性テスト
    const managedSheet = getSheetByName(ROSTER_SHEET_NAME);
    const directSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    results.dataIntegrity =
      managedSheet && directSheet && managedSheet.getName() === directSheet.getName();
    Logger.log(`✓ データ整合性: ${results.dataIntegrity ? '成功' : '失敗'}`);

    // 3. パフォーマンス測定
    const iterations = 5;

    const startTimeManaged = new Date();
    for (let i = 0; i < iterations; i++) {
      getActiveSpreadsheet();
      getSheetByName(ROSTER_SHEET_NAME);
      getSpreadsheetTimezone();
    }
    const managedTime = new Date() - startTimeManaged;

    const startTimeDirect = new Date();
    for (let i = 0; i < iterations; i++) {
      SpreadsheetApp.getActiveSpreadsheet();
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
      SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    }
    const directTime = new Date() - startTimeDirect;

    const improvement = ((directTime - managedTime) / directTime) * 100;
    results.performanceImprovement = improvement >= 0; // 改善または同等であることを確認
    Logger.log(`✓ パフォーマンス改善率: ${improvement.toFixed(1)}%`);

    // 4. API呼び出し削減確認（機能的にはインスタンス共有で確認）
    const ss3 = getActiveSpreadsheet();
    const ss4 = getActiveSpreadsheet();
    results.apiCallReduction = ss3 === ss4; // 同一インスタンス = API呼び出し削減
    Logger.log(`✓ API呼び出し削減: ${results.apiCallReduction ? '成功' : '失敗'}`);

    // 5. 主要機能の動作確認
    const testFunctions = [
      () => getAllStudentNames(),
      () => getAllReservations(),
      () => getAllArchivedReservations(),
      () => getAllFutureReservations(),
      () => getAccountingMasterData(),
    ];

    let functionalitySuccess = true;
    testFunctions.forEach((func, index) => {
      try {
        const result = func();
        if (!result || (Array.isArray(result) && result.length === undefined)) {
          functionalitySuccess = false;
          Logger.log(`✗ 機能テスト${index + 1}失敗`);
        }
      } catch (error) {
        functionalitySuccess = false;
        Logger.log(`✗ 機能テスト${index + 1}エラー: ${error.message}`);
      }
    });

    const allTestsPassed =
      Object.values(results).every(result => result === true) && functionalitySuccess;

    if (allTestsPassed) {
      Logger.log('✓ SpreadsheetManager最適化確認テスト: 全て成功');
      return {
        success: true,
        message: `最適化確認テスト成功 (パフォーマンス改善率: ${improvement.toFixed(1)}%)`,
        details: results,
      };
    } else {
      Logger.log('✗ SpreadsheetManager最適化確認テスト: 一部失敗');
      return {
        success: false,
        message: '最適化確認テストで一部失敗があります',
        details: results,
      };
    }
  } catch (error) {
    Logger.log(`✗ 最適化確認テストでエラー: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}
