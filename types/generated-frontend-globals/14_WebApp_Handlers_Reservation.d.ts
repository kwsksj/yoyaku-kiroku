export namespace reservationActionHandlers {
    function cancel(d: ActionHandlerData): void;
    function confirmBooking(): void;
    function goToEditReservation(d: ActionHandlerData): void;
    function updateReservation(): void;
    function showClassroomModal(): void;
    function closeClassroomModal(): void;
    function goToBookingView(): void;
    function selectClassroom(d: ActionHandlerData): void;
    function filterBookingClassroom(d: ActionHandlerData): void;
    function updateLessonsAndGoToBooking(classroomName: string): void;
    function fetchLatestLessonsData(classroomName: string, newLessonsVersion: string | null): void;
    function bookLesson(d: ActionHandlerData): void;
    function goToReservationFormForLesson(d: ActionHandlerData): void;
    function goBackToDashboard(): void;
    function goToDashboard(): void;
    function goBackToBooking(): void;
    function confirmWaitlistedReservation(d: ActionHandlerData): void;
    function changeReservationDate(d: ActionHandlerData): void;
    function confirmDateChange(): void;
    function showLessonParticipants(d: ActionHandlerData): void;
    function goToAdminReservationForm(d: ActionHandlerData): void;
    function showAdminAccounting(d: ActionHandlerData): void;
}
