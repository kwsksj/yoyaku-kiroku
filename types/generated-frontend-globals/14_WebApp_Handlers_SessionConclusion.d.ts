/**
 * ウィザードを開始する
 * @param {string} reservationId - 対象の予約ID
 */
export function startSessionConclusion(reservationId: string): void;
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
