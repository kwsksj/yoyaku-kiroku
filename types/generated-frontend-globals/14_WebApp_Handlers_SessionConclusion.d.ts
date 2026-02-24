/**
 * ウィザードを開始する
 * @param {string} reservationId - 対象の予約ID
 * @param {boolean} [isSalesOnly=false] - 販売のみモードかどうか
 */
export function startSessionConclusion(reservationId: string, isSalesOnly?: boolean): void;
/**
 * 販売のみの会計フローを開始する（管理者専用）
 * バックエンドで販売専用予約を作成後、会計ステップに直接遷移
 * @param {string} studentId - 対象生徒のID
 * @param {string} lessonId - 対象レッスンID
 * @param {string} classroom - 教室名
 */
export function startSalesOnlyConclusion(studentId: string, lessonId: string, classroom: string): void;
/**
 * 現在の状態に基づいてウィザードViewを取得（14_WebApp_Handlers.jsから呼ばれる）
 * @returns {string} View HTML
 */
export function getCurrentSessionConclusionView(): string;
/**
 * ウィザードのUIセットアップ（14_WebApp_Handlers.jsから呼ばれる）
 * @param {string} [step] - 指定された場合、そのステップに強制同期
 */
export function setupSessionConclusionUI(step?: string): void;
/**
 * 外部からウィザードのステップを設定する（履歴ナビゲーション用）
 * @param {string} step
 */
export function setWizardStep(step: string): void;
/**
 * リロード後にウィザード状態を復元できるかチェックし、可能なら復元
 * window.onload から呼び出される
 * @returns {boolean} 復元できた場合true
 */
export function tryRestoreWizardFromCache(): boolean;
export namespace sessionConclusionActionHandlers {
    function startSessionConclusion(d: ActionHandlerData): void;
    function startSalesOnlyConclusion(d: ActionHandlerData): void;
    function conclusionNextStep(d: ActionHandlerData): void;
    function conclusionPrevStep(d: ActionHandlerData): void;
    function conclusionSkipReservation(): void;
    function conclusionFinalize(): void;
    function conclusionCancel(): void;
    function conclusionDone(): void;
    function selectRecommendedLesson(_d: any, target: HTMLElement): void;
    function skipReservation(): void;
    function undoReservationSkip(): void;
    function toggleLessonListDOM(): void;
    function selectLessonForConclusion(_d: any, target: HTMLElement): void;
    function clearSelectedLesson(): void;
    function toggleTimeEdit(): void;
    function requestWaitlistForConclusion(_d: any, target: HTMLElement): void;
}
export type SessionConclusionState = import("./13_WebApp_Views_SessionConclusion.js").SessionConclusionState;
