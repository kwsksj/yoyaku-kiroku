/**
 * @typedef {Object} SessionConclusionState
 * @property {number} currentStep - 現在のステップ (1, 2, 3)
 * @property {ReservationCore | null} currentReservation - 今日の予約データ
 * @property {LessonCore | null} recommendedNextLesson - おすすめの次回レッスン
 * @property {string} workInProgressToday - 今日の制作メモ
 * @property {string} workInProgressNext - 次回やりたいこと
 * @property {string} nextStartTime - 次回開始時間
 * @property {string} nextEndTime - 次回終了時間
 * @property {ClassifiedAccountingItemsCore | null} classifiedItems - 会計項目
 * @property {AccountingFormDto} accountingFormData - 会計フォームデータ
 */
/**
 * ウィザードの進行バーを生成
 * @param {number} currentStep - 現在のステップ (1, 2, or 3)
 * @returns {string} HTML文字列
 */
export function renderWizardProgressBar(currentStep: number): string;
/**
 * ステップ1: 今日の記録画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep1Record(state: SessionConclusionState): string;
/**
 * ステップ2: 次回予約画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep2Reservation(state: SessionConclusionState): string;
/**
 * ステップ3: 会計画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep3Accounting(state: SessionConclusionState): string;
/**
 * 完了画面を生成
 * @returns {string} HTML文字列
 */
export function renderConclusionComplete(): string;
/**
 * セッション終了ウィザード全体のフルページViewを生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function getSessionConclusionView(state: SessionConclusionState): string;
/**
 * セッション終了ウィザード全体のモーダルを生成（後方互換用）
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 * @deprecated getSessionConclusionView を使用してください
 */
export function generateSessionConclusionModal(state: SessionConclusionState): string;
export type SessionConclusionState = {
    /**
     * - 現在のステップ (1, 2, 3)
     */
    currentStep: number;
    /**
     * - 今日の予約データ
     */
    currentReservation: ReservationCore | null;
    /**
     * - おすすめの次回レッスン
     */
    recommendedNextLesson: LessonCore | null;
    /**
     * - 今日の制作メモ
     */
    workInProgressToday: string;
    /**
     * - 次回やりたいこと
     */
    workInProgressNext: string;
    /**
     * - 次回開始時間
     */
    nextStartTime: string;
    /**
     * - 次回終了時間
     */
    nextEndTime: string;
    /**
     * - 会計項目
     */
    classifiedItems: ClassifiedAccountingItemsCore | null;
    /**
     * - 会計フォームデータ
     */
    accountingFormData: AccountingFormDto;
};
