/**
 * =================================================================
 * 【ファイル名】: 04_Backend_User.gs
 * 【バージョン】: 4.0
 * 【役割】: Webアプリ連携のうち、ユーザー認証・管理を担当するバックエンド機能。
 * 【v4.0での変更点】
 * - Phase 3: 型システム統一 - Core型・DTO型の導入
 * - registerNewUser: UserRegistrationDto対応
 * - updateUserProfile: UserUpdateDto対応
 * - 変換関数の活用（convertRowToUser/convertUserToRow）
 * 【v3.5での変更点】
 * - updateUserProfile がピンポイント更新（rowIndex利用）を行うように修正。
 * - updateUserProfile 内の電話番号重複チェックをキャッシュベースに変更。
 * =================================================================
 */
/**
 * 電話番号を正規化し、日本の携帯電話番号形式か検証するプライベートヘルパー関数。
 * @param {string} phoneNumber - 検証する電話番号。
 * @param {boolean} [allowEmpty=false] - 空文字列を有効とみなすか。
 * @returns {{isValid: boolean, normalized: string, message: string}} - 検証結果オブジェクト。
 */
export function _normalizeAndValidatePhone(phoneNumber: string, allowEmpty?: boolean): {
    isValid: boolean;
    normalized: string;
    message: string;
};
/**
 * 軽量電話番号バリデーション（パフォーマンス最適化版）
 * フロントエンドで事前検証済みのデータに対する最小限チェック
 * @param {string} phoneNumber - 正規化済み電話番号（フロントエンドで処理済み想定）
 * @returns {boolean} 有効性
 */
export function _validatePhoneLight(phoneNumber: string): boolean;
/**
 * 軽量認証：電話番号検証のみ実行（初期データ取得を除外）
 * フロントエンドで事前取得されたデータと組み合わせて使用
 * @param {string} phoneNumber - 認証する電話番号
 * @returns {Object} 認証結果（初期データなし）
 */
export function authenticateUserLightweight(phoneNumber: string): any;
/**
 * キャッシュデータから個人用データを抽出する
 * @param {string} studentId - 生徒ID
 * @param {{allReservationsCache: ReservationCacheData}} cacheData - getAppInitialDataから取得したキャッシュデータ
 * @returns {PersonalDataResult} - 個人の予約、履歴、利用可能枠データ
 */
export function extractPersonalDataFromCache(studentId: string, cacheData: {
    allReservationsCache: ReservationCacheData;
}): PersonalDataResult;
/**
 * 電話番号を元にユーザーを認証します（軽量版）。
 * 初期データは含まず、ユーザー認証のみに特化。
 * @param {string} phoneNumber - 認証に使用する電話番号。
 * @returns {Object} - 認証結果のみ（初期データなし）
 */
export function authenticateUser(phoneNumber: string): any;
/**
 * 新規ユーザーを生徒名簿に登録します（Phase 3: 型システム統一対応）
 *
 * @param {UserCore} userInfo - 新規ユーザー登録リクエストDTO
 * @returns {ApiResponseGeneric<UserRegistrationResult>}
 *
 * @example
 * const result = registerNewUser({
 *   phone: '09012345678',
 *   realName: '山田太郎',
 *   nickname: '太郎',
 *   email: 'taro@example.com',
 *   wantsEmail: true,
 *   trigger: 'Web検索',
 *   firstMessage: 'よろしくお願いします',
 * });
 */
export function registerNewUser(userInfo: UserCore): ApiResponseGeneric<UserRegistrationResult>;
/**
 * メールアドレスの形式をチェックします。
 * @param {string} email - チェックするメールアドレス
 * @returns {boolean} - 形式が正しければtrue
 */
export function _isValidEmail(email: string): boolean;
/**
 * ユーザーアカウントを退会（電話番号無効化）します
 * 電話番号にプレフィックスを追加してログイン不可にします
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponseGeneric<{message: string}>}
 */
export function requestAccountDeletion(studentId: string): ApiResponseGeneric<{
    message: string;
}>;
/**
 * プロフィール編集用にユーザーの詳細情報をシートから取得します。
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function getUserDetailForEdit(studentId: string): ApiResponseGeneric<UserCore>;
/**
 * ユーザーのプロフィール（本名、ニックネーム、電話番号、メールアドレス）を更新します
 * （Phase 3: 型システム統一対応）
 *
 * @param {UserCore} userInfo - ユーザー情報更新リクエストDTO
 * @returns {ApiResponseGeneric<UserProfileUpdateResult>}
 *
 * @example
 * const result = updateUserProfile({
 *   studentId: 'S-001',
 *   email: 'newemail@example.com',
 *   wantsEmail: true,
 *   address: '東京都渋谷区',
 * });
 */
export function updateUserProfile(userInfo: UserCore): ApiResponseGeneric<UserProfileUpdateResult>;
