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
interface LessonCore {
  // --- 基本情報 ---
  /** 教室名 */
  classroom: string;

  /** 開催日（YYYY-MM-DD） */
  date: string;

  /** 会場名 */
  venue?: string;

  /** 教室形式（'セッション制' | '時間制・2部制' | '時間制・全日'） */
  classroomType?: string;

  /** 備考 */
  notes?: string;

  /**
   * ステータス
   * @see CONSTANTS.SCHEDULE_STATUS
   * - '開催予定': 予約可能
   * - '休講': 予約不可
   * - '開催済み': 過去の日程
   */
  status?: string;

  // --- 時間情報 ---
  /** 1部開始時刻（HH:mm） */
  firstStart?: string;

  /** 1部終了時刻（HH:mm） */
  firstEnd?: string;

  /** 2部開始時刻（HH:mm） */
  secondStart?: string;

  /** 2部終了時刻（HH:mm） */
  secondEnd?: string;

  /** 初回者開始時刻（HH:mm） */
  beginnerStart?: string;

  /** 全日開始時刻（HH:mm）- セッション制・時間制全日用 */
  startTime?: string;

  /** 全日終了時刻（HH:mm）- セッション制・時間制全日用 */
  endTime?: string;

  // --- 定員情報 ---
  /** 全体定員 */
  totalCapacity?: number;

  /** 初回者定員 */
  beginnerCapacity?: number;

  // --- 空き枠情報（計算結果） ---
  /** 1部空き枠数 */
  firstSlots?: number;

  /** 2部空き枠数（2部制の場合のみ） */
  secondSlots?: number;

  /**
   * 初回枠の空き数
   * - null: 経験者限定（初回枠なし）
   * - 0: 初回枠満席
   * - 1以上: 初回枠あり
   */
  beginnerSlots?: number | null;

  /** 行インデックス（シート行番号） */
  rowIndex?: number;
}
