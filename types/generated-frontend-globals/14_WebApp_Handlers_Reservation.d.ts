export namespace reservationActionHandlers {
    function cancel(d: ActionHandlerData): void;
    function confirmBooking(): void;
    function goToEditReservation(d: ActionHandlerData): void;
    function updateReservation(): void;
    function showClassroomModal(): void;
    function closeClassroomModal(): void;
    function selectClassroom(d: ActionHandlerData): void;
    function updateLessonsAndGoToBooking(classroomName: string): void;
    function fetchLatestLessonsData(classroomName: string, newLessonsVersion: string | null): void;
    function bookLesson(d: ActionHandlerData): void;
    function goBackToDashboard(): void;
    function goToDashboard(): void;
    function goBackToBooking(): void;
    function confirmWaitlistedReservation(d: ActionHandlerData): void;
    function toggleBeginnerMode(isBeginnerMode: boolean): void;
    function resetBeginnerMode(): void;
}
