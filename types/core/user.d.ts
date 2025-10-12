/**
 * =================================================================
 * 【ファイル名】: types/core/user-core.d.ts
 * 【役割】: ユーザーデータの統一Core型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/**
 * ユーザーデータの統一コア型
 *
 * - バックエンド・フロントエンド共通で使用
 * - 全ユーザー関連処理でこの型を使用する
 * - 生徒名簿のデータ構造を正確に反映
 *
 * @example
 * ```typescript
 * const user: UserCore = {
 *   studentId: 'S-001',
 *   phone: '09012345678',
 *   realName: '山田太郎',
 *   displayName: '太郎',
 * };
 * ```
 */
interface UserCore {
  // ========================================
  // 必須プロパティ
  // ========================================

  /** 生徒ID（例: S-001） */
  studentId?: string | undefined;

  /** 電話番号（ハイフンなし、例: 09012345678） */
  phone: string;

  /** 本名 */
  realName: string;

  /** 表示名（ニックネームまたは本名から生成） */
  displayName?: string | undefined;

  // ========================================
  // 基本情報（オプション）
  // ========================================

  /** ニックネーム */
  nickname?: string | undefined;

  /** メールアドレス */
  email?: string | undefined;

  /** メール送信希望フラグ */
  wantsEmail?: boolean | undefined;

  /** スケジュール通知希望フラグ */
  wantsScheduleNotification?: boolean | undefined;

  /** 通知日（曜日: 0=日曜, 1=月曜, ...） */
  notificationDay?: number | undefined;

  /** 通知時刻（時: 0-23） */
  notificationHour?: number | undefined;

  // ========================================
  // 属性情報（オプション）
  // ========================================

  /** 年齢層 */
  ageGroup?: string | undefined;

  /** 性別 */
  gender?: string | undefined;

  /** 利き手 */
  dominantHand?: string | undefined;

  /** 住所 */
  address?: string | undefined;

  // ========================================
  // 経験・目標（オプション）
  // ========================================

  /** 木彫り経験 */
  experience?: string | undefined;

  /** 過去の作品 */
  pastWork?: string | undefined;

  /** 想定参加頻度（今後の参加予定） */
  futureParticipation?: string | undefined;

  /** 将来制作したいもの */
  futureCreations?: string | undefined;

  /** 登録のきっかけ */
  trigger?: string | undefined;

  /** 初回メッセージ */
  firstMessage?: string | undefined;
}
