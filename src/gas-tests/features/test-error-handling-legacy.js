/**
 * =================================================================
 * 【ファイル名】: ZZ_TestErrorHandling.js
 * 【役割】: SpreadsheetManager最適化後のエラーハンドリング検証
 * 【接頭辞ZZ】: ファイル一覧で最下部に表示されるようにする
 * =================================================================
 */

/**
 * エラーハンドリングの検証テスト
 */
function testErrorHandling() {
  Logger.log('=== エラーハンドリング検証開始 ===');

  const results = {
    tests: {},
    summary: { total: 0, passed: 0, failed: 0 },
  };

  // 1. 無効なシート名でのアクセステスト
  results.tests.invalidSheet = testInvalidSheetAccess();

  // 2. 無効なユーザー認証テスト
  results.tests.invalidAuth = testInvalidAuthentication();

  // 3. 存在しないデータへのアクセステスト
  results.tests.missingData = testMissingDataAccess();

  // 結果集計
  Object.values(results.tests).forEach(test => {
    results.summary.total++;
    if (test.success) results.summary.passed++;
    else results.summary.failed++;
  });

  Logger.log('=== エラーハンドリング検証完了 ===');
  Logger.log('エラーハンドリング検証結果: ' + JSON.stringify(results, null, 2));

  return results;
}

/**
 * 無効なシート名アクセスのテスト
 */
function testInvalidSheetAccess() {
  try {
    Logger.log('--- 無効なシートアクセステスト ---');

    // 存在しないシート名でアクセス
    const invalidSheet = getSheetByName('存在しないシート');

    // nullが返されることを確認（エラーではなく）
    const handlesGracefully = invalidSheet === null;

    return {
      success: handlesGracefully,
      message: handlesGracefully
        ? '無効なシートアクセスを適切にハンドリング'
        : '無効なシートアクセスでエラーが発生',
    };
  } catch (error) {
    return {
      success: false,
      message: `予期しないエラー: ${error.message}`,
    };
  }
}

/**
 * 無効なユーザー認証のテスト
 */
function testInvalidAuthentication() {
  try {
    Logger.log('--- 無効なユーザー認証テスト ---');

    // 無効な電話番号
    const result1 = authenticateUser('');
    const result2 = authenticateUser('invalid-phone');
    const result3 = authenticateUser('12345');

    // すべて失敗すべき
    const allFailed = !result1.success && !result2.success && !result3.success;

    return {
      success: allFailed,
      message: allFailed ? '無効な認証を適切に拒否' : '無効な認証が通ってしまった',
      details: {
        emptyPhone: result1.success,
        invalidPhone: result2.success,
        shortPhone: result3.success,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `認証テストでエラー: ${error.message}`,
    };
  }
}

/**
 * 存在しないデータアクセスのテスト
 */
function testMissingDataAccess() {
  try {
    Logger.log('--- 存在しないデータアクセステスト ---');

    // 存在しないユーザーIDでの初期データ取得
    const result = getInitialWebApp_Data('non-existent-user-id');

    // エラーではなく、適切な空データが返されることを確認
    const handlesGracefully =
      result.success &&
      Array.isArray(result.availableSlots) &&
      Array.isArray(result.myBookings) &&
      Array.isArray(result.myHistory);

    return {
      success: handlesGracefully,
      message: handlesGracefully
        ? '存在しないデータに対して適切な空配列を返却'
        : '存在しないデータアクセスでエラーまたは不正な値',
      resultData: {
        success: result.success,
        slotsLength: result.availableSlots?.length,
        bookingsLength: result.myBookings?.length,
        historyLength: result.myHistory?.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `データアクセステストでエラー: ${error.message}`,
    };
  }
}

/**
 * 負荷テスト（同じ処理を複数回実行）
 */
function testLoadHandling() {
  try {
    Logger.log('--- 負荷テスト開始 ---');

    const iterations = 5;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = new Date().getTime();

      // 基本操作を実行
      const ss = getActiveSpreadsheet();
      const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
      const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);
      const timezone = getSpreadsheetTimezone();

      const endTime = new Date().getTime();
      results.push(endTime - startTime);
    }

    const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
    const maxTime = Math.max(...results);
    const minTime = Math.min(...results);

    return {
      success: true,
      iterations: iterations,
      averageTime: avgTime,
      maxTime: maxTime,
      minTime: minTime,
      allResults: results,
      message: `${iterations}回の負荷テスト完了`,
    };
  } catch (error) {
    return {
      success: false,
      message: `負荷テストでエラー: ${error.message}`,
    };
  }
}
