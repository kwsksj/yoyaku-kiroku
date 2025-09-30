/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/constants.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 01_Code.gs
 * 【バージョン】: 2.3
 * 【役割】: グローバル定数、UI定義、トリガー関数を集約するプロジェクトのエントリーポイント。
 * 【構成】: 18ファイル構成のうちの1番目（新規00_Constants.jsを含む）
 * 【v2.3での変更点】:
 * - フェーズ1リファクタリング: 定数の統一管理のため、00_Constants.jsで定義された統一定数を使用
 * - 重複定義されていた教室名、ヘッダー名などを削除し、統一ファイルから継承
 * =================================================================
 */

// =================================================================
// 統一定数ファイル（00_Constants.js）から継承
// 基本的な定数は00_Constants.jsで統一管理されています
// =================================================================

// --- グローバル定数定義 ---
const RESERVATION_DATA_START_ROW = 2;

//  管理者通知用のメールアドレス
const ADMIN_EMAIL =
  PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL'); // 管理者のメールアドレス

// --- UI・表示関連の定数 ---
const COLUMN_WIDTH_DATE = 100; // 日付列の幅
const COLUMN_WIDTH_CLASSROOM = 100; // 教室列の幅
const COLUMN_WIDTH_VENUE = 150; // 会場列の幅
const COLUMN_WIDTH_CLASSROOM_TYPE = 120; // 教室形式列の幅
const COLUMN_WIDTH_TIME = 80; // 時間関連列の幅
const COLUMN_WIDTH_BEGINNER_START = 100; // 初回者開始列の幅
const COLUMN_WIDTH_CAPACITY = 80; // 定員関連列の幅
const COLUMN_WIDTH_STATUS = 80; // 状態列の幅
const COLUMN_WIDTH_NOTES = 200; // 備考列の幅

// --- システム処理関連の定数 ---
const CACHE_EXPIRY_SECONDS = 86400; // キャッシュ有効期限（24時間）
const WEEKEND_SUNDAY = 0; // 日曜日の曜日コード
const WEEKEND_SATURDAY = 6; // 土曜日の曜日コード
const HEADER_ROW = 1; // ヘッダー行番号

// --- 外部サービス連携用ID ---

// --- GoogleカレンダーのID ---
const CALENDAR_IDS_RAW =
  PropertiesService.getScriptProperties().getProperty('CALENDAR_IDS');
const CALENDAR_IDS = CALENDAR_IDS_RAW ? JSON.parse(CALENDAR_IDS_RAW) : {};

/**
 * HTMLテンプレートのサブファイルをテンプレート評価の文脈で読み込むためのinclude関数
 * @param {string} filename - 読み込むHTMLファイル名（拡張子不要）
 * @returns {string} - サブファイルのHTML文字列
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- エントリーポイント関数 ---

/**
 * @param {GoogleAppsScript.Events.DoGet} e
 */
function doGet(e) {
  // URLパラメータでテストモードかどうかを判定
  const isTestMode = e && e.parameter && e.parameter['test'] === 'true';

  // 【パフォーマンス対策】doGetでのウォームアップを削除
  // ページ読み込みの遅延を回避し、必要時のみ初期化
  Logger.log('[WEBAPP] doGet実行 - ウォームアップは遅延実行');

  if (isTestMode) {
    // テストモード: パフォーマンステスト画面を表示
    return HtmlService.createTemplateFromFile('test_performance_webapp')
      .evaluate()
      .setTitle('パフォーマンス改善テスト')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    // 通常モード: メインアプリケーションを表示（静的HTMLファイル）
    // 環境に応じてタイトルを設定
    const titlePrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE ? '' : '[テスト]';
    const title = `${titlePrefix}きぼりの よやく・きろく`;

    return HtmlService.createHtmlOutputFromFile('10_WebApp')
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('データ処理');
  addAdminMenu(menu);
  addCacheMenu(menu);
  menu.addToUi();
}

/**
 * @param {GoogleAppsScript.Base.Menu} menu
 */
function addAdminMenu(menu) {
  menu
 }

/**
 * @param {GoogleAppsScript.Base.Menu} menu
 */
function addCacheMenu(menu) {
  menu
    .addSeparator()
    .addItem('キャッシュサービスを一括更新', 'rebuildAllCachesEntryPoint')
    .addItem(
      'PropertiesServiceクリーンアップ',
      'cleanupPropertiesServiceCache',
    );
}

/**
 * インストール型トリガー：シート変更時に実行。
 * 実際の処理は `02-2_BusinessLogic_Handlers.gs` の `processChange` へ委譲します。
 * @param {GoogleAppsScript.Events.SheetsOnChange} _e - Google Sheets のイベントオブジェクト
 */
function handleOnChange(_e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS)) return;

  try {
  } catch (err) {
    handleError(`OnChangeイベント処理中にエラー: ${err.message}`, true);
  } finally {
    lock.releaseLock();
  }
}

/**
 * インストール型トリガー：シート編集時に実行。
 * 実際の処理は `02-2_BusinessLogic_Handlers.gs` の `processCellEdit` へ委譲します。
 * @param {GoogleAppsScript.Events.SheetsOnEdit} _e - Google Sheets のイベントオブジェクト
 */
function handleEdit(_e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS)) return;
  try {
  } catch (err) {
    handleError(`セル編集処理中にエラー: ${err.message}`, true);
  } finally {
    lock.releaseLock();
  }
}

/**
 * テスト用WebAppのエントリーポイント
 * パフォーマンステスト画面を表示します
 */
function doGetTest() {
  try {
    const htmlOutput = HtmlService.createTemplateFromFile(
      'test_performance_webapp',
    )
      .evaluate()
      .setTitle('パフォーマンス改善テスト')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    // GASエディタから実行された場合のデバッグ情報
    Logger.log('テスト用WebAppが生成されました');
    Logger.log(
      'URLでアクセスするか、doGetTestをWebAppとしてデプロイしてください',
    );

    return htmlOutput;
  } catch (error) {
    Logger.log('doGetTest エラー: ' + error.message);
    throw error;
  }
}

/**
 * 別のデプロイメント用のエントリーポイント
 * テスト専用のデプロイメントを作成する場合に使用
 * @param {GoogleAppsScript.Events.DoGet} _e
 */
function doGetPerformanceTest(_e) {
  return doGetTest();
}

/**
 * 管理者メールアドレスを設定する関数
 * GASエディタから一度だけ実行してください
 * @param {string} email - 設定するメールアドレス
 */
function setAdminEmail(email = 'shiawasenahito3000@gmail.com') {
  try {
    PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', email);
    Logger.log(`ADMIN_EMAIL を設定しました: ${email}`);
    console.log(`✅ ADMIN_EMAIL を設定しました: ${email}`);
  } catch (error) {
    Logger.log(`ADMIN_EMAIL 設定エラー: ${error.message}`);
    console.error(`❌ ADMIN_EMAIL 設定エラー: ${error.message}`);
  }
}

// =================================================================
// 月次通知メールトリガー管理
// =================================================================

/**
 * 月次通知メールトリガーを設定
 * すべての通知日・時刻の組み合わせに対してトリガーを作成
 */
function setupMonthlyNotificationTriggers() {
  try {
    // 既存のトリガーを削除
    deleteMonthlyNotificationTriggers();

    const days = CONSTANTS.NOTIFICATION.DAYS; // [5, 15, 25]
    const hours = CONSTANTS.NOTIFICATION.HOURS; // [9, 12, 18, 21]

    let triggerCount = 0;

    // すべての日時の組み合わせに対してトリガーを作成
    for (const day of days) {
      for (const hour of hours) {
        ScriptApp.newTrigger(`trigger_sendNotification_day${day}_hour${hour}`)
          .timeBased()
          .onMonthDay(day)
          .atHour(hour)
          .create();

        triggerCount++;
        Logger.log(`トリガー作成: ${day}日 ${hour}時`);
      }
    }

    Logger.log(
      `月次通知メールトリガーを設定しました（${triggerCount}個のトリガー）`,
    );
    return { success: true, count: triggerCount };
  } catch (error) {
    Logger.log(`トリガー設定エラー: ${error.message || error}`);
    throw error;
  }
}

/**
 * 月次通知メールトリガーを削除
 */
function deleteMonthlyNotificationTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deleteCount = 0;

    for (const trigger of triggers) {
      const handlerFunction = trigger.getHandlerFunction();
      if (handlerFunction.startsWith('trigger_sendNotification_')) {
        ScriptApp.deleteTrigger(trigger);
        deleteCount++;
        Logger.log(`トリガー削除: ${handlerFunction}`);
      }
    }

    Logger.log(
      `月次通知メールトリガーを削除しました（${deleteCount}個のトリガー）`,
    );
    return { success: true, count: deleteCount };
  } catch (error) {
    Logger.log(`トリガー削除エラー: ${error.message || error}`);
    throw error;
  }
}

// =================================================================
// トリガー実行関数（各日時の組み合わせごとに定義）
// =================================================================

// 5日
function trigger_sendNotification_day5_hour9() {
  sendMonthlyNotificationEmails(5, 9);
}
function trigger_sendNotification_day5_hour12() {
  sendMonthlyNotificationEmails(5, 12);
}
function trigger_sendNotification_day5_hour18() {
  sendMonthlyNotificationEmails(5, 18);
}
function trigger_sendNotification_day5_hour21() {
  sendMonthlyNotificationEmails(5, 21);
}

// 15日
function trigger_sendNotification_day15_hour9() {
  sendMonthlyNotificationEmails(15, 9);
}
function trigger_sendNotification_day15_hour12() {
  sendMonthlyNotificationEmails(15, 12);
}
function trigger_sendNotification_day15_hour18() {
  sendMonthlyNotificationEmails(15, 18);
}
function trigger_sendNotification_day15_hour21() {
  sendMonthlyNotificationEmails(15, 21);
}

// 25日
function trigger_sendNotification_day25_hour9() {
  sendMonthlyNotificationEmails(25, 9);
}
function trigger_sendNotification_day25_hour12() {
  sendMonthlyNotificationEmails(25, 12);
}
function trigger_sendNotification_day25_hour18() {
  sendMonthlyNotificationEmails(25, 18);
}
function trigger_sendNotification_day25_hour21() {
  sendMonthlyNotificationEmails(25, 21);
}
