/**
 * =================================================================
 * 【ファイル名】  : 01_Code.gs
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : プロジェクト全体のエントリーポイントとして、メニュー生成や WebApp エントリ関数を定義する。
 *
 * 【主な責務】
 *   - `doGet` / `onOpen` など GAS の公開エントリーポイントを提供
 *   - スクリプトプロパティから管理者メールやカレンダー ID を読み込み、グローバル定数として公開
 *   - テスト環境向けの初期化（キャッシュ再構築）をトリガー
 *
 * 【関連モジュール】
 *   - `02-5_Notification_StudentSchedule.js`: 月次通知トリガーを呼び出す
 *   - `07_CacheManager.js`: キャッシュ再構築エントリポイントを使用
 *   - `08_Utilities.js`: メニュー操作でのエラーハンドリングに利用
 *
 * 【利用時の留意点】
 *   - WebApp の UI を変更する場合は `10_WebApp.html` 側とのタイトル整合を確認
 *   - スクリプトプロパティに依存するため、環境セットアップ時に必ず値を登録する
 *   - 新しいトリガーを追加する際は、Spreadsheet のロック取得とエラー処理方針を統一する
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { repostSalesLogByDate } from './02-1_BusinessLogic_Batch.js';
import { sendMonthlyNotificationEmails } from './02-5_Notification_StudentSchedule.js';
import { rebuildAllCachesEntryPoint } from './07_CacheManager.js';
import { handleError } from './08_Utilities.js';

//  管理者通知用のメールアドレス
export const ADMIN_EMAIL =
  PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL'); // 管理者のメールアドレス

// --- GoogleカレンダーのID ---
export const CALENDAR_IDS_RAW =
  PropertiesService.getScriptProperties().getProperty('CALENDAR_IDS');
export const CALENDAR_IDS = CALENDAR_IDS_RAW
  ? JSON.parse(CALENDAR_IDS_RAW)
  : {};

/**
 * HTMLテンプレートのサブファイルをテンプレート評価の文脈で読み込むためのinclude関数
 * @param {string} filename - 読み込むHTMLファイル名（拡張子不要）
 * @returns {string} - サブファイルのHTML文字列
 */
export function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- エントリーポイント関数 ---

/**
 * @param {GoogleAppsScript.Events.DoGet} e
 */
export function doGet(e) {
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

    const template = HtmlService.createTemplateFromFile('10_WebApp');
    template['isDebug'] = e && e.parameter && e.parameter['debug'] === 'true';

    return template
      .evaluate()
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

export function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('データ処理');
  addAdminMenu(menu);
  addCacheMenu(menu);
  menu.addToUi();

  // テスト環境のみ：スプレッドシートを開くたびにキャッシュを自動再構築
  if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
    rebuildAllCachesEntryPoint();
  }

  // ログシートがアクティブな状態で開かれた場合、最新行（最下行）を表示する
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const activeSheetName = activeSheet.getName();

  if (
    activeSheetName === CONSTANTS.SHEET_NAMES.LOG ||
    activeSheetName === CONSTANTS.SHEET_NAMES.RESERVATIONS
  ) {
    const lastRow = activeSheet.getLastRow();
    if (lastRow > 0) {
      activeSheet.getRange(lastRow, 1).activate();
    }
  }
}

/**
 * 選択範囲変更時に実行されるシンプルトリガー
 * シート切り替えを検知して、ログ系シートの場合は最下部にスクロールする
 *
 * @description
 * ユーザーがシートタブを切り替えた際にも発火するため、
 * CacheServiceを使って「直前のシート」を記憶し、
 * シートが変わったタイミングでのみ自動スクロールを実行する。
 * これにより、同一シート内でのセル選択移動ではスクロールが発生しないようにする。
 *
 * @param {{ range: GoogleAppsScript.Spreadsheet.Range }} e
 */
export function onSelectionChange(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const userCache = CacheService.getUserCache(); // ユーザーごとのキャッシュを使用
  const cacheKey = 'LAST_ACTIVE_SHEET';
  const lastSheetName = userCache.get(cacheKey);

  // シートが切り替わった場合のみ処理を実行
  if (sheetName !== lastSheetName) {
    // 現在のシート名をキャッシュに保存（有効期限: 6時間）
    userCache.put(cacheKey, sheetName, 21600);

    // 対象のシート（ログ記録・予約記録）なら最下部にスクロール
    if (
      sheetName === CONSTANTS.SHEET_NAMES.LOG ||
      sheetName === CONSTANTS.SHEET_NAMES.RESERVATIONS
    ) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 0) {
        // A列の最下行をアクティブにする
        sheet.getRange(lastRow, 1).activate();
      }
    }
  }
}

/**
 * @param {GoogleAppsScript.Base.Menu} menu
 */
export function addAdminMenu(menu) {
  // repostSalesLogByDateを文字列で参照するため、明示的に参照して型チェックを通す
  void repostSalesLogByDate;
  menu.addItem('売上記録を再転載（日付指定）', 'repostSalesLogByDate');
}

/**
 * @param {GoogleAppsScript.Base.Menu} menu
 */
export function addCacheMenu(menu) {
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
export function handleOnChange(_e) {
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
export function handleEdit(_e) {
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
export function doGetTest() {
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
export function doGetPerformanceTest(_e) {
  return doGetTest();
}

/**
 * 管理者メールアドレスを設定する関数
 * GASエディタから一度だけ実行してください
 * @param {string} email - 設定するメールアドレス
 */
export function setAdminEmail(email = 'shiawasenahito3000@gmail.com') {
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
 * さらに毎日実行のトリガーも追加（リトライキュー処理用）
 */
export function setupMonthlyNotificationTriggers() {
  try {
    // 既存のトリガーを削除
    deleteMonthlyNotificationTriggers();

    const days = CONSTANTS.NOTIFICATION.DAYS; // [5, 15, 25]
    const hours = CONSTANTS.NOTIFICATION.HOURS; // [9, 12, 18, 21]

    let triggerCount = 0;

    // 1. 月次トリガー: 特定の日・時刻の組み合わせ
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

    // 2. 毎日トリガー: リトライキュー処理用（各時間帯）
    for (const hour of hours) {
      ScriptApp.newTrigger(`trigger_sendNotification_daily_hour${hour}`)
        .timeBased()
        .everyDays(1)
        .atHour(hour)
        .create();

      triggerCount++;
      Logger.log(`毎日トリガー作成: ${hour}時`);
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
export function deleteMonthlyNotificationTriggers() {
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
export function trigger_sendNotification_day5_hour9() {
  sendMonthlyNotificationEmails(5, 9);
}
export function trigger_sendNotification_day5_hour12() {
  sendMonthlyNotificationEmails(5, 12);
}
export function trigger_sendNotification_day5_hour18() {
  sendMonthlyNotificationEmails(5, 18);
}
export function trigger_sendNotification_day5_hour21() {
  sendMonthlyNotificationEmails(5, 21);
}

// 15日
export function trigger_sendNotification_day15_hour9() {
  sendMonthlyNotificationEmails(15, 9);
}
export function trigger_sendNotification_day15_hour12() {
  sendMonthlyNotificationEmails(15, 12);
}
export function trigger_sendNotification_day15_hour18() {
  sendMonthlyNotificationEmails(15, 18);
}
export function trigger_sendNotification_day15_hour21() {
  sendMonthlyNotificationEmails(15, 21);
}

// 25日
export function trigger_sendNotification_day25_hour9() {
  sendMonthlyNotificationEmails(25, 9);
}
export function trigger_sendNotification_day25_hour12() {
  sendMonthlyNotificationEmails(25, 12);
}
export function trigger_sendNotification_day25_hour18() {
  sendMonthlyNotificationEmails(25, 18);
}
export function trigger_sendNotification_day25_hour21() {
  sendMonthlyNotificationEmails(25, 21);
}

// =================================================================
// 毎日トリガー実行関数（リトライキュー処理専用）
// 常にtargetDay=0を渡し、リトライキューの消化のみを行う
// 新規送信は月次トリガーが担当するため、二重送信を防止
// =================================================================

/**
 * 毎日実行: 9時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour9() {
  // 常にtargetDay=0でリトライ専用（新規対象者は抽出しない）
  sendMonthlyNotificationEmails(0, 9);
}

/**
 * 毎日実行: 12時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour12() {
  sendMonthlyNotificationEmails(0, 12);
}

/**
 * 毎日実行: 18時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour18() {
  sendMonthlyNotificationEmails(0, 18);
}

/**
 * 毎日実行: 21時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour21() {
  sendMonthlyNotificationEmails(0, 21);
}
