/**
 * 月次通知メールを送信するメインエントリーポイント（トリガーから実行）
 * 指定された日時に該当する生徒に通知メールを送信
 * リトライキューがある場合は優先的に処理し、Quota上限に近づいたら中断してキューに保存
 * @param {number} targetDay - 通知対象日（5, 15, 25）
 * @param {number} targetHour - 通知対象時刻（9, 12, 18, 21）
 */
export function sendMonthlyNotificationEmails(targetDay: number, targetHour: number): void;
/**
 * 通知メール送信対象者を抽出
 * @param {number} targetDay - 通知対象日
 * @param {number} targetHour - 通知対象時刻
 * @returns {UserCore[]} 送信対象生徒の配列
 * @private
 */
export function _getNotificationRecipients(targetDay: number, targetHour: number): UserCore[];
/**
 * メール本文を生成
 * @param {UserCore} student - 生徒情報
 * @param {Array<{date: string, startTime: string, endTime: string, status: string, classroom: string, venue: string}>} reservations - 生徒のよやく一覧
 * @param {LessonCore[]} lessons - 今後の日程一覧（getLessons()の結果）
 * @returns {string} メール本文
 * @private
 */
export function _generateEmailBody(student: UserCore, reservations: Array<{
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    classroom: string;
    venue: string;
}>, lessons: LessonCore[]): string;
/**
 * 時刻範囲をフォーマット（例: 13:00-15:30）
 * @param {string|Date} startTime - 開始時刻
 * @param {string|Date} endTime - 終了時刻
 * @returns {string} フォーマット済み時刻文字列
 * @private
 */
export function _formatTimeRange(startTime: string | Date, endTime: string | Date): string;
/**
 * ステータスをフォーマット
 * @param {string} status - ステータス
 * @returns {string} フォーマット済みステータス文字列
 * @private
 */
export function _formatStatus(status: string): string;
/**
 * 管理者へ送信失敗を通知
 * @param {number} successCount - 成功件数
 * @param {number} failCount - 失敗件数
 * @param {number} [retryCount=0] - リトライ待ち件数
 * @private
 */
export function _notifyAdminAboutFailures(successCount: number, failCount: number, retryCount?: number): void;
/**
 * 【開発・テスト用】手動で通知メールを送信
 * メニューから実行可能
 */
export function manualSendMonthlyNotificationEmails(): void;
/**
 * リトライキューに保存するエントリの型
 */
export type RetryQueueEntry = {
    /**
     * - 生徒ID
     */
    studentId: string;
    /**
     * - 元々の通知希望時刻
     */
    targetHour: number;
    /**
     * - リトライ回数
     */
    retryCount: number;
    /**
     * - 追加日時（timestamp）
     */
    addedAt: number;
};
