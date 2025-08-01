/**
 * =================================================================
 * 【ファイル名】: test_functions.js
 * 【役割】: パフォーマンス改善のテスト用関数
 * =================================================================
 */

/**
 * SpreadsheetManagerの基本動作テスト
 */
function testSpreadsheetManagerFunction() {
  try {
    const startTime = new Date().getTime();

    // SpreadsheetManagerの動作確認
    const ss = getActiveSpreadsheet();
    const spreadsheetId = ss.getId();
    const timezone = getSpreadsheetTimezone();

    // シート取得テスト
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);

    const endTime = new Date().getTime();
    const executionTime = endTime - startTime;

    return {
      success: true,
      spreadsheetId: spreadsheetId,
      timezone: timezone,
      sheetCount: ss.getSheets().length,
      executionTime: executionTime,
    };
  } catch (error) {
    Logger.log(`testSpreadsheetManagerFunction Error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * 予約枠取得関数のテスト
 */
function testAvailableSlotsFunction() {
  try {
    const startTime = new Date().getTime();

    // 新しい関数をテスト
    const slots = getAvailableSlotsFromSummary();

    const endTime = new Date().getTime();
    const executionTime = endTime - startTime;

    return {
      success: true,
      slotCount: slots.length,
      sampleSlot: slots.length > 0 ? slots[0] : null,
      executionTime: executionTime,
    };
  } catch (error) {
    Logger.log(`testAvailableSlotsFunction Error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * ログインフローの統合テスト
 */
function testLoginFlowFunction(phoneNumber) {
  try {
    const startTime = new Date().getTime();

    // 認証テスト
    const authResult = authenticateUser(phoneNumber);

    let slotsCount = 0;
    let bookingsCount = 0;
    let historyCount = 0;

    if (authResult.success) {
      // 初期データ取得テスト
      const initialData = getInitialWebApp_Data(authResult.user.studentId);
      if (initialData.success) {
        slotsCount = initialData.availableSlots.length;
        bookingsCount = initialData.myBookings.length;
        historyCount = initialData.myHistory.length;
      }
    }

    const endTime = new Date().getTime();
    const executionTime = endTime - startTime;

    return {
      success: true,
      authSuccess: authResult.success,
      slotsCount: slotsCount,
      bookingsCount: bookingsCount,
      historyCount: historyCount,
      executionTime: executionTime,
    };
  } catch (error) {
    Logger.log(`testLoginFlowFunction Error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * パフォーマンス比較テスト
 */
function performanceComparisonFunction() {
  try {
    // 最適化版のテスト
    const optimizedStartTime = new Date().getTime();

    // SpreadsheetManagerを使用した処理
    const ss = getActiveSpreadsheet();
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    const timezone = getSpreadsheetTimezone();

    const optimizedEndTime = new Date().getTime();
    const optimizedTime = optimizedEndTime - optimizedStartTime;

    // 従来版のテスト
    const traditionalStartTime = new Date().getTime();

    // 従来の方法（毎回新しく取得）
    const ss2 = SpreadsheetApp.getActiveSpreadsheet();
    const summarySheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUMMARY_SHEET_NAME);
    const rosterSheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    const timezone2 = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    const traditionalEndTime = new Date().getTime();
    const traditionalTime = traditionalEndTime - traditionalStartTime;

    // 改善率を計算
    const improvementPercentage =
      traditionalTime > 0
        ? Math.round(((traditionalTime - optimizedTime) / traditionalTime) * 100)
        : 0;

    return {
      success: true,
      optimizedTime: optimizedTime,
      traditionalTime: traditionalTime,
      improvementPercentage: improvementPercentage,
    };
  } catch (error) {
    Logger.log(`performanceComparisonFunction Error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * 包括的なテストスイート
 */
function runAllTests() {
  const results = {};

  // 1. SpreadsheetManager テスト
  results.spreadsheetManager = testSpreadsheetManagerFunction();

  // 2. 予約枠取得テスト
  results.availableSlots = testAvailableSlotsFunction();

  // 3. パフォーマンス比較
  results.performance = performanceComparisonFunction();

  // 4. 簡単な統合テスト
  try {
    const initialData = getInitialWebApp_Data('test-user-id');
    results.integration = {
      success: true,
      hasAvailableSlots: Array.isArray(initialData.availableSlots),
      hasMyBookings: Array.isArray(initialData.myBookings),
      hasMyHistory: Array.isArray(initialData.myHistory),
      hasAccountingMaster: !!initialData.accountingMaster,
    };
  } catch (error) {
    results.integration = {
      success: false,
      message: error.message,
    };
  }

  Logger.log('All Tests Results: ' + JSON.stringify(results, null, 2));
  return results;
}
