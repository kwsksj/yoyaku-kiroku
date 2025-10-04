/**
 * =================================================================
 * 【ファイル名】: types/core/session.d.ts
 * 【役割】: 開催セッション（スケジュールマスター）のCore型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/**
 * 開催セッション情報（スケジュールマスターの1行）
 *
 * 特定日・特定教室の1回の開催枠を表現
 * 1つのSessionCoreには複数の時間帯（午前/午後）が含まれる場合がある
 *
 * @example
 * ```typescript
 * // 時間制・2部制の例
 * const session: SessionCore = {
 *   classroom: "東京教室",
 *   date: "2025-10-15",
 *   venue: "銀座会場",
 *   classroomType: "時間制・2部制",
 *   firstStart: "10:00",   // 午前（TIME_SLOTS.MORNING）
 *   firstEnd: "13:00",
 *   secondStart: "14:00",  // 午後（TIME_SLOTS.AFTERNOON）
 *   secondEnd: "17:00",
 *   maxCapacity: 8,
 *   currentReservations: 3
 * }
 *
 * // セッション制の例
 * const session2: SessionCore = {
 *   classroom: "筑波教室",
 *   date: "2025-10-20",
 *   venue: "つくば市民ホール",
 *   classroomType: "セッション制",
 *   startTime: "10:00",
 *   endTime: "17:00",
 *   maxCapacity: 12
 * }
 * ```
 */
interface SessionCore {
  // --- 開催情報 ---
  /** 教室名 */
  classroom: string;

  /** 開催日（YYYY-MM-DD形式、1日単位） */
  date: string;

  /** 会場名 */
  venue?: string;

  /** 教室形式（'セッション制' | '時間制・2部制' | '時間制・全日'） */
  classroomType?: string;

  // --- 時間制（全日）---
  /** 開始時刻（HH:mm形式） */
  startTime?: string;

  /** 終了時刻（HH:mm形式） */
  endTime?: string;

  // --- 時間制・2部制（TIME_SLOTSで区分）---
  /** 午前開始時刻（CONSTANTS.TIME_SLOTS.MORNING） */
  firstStart?: string;

  /** 午前終了時刻 */
  firstEnd?: string;

  /** 午後開始時刻（CONSTANTS.TIME_SLOTS.AFTERNOON） */
  secondStart?: string;

  /** 午後終了時刻 */
  secondEnd?: string;

  /** 初心者枠開始時刻（特定教室用） */
  beginnerStart?: string;

  // --- 定員情報 ---
  /** 最大定員数 */
  maxCapacity?: number;

  /** 現在の予約数 */
  currentReservations?: number;

  /** 待ちリスト数 */
  waitlistCount?: number;

  // --- 追加情報 ---
  /** 備考 */
  notes?: string;

  /** 休講フラグ */
  isCancelled?: boolean;

  /** 満席フラグ */
  isFull?: boolean;

  /** 行インデックス（シート行番号） */
  rowIndex?: number;
}
