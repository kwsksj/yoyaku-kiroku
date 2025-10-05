/**
 * =================================================================
 * 【ファイル名】: types/core/reservation-core.d.ts
 * 【役割】: 予約データの統一Core型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/**
 * 予約データの統一コア型
 *
 * - バックエンド・フロントエンド共通で使用
 * - 全処理でこの型を使用する（旧型は段階的に廃止）
 * - データの流れ: RawSheetRow → ReservationCore → DTO型
 *
 * @example
 * ```typescript
 * const reservation: ReservationCore = {
 *   reservationId: 'R-20251003-001',
 *   studentId: 'S-001',
 *   classroom: '東京教室',
 *   date: '2025-10-15',
 *   status: '確定',
 * };
 * ```
 */
interface ReservationCore {
  // ========================================
  // 必須プロパティ
  // ========================================

  /** 予約ID（例: R-20251003-001） */
  reservationId: string;

  /** 生徒ID（例: S-001） */
  studentId: string;

  /** 教室名（CONSTANTS.CLASSROOMSの値） */
  classroom: string;

  /** 日付（YYYY-MM-DD形式） */
  date: string;

  /** ステータス（CONSTANTS.STATUSの値: 取消/待機/確定/完了） */
  status: string;

  // ========================================
  // 基本オプション
  // ========================================

  /** 会場名 */
  venue?: string;

  /** 開始時刻（HH:mm形式、例: 13:00） */
  startTime?: string;

  /** 終了時刻（HH:mm形式、例: 16:00） */
  endTime?: string;

  // ========================================
  // 予約オプション
  // ========================================

  /** 彫刻刀レンタル */
  chiselRental?: boolean;

  /** 初回講座フラグ */
  firstLecture?: boolean;

  /** 制作メモ */
  workInProgress?: string;

  /** 材料情報 */
  materialInfo?: string;

  /** 注文内容 */
  order?: string;

  /** 先生へのメッセージ */
  messageToTeacher?: string;

  // ========================================
  // 会計関連
  // ========================================

  /** 会計詳細（計算結果） */
  accountingDetails?: AccountingDetailsCore | null;

  /** 割引適用フラグ */
  discountApplied?: boolean | string;

  /** 計算時間（分） */
  計算時間?: number;

  /** 休憩時間（分） */
  breakTime?: number;

  // ========================================
  // 関連データ
  // ========================================

  /**
   * ユーザー情報（生徒情報）
   * - getUserReservations()で自動付与
   * - フロントエンドで reservation.user.displayName としてアクセス可能
   * - JavaScriptの参照なのでメモリ効率的
   */
  user?: UserCore;

  // ========================================
  // 動的プロパティ（material/otherSales系）
  // ========================================

  /** 材料関連の動的プロパティ（materialType0, materialL0等） */
  [key: `material${string}`]: string | number | undefined;

  /** その他販売品の動的プロパティ（otherSalesName0, otherSalesPrice0等） */
  [key: `otherSales${string}`]: string | number | undefined;
}

/// <reference path="./common.d.ts" />
