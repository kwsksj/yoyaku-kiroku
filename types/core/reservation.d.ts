/**
 * =================================================================
 * 【ファイル名】: types/core/reservation-core.d.ts
 * 【役割】: 予約データの統一Core型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

import type { AccountingDetailsCore } from './accounting';
import type { UserCore } from './user';

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
export interface AdminOperationParams {
  /** 管理者操作かどうか（締切や権限チェックの緩和に利用） */
  _isByAdmin?: boolean | undefined;

  /** 管理者セッショントークン（管理操作時のみ） */
  _adminToken?: string | null | undefined;
}

export interface ReservationCore extends AdminOperationParams {
  // ========================================
  // 必須プロパティ
  // ========================================

  /** 予約ID（例: R-20251003-001） */
  reservationId: string;

  /**
   * 関連するレッスンの一意なID (UUID)
   * @see LessonCore.lessonId
   */
  lessonId: string;

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
  venue?: string | undefined;

  /** 開始時刻（HH:mm形式、例: 13:00） */
  startTime?: string | undefined;

  /** 終了時刻（HH:mm形式、例: 16:00） */
  endTime?: string | undefined;

  // ========================================
  // 予約オプション
  // ========================================

  /** 彫刻刀レンタル */
  chiselRental?: boolean | undefined;

  /** 初回講座フラグ */
  firstLecture?: boolean | undefined;

  /** 制作メモ */
  sessionNote?: string | undefined;

  /** 材料情報 */
  materialInfo?: string | undefined;

  /** 注文内容 */
  order?: string | undefined;

  /** 先生へのメッセージ */
  messageToTeacher?: string | undefined;

  /** キャンセル理由 */
  cancelMessage?: string | undefined;

  /** 同行者 */
  companion?: string | undefined;

  /** 来場手段 */
  transportation?: string | undefined;

  /** 送迎 */
  pickup?: string | undefined;

  /** 車 */
  car?: string | undefined;

  /** 備考 */
  notes?: string | undefined;

  // ========================================
  // 会計関連
  // ========================================

  /** 会計詳細（計算結果） */
  accountingDetails?: AccountingDetailsCore | null | undefined;

  /** 割引適用フラグ */
  discountApplied?: boolean | string | undefined;

  /** 計算時間（分） */
  計算時間?: number | undefined;

  /** 休憩時間（分） */
  breakTime?: number | undefined;

  // ========================================
  // 関連データ
  // ========================================

  /**
   * ユーザー情報（生徒情報）
   * - getUserReservations()で自動付与
   * - フロントエンドで reservation.user.displayName としてアクセス可能
   * - JavaScriptの参照なのでメモリ効率的
   */
  user?: UserCore | undefined;

  // ========================================
  // 動的プロパティ（material/otherSales系）
  // ========================================

  /** 材料関連の動的プロパティ（materialType0, materialL0等） */
  [key: `material${string}`]: string | number | undefined;

  /** その他販売品の動的プロパティ（otherSalesName0, otherSalesPrice0等） */
  [key: `otherSales${string}`]: string | number | undefined;
}

/**
 * 予約キャンセル専用のパラメータ型
 *
 * - ReservationCoreから必要最小限のプロパティのみを抽出
 * - 型安全性の向上とコードの意図を明確化
 *
 * @example
 * ```typescript
 * const cancelParams: CancelReservationParams = {
 *   reservationId: 'R-20251003-001',
 *   studentId: 'S-001',
 *   cancelMessage: '予約日変更のため自動キャンセル',
 * };
 * ```
 */
export interface CancelReservationParams extends AdminOperationParams {
  /** 予約ID（例: R-20251003-001） */
  reservationId: string;

  /** 生徒ID（例: S-001） */
  studentId: string;

  /** キャンセル理由 */
  cancelMessage?: string | undefined;
}

/**
 * 予約詳細更新用パラメータ（管理者操作対応）
 */
export interface UpdateReservationDetailsParams
  extends Partial<ReservationCore>, AdminOperationParams {
  reservationId: string;
  studentId: string;
}

/**
 * 待機予約確定用パラメータ（管理者操作対応）
 */
export interface ConfirmWaitlistedReservationParams extends AdminOperationParams {
  reservationId: string;
  studentId: string;
  messageToTeacher?: string | undefined;
}

/**
 * 会計処理用の予約データ（管理者操作対応）
 */
export interface ReservationCoreWithAccounting
  extends ReservationCore, AdminOperationParams {
  accountingDetails: AccountingDetailsCore;
}
