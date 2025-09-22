/**
 * Google Sheetsとスクリプトのタイムゾーンを確認・設定するためのユーティリティ
 * Google Apps Script エディタで実行してください
 */

function checkAndSetTimezone() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  console.log('=== タイムゾーン確認 ===');
  console.log('スプレッドシートのタイムゾーン:', ss.getSpreadsheetTimeZone());
  console.log('スクリプトのタイムゾーン:', Session.getScriptTimeZone());

  // 日本時間に設定（必要な場合）
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Tokyo') {
    console.log('スプレッドシートを日本時間に設定中...');
    ss.setSpreadsheetTimeZone('Asia/Tokyo');
    console.log(
      '✅ スプレッドシートのタイムゾーンを Asia/Tokyo に設定しました',
    );
  } else {
    console.log('✅ スプレッドシートは既に日本時間に設定済みです');
  }

  // 現在時刻の確認
  const now = new Date();
  console.log('=== 現在時刻確認 ===');
  console.log('システム時刻:', now);
  console.log(
    '日本時間（フォーマット済み）:',
    Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
  );

  return {
    spreadsheetTimezone: ss.getSpreadsheetTimeZone(),
    scriptTimezone: Session.getScriptTimeZone(),
    currentTime: Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
  };
}
