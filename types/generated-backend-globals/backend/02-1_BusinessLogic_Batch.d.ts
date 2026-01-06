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
 * 指定した日付の予約記録から売上ログを転載する
 * HTMLダイアログ（手動再転載）またはバッチ処理（日次転載）から呼び出される
 * @param {string} [targetDate] - 対象日付（YYYY-MM-DD形式）。省略時は当日。
 * @returns {{ success: boolean, totalCount: number, successCount: number }} 転載結果
 */
export function transferSalesLogByDate(targetDate?: string): {
    success: boolean;
    totalCount: number;
    successCount: number;
};
/**
 * 予約シート全体をソートします（バッチ処理用）
 *
 * @description
 * 予約シートのデータを以下の順序でソートします:
 * 1. 日付順（降順: 新しい日付が上）
 * 2. ステータス順（完了=確定 > 待機 > 取消）
 * 3. 開始時間順（昇順）
 * 4. 終了時間順（昇順）
 * 5. 初回順（初回=true > 空白/false）
 *
 * @returns {{success: boolean, message: string, sortedCount: number}}
 */
export function sortReservationSheet(): {
    success: boolean;
    message: string;
    sortedCount: number;
};
/**
 * 【トリガー関数】毎日20時に実行: 当日の会計済み予約を売上表に転載する
 * スクリプトのトリガー設定から呼び出される
 *
 * @description
 * このバッチ処理により、会計修正は当日20時まで可能となり、
 * 20時以降は確定された会計データが売上表に転載される。
 * これにより、会計処理時の売上ログ記録が不要になり、
 * 何度修正しても売上表に影響がない運用が実現できる。
 */
export function dailySalesTransferBatch(): void;
