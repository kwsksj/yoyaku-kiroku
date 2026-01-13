export function getBookingView(classroom: string): string;
export function getReservationFormView(): string;
export function renderBookingLessons(lessons: LessonCore[], selectedClassroom?: string, options?: {
    reservations?: ReservationCore[];
    actions?: {
        book?: string;
        waitlist?: string;
        changeDate?: string;
    };
    isChangingDate?: boolean;
    isBeginnerMode?: boolean;
}): string;
export function getClassroomSelectionModalContent(): string;
export function getClassroomSelectionModal(): string;
export function _buildHistoryCardWithEditMode(historyItem: ReservationCore, editButtons: Array<any>): string;
