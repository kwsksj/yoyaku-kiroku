/**
 * 負荷テスト用関数
 */
function loadTestSpreadsheetManager() {
  const iterations = 10;
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = new Date().getTime();

    // 複数のシートアクセス
    const ss = getActiveSpreadsheet();
    const sheet1 = getSheetByName(ROSTER_SHEET_NAME);
    const sheet2 = getSheetByName(SUMMARY_SHEET_NAME);
    const timezone = getSpreadsheetTimezone();

    const endTime = new Date().getTime();
    results.push(endTime - startTime);
  }

  const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
  const minTime = Math.min(...results);
  const maxTime = Math.max(...results);

  Logger.log(`Load Test Results - Avg: ${avgTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
  return { avgTime, minTime, maxTime, results };
}

/**
 * 従来方式との比較負荷テスト
 */
function compareLoadTest() {
  const iterations = 5;

  // SpreadsheetManager使用
  const optimizedTimes = [];
  for (let i = 0; i < iterations; i++) {
    const startTime = new Date().getTime();
    const ss = getActiveSpreadsheet();
    const sheet1 = getSheetByName(ROSTER_SHEET_NAME);
    const sheet2 = getSheetByName(SUMMARY_SHEET_NAME);
    const timezone = getSpreadsheetTimezone();
    const endTime = new Date().getTime();
    optimizedTimes.push(endTime - startTime);
  }

  // 従来方式
  const traditionalTimes = [];
  for (let i = 0; i < iterations; i++) {
    const startTime = new Date().getTime();
    const ss1 = SpreadsheetApp.getActiveSpreadsheet();
    const sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    const sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUMMARY_SHEET_NAME);
    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const endTime = new Date().getTime();
    traditionalTimes.push(endTime - startTime);
  }

  const optimizedAvg = optimizedTimes.reduce((a, b) => a + b, 0) / optimizedTimes.length;
  const traditionalAvg = traditionalTimes.reduce((a, b) => a + b, 0) / traditionalTimes.length;
  const improvement = (((traditionalAvg - optimizedAvg) / traditionalAvg) * 100).toFixed(1);

  const result = {
    optimizedAvg: optimizedAvg.toFixed(1),
    traditionalAvg: traditionalAvg.toFixed(1),
    improvement: improvement + '%',
    optimizedTimes,
    traditionalTimes,
  };

  Logger.log('Performance Comparison: ' + JSON.stringify(result, null, 2));
  return result;
}
