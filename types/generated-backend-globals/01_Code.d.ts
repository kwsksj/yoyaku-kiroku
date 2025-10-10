/**
 * HTMLテンプレートのサブファイルをテンプレート評価の文脈で読み込むためのinclude関数
 * @param {string} filename - 読み込むHTMLファイル名（拡張子不要）
 * @returns {string} - サブファイルのHTML文字列
 */
export function include(filename: string): string;
/**
 * @param {GoogleAppsScript.Events.DoGet} e
 */
export function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput;
export function onOpen(): void;
/**
 * @param {GoogleAppsScript.Base.Menu} menu
 */
export function addAdminMenu(menu: GoogleAppsScript.Base.Menu): void;
/**
 * @param {GoogleAppsScript.Base.Menu} menu
 */
export function addCacheMenu(menu: GoogleAppsScript.Base.Menu): void;
/**
 * インストール型トリガー：シート変更時に実行。
 * 実際の処理は `02-2_BusinessLogic_Handlers.gs` の `processChange` へ委譲します。
 * @param {GoogleAppsScript.Events.SheetsOnChange} _e - Google Sheets のイベントオブジェクト
 */
export function handleOnChange(_e: GoogleAppsScript.Events.SheetsOnChange): void;
/**
 * インストール型トリガー：シート編集時に実行。
 * 実際の処理は `02-2_BusinessLogic_Handlers.gs` の `processCellEdit` へ委譲します。
 * @param {GoogleAppsScript.Events.SheetsOnEdit} _e - Google Sheets のイベントオブジェクト
 */
export function handleEdit(_e: GoogleAppsScript.Events.SheetsOnEdit): void;
/**
 * テスト用WebAppのエントリーポイント
 * パフォーマンステスト画面を表示します
 */
export function doGetTest(): GoogleAppsScript.HTML.HtmlOutput;
/**
 * 別のデプロイメント用のエントリーポイント
 * テスト専用のデプロイメントを作成する場合に使用
 * @param {GoogleAppsScript.Events.DoGet} _e
 */
export function doGetPerformanceTest(_e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput;
/**
 * 管理者メールアドレスを設定する関数
 * GASエディタから一度だけ実行してください
 * @param {string} email - 設定するメールアドレス
 */
export function setAdminEmail(email?: string): void;
/**
 * 月次通知メールトリガーを設定
 * すべての通知日・時刻の組み合わせに対してトリガーを作成
 */
export function setupMonthlyNotificationTriggers(): {
    success: boolean;
    count: number;
};
/**
 * 月次通知メールトリガーを削除
 */
export function deleteMonthlyNotificationTriggers(): {
    success: boolean;
    count: number;
};
export function trigger_sendNotification_day5_hour9(): void;
export function trigger_sendNotification_day5_hour12(): void;
export function trigger_sendNotification_day5_hour18(): void;
export function trigger_sendNotification_day5_hour21(): void;
export function trigger_sendNotification_day15_hour9(): void;
export function trigger_sendNotification_day15_hour12(): void;
export function trigger_sendNotification_day15_hour18(): void;
export function trigger_sendNotification_day15_hour21(): void;
export function trigger_sendNotification_day25_hour9(): void;
export function trigger_sendNotification_day25_hour12(): void;
export function trigger_sendNotification_day25_hour18(): void;
export function trigger_sendNotification_day25_hour21(): void;
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
export const RESERVATION_DATA_START_ROW: 2;
export const ADMIN_EMAIL: string;
export const COLUMN_WIDTH_DATE: 100;
export const COLUMN_WIDTH_CLASSROOM: 100;
export const COLUMN_WIDTH_VENUE: 150;
export const COLUMN_WIDTH_CLASSROOM_TYPE: 120;
export const COLUMN_WIDTH_TIME: 80;
export const COLUMN_WIDTH_BEGINNER_START: 100;
export const COLUMN_WIDTH_CAPACITY: 80;
export const COLUMN_WIDTH_STATUS: 80;
export const COLUMN_WIDTH_NOTES: 200;
export const CACHE_EXPIRY_SECONDS: 86400;
export const WEEKEND_SUNDAY: 0;
export const WEEKEND_SATURDAY: 6;
export const HEADER_ROW: 1;
export const CALENDAR_IDS_RAW: string;
export const CALENDAR_IDS: any;
