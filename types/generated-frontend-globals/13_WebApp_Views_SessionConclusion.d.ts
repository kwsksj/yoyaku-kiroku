/**
 * @typedef {Object} SessionConclusionState
 * @property {string} currentStep - 現在のステップ (STEPS定数参照)
 * @property {ReservationCore | null} currentReservation - 今日のよやくデータ
 * @property {LessonCore | null} recommendedNextLesson - おすすめの次回レッスン
 * @property {LessonCore | null} selectedLesson - ユーザーが選択したレッスン
 * @property {ReservationCore | null} existingFutureReservation - 既存の未来よやく
 * @property {boolean} reservationSkipped - 「いまはきめない」を選択
 * @property {boolean} isWaitlistRequest - 空き通知希望として選択
 * @property {boolean} isLessonListExpanded - 日程一覧アコーディオン展開状態
 * @property {string} sessionNoteToday - 今日のきろく（セッションノート）
 * @property {string} nextLessonGoal - けいかく・もくひょう（生徒名簿に保存）
 * @property {string} sessionNoteNext - 次回よやくへのメッセージ
 * @property {string} nextStartTime - 次回開始時間
 * @property {string} nextEndTime - 次回終了時間
 * @property {ClassifiedAccountingItemsCore | null} classifiedItems - 会計項目
 * @property {AccountingFormDto} accountingFormData - 会計フォームデータ
 * @property {string} filterClassroom - 教室フィルター ('current' | 'all')
 * @property {string} [orderInput] - 材料希望入力
 * @property {string} [materialInput] - 注文品希望入力
 */
/**
 * ウィザードの進行バーを生成
 * @param {string} currentStep - 現在のステップID
 * @returns {string} HTML文字列
 */
export function renderWizardProgressBar(currentStep: string): string;
/**
 * ステップ1: 今日の記録画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep1Record(state: SessionConclusionState): string;
/**
 * ステップ2: けいかく・もくひょう入力画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep2GoalInput(state: SessionConclusionState): string;
/**
 * ステップ3: 次回よやく画面を生成（よやく）- スロット型UI
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep3Reservation(state: SessionConclusionState): string;
/**
 * ステップ4: 会計画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderStep4Accounting(state: SessionConclusionState): string;
/**
 * 完了画面を生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function renderConclusionComplete(state: SessionConclusionState): string;
/**
 * セッション終了ウィザード全体のフルページViewを生成
 * @param {SessionConclusionState} state - 現在の状態
 * @returns {string} HTML文字列
 */
export function getSessionConclusionView(state: SessionConclusionState): string;
export namespace STEPS {
    let RECORD: string;
    let GOAL: string;
    let RESERVATION: string;
    let ACCOUNTING: string;
    let COMPLETE: string;
}
export type SessionConclusionState = {
    /**
     * - 現在のステップ (STEPS定数参照)
     */
    currentStep: string;
    /**
     * - 今日のよやくデータ
     */
    currentReservation: ReservationCore | null;
    /**
     * - おすすめの次回レッスン
     */
    recommendedNextLesson: LessonCore | null;
    /**
     * - ユーザーが選択したレッスン
     */
    selectedLesson: LessonCore | null;
    /**
     * - 既存の未来よやく
     */
    existingFutureReservation: ReservationCore | null;
    /**
     * - 「いまはきめない」を選択
     */
    reservationSkipped: boolean;
    /**
     * - 空き通知希望として選択
     */
    isWaitlistRequest: boolean;
    /**
     * - 日程一覧アコーディオン展開状態
     */
    isLessonListExpanded: boolean;
    /**
     * - 今日のきろく（セッションノート）
     */
    sessionNoteToday: string;
    /**
     * - けいかく・もくひょう（生徒名簿に保存）
     */
    nextLessonGoal: string;
    /**
     * - 次回よやくへのメッセージ
     */
    sessionNoteNext: string;
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
    /**
     * - 教室フィルター ('current' | 'all')
     */
    filterClassroom: string;
    /**
     * - 材料希望入力
     */
    orderInput?: string;
    /**
     * - 注文品希望入力
     */
    materialInput?: string;
};
