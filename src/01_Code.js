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

// NF-01: 電話番号なしユーザーの特殊ログインコマンド (PropertiesServiceから取得)
// PropertiesServiceに SPECIAL_NO_PHONE_LOGIN_COMMAND キーで文字列を登録してください。
// 例: キー 'SPECIAL_NO_PHONE_LOGIN_COMMAND', 値 'NO_PHONE_LOGIN'
const SPECIAL_NO_PHONE_LOGIN_COMMAND_VALUE =
  PropertiesService.getScriptProperties().getProperty(
    'SPECIAL_NO_PHONE_LOGIN_COMMAND',
  );

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

function doGet(e) {
  // URLパラメータでテストモードかどうかを判定
  const isTestMode = e && e.parameter && e.parameter.test === 'true';

  if (isTestMode) {
    // テストモード: パフォーマンステスト画面を表示
    return HtmlService.createTemplateFromFile('test_performance_webapp')
      .evaluate()
      .setTitle('パフォーマンス改善テスト')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    // 通常モード: メインアプリケーションを表示
    return HtmlService.createTemplateFromFile('10_WebApp')
      .evaluate()
      .setTitle('きぼりの よやく・きろく')
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

function addAdminMenu(menu) {
  menu
    .addItem(
      'googleカレンダーから予定日を追加',
      'addCalendarEventsToSheetWithSpecifics',
    )
    .addSeparator()
    .addItem('日程マスタを作成', 'createScheduleMasterSheet')
    .addItem(
      '【移行用】予約データから日程マスタを生成',
      'generateScheduleMasterFromExistingReservationsWithUI',
    )
    .addSeparator()
    .addItem('【開発用】テスト環境をセットアップ', 'setupTestEnvironment')
    .addSeparator()
    .addItem('【本番移行】統合予約シート作成', 'createIntegratedSheet')
    .addItem(
      '【本番移行】データを統合シートへ移行',
      'migrateDataToIntegratedSheet',
    )
    .addItem('【本番移行】移行データ整合性チェック', 'verifyMigratedData');
}

function addCacheMenu(menu) {
  menu
    .addSeparator()
    .addItem('キャッシュサービスを一括更新', 'rebuildAllCachesEntryPoint')
    .addItem(
      '【修復】Schedule Masterキャッシュ診断・修復',
      'diagnoseAndFixScheduleMasterCache',
    )
    .addItem(
      'PropertiesServiceクリーンアップ',
      'cleanupPropertiesServiceCache',
    );
}

/**
 * インストール型トリガー：シート変更時に実行。
 * 実際の処理は `02-2_BusinessLogic_Handlers.gs` の `processChange` へ委譲します。
 * @param {Object} e - Google Sheets のイベントオブジェクト
 */
function handleOnChange(_e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) return;

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
 * @param {Object} e - Google Sheets のイベントオブジェクト
 */
function handleEdit(_e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) return;
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
      'URLでアクセスするか、doGetテストをWebAppとしてデプロイしてください',
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
 */
function doGetPerformanceTest(_e) {
  return doGetTest();
}
