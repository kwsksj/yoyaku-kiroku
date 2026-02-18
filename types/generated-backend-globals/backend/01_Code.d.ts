/**
 * HTMLテンプレートのサブファイルをテンプレート評価の文脈で読み込むためのinclude関数
 * @param {string} filename - 読み込むHTMLファイル名（拡張子不要）
 * @returns {string} - サブファイルのHTML文字列
 */
export function include(filename: string): string;
/**
 * @param {GoogleAppsScript.Events.DoGet} e
 */
export function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput | GoogleAppsScript.HTML.HtmlOutput;
export function onOpen(): void;
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
export function onSelectionChange(e: {
    range: GoogleAppsScript.Spreadsheet.Range;
}): void;
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
 * さらに毎日実行のトリガーも追加（リトライキュー処理用）
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
 * 毎日実行: 9時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour9(): void;
/**
 * 毎日実行: 12時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour12(): void;
/**
 * 毎日実行: 18時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour18(): void;
/**
 * 毎日実行: 21時のリトライキュー処理（リトライ専用）
 */
export function trigger_sendNotification_daily_hour21(): void;
export const ADMIN_EMAIL: string;
export const CALENDAR_IDS_RAW: string;
export const CALENDAR_IDS: any;
