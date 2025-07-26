/**
 * =================================================================
 * 【ファイル名】: 01_Code.gs
 * 【バージョン】: 2.2
 * 【役割】: グローバル定数、UI定義、トリガー関数を集約するプロジェクトのエントリーポイント。
 * 【構成】: 17ファイル構成のうちの1番目
 * 【v2.2での変更点】:
 * - NF-12: キャッシュメニューに、将来の予約キャッシュを一括生成する
 * 「migrateAllFutureBookingsToCache」関数を呼び出す項目を追加。
 * =================================================================
 */

// --- グローバル定数定義 ---
const RESERVATION_SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const RESERVATION_DATA_START_ROW = 2;
const ROSTER_SHEET_NAME = '生徒名簿';
const ACCOUNTING_MASTER_SHEET_NAME = '料金・商品マスタ';
const SUMMARY_SHEET_NAME = '予約サマリー';
const LOG_SHEET_NAME = 'アクティビティログ';

// NF-01: 電話番号なしユーザーの特殊ログインコマンド (PropertiesServiceから取得)
// PropertiesServiceに SPECIAL_NO_PHONE_LOGIN_COMMAND キーで文字列を登録してください。
// 例: キー 'SPECIAL_NO_PHONE_LOGIN_COMMAND', 値 'NO_PHONE_LOGIN'
const SPECIAL_NO_PHONE_LOGIN_COMMAND_VALUE = PropertiesService.getScriptProperties().getProperty('SPECIAL_NO_PHONE_LOGIN_COMMAND');



//  管理者通知用のメールアドレス
const ADMIN_EMAIL = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL'); // 管理者のメールアドレス

// --- シート・ヘッダー関連の定数 ---
const TOKYO_CLASSROOM_NAME = '東京教室';
const NUMAZU_CLASSROOM_NAME = '沼津教室';
const TSUKUBA_CLASSROOM_NAME = 'つくば教室';
const CLASSROOM_SHEET_NAMES = [TOKYO_CLASSROOM_NAME, NUMAZU_CLASSROOM_NAME, TSUKUBA_CLASSROOM_NAME];

const CLASSROOM_CAPACITIES = {
  [TOKYO_CLASSROOM_NAME]: 8,
  [NUMAZU_CLASSROOM_NAME]: 8,
  [TSUKUBA_CLASSROOM_NAME]: 8,
};
const INTRO_LECTURE_CAPACITY = 4;
const TSUKUBA_MORNING_SESSION_END_HOUR = 13;

const HEADER_STUDENT_ID = '生徒ID';
const HEADER_RESERVATION_ID = '予約ID';
const HEADER_DATE = '日付';
const HEADER_VENUE = '会場';
const HEADER_PARTICIPANT_COUNT = '人数';
const HEADER_CO = 'co';
const HEADER_NAME = '名前';
const HEADER_CLASS_COUNT = '回数';
const HEADER_UNIFIED_CLASS_COUNT = '参加回数';
const HEADER_FIRST_LECTURE = '初講';
const HEADER_EARLY_ARRIVAL = '早出';
const HEADER_CHISEL_RENTAL = '彫刻刀レンタル';
const HEADER_TIME = '受講時間';
const HEADER_WORK_IN_PROGRESS = '制作メモ';
const HEADER_ORDER = 'order';
const HEADER_ACCOUNTING_DETAILS = '会計詳細';
const HEADER_LINE = 'LINE';
const HEADER_IN_THE_FUTURE = 'in the future';
const HEADER_NOTES = 'notes';
const HEADER_FROM = 'from';
const HEADER_CLASS_START = '講座開始';
const HEADER_CLASS_END = '講座終了';
const HEADER_BREAK_START = '休憩開始';
const HEADER_BREAK_END = '休憩終了';
const HEADER_START_TIME = '開始時刻';
const HEADER_END_TIME = '終了時刻';

const SYNC_TARGET_HEADERS = [HEADER_LINE, HEADER_IN_THE_FUTURE, HEADER_NOTES, HEADER_FROM, HEADER_CHISEL_RENTAL];
const HEADER_REAL_NAME = '本名';
const HEADER_NICKNAME = 'ニックネーム';
const HEADER_PHONE = '電話番号';
const HEADER_SUMMARY_UNIQUE_KEY = 'ユニークキー';
const HEADER_SUMMARY_CLASSROOM = '教室名';
const HEADER_SUMMARY_SESSION = 'セッション';
const HEADER_SUMMARY_VENUE = '会場';
const HEADER_SUMMARY_CAPACITY = '定員';
const HEADER_SUMMARY_RESERVATION_COUNT = '予約数';
const HEADER_SUMMARY_AVAILABLE_COUNT = '空席数';
const HEADER_SUMMARY_LAST_UPDATED = '最終更新日時';

const HEADER_ARCHIVE_PREFIX = 'old';
const ARCHIVE_SHEET_NAMES = CLASSROOM_SHEET_NAMES.map(name => HEADER_ARCHIVE_PREFIX + name.slice(0, -2));

const LOCK_WAIT_TIME_MS = 30000;

const CLASSROOM_TRANSFER_SETTINGS = [
  { sourceSheetName: TOKYO_CLASSROOM_NAME, transferColumns: [HEADER_DATE, HEADER_VENUE, HEADER_PARTICIPANT_COUNT, HEADER_CO, HEADER_NAME, HEADER_FIRST_LECTURE, HEADER_EARLY_ARRIVAL, HEADER_CHISEL_RENTAL] },
  { sourceSheetName: NUMAZU_CLASSROOM_NAME, transferColumns: [HEADER_DATE, HEADER_PARTICIPANT_COUNT, HEADER_CO, HEADER_NAME, HEADER_TIME, HEADER_CHISEL_RENTAL] },
  { sourceSheetName: TSUKUBA_CLASSROOM_NAME, transferColumns: [HEADER_DATE, HEADER_PARTICIPANT_COUNT, HEADER_CO, HEADER_NAME, HEADER_TIME, HEADER_CHISEL_RENTAL] }
];

// --- 外部サービス連携用ID ---
const SALES_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SALES_SPREADSHEET_ID');
const GOOGLE_FORM_IDS_RAW = PropertiesService.getScriptProperties().getProperty('GOOGLE_FORM_IDS');
const GOOGLE_FORM_IDS = GOOGLE_FORM_IDS_RAW ? JSON.parse(GOOGLE_FORM_IDS_RAW) : {};
// --- Googleフォームの質問タイトル ---
const FORM_QUESTION_TITLES = {
  [TOKYO_CLASSROOM_NAME]: '参加希望日・会場',
  [TSUKUBA_CLASSROOM_NAME]: '参加希望日',
  [NUMAZU_CLASSROOM_NAME]: '参加希望日'
}
// --- GoogleカレンダーのID ---
const CALENDAR_IDS_RAW = PropertiesService.getScriptProperties().getProperty('CALENDAR_IDS');
const CALENDAR_IDS = CALENDAR_IDS_RAW ? JSON.parse(CALENDAR_IDS_RAW) : {};

// --- ステータス・種別関連の定数 ---
const STATUS_WAITING = 'waiting';
const STATUS_CANCEL = 'cancel';
const SESSION_MORNING = '午前';
const SESSION_AFTERNOON = '午後';
const SESSION_ALL_DAY = '全日';
const ITEM_TYPE_TUITION = '授業料';
const ITEM_TYPE_MATERIAL = '材料';
const ITEM_TYPE_SALES = '物販';
const ITEM_NAME_MAIN_LECTURE = '本講座';
const ITEM_NAME_FIRST_LECTURE = '初回講習';
const ITEM_NAME_EARLY_ARRIVAL = '早出';
const ITEM_NAME_CHISEL_RENTAL = '彫刻刀レンタル';
const ITEM_NAME_DISCOUNT = '初回講習同時間割引';
const UNIT_30_MIN = '30分';
const UNIT_CM3 = 'cm³';

// --- エントリーポイント関数 ---

function doGet(e) {
  return HtmlService.createTemplateFromFile('10_WebApp.html').evaluate().setTitle('きぼりの よやく・きろく').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('データ処理');
  addAdminMenu(menu);
  addCacheMenu(menu);
  menu.addToUi();
}

function addAdminMenu(menu) {
  menu.addItem('昨日までのデータ処理', 'processYesterdayData')
    .addItem('今日のデータ処理', 'processTodayData')
    .addItem('一番古い日付のデータ処理', 'processOldestDate')
    .addSeparator()
    .addItem('googleカレンダーから予定日を追加', 'addCalendarEventsToSheetWithSpecifics')
    .addSeparator()
    .addItem('シート全体を再ソート＆採番', 'manuallyReSortAndNumberSheet')
    .addItem('アクティブシートの罫線を再描画', 'manuallyFormatActiveSheet')
    .addSeparator()
    .addItem('予約サマリーを再構築', 'rebuildSummarySheet')
    .addSeparator()
    .addItem('【開発用】テスト環境をセットアップ', 'setupTestEnvironment')
    .addSeparator()
    .addItem('【東京】フォーム選択肢を更新', () => setCheckboxChoices(TOKYO_CLASSROOM_NAME))
    .addItem('【つくば】フォーム選択肢を更新', () => setCheckboxChoices(TSUKUBA_CLASSROOM_NAME))
    .addItem('【沼津】フォーム選択肢を更新', () => setCheckboxChoices(NUMAZU_CLASSROOM_NAME));
}

function addCacheMenu(menu) {
  menu.addSeparator()
    .addItem('生徒名簿キャッシュを更新（手動）', 'updateRosterCache')
    .addItem('【データ移行】全過去ログから「きろく」キャッシュを生成', 'migrateAllRecordsToCache')
    .addItem('【データ移行】全予約から「よやくキャッシュ」を生成', 'migrateAllFutureBookingsToCache');
}

/**
 * インストール型トリガー：シート変更時に実行。
 * 実際の処理は `02-2_BusinessLogic_Handlers.gs` の `processChange` へ委譲します。
 * @param {Object} e - Google Sheets のイベントオブジェクト
 */
function handleOnChange(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) return;

  try {
    processChange(e.changeType);
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
function handleEdit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_TIME_MS)) return;
  try {
    processCellEdit(e);
  } catch (err) {
    handleError(`セル編集処理中にエラー: ${err.message}`, true);
  } finally {
    lock.releaseLock();
  }
}
