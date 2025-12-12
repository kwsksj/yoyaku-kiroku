/**
 * ウィザードを開始する
 * @param {string} reservationId - 対象の予約ID
 */
export function startSessionConclusion(reservationId: string): void;
export namespace sessionConclusionActionHandlers {
    function startSessionConclusion(d: ActionHandlerData): void;
    function conclusionNextStep(d: ActionHandlerData): void;
    function conclusionPrevStep(d: ActionHandlerData): void;
    function conclusionSkipReservation(): void;
    function conclusionFinalize(): void;
    function conclusionCancel(): void;
    function conclusionDone(): void;
}
export type SessionConclusionState = import("./13_WebApp_Views_SessionConclusion.js").SessionConclusionState;
