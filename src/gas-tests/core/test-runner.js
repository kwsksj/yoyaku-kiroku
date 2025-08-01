/**
 * =================================================================
 * 【ファイル名】: test_runner_optimization.js
 * 【バージョン】: 1.0
 * 【役割】: SpreadsheetManager最適化テスト実行統括スクリプト
 * 【説明】: 各種テストを統合して実行し、結果を分析
 * =================================================================
 */

/**
 * 全テスト実行（メインエントリーポイント）
 */
function runAllOptimizationTests() {
  console.log('🧪 === SpreadsheetManager最適化 全テスト実行 ===');

  const overallResults = {
    startTime: new Date(),
    tests: {},
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      overallSuccessRate: 0,
      totalExecutionTime: 0,
    },
  };

  try {
    // 1. 基本機能テスト
    console.log('\n📋 1. SpreadsheetManager基本機能テスト実行中...');
    overallResults.tests.basic = runSpreadsheetManagerFunctionalityTests();

    // 2. 回帰テスト
    console.log('\n🔄 2. 機能回帰テスト実行中...');
    overallResults.tests.regression = testRegressionSuite();

    // 3. 統合テスト
    console.log('\n🔗 3. 統合機能テスト実行中...');
    overallResults.tests.integration = runPostOptimizationIntegrationTests();

    // 4. パフォーマンステスト
    console.log('\n⚡ 4. パフォーマンス比較テスト実行中...');
    overallResults.tests.performance = runPerformanceComparisonTest();

    // 結果集計
    overallResults.summary = calculateOverallSummary(overallResults.tests);
    overallResults.endTime = new Date();
    overallResults.summary.totalExecutionTime = overallResults.endTime - overallResults.startTime;

    // 結果表示
    displayTestResults(overallResults);

    // スプレッドシートに結果通知
    notifyTestCompletion(overallResults);

    return overallResults;
  } catch (error) {
    console.error('💥 テスト実行中にエラーが発生:', error.message);

    getActiveSpreadsheet().toast(`❌ テスト実行エラー\n${error.message}`, 'テスト実行失敗', 10);

    return {
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * クイックテスト実行（高速版）
 */
function runQuickOptimizationTest() {
  console.log('🚀 === クイック最適化テスト ===');

  const quickResults = {
    startTime: new Date(),
    tests: {},
  };

  try {
    // 1. 基本機能確認
    quickResults.tests.basicCheck = quickFunctionalityCheck();

    // 2. SpreadsheetManager簡易テスト
    quickResults.tests.spreadsheetManager = quickSpreadsheetManagerTest();

    // 3. 最適化確認テスト
    quickResults.tests.optimization = testOptimizationVerification();

    quickResults.endTime = new Date();
    quickResults.executionTime = quickResults.endTime - quickResults.startTime;

    // 結果サマリー
    const passedCount = Object.values(quickResults.tests).filter(
      test =>
        test.success ||
        (test.results && test.results.every && test.results.every(r => r.includes('✅'))),
    ).length;
    const totalCount = Object.keys(quickResults.tests).length;
    const successRate = (passedCount / totalCount) * 100;

    console.log('\n🎯 クイックテスト結果:');
    console.log(`✅ 成功: ${passedCount}/${totalCount}`);
    console.log(`📊 成功率: ${successRate.toFixed(1)}%`);
    console.log(`⏱️ 実行時間: ${quickResults.executionTime}ms`);

    const status = successRate >= 80 ? '✅ 良好' : successRate >= 60 ? '⚠️ 注意' : '❌ 問題あり';

    getActiveSpreadsheet().toast(
      `${status} クイックテスト完了\n成功率: ${successRate.toFixed(1)}%\n実行時間: ${quickResults.executionTime}ms`,
      'クイックテスト結果',
      8,
    );

    return quickResults;
  } catch (error) {
    console.error('💥 クイックテストエラー:', error.message);
    return { error: error.message };
  }
}

/**
 * パフォーマンス重点テスト
 */
function runPerformanceFocusedTest() {
  console.log('⚡ === パフォーマンス重点テスト ===');

  const performanceResults = {
    startTime: new Date(),
    metrics: {},
  };

  try {
    // 1. 基本パフォーマンス測定
    performanceResults.metrics.basic = measureBasicPerformance();

    // 2. キャッシュ効果測定
    performanceResults.metrics.cache = measureCacheEffectiveness();

    // 3. 比較テスト
    performanceResults.metrics.comparison = runPerformanceComparisonTest();

    performanceResults.endTime = new Date();
    performanceResults.totalTime = performanceResults.endTime - performanceResults.startTime;

    // パフォーマンス分析
    const analysis = analyzePerformanceResults(performanceResults.metrics);

    console.log('\n📈 パフォーマンス分析結果:');
    console.log(`🎯 総合改善率: ${analysis.overallImprovement.toFixed(1)}%`);
    console.log(`⚡ キャッシュ効果: ${analysis.cacheEffectiveness}`);
    console.log(`🏆 最適化評価: ${analysis.optimizationGrade}`);

    const message = `パフォーマンステスト完了\n改善率: ${analysis.overallImprovement.toFixed(1)}%\n評価: ${analysis.optimizationGrade}`;
    getActiveSpreadsheet().toast(message, 'パフォーマンステスト結果', 10);

    return performanceResults;
  } catch (error) {
    console.error('💥 パフォーマンステストエラー:', error.message);
    return { error: error.message };
  }
}

/**
 * 結果の総合集計
 */
function calculateOverallSummary(tests) {
  const summary = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    overallSuccessRate: 0,
  };

  Object.values(tests).forEach(testResult => {
    if (testResult.passed !== undefined && testResult.failed !== undefined) {
      summary.totalTests += testResult.passed + testResult.failed;
      summary.passedTests += testResult.passed;
      summary.failedTests += testResult.failed;
    } else if (testResult.success !== undefined) {
      summary.totalTests += 1;
      if (testResult.success) {
        summary.passedTests += 1;
      } else {
        summary.failedTests += 1;
      }
    }
  });

  summary.overallSuccessRate =
    summary.totalTests > 0 ? (summary.passedTests / summary.totalTests) * 100 : 0;

  return summary;
}

/**
 * テスト結果表示
 */
function displayTestResults(results) {
  console.log('\n🎯 =========================');
  console.log('📊 全テスト結果サマリー');
  console.log('============================');
  console.log(`✅ 成功テスト: ${results.summary.passedTests}`);
  console.log(`❌ 失敗テスト: ${results.summary.failedTests}`);
  console.log(`📊 総合成功率: ${results.summary.overallSuccessRate.toFixed(1)}%`);
  console.log(`⏱️ 総実行時間: ${results.summary.totalExecutionTime}ms`);

  // 各テストカテゴリの詳細
  Object.entries(results.tests).forEach(([category, result]) => {
    console.log(`\n📋 ${category}:`);
    if (result.passed !== undefined) {
      console.log(`  ✅ 成功: ${result.passed}, ❌ 失敗: ${result.failed}`);
    } else if (result.success !== undefined) {
      console.log(`  ${result.success ? '✅ 成功' : '❌ 失敗'}: ${result.message || ''}`);
    }
  });
}

/**
 * テスト完了通知
 */
function notifyTestCompletion(results) {
  const status =
    results.summary.overallSuccessRate >= 90
      ? '🎉 優秀'
      : results.summary.overallSuccessRate >= 75
        ? '✅ 良好'
        : results.summary.overallSuccessRate >= 60
          ? '⚠️ 注意'
          : '❌ 要改善';

  const message =
    `${status} 全テスト完了\n` +
    `成功率: ${results.summary.overallSuccessRate.toFixed(1)}%\n` +
    `成功: ${results.summary.passedTests}, 失敗: ${results.summary.failedTests}\n` +
    `実行時間: ${results.summary.totalExecutionTime}ms`;

  getActiveSpreadsheet().toast(message, 'SpreadsheetManager最適化テスト完了', 15);
}

/**
 * 基本パフォーマンス測定
 */
function measureBasicPerformance() {
  const iterations = 20;

  // SpreadsheetManager使用
  const startManaged = new Date();
  for (let i = 0; i < iterations; i++) {
    getActiveSpreadsheet();
    getSheetByName(ROSTER_SHEET_NAME);
  }
  const managedTime = new Date() - startManaged;

  // 直接呼び出し
  const startDirect = new Date();
  for (let i = 0; i < iterations; i++) {
    SpreadsheetApp.getActiveSpreadsheet();
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
  }
  const directTime = new Date() - startDirect;

  return {
    managedTime,
    directTime,
    improvement: ((directTime - managedTime) / directTime) * 100,
    iterations,
  };
}

/**
 * キャッシュ効果測定
 */
function measureCacheEffectiveness() {
  const iterations = 10;

  // 連続呼び出しでのキャッシュ効果測定
  const startTime = new Date();
  for (let i = 0; i < iterations; i++) {
    const ss1 = getActiveSpreadsheet();
    const ss2 = getActiveSpreadsheet();
    const areEqual = ss1 === ss2;
    if (!areEqual) {
      return { effective: false, message: 'キャッシュが機能していません' };
    }
  }
  const cacheTime = new Date() - startTime;

  return {
    effective: true,
    cacheTime,
    avgTimePerCall: cacheTime / (iterations * 2),
  };
}

/**
 * パフォーマンス結果分析
 */
function analyzePerformanceResults(metrics) {
  const analysis = {
    overallImprovement: 0,
    cacheEffectiveness: 'Unknown',
    optimizationGrade: 'Unknown',
  };

  // 基本パフォーマンス分析
  if (metrics.basic && metrics.basic.improvement !== undefined) {
    analysis.overallImprovement = metrics.basic.improvement;
  }

  // キャッシュ効果分析
  if (metrics.cache) {
    analysis.cacheEffectiveness = metrics.cache.effective ? '有効' : '無効';
  }

  // 最適化グレード判定
  if (analysis.overallImprovement >= 50) {
    analysis.optimizationGrade = 'A+ (優秀)';
  } else if (analysis.overallImprovement >= 30) {
    analysis.optimizationGrade = 'A (良好)';
  } else if (analysis.overallImprovement >= 10) {
    analysis.optimizationGrade = 'B (普通)';
  } else if (analysis.overallImprovement >= 0) {
    analysis.optimizationGrade = 'C (要改善)';
  } else {
    analysis.optimizationGrade = 'D (問題あり)';
  }

  return analysis;
}
