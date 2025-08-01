/**
 * =================================================================
 * 【ファイル名】: test_integration_post_optimization.js
 * 【バージョン】: 1.0
 * 【役割】: SpreadsheetManager最適化後の統合機能テスト
 * 【説明】: エンドツーエンドでの機能確認とパフォーマンス検証
 * =================================================================
 */

/**
 * 最適化後統合テスト実行
 */
function runPostOptimizationIntegrationTests() {
  console.log('=== 最適化後統合テスト開始 ===');

  const testResults = {
    startTime: new Date(),
    passed: 0,
    failed: 0,
    errors: [],
    performanceMetrics: {},
  };

  try {
    // 1. 基盤機能テスト
    testResults.performanceMetrics.foundation = testFoundationFunctionality();
    if (testResults.performanceMetrics.foundation.success) {
      testResults.passed++;
      console.log('✅ 基盤機能テスト: 成功');
    } else {
      testResults.failed++;
      testResults.errors.push('基盤機能テスト失敗');
    }

    // 2. ユーザー機能統合テスト
    testResults.performanceMetrics.userFlow = testUserFlowIntegration();
    if (testResults.performanceMetrics.userFlow.success) {
      testResults.passed++;
      console.log('✅ ユーザー機能統合テスト: 成功');
    } else {
      testResults.failed++;
      testResults.errors.push('ユーザー機能統合テスト失敗');
    }

    // 3. データ処理統合テスト
    testResults.performanceMetrics.dataProcessing = testDataProcessingIntegration();
    if (testResults.performanceMetrics.dataProcessing.success) {
      testResults.passed++;
      console.log('✅ データ処理統合テスト: 成功');
    } else {
      testResults.failed++;
      testResults.errors.push('データ処理統合テスト失敗');
    }

    // 4. キャッシュ機能統合テスト
    testResults.performanceMetrics.cacheOperations = testCacheOperationsIntegration();
    if (testResults.performanceMetrics.cacheOperations.success) {
      testResults.passed++;
      console.log('✅ キャッシュ機能統合テスト: 成功');
    } else {
      testResults.failed++;
      testResults.errors.push('キャッシュ機能統合テスト失敗');
    }

    // 5. バッチ処理統合テスト
    testResults.performanceMetrics.batchProcessing = testBatchProcessingIntegration();
    if (testResults.performanceMetrics.batchProcessing.success) {
      testResults.passed++;
      console.log('✅ バッチ処理統合テスト: 成功');
    } else {
      testResults.failed++;
      testResults.errors.push('バッチ処理統合テスト失敗');
    }

    // 6. 外部サービス統合テスト
    testResults.performanceMetrics.externalServices = testExternalServicesIntegration();
    if (testResults.performanceMetrics.externalServices.success) {
      testResults.passed++;
      console.log('✅ 外部サービス統合テスト: 成功');
    } else {
      testResults.failed++;
      testResults.errors.push('外部サービス統合テスト失敗');
    }

    // 結果サマリー
    testResults.endTime = new Date();
    testResults.totalTime = testResults.endTime - testResults.startTime;
    testResults.successRate =
      (testResults.passed / (testResults.passed + testResults.failed)) * 100;

    console.log('\n=== 統合テスト結果 ===');
    console.log(`✅ 成功: ${testResults.passed}`);
    console.log(`❌ 失敗: ${testResults.failed}`);
    console.log(`📊 成功率: ${testResults.successRate.toFixed(1)}%`);
    console.log(`⏱️ 総実行時間: ${testResults.totalTime}ms`);

    // 結果をスプレッドシートに通知
    const message = `統合テスト完了\n成功率: ${testResults.successRate.toFixed(1)}%\n実行時間: ${testResults.totalTime}ms`;
    getActiveSpreadsheet().toast(message, 'テスト結果', 5);

    return testResults;
  } catch (error) {
    console.error('💥 統合テスト実行エラー:', error.message);
    testResults.errors.push(`実行エラー: ${error.message}`);
    return testResults;
  }
}

/**
 * 基盤機能テスト
 */
function testFoundationFunctionality() {
  const startTime = new Date();

  try {
    // SpreadsheetManagerの基本動作確認
    const ss1 = getActiveSpreadsheet();
    const ss2 = getActiveSpreadsheet();

    if (ss1 !== ss2) {
      return {
        success: false,
        message: 'SpreadsheetManagerキャッシュ失敗',
        time: new Date() - startTime,
      };
    }

    // 基本シート取得確認
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);

    if (!rosterSheet || !summarySheet) {
      return { success: false, message: '基本シート取得失敗', time: new Date() - startTime };
    }

    // タイムゾーン取得確認
    const timezone = getSpreadsheetTimezone();
    if (!timezone) {
      return { success: false, message: 'タイムゾーン取得失敗', time: new Date() - startTime };
    }

    return { success: true, message: '基盤機能テスト成功', time: new Date() - startTime };
  } catch (error) {
    return {
      success: false,
      message: `基盤機能テストエラー: ${error.message}`,
      time: new Date() - startTime,
    };
  }
}

/**
 * ユーザー機能統合テスト
 */
function testUserFlowIntegration() {
  const startTime = new Date();

  try {
    // 生徒名一覧取得
    const studentNames = getAllStudentNames();
    if (!(studentNames instanceof Set)) {
      return { success: false, message: '生徒名一覧取得失敗', time: new Date() - startTime };
    }

    // テスト用ユーザーID（存在する場合のみテスト）
    if (studentNames.size > 0) {
      const testStudentId = Array.from(studentNames)[0]; // SetからArrayに変換して最初の生徒IDを使用

      // ユーザー認証テスト
      const userProfile = getUserProfile(testStudentId);
      if (!userProfile) {
        console.log('⚠️ ユーザープロファイル取得失敗（データが存在しない可能性）');
      }
    }

    // 会計マスターデータ取得
    const accountingData = getAccountingMasterData();
    if (!accountingData || !accountingData.success || !accountingData.data) {
      return {
        success: false,
        message: '会計マスターデータ取得失敗',
        time: new Date() - startTime,
      };
    }

    return { success: true, message: 'ユーザー機能統合テスト成功', time: new Date() - startTime };
  } catch (error) {
    return {
      success: false,
      message: `ユーザー機能統合テストエラー: ${error.message}`,
      time: new Date() - startTime,
    };
  }
}

/**
 * データ処理統合テスト
 */
function testDataProcessingIntegration() {
  const startTime = new Date();

  try {
    // 予約データ取得
    const reservations = getAllReservations();
    if (!Array.isArray(reservations)) {
      return { success: false, message: '予約データ取得失敗', time: new Date() - startTime };
    }

    // アーカイブデータ取得
    const archivedReservations = getAllArchivedReservations();
    if (!Array.isArray(archivedReservations)) {
      return { success: false, message: 'アーカイブデータ取得失敗', time: new Date() - startTime };
    }

    // 将来予約データ取得
    const futureReservations = getAllFutureReservations();
    if (!Array.isArray(futureReservations)) {
      return { success: false, message: '将来予約データ取得失敗', time: new Date() - startTime };
    }

    // 予約可能枠取得
    const availableSlots = getAvailableSlotsFromSummary();
    if (!Array.isArray(availableSlots)) {
      return { success: false, message: '予約可能枠取得失敗', time: new Date() - startTime };
    }

    return { success: true, message: 'データ処理統合テスト成功', time: new Date() - startTime };
  } catch (error) {
    return {
      success: false,
      message: `データ処理統合テストエラー: ${error.message}`,
      time: new Date() - startTime,
    };
  }
}

/**
 * キャッシュ機能統合テスト
 */
function testCacheOperationsIntegration() {
  const startTime = new Date();

  try {
    // キャッシュマネージャーの基本機能確認
    const cacheTestResults = [];

    // 1. データ取得とキャッシュ効果確認
    const startCacheTest = new Date();
    for (let i = 0; i < 3; i++) {
      getAllStudentNames();
      getAllReservations();
    }
    const cacheTime = new Date() - startCacheTest;
    cacheTestResults.push(`キャッシュテスト時間: ${cacheTime}ms`);

    // 2. SpreadsheetManagerインスタンス共有確認
    const instances = [];
    for (let i = 0; i < 5; i++) {
      instances.push(getActiveSpreadsheet());
    }

    const allSameInstance = instances.every(instance => instance === instances[0]);
    if (!allSameInstance) {
      return {
        success: false,
        message: 'SpreadsheetManagerインスタンス共有失敗',
        time: new Date() - startTime,
      };
    }

    return {
      success: true,
      message: 'キャッシュ機能統合テスト成功',
      details: cacheTestResults,
      time: new Date() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: `キャッシュ機能統合テストエラー: ${error.message}`,
      time: new Date() - startTime,
    };
  }
}

/**
 * バッチ処理統合テスト
 */
function testBatchProcessingIntegration() {
  const startTime = new Date();

  try {
    // バッチ処理に必要なシートの存在確認
    const classroomSheets = CLASSROOM_SHEET_NAMES.map(name => getSheetByName(name)).filter(
      sheet => sheet !== null,
    );
    const archiveSheets = ARCHIVE_SHEET_NAMES.map(name => getSheetByName(name)).filter(
      sheet => sheet !== null,
    );

    if (classroomSheets.length === 0) {
      return {
        success: false,
        message: '教室シートが見つかりません',
        time: new Date() - startTime,
      };
    }

    if (archiveSheets.length === 0) {
      return {
        success: false,
        message: 'アーカイブシートが見つかりません',
        time: new Date() - startTime,
      };
    }

    // ヘッダーマップ作成テスト
    const testSheet = classroomSheets[0];
    const headerRow = testSheet.getRange(1, 1, 1, testSheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(headerRow);

    if (!headerMap || !(headerMap instanceof Map)) {
      return { success: false, message: 'ヘッダーマップ作成失敗', time: new Date() - startTime };
    }

    return { success: true, message: 'バッチ処理統合テスト成功', time: new Date() - startTime };
  } catch (error) {
    return {
      success: false,
      message: `バッチ処理統合テストエラー: ${error.message}`,
      time: new Date() - startTime,
    };
  }
}

/**
 * 外部サービス統合テスト
 */
function testExternalServicesIntegration() {
  const startTime = new Date();

  try {
    // サマリーシート確認
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);
    if (!summarySheet) {
      return { success: false, message: 'サマリーシート取得失敗', time: new Date() - startTime };
    }

    // 教室カウント文字列配列作成テスト
    if (CLASSROOM_SHEET_NAMES.length > 0) {
      const testClassroom = CLASSROOM_SHEET_NAMES[0].slice(0, -2); // 「01」を除去
      const stringArray = createStringArrayFromCounts(testClassroom);

      if (!Array.isArray(stringArray)) {
        return {
          success: false,
          message: '教室カウント配列作成失敗',
          time: new Date() - startTime,
        };
      }
    }

    return { success: true, message: '外部サービス統合テスト成功', time: new Date() - startTime };
  } catch (error) {
    return {
      success: false,
      message: `外部サービス統合テストエラー: ${error.message}`,
      time: new Date() - startTime,
    };
  }
}

/**
 * パフォーマンス比較テスト
 */
function runPerformanceComparisonTest() {
  console.log('=== パフォーマンス比較テスト ===');

  const iterations = 10;
  const results = {
    optimized: {},
    direct: {},
    improvement: {},
  };

  try {
    // 最適化版テスト
    const startOptimized = new Date();
    for (let i = 0; i < iterations; i++) {
      getActiveSpreadsheet();
      getSheetByName(ROSTER_SHEET_NAME);
      getSheetByName(SUMMARY_SHEET_NAME);
      getSpreadsheetTimezone();
    }
    results.optimized.time = new Date() - startOptimized;
    results.optimized.avgPerCall = results.optimized.time / (iterations * 4);

    // 直接呼び出し版テスト
    const startDirect = new Date();
    for (let i = 0; i < iterations; i++) {
      SpreadsheetApp.getActiveSpreadsheet();
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUMMARY_SHEET_NAME);
      SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    }
    results.direct.time = new Date() - startDirect;
    results.direct.avgPerCall = results.direct.time / (iterations * 4);

    // 改善率計算
    results.improvement.timeReduction = results.direct.time - results.optimized.time;
    results.improvement.percentageImprovement =
      (results.improvement.timeReduction / results.direct.time) * 100;

    console.log(
      `最適化版: ${results.optimized.time}ms (平均: ${results.optimized.avgPerCall.toFixed(2)}ms/call)`,
    );
    console.log(
      `直接呼出: ${results.direct.time}ms (平均: ${results.direct.avgPerCall.toFixed(2)}ms/call)`,
    );
    console.log(`改善率: ${results.improvement.percentageImprovement.toFixed(1)}%`);
    console.log(`時間短縮: ${results.improvement.timeReduction}ms`);

    // 結果通知
    const message = `パフォーマンス改善率: ${results.improvement.percentageImprovement.toFixed(1)}%\n時間短縮: ${results.improvement.timeReduction}ms`;
    getActiveSpreadsheet().toast(message, 'パフォーマンステスト結果', 8);

    return results;
  } catch (error) {
    console.error('パフォーマンステストエラー:', error.message);
    return { error: error.message };
  }
}

/**
 * 簡易機能確認テスト（メニューから実行可能）
 */
function quickFunctionalityCheck() {
  try {
    console.log('=== 簡易機能確認テスト ===');

    // 基本機能確認
    const checks = [
      { name: 'SpreadsheetManager取得', test: () => getActiveSpreadsheet() },
      { name: '生徒名簿シート取得', test: () => getSheetByName(ROSTER_SHEET_NAME) },
      { name: 'タイムゾーン取得', test: () => getSpreadsheetTimezone() },
      { name: '生徒名一覧取得', test: () => getAllStudentNames() },
      { name: '予約データ取得', test: () => getAllReservations() },
      { name: '会計マスタ取得', test: () => getAccountingMasterData() },
    ];

    let allPassed = true;
    const results = [];

    checks.forEach(check => {
      try {
        const result = check.test();
        if (result) {
          console.log(`✅ ${check.name}: 成功`);
          results.push(`✅ ${check.name}`);
        } else {
          console.log(`❌ ${check.name}: 失敗`);
          results.push(`❌ ${check.name}`);
          allPassed = false;
        }
      } catch (error) {
        console.log(`💥 ${check.name}: エラー - ${error.message}`);
        results.push(`💥 ${check.name}: エラー`);
        allPassed = false;
      }
    });

    const status = allPassed ? '✅ 全機能正常' : '⚠️ 一部問題あり';
    const message = `${status}\n${results.join('\n')}`;

    getActiveSpreadsheet().toast(message, '機能確認結果', 10);

    return { success: allPassed, results: results };
  } catch (error) {
    console.error('簡易機能確認テストエラー:', error.message);
    getActiveSpreadsheet().toast(`❌ テスト実行エラー\n${error.message}`, 'エラー', 10);
    return { success: false, error: error.message };
  }
}
