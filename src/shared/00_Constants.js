/**
 * @file 00_Constants.js
 * @description
 * このファイルは、フロントエンドとバックエンドの両方で共有されるグローバル定数を定義します。
 *
 * !!! AIへの重要指示 !!!
 * このファイルはビルドプロセスによって、サーバーサイドコードとクライアントサイドの<script>の両方に
 * 組み込まれる【唯一の例外ファイル】です。
 *
 * ここに定義された定数は、両方の環境からグローバルな `CONSTANTS` オブジェクトとしてアクセスできます。
 * 他のファイルにはこの仕組みは適用されません。
 */

/**
 * =================================================================
 * 【ファイル名】  : 00_Constants.js
 * 【モジュール種別】: 共有（ビルド時にバックエンド／フロントエンドへ自動注入）
 * 【役割】        : プロジェクト全体で利用される定数を `CONSTANTS` オブジェクトとして定義し、両環境で共通参照できるようにする。
 *
 * 【主な責務】
 *   - 教室名・予約ステータス・UI 設定など、アプリ全体で一貫して参照する値を管理
 *   - ビルド時に `CONSTANTS` がグローバルへ自動注入される唯一の例外ファイルとして機能
 *   - TypeScript 型は `npm run types:refresh` により `types/generated-shared-globals` へ出力され、エディタ補完を支援
 *
 * 【関連モジュール】
 *   - すべてのフロント／バックエンドファイル（import 記述は開発時の補完用で、ビルドで除去）
 *   - `tools/create-global-bridge.js`: 共有定数用ブリッジ (`types/generated-shared-globals/_globals.d.ts`) を生成
 *
 * 【利用時の留意点】
 *   - 値を追加した場合、定数に依存するドキュメントや UI 設定も合わせて更新する
 *   - ここへビジネスロジックを追加しない。純粋な値／設定のみを定義する
 *   - ビルド前提を崩さないよう、他ファイルへ `globalThis.CONSTANTS` などを直接定義させない
 * =================================================================
 */

/**
 * プロジェクト全体で使用する統一定数オブジェクト
 * 型定義は自動生成されます
 */
export const CONSTANTS = {
  // タイムゾーン設定
  TIMEZONE: 'Asia/Tokyo',

  // 環境設定（PRODUCTION_MODEはビルド時に自動設定される）
  ENVIRONMENT: {
    PRODUCTION_MODE: false, // ビルド時に自動置換される
  },

  // WebアプリケーションURL
  WEB_APP_URL: {
    PRODUCTION: 'https://www.kibori-class.net/booking',
  },

  /**
   * 教室名定数
   */
  CLASSROOMS: {
    TOKYO: '東京教室',
    NUMAZU: '沼津教室',
    TSUKUBA: 'つくば教室',
  },

  /**
   * ステータス定数（4種類統合）
   */
  STATUS: {
    CANCELED: '取消', // キャンセル済み
    WAITLISTED: '待機', // 空き通知希望
    CONFIRMED: '確定', // 予約確定（会計前）
    COMPLETED: '完了', // 完了（会計済み）
  },

  /**
   * 単位定数
   */
  UNITS: {
    THIRTY_MIN: '30分',
    PIECE: '個',
    SET: 'セット',
    CM3: 'cm³',
  },

  /**
   * 支払い方法定数
   */
  PAYMENT_METHODS: {
    CASH: 'cash',
    CARD: 'card',
    TRANSFER: 'transfer',
  },

  /**
   * UI関連定数
   */
  UI: {
    HISTORY_INITIAL_RECORDS: 10,
    HISTORY_LOAD_MORE_RECORDS: 10,
    LOADING_MESSAGE_INTERVAL: 3000,
    MODAL_FADE_DURATION: 300,
    COLUMN_WIDTHS: {
      DATE: 100,
      CLASSROOM: 100,
      VENUE: 150,
      CLASSROOM_TYPE: 120,
      TIME: 80,
      BEGINNER_START: 100,
      CAPACITY: 80,
      STATUS: 80,
      NOTES: 200,
    },
  },

  // 容量・制限
  LIMITS: {
    TSUKUBA_MORNING_SESSION_END_HOUR: 13,
    LOCK_WAIT_TIME_MS: 30000,
    MAX_RETRY_COUNT: 3,
  },

  // シート名
  SHEET_NAMES: {
    ROSTER: '生徒名簿',
    ACCOUNTING: '会計マスタ',
    LOG: 'ログ',
    RESERVATIONS: '予約記録',
    SCHEDULE: '日程',
    SALES_LOG: '売上（項目別）', // 別スプレッドシート
  },

  // 時間帯区分（2部制教室用）
  TIME_SLOTS: {
    MORNING: '午前',
    AFTERNOON: '午後',
    ALL_DAY: '全日',
  },

  // 支払い方法（表示用）
  PAYMENT_DISPLAY: {
    CASH: '現金',
    COTRA: 'ことら送金',
    BANK_TRANSFER: 'オンライン振込',
  },

  // 銀行情報
  BANK_INFO: {
    COTRA_PHONE: '09013755977',
    NAME: 'ゆうちょ銀行',
    BRANCH: '818',
    ACCOUNT: '2661797',
  },

  // フロントエンド固有のUI設定
  FRONTEND_UI: {
    DISCOUNT_OPTIONS: {
      NONE: 0,
      THIRTY_MIN: 30,
      SIXTY_MIN: 60,
    },
    TIME_SETTINGS: {
      STEP_MINUTES: 30,
      END_BUFFER_HOURS: 3,
    },
  },

  // メッセージ定数
  MESSAGES: {
    PROCESSING_INTERRUPTED: '処理を中断しました。',
    SHEET_INITIALIZATION: '日程マスタシートの初期化',
    EXISTING_SHEET_WARNING:
      '「日程マスタ」シートは既に存在します。\n初期化しますか？（既存データは削除されます）',
    SUCCESS: '成功',
    ERROR: 'エラー',
    CANCEL: 'キャンセル',
    SAVE: '保存する',
    EDIT: '編集',
  },

  // ログアクション定数
  LOG_ACTIONS: {
    // 予約関連
    RESERVATION_CREATE: '予約作成',
    RESERVATION_WAITLIST: '空き通知 登録',
    RESERVATION_CANCEL: '予約キャンセル',
    RESERVATION_UPDATE: '予約詳細更新',
    RESERVATION_CONFIRM: '予約確定（空き通知から）',
    RESERVATION_EDIT: '予約編集',

    // 会計関連
    ACCOUNTING_SAVE: '会計記録保存',
    ACCOUNTING_MODIFY: '会計記録修正',

    // ユーザー管理関連
    USER_LOGIN: 'ログイン',
    USER_LOGOUT: 'ログアウト',
    USER_REGISTER: '新規登録',
    USER_UPDATE: 'プロフィール更新',
    USER_UPDATE_ERROR: 'プロフィール詳細取得エラー',
    USER_PASSWORD_CHANGE: 'パスワード変更',
    USER_WITHDRAWAL: '退会',

    // 名簿・データ管理関連
    ROSTER_EDIT: '名簿編集',
    ROW_INSERT: '行挿入',

    // メール通知関連
    EMAIL_VACANCY_NOTIFICATION: '空き通知メール送信',

    // システム・バッチ関連
    BATCH_SALES_TRANSFER_START: '売上転載バッチ開始',
    BATCH_SALES_TRANSFER_SUCCESS: '売上転載バッチ完了',
    BATCH_SALES_TRANSFER_ERROR: '売上転載バッチエラー',
    SYSTEM_ERROR: 'システムエラー',
  },

  // 教室タイプ定数
  CLASSROOM_TYPES: {
    SESSION_BASED: 'セッション制',
    TIME_DUAL: '時間制・2部制',
    TIME_FULL: '時間制・全日',
  },

  // スケジュールステータス定数
  SCHEDULE_STATUS: {
    SCHEDULED: '開催予定',
    CANCELLED: '休講',
    COMPLETED: '開催済み',
  },

  // シート別ヘッダー定数
  HEADERS: {
    // 予約記録シート（短縮名: RESERVATIONS）
    RESERVATIONS: {
      RESERVATION_ID: '予約ID',
      LESSON_ID: 'レッスンID',
      STUDENT_ID: '生徒ID',
      DATE: '日付',
      CLASSROOM: '教室',
      VENUE: '会場',
      START_TIME: '開始時刻',
      END_TIME: '終了時刻',
      STATUS: 'ステータス',
      CHISEL_RENTAL: '彫刻刀レンタル',
      FIRST_LECTURE: '初回',
      TRANSPORTATION: '来場手段',
      PICKUP: '送迎',
      WORK_IN_PROGRESS: '制作メモ',
      ORDER: 'order',
      MESSAGE_TO_TEACHER: 'メッセージ',
      ACCOUNTING_DETAILS: '会計詳細',
    },

    // 生徒名簿
    ROSTER: {
      STUDENT_ID: '生徒ID',
      REAL_NAME: '本名',
      NICKNAME: 'ニックネーム',
      PHONE: '電話番号',
      CAR: '車',
      CHISEL_RENTAL: '彫刻刀レンタル',
      LINE: 'LINE',
      NOTES: 'notes',
      FROM: 'from',
      REGISTRATION_DATE: '登録日時',
      EMAIL: 'メールアドレス',
      WANTS_RESERVATION_EMAIL: '予約メール希望',
      WANTS_SCHEDULE_INFO: '日程連絡希望',
      NOTIFICATION_DAY: '通知日',
      NOTIFICATION_HOUR: '通知時刻',
      AGE_GROUP: '年代',
      GENDER: '性別',
      DOMINANT_HAND: '利き手',
      ADDRESS: '住所',
      FUTURE_CREATIONS: '将来制作したいもの',
      EXPERIENCE: '木彫り経験',
      PAST_WORK: '過去の制作物',
      ATTENDANCE_INTENTION: '想定参加頻度',
      TRIGGER: 'きっかけ',
      FIRST_MESSAGE: '初回メッセージ',
      COMPANION: '同行者',
      TRANSPORTATION: '来場手段',
      PICKUP: '送迎',
      TOTAL_PARTICIPATION: '参加回数',
    },

    // 会計マスタ（短縮名: ACCOUNTING）
    ACCOUNTING: {
      TYPE: '種別',
      ITEM_NAME: '項目名',
      UNIT_PRICE: '単価',
      UNIT: '単位',
      TARGET_CLASSROOM: '対象教室',
      NOTES: '備考',
    },

    // 日程マスタ（短縮名: SCHEDULE）
    SCHEDULE: {
      LESSON_ID: 'レッスンID',
      RESERVATION_IDS: '予約IDs',
      DATE: '日付',
      CLASSROOM: '教室',
      VENUE: '会場',
      TYPE: '教室形式',
      FIRST_START: '1部開始',
      FIRST_END: '1部終了',
      SECOND_START: '2部開始',
      SECOND_END: '2部終了',
      BEGINNER_START: '初回者開始',
      TOTAL_CAPACITY: '全体定員',
      BEGINNER_CAPACITY: '初回者定員',
      STATUS: 'ステータス',
      NOTES: '備考',
    },
  },

  // 会計項目定数
  ITEMS: {
    MAIN_LECTURE: '基本授業料',
    MAIN_LECTURE_COUNT: '授業料（回数制）',
    MAIN_LECTURE_TIME: '授業料（時間制）',
    FIRST_LECTURE: '初回参加費',
    CHISEL_RENTAL: '彫刻刀レンタル',
    DISCOUNT: '初回者同時割引',
  },

  // 会計項目種別定数
  ITEM_TYPES: {
    TUITION: '授業料',
    SALES: '物販',
    MATERIAL: '材料',
  },

  // その他のシステム定数
  SYSTEM: {
    MATERIAL_INFO_PREFIX: '\n【希望材料】: ',
    ARCHIVE_PREFIX: 'アーカイブ_',
    DATA_START_ROW: 2,
    CACHE_EXPIRY_SECONDS: 86400, // 24時間
    HEADER_ROW: 1,
  },

  // 会計システム設定
  ACCOUNTING_SYSTEM: {
    /**
     * 会計修正締切時刻（24時間形式）
     * この時刻以降は会計修正が不可能になり、売上表への転載が実行される
     */
    MODIFICATION_DEADLINE_HOUR: 20, // 20時
    /**
     * 売上表転載バッチの実行時刻
     * 毎日この時刻に当日の会計済み予約を売上表に転載する
     */
    SALES_TRANSFER_HOUR: 20, // 20時
  },

  // メール通知設定
  NOTIFICATION: {
    DAYS: [5, 15, 25], // 選択可能な通知日
    HOURS: [9, 12, 18, 21], // 選択可能な通知時刻
    DEFAULT_DAY: 25, // デフォルト通知日
    DEFAULT_HOUR: 9, // デフォルト通知時刻
    SCHEDULE_MONTHS_AHEAD: 3, // 通知対象となる日程の先行月数
  },

  // 曜日コード
  WEEKEND: {
    SUNDAY: 0,
    SATURDAY: 6,
  },
};
