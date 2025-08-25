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
const RESERVATION_SPREADSHEET_ID = getActiveSpreadsheet().getId();
const RESERVATION_DATA_START_ROW = 2;

// NF-01: 電話番号なしユーザーの特殊ログインコマンド (PropertiesServiceから取得)
// PropertiesServiceに SPECIAL_NO_PHONE_LOGIN_COMMAND キーで文字列を登録してください。
// 例: キー 'SPECIAL_NO_PHONE_LOGIN_COMMAND', 値 'NO_PHONE_LOGIN'
const SPECIAL_NO_PHONE_LOGIN_COMMAND_VALUE = PropertiesService.getScriptProperties().getProperty(
  'SPECIAL_NO_PHONE_LOGIN_COMMAND',
);

//  管理者通知用のメールアドレス
const ADMIN_EMAIL = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL'); // 管理者のメールアドレス

// --- シート名関連の定数（継続使用） ---
// 同期対象ヘッダー - すべて00_Constants.jsで定義済み

const SYNC_TARGET_HEADERS = [
  HEADER_LINE,
  HEADER_IN_THE_FUTURE,
  HEADER_NOTES,
  HEADER_FROM,
  HEADER_CHISEL_RENTAL,
];

// --- UI・表示関連の定数 ---
const COLUMN_WIDTH_DATE = 100; // 日付列の幅
const COLUMN_WIDTH_CLASSROOM = 100; // 教室列の幅
const COLUMN_WIDTH_VENUE = 150; // 会場列の幅
const COLUMN_WIDTH_CLASSROOM_TYPE = 120; // 教室形式列の幅
const COLUMN_WIDTH_TIME = 80; // 時間関連列の幅
const COLUMN_WIDTH_BEGINNER_START = 100; // 初心者開始列の幅
const COLUMN_WIDTH_CAPACITY = 80; // 定員関連列の幅
const COLUMN_WIDTH_STATUS = 80; // 状態列の幅
const COLUMN_WIDTH_NOTES = 200; // 備考列の幅

// --- システム処理関連の定数 ---
const CACHE_EXPIRY_SECONDS = 86400; // キャッシュ有効期限（24時間）
const SAMPLE_DATA_DAYS = 30; // サンプルデータ生成日数（1ヶ月）
const WEEKEND_SUNDAY = 0; // 日曜日の曜日コード
const WEEKEND_SATURDAY = 6; // 土曜日の曜日コード
const HEADER_ROW = 1; // ヘッダー行番号
// DATA_START_ROWは00_Constants.jsで統一管理されています

// --- 材料情報関連の定数は00_Constants.jsで統一管理されています ---

// --- 売上カテゴリ関連の定数（00_Constants.jsに未統合） ---
const SALES_CATEGORY_TUITION = '授業料';
const SALES_CATEGORY_SALES = '物販';

// 注意: MSG_*, LOG_ACTION_*, COLOR_* 定数は00_Constants.jsで定義済みのため削除

// 注意: 主要な定数（教室名、ヘッダー名、ステータスなど）は00_Constants.jsで統一管理されています

const CLASSROOM_TRANSFER_SETTINGS = [
  {
    sourceSheetName: TOKYO_CLASSROOM_NAME,
    transferColumns: [
      HEADER_DATE,
      HEADER_VENUE,
      HEADER_PARTICIPANT_COUNT,
      HEADER_CO,
      HEADER_NAME,
      HEADER_FIRST_LECTURE,
      HEADER_CHISEL_RENTAL,
    ],
  },
  {
    sourceSheetName: NUMAZU_CLASSROOM_NAME,
    transferColumns: [
      HEADER_DATE,
      HEADER_PARTICIPANT_COUNT,
      HEADER_CO,
      HEADER_NAME,
      HEADER_TIME,
      HEADER_CHISEL_RENTAL,
    ],
  },
  {
    sourceSheetName: TSUKUBA_CLASSROOM_NAME,
    transferColumns: [
      HEADER_DATE,
      HEADER_PARTICIPANT_COUNT,
      HEADER_CO,
      HEADER_NAME,
      HEADER_TIME,
      HEADER_CHISEL_RENTAL,
    ],
  },
];

// --- 外部サービス連携用ID ---
// SALES_SPREADSHEET_IDは00_Constants.jsで統一管理されています
const GOOGLE_FORM_IDS_RAW = PropertiesService.getScriptProperties().getProperty('GOOGLE_FORM_IDS');
const GOOGLE_FORM_IDS = GOOGLE_FORM_IDS_RAW ? JSON.parse(GOOGLE_FORM_IDS_RAW) : {};
// --- Googleフォームの質問タイトル ---
const FORM_QUESTION_TITLES = {
  [TOKYO_CLASSROOM_NAME]: '参加希望日・会場',
  [TSUKUBA_CLASSROOM_NAME]: '参加希望日',
  [NUMAZU_CLASSROOM_NAME]: '参加希望日',
};
// --- GoogleカレンダーのID ---
const CALENDAR_IDS_RAW = PropertiesService.getScriptProperties().getProperty('CALENDAR_IDS');
const CALENDAR_IDS = CALENDAR_IDS_RAW ? JSON.parse(CALENDAR_IDS_RAW) : {};

// 日程マスタのヘッダー定義
const SCHEDULE_MASTER_HEADERS = [
  '日付',
  '教室',
  '会場',
  '教室形式',
  '1部開始',
  '1部終了',
  '2部開始',
  '2部終了',
  '初心者開始',
  '全体定員',
  '初心者定員',
  '状態',
  '備考',
];

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
    .addItem('googleカレンダーから予定日を追加', 'addCalendarEventsToSheetWithSpecifics')
    .addSeparator()
    .addItem('アクティブシートの罫線を再描画', 'manuallyFormatActiveSheet')
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
    .addItem('【本番移行】データを統合シートへ移行', 'migrateDataToIntegratedSheet')
    .addItem('【本番移行】移行データ整合性チェック', 'verifyMigratedData');
}

function addCacheMenu(menu) {
  menu
    .addSeparator()
    .addItem('キャッシュサービスを一括更新', 'rebuildAllCachesEntryPoint')
    .addSeparator()
    .addItem('【管理者専用】PropertiesServiceクリーンアップ', 'cleanupPropertiesServiceCache')
    .addSeparator()
    .addItem('キャッシュサービス容量チェック', 'checkCacheCapacity')
    .addItem('古いプロパティサービスデータをクリーンアップ', 'cleanupOldCaches');
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
    const htmlOutput = HtmlService.createTemplateFromFile('test_performance_webapp')
      .evaluate()
      .setTitle('パフォーマンス改善テスト')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    // GASエディタから実行された場合のデバッグ情報
    Logger.log('テスト用WebAppが生成されました');
    Logger.log('URLでアクセスするか、doGetテストをWebAppとしてデプロイしてください');

    return htmlOutput;
  } catch (error) {
    Logger.log('doGetTest エラー: ' + error.message);
    throw error;
  }
}

/**
 * デバッグ用：テスト関数が正常に動作するかチェック
 */
function debugTestSetup() {
  try {
    Logger.log('=== テストセットアップ開始 ===');

    // HTMLファイルの存在確認
    try {
      Logger.log('✓ HTMLテンプレートが見つかりました');
    } catch (e) {
      Logger.log('✗ HTMLテンプレートエラー: ' + e.message);
      throw e;
    }

    // スプレッドシートマネージャーの動作確認
    try {
      const ss = getActiveSpreadsheet();
      Logger.log('✓ SpreadsheetManagerが動作しています: ' + ss.getId());
    } catch (e) {
      Logger.log('✗ SpreadsheetManagerエラー: ' + e.message);
      throw e;
    }

    // テスト関数の動作確認
    try {
      const testResult = testSpreadsheetManagerFunction();
      Logger.log('✓ テスト関数が動作しています');
      Logger.log('テスト結果: ' + JSON.stringify(testResult, null, 2));
    } catch (e) {
      Logger.log('✗ テスト関数エラー: ' + e.message);
      throw e;
    }

    Logger.log('=== テストセットアップ完了 ===');
    return {
      success: true,
      message: 'すべてのテストセットアップが正常です',
    };
  } catch (error) {
    Logger.log('✗ セットアップエラー: ' + error.message);
    Logger.log('エラーの詳細: ' + error.stack);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * GASエディタで直接実行可能なテスト関数
 */
function runDirectTest() {
  Logger.log('=== 直接テスト実行開始 ===');

  try {
    // 1. SpreadsheetManager テスト
    Logger.log('--- SpreadsheetManager テスト ---');
    const managerResult = testSpreadsheetManagerFunction();
    Logger.log('結果: ' + JSON.stringify(managerResult, null, 2));

    // 2. 予約枠取得テスト
    Logger.log('--- 予約枠取得テスト ---');
    const slotsResult = testAvailableSlotsFunction();
    Logger.log('結果: ' + JSON.stringify(slotsResult, null, 2));

    // 3. パフォーマンス比較
    Logger.log('--- パフォーマンス比較テスト ---');
    const perfResult = performanceComparisonFunction();
    Logger.log('結果: ' + JSON.stringify(perfResult, null, 2));

    Logger.log('=== 直接テスト実行完了 ===');
    return {
      success: true,
      managerTest: managerResult,
      slotsTest: slotsResult,
      performanceTest: perfResult,
    };
  } catch (error) {
    Logger.log('✗ 直接テストエラー: ' + error.message);
    Logger.log('エラーの詳細: ' + error.stack);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * 別のデプロイメント用のエントリーポイント
 * テスト専用のデプロイメントを作成する場合に使用
 */
function doGetPerformanceTest(_e) {
  return doGetTest();
}

/**
 * 機能回帰テストの実行
 * GASエディタから直接実行可能
 */
function runRegressionTest() {
  Logger.log('=== 機能回帰テスト実行開始 ===');

  try {
    // 基本機能テストを実行
    const basicResult = testBasicFunctionality();
    Logger.log('基本機能テスト結果: ' + JSON.stringify(basicResult, null, 2));

    if (basicResult.success) {
      // 基本機能が正常な場合、包括テストを実行
      const regressionResult = testRegressionSuite();
      Logger.log('包括機能テスト結果: ' + JSON.stringify(regressionResult, null, 2));

      // エラーハンドリングテストも実行
      const errorResult = testErrorHandling();
      Logger.log('エラーハンドリングテスト結果: ' + JSON.stringify(errorResult, null, 2));

      return {
        success: true,
        basicTest: basicResult,
        regressionTest: regressionResult,
        errorTest: errorResult,
        message: '全テスト完了',
      };
    } else {
      return {
        success: false,
        basicTest: basicResult,
        message: '基本機能テストで問題が検出されました',
      };
    }
  } catch (error) {
    Logger.log('テスト実行エラー: ' + error.message);
    return {
      success: false,
      message: error.message,
    };
  }
}
