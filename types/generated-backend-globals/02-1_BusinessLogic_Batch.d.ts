/**
 * 【開発用】テスト環境をセットアップします。
 * 現在のスプレッドシートをコピーし、テスト用の新しい環境を作成します。
 */
export function setupTestEnvironment(): void;
/**
 * 直近60日間の会計済み予約日を取得する
 * @returns {string[]} 日付文字列の配列（YYYY-MM-DD形式、降順）
 */
export function getRecentCompletedReservationDates(): string[];
/**
 * 指定した日付の予約記録から売上ログを再転載する（ダイアログ表示版）
 * カスタムメニューから手動実行する想定
 */
export function repostSalesLogByDate(): void;
/**
 * 指定した日付の予約記録から売上ログを再転載する（処理実行部分）
 * HTMLダイアログから呼び出される
 * @param {string} targetDate - 対象日付（YYYY-MM-DD形式）
 */
export function processRepostSalesLogByDate(targetDate: string): {
    success: boolean;
    totalCount: number;
    successCount: number;
};
