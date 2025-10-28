/**
 * =================================================================
 * 【ファイル名】: types/core/lesson.d.ts
 * 【役割】: レッスン（日程マスタ）のCore型定義
 * 【バージョン】: 2.0
 * =================================================================
 */

/**
 * レッスン情報（日程マスタの1行）
 *
 * 1日の教室開催情報を表現
 * スプレッドシート「日程マスタ」の列名に準拠
 *
 * @example
 * ```typescript
 * // 時間制・2部制の例
 * const lesson: LessonCore = {
 *   classroom: "東京教室",
 *   date: "2025-10-15",
 *   venue: "銀座会場",
 *   classroomType: "時間制・2部制",
 *   firstStart: "10:00",
 *   firstEnd: "13:00",
 *   secondStart: "14:00",
 *   secondEnd: "17:00",
 *   totalCapacity: 8,
 *   beginnerCapacity: 3,
 *   status: "開催予定",
 *   firstSlots: 5,
 *   secondSlots: 4,
 *   beginnerSlots: 2
 * }
 *
 * // セッション制の例
 * const lesson2: LessonCore = {
 *   classroom: "筑波教室",
 *   date: "2025-10-20",
 *   venue: "つくば市民ホール",
 *   classroomType: "セッション制",
 *   startTime: "10:00",
 *   endTime: "17:00",
 *   totalCapacity: 12,
 *   status: "開催予定",
 *   firstSlots: 8
 * }
 * ```
 */
export interface LessonCore {
  // --- インデックスシグネチャ ---
  [key: string]: any;

  // --- 識別子 ---
  /**
   * レッスンを一意に識別するID (UUID)
   * @example "c3e2a1b0-5b3a-4b9c-8b0a-0e1b0e1b0e1b"
   */
  lessonId: string;

  /**
   * このレッスンに紐づく予約IDの配列
   * @example ["rsv-001", "rsv-002"]
   */
  reservationIds: string[];

  // --- 基本情報 ---
  /** 教室名 */
  classroom: string;

  /** 開催日（YYYY-MM-DD） */
  date: string | Date;

  /** 会場名 */
  venue?: string | undefined;

  /** 教室形式（'セッション制' | '時間制・2部制' | '時間制・全日'） */
  classroomType?: string | undefined;

  /** 備考 */
  notes?: string | undefined;

  /**
   * ステータス
   * @see CONSTANTS.SCHEDULE_STATUS
   * - '開催予定': 予約可能
   * - '休講': 予約不可
   * - '開催済み': 過去の日程
   */
  status?: string | undefined;

  // --- 時間情報 ---
  /** 1部開始時刻（HH:mm） */
  firstStart?: string | undefined;

  /** 1部終了時刻（HH:mm） */
  firstEnd?: string | undefined;

  /** 2部開始時刻（HH:mm） */
  secondStart?: string | undefined;

  /** 2部終了時刻（HH:mm） */
  secondEnd?: string | undefined;

  /** 初回者開始時刻（HH:mm） */
  beginnerStart?: string | undefined;

  /** 全日開始時刻（HH:mm）- セッション制・時間制全日用 */
  startTime?: string | undefined;

  /** 全日終了時刻（HH:mm）- セッション制・時間制全日用 */
  endTime?: string | undefined;

  // --- 定員情報 ---
  /** 全体定員 */
  totalCapacity?: number | undefined;

  /** 初回者定員 */
  beginnerCapacity?: number | undefined;

  // --- 空き枠情報（計算結果） ---
  /** 1部空き枠数 */
  firstSlots?: number | undefined;

  /** 2部空き枠数（2部制の場合のみ） */
  secondSlots?: number | undefined;

  /**
   * 初回枠の空き数
   * - null: 経験者限定（初回枠なし）
   * - 0: 初回枠満席
   * - 1以上: 初回枠あり
   */
  beginnerSlots?: number | null | undefined;

  /** 行インデックス（シート行番号） */
  rowIndex?: number | undefined;
}

/**
 * 日程マスタ情報の統一型エイリアス
 * LessonCoreと同義だが、文脈上の意味付けのために別名を提供
 */
export type ScheduleInfo = LessonCore;
export type SessionCore = LessonCore;
