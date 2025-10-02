/**
 * =================================================================
 * 【ファイル名】: types/dto/user-dto.d.ts
 * 【役割】: ユーザー操作用DTO型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="../core/index.d.ts" />

/**
 * 新規ユーザー登録リクエストDTO
 *
 * 新規ユーザー登録時にフロントエンドからバックエンドへ送信するデータ
 * studentIdとdisplayNameは含まない（サーバー側で生成）
 *
 * @example
 * ```typescript
 * const registrationDto: UserRegistrationDto = {
 *   phone: '09012345678',
 *   realName: '山田太郎',
 *   nickname: '太郎',
 *   email: 'taro@example.com',
 *   wantsEmail: true,
 *   ageGroup: '30代',
 *   trigger: 'Web検索',
 *   firstMessage: 'よろしくお願いします',
 * };
 * ```
 */
interface UserRegistrationDto
  extends Omit<UserCore, 'studentId' | 'displayName'> {
  /** 電話番号（必須） */
  phone: string;

  /** 本名（必須） */
  realName: string;

  /** きっかけ（登録時のみ） */
  trigger?: string;

  /** 初回メッセージ（登録時のみ） */
  firstMessage?: string;
}

/**
 * ユーザー情報更新リクエストDTO
 *
 * 既存ユーザー情報を更新する際に使用
 * 部分更新をサポート（Partial型）
 *
 * @example
 * ```typescript
 * const updateDto: UserUpdateDto = {
 *   studentId: 'S-001',
 *   email: 'newemail@example.com',
 *   wantsEmail: true,
 *   address: '東京都渋谷区',
 * };
 * ```
 */
type UserUpdateDto = Partial<UserCore> & {
  /** 生徒ID（必須） */
  studentId: string;
};

/**
 * ユーザー情報API応答DTO（最小限）
 *
 * API応答で返すユーザー情報（必要最小限のフィールド）
 * 予約情報などに含めるユーザー情報として使用
 *
 * @example
 * ```typescript
 * const userInfoDto: UserInfoDto = {
 *   studentId: 'S-001',
 *   displayName: '太郎',
 *   realName: '山田太郎',
 * };
 * ```
 */
interface UserInfoDto {
  /** 生徒ID */
  studentId: string;

  /** 表示名 */
  displayName: string;

  /** 本名 */
  realName: string;
}

/**
 * プロフィール編集画面用DTO
 *
 * プロフィール編集画面で表示・編集するための完全なユーザー情報
 * UserCoreのエイリアス
 *
 * @example
 * ```typescript
 * const profileDto: UserProfileDto = {
 *   studentId: 'S-001',
 *   phone: '09012345678',
 *   realName: '山田太郎',
 *   displayName: '太郎',
 *   nickname: '太郎',
 *   email: 'taro@example.com',
 *   // ... その他全フィールド
 * };
 * ```
 */
type UserProfileDto = UserCore;

/**
 * ユーザー認証応答DTO
 *
 * ログイン成功時のAPI応答
 *
 * @example
 * ```typescript
 * const authResponse: UserAuthResponseDto = {
 *   success: true,
 *   user: {
 *     studentId: 'S-001',
 *     displayName: '太郎',
 *     realName: '山田太郎',
 *     phone: '09012345678',
 *   },
 * };
 * ```
 */
interface UserAuthResponseDto {
  /** 認証成功フラグ */
  success: boolean;

  /** 認証されたユーザー情報 */
  user?: {
    studentId: string;
    displayName: string;
    realName: string;
    phone: string;
  };

  /** エラーメッセージ */
  message?: string;

  /** 登録用電話番号（未登録の場合） */
  registrationPhone?: string;
}
