/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/constants.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 00_Constants.js
 * 【バージョン】: 1.2
 * 【役割】: プロジェクト全体で使用する統一定数定義システム
 * 【v1.2での変更点】:
 * - JSDocを修正し、グローバル型定義との競合を解消
 * =================================================================
 */

/**
 * プロジェクト全体で使用する統一定数オブジェクト
 * 型定義は types/constants.d.ts で定義されています
 */
const CONSTANTS = {
  // タイムゾーン設定
  TIMEZONE: 'Asia/Tokyo',

  // 環境設定（PRODUCTION_MODEはビルド時に自動設定される）
  ENVIRONMENT: {
    DEBUG_MODE: typeof DEBUG !== 'undefined' ? DEBUG : false,
    PRODUCTION_MODE: typeof ScriptApp !== 'undefined' && ScriptApp.getScriptId() === 'BUILD_TIME_REPLACEMENT',
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
    WAITLISTED: '待機', // 空き連絡希望
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
    LOG: 'アクティビティログ',
    RESERVATIONS: '統合予約シート',
    SCHEDULE: '日程マスタ',
  },

  // セッション関連
  SESSIONS: {
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
    EXISTING_SHEET_WARNING: `「日程マスタ」シートは既に存在します。
初期化しますか？（既存データは削除されます）`,
    SUCCESS: '成功',
    ERROR: 'エラー',
    CANCEL: 'キャンセル',
    SAVE: '保存する',
    EDIT: '編集',
  },

  // ログアクション定数
  LOG_ACTIONS: {
    ROSTER_EDIT: '名簿編集',
    RESERVATION_EDIT: '予約編集',
    ROW_INSERT: '行挿入',
    RESERVATION_CANCEL: '予約キャンセル',
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
    // 統合予約シート（短縮名: RESERVATIONS）
    RESERVATIONS: {
      RESERVATION_ID: '予約ID',
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
      EMAIL_PREFERENCE: 'メール連絡希望',
      NOTIFICATION_DAY: '通知日',
      NOTIFICATION_HOUR: '通知時刻',
      AGE_GROUP: '年代',
      AGE: '年齢',
      GENDER: '性別',
      DOMINANT_HAND: '利き手',
      ADDRESS: '住所',
      FUTURE_CREATIONS: '将来制作したいもの',
      WOODCARVING_EXPERIENCE: '木彫り経験',
      PAST_CREATIONS: '過去の制作物',
      FUTURE_PARTICIPATION: '今後のご参加について',
      TRIGGER: 'きっかけ',
      FIRST_MESSAGE: '初回メッセージ',
      COMPANION: '同行者',
      TRANSPORTATION: '来場手段',
      PICKUP: '送迎',
      TOTAL_PARTICIPATION: '参加回数',
      TOKYO_PARTICIPATION: '参加回数（東京）',
      NUMAZU_PARTICIPATION: '参加回数（沼津）',
      TSUKUBA_PARTICIPATION: '参加回数（つくば）',
      MITSUKOSHI_PARTICIPATION: '参加回数（三越）',
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
      STATUS: '状態',
      NOTES: '備考',
    },
  },

  // 会計項目定数
  ITEMS: {
    MAIN_LECTURE: '基本授業料',
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

  // 注意: HEADER_MAPPINGS は過度に複雑だったため削除
  // 必要な箇所では直接的なswitch文で対応

  // その他のシステム定数
  SYSTEM: {
    MATERIAL_INFO_PREFIX: '\n【希望材料】: ',
    ARCHIVE_PREFIX: 'アーカイブ_',
    DATA_START_ROW: 2,
  },

  // メール通知設定
  NOTIFICATION: {
    DAYS: [5, 15, 25], // 選択可能な通知日
    HOURS: [9, 12, 18, 21], // 選択可能な通知時刻
    DEFAULT_DAY: 25, // デフォルト通知日
    DEFAULT_HOUR: 9, // デフォルト通知時刻
    SCHEDULE_MONTHS_AHEAD: 3, // 通知対象となる日程の先行月数
  },
};

// =================================================================
// 環境設定・デバッグ制御
// =================================================================

/**
 * 環境判定とデバッグ制御の統一管理
 */
const ENVIRONMENT_CONFIG = {
  // デバッグ出力制御
  DEBUG_ENABLED: false, // 本番環境では false
};
