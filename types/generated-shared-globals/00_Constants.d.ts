export namespace CONSTANTS {
    let TIMEZONE: string;
    namespace ENVIRONMENT {
        let PRODUCTION_MODE: boolean;
    }
    namespace WEB_APP_URL {
        let PRODUCTION: string;
    }
    namespace CLASSROOMS {
        let TOKYO: string;
        let NUMAZU: string;
        let TSUKUBA: string;
    }
    namespace STATUS {
        let CANCELED: string;
        let WAITLISTED: string;
        let CONFIRMED: string;
        let COMPLETED: string;
    }
    namespace STATUS_PRIORITY {
        let 完了: number;
        let 確定: number;
        let 待機: number;
        let 取消: number;
    }
    namespace UNITS {
        let THIRTY_MIN: string;
        let PIECE: string;
        let SET: string;
        let CM3: string;
    }
    namespace PAYMENT_METHODS {
        let CASH: string;
        let CARD: string;
        let TRANSFER: string;
    }
    namespace UI {
        let HISTORY_INITIAL_RECORDS: number;
        let HISTORY_LOAD_MORE_RECORDS: number;
        let LOADING_MESSAGE_INTERVAL: number;
        let MODAL_FADE_DURATION: number;
        namespace COLUMN_WIDTHS {
            export let DATE: number;
            export let CLASSROOM: number;
            export let VENUE: number;
            export let CLASSROOM_TYPE: number;
            export let TIME: number;
            export let BEGINNER_START: number;
            export let CAPACITY: number;
            let STATUS_1: number;
            export { STATUS_1 as STATUS };
            export let NOTES: number;
        }
    }
    namespace LIMITS {
        let TSUKUBA_MORNING_SESSION_END_HOUR: number;
        let LOCK_WAIT_TIME_MS: number;
        let MAX_RETRY_COUNT: number;
    }
    namespace SHEET_NAMES {
        let ROSTER: string;
        let ACCOUNTING: string;
        let LOG: string;
        let RESERVATIONS: string;
        let SCHEDULE: string;
        let SALES_LOG: string;
    }
    namespace TIME_SLOTS {
        let MORNING: string;
        let AFTERNOON: string;
        let ALL_DAY: string;
    }
    namespace PAYMENT_DISPLAY {
        let CASH_1: string;
        export { CASH_1 as CASH };
        export let COTRA: string;
        export let BANK_TRANSFER: string;
    }
    namespace BANK_INFO {
        let COTRA_PHONE: string;
        let NAME: string;
        let BRANCH: string;
        let ACCOUNT: string;
    }
    namespace FRONTEND_UI {
        namespace DISCOUNT_OPTIONS {
            export let NONE: number;
            let THIRTY_MIN_1: number;
            export { THIRTY_MIN_1 as THIRTY_MIN };
            export let SIXTY_MIN: number;
        }
        namespace TIME_SETTINGS {
            let STEP_MINUTES: number;
            let END_BUFFER_HOURS: number;
        }
    }
    namespace MESSAGES {
        let PROCESSING_INTERRUPTED: string;
        let SHEET_INITIALIZATION: string;
        let EXISTING_SHEET_WARNING: string;
        let SUCCESS: string;
        let ERROR: string;
        let CANCEL: string;
        let SAVE: string;
        let EDIT: string;
    }
    namespace LOG_ACTIONS {
        let RESERVATION_CREATE: string;
        let RESERVATION_WAITLIST: string;
        let RESERVATION_CANCEL: string;
        let RESERVATION_UPDATE: string;
        let RESERVATION_CONFIRM: string;
        let RESERVATION_EDIT: string;
        let ACCOUNTING_SAVE: string;
        let ACCOUNTING_MODIFY: string;
        let USER_LOGIN: string;
        let USER_LOGOUT: string;
        let USER_REGISTER: string;
        let USER_UPDATE: string;
        let USER_UPDATE_ERROR: string;
        let USER_PASSWORD_CHANGE: string;
        let USER_WITHDRAWAL: string;
        let ADMIN_TOKEN_ISSUE: string;
        let ADMIN_TOKEN_VALIDATE_ERROR: string;
        let ADMIN_TOKEN_REVOKE: string;
        let ROSTER_EDIT: string;
        let ROW_INSERT: string;
        let EMAIL_VACANCY_NOTIFICATION: string;
        let BATCH_SALES_TRANSFER_START: string;
        let BATCH_SALES_TRANSFER_SUCCESS: string;
        let BATCH_SALES_TRANSFER_ERROR: string;
        let BATCH_SORT_SUCCESS: string;
        let BATCH_SORT_ERROR: string;
        let SYSTEM_ERROR: string;
    }
    namespace CLASSROOM_TYPES {
        let SESSION_BASED: string;
        let TIME_DUAL: string;
        let TIME_FULL: string;
    }
    namespace SCHEDULE_STATUS {
        export let SCHEDULED: string;
        export let CANCELLED: string;
        let COMPLETED_1: string;
        export { COMPLETED_1 as COMPLETED };
    }
    namespace HEADERS {
        export namespace RESERVATIONS_1 {
            export let RESERVATION_ID: string;
            export let LESSON_ID: string;
            export let STUDENT_ID: string;
            let DATE_1: string;
            export { DATE_1 as DATE };
            let CLASSROOM_1: string;
            export { CLASSROOM_1 as CLASSROOM };
            let VENUE_1: string;
            export { VENUE_1 as VENUE };
            export let START_TIME: string;
            export let END_TIME: string;
            let STATUS_2: string;
            export { STATUS_2 as STATUS };
            export let CHISEL_RENTAL: string;
            export let FIRST_LECTURE: string;
            export let TRANSPORTATION: string;
            export let PICKUP: string;
            export let SEESSION_NOTE: string;
            export let ORDER: string;
            export let MESSAGE_TO_TEACHER: string;
            export let ACCOUNTING_DETAILS: string;
        }
        export { RESERVATIONS_1 as RESERVATIONS };
        export namespace ROSTER_1 {
            let STUDENT_ID_1: string;
            export { STUDENT_ID_1 as STUDENT_ID };
            export let REAL_NAME: string;
            export let NICKNAME: string;
            export let PHONE: string;
            export let CAR: string;
            let CHISEL_RENTAL_1: string;
            export { CHISEL_RENTAL_1 as CHISEL_RENTAL };
            export let LINE: string;
            let NOTES_1: string;
            export { NOTES_1 as NOTES };
            export let FROM: string;
            export let REGISTRATION_DATE: string;
            export let EMAIL: string;
            export let WANTS_RESERVATION_EMAIL: string;
            export let WANTS_SCHEDULE_INFO: string;
            export let NOTIFICATION_DAY: string;
            export let NOTIFICATION_HOUR: string;
            export let AGE_GROUP: string;
            export let GENDER: string;
            export let DOMINANT_HAND: string;
            export let ADDRESS: string;
            export let FUTURE_CREATIONS: string;
            export let EXPERIENCE: string;
            export let PAST_WORK: string;
            export let ATTENDANCE_INTENTION: string;
            export let TRIGGER: string;
            export let FIRST_MESSAGE: string;
            export let COMPANION: string;
            let TRANSPORTATION_1: string;
            export { TRANSPORTATION_1 as TRANSPORTATION };
            let PICKUP_1: string;
            export { PICKUP_1 as PICKUP };
            export let TOTAL_PARTICIPATION: string;
            export let NEXT_LESSON_GOAL: string;
        }
        export { ROSTER_1 as ROSTER };
        export namespace ACCOUNTING_1 {
            export let TYPE: string;
            export let ITEM_NAME: string;
            export let UNIT_PRICE: string;
            export let UNIT: string;
            export let TARGET_CLASSROOM: string;
            let NOTES_2: string;
            export { NOTES_2 as NOTES };
        }
        export { ACCOUNTING_1 as ACCOUNTING };
        export namespace SCHEDULE_1 {
            let LESSON_ID_1: string;
            export { LESSON_ID_1 as LESSON_ID };
            export let RESERVATION_IDS: string;
            let DATE_2: string;
            export { DATE_2 as DATE };
            let CLASSROOM_2: string;
            export { CLASSROOM_2 as CLASSROOM };
            let VENUE_2: string;
            export { VENUE_2 as VENUE };
            let TYPE_1: string;
            export { TYPE_1 as TYPE };
            export let FIRST_START: string;
            export let FIRST_END: string;
            export let SECOND_START: string;
            export let SECOND_END: string;
            let BEGINNER_START_1: string;
            export { BEGINNER_START_1 as BEGINNER_START };
            export let TOTAL_CAPACITY: string;
            export let BEGINNER_CAPACITY: string;
            let STATUS_3: string;
            export { STATUS_3 as STATUS };
            let NOTES_3: string;
            export { NOTES_3 as NOTES };
        }
        export { SCHEDULE_1 as SCHEDULE };
    }
    namespace ITEMS {
        export let MAIN_LECTURE: string;
        export let MAIN_LECTURE_COUNT: string;
        export let MAIN_LECTURE_TIME: string;
        let FIRST_LECTURE_1: string;
        export { FIRST_LECTURE_1 as FIRST_LECTURE };
        let CHISEL_RENTAL_2: string;
        export { CHISEL_RENTAL_2 as CHISEL_RENTAL };
        export let DISCOUNT: string;
    }
    namespace ITEM_TYPES {
        let TUITION: string;
        let SALES: string;
        let MATERIAL: string;
    }
    namespace SYSTEM {
        let MATERIAL_INFO_PREFIX: string;
        let ARCHIVE_PREFIX: string;
        let DATA_START_ROW: number;
        let CACHE_EXPIRY_SECONDS: number;
        let HEADER_ROW: number;
    }
    namespace ACCOUNTING_SYSTEM {
        let MODIFICATION_DEADLINE_HOUR: number;
        let SALES_TRANSFER_HOUR: number;
    }
    namespace NOTIFICATION {
        let DAYS: number[];
        let HOURS: number[];
        let DEFAULT_DAY: number;
        let DEFAULT_HOUR: number;
        let SCHEDULE_MONTHS_AHEAD: number;
    }
    namespace WEEKEND {
        let SUNDAY: number;
        let SATURDAY: number;
    }
}
