/**
 * @typedef {Object} InitialAppDataPayload
 * @property {AccountingMasterItemCore[]} accountingMaster
 * @property {Record<string, unknown>} cacheVersions
 * @property {LessonCore[]} lessons
 * @property {ReservationCore[]} myReservations
 */
/**
 * 生徒名簿シートから全生徒データを取得し、オブジェクト形式で返します。
 * この関数は、他の多くの関数で利用されるコアなデータソースです。
 * （Phase 3: 型システム統一対応）
 *
 * @returns {Object<string, UserCore>} 生徒IDをキーとした生徒データオブジェクト
 * @example
 * const allStudents = getAllStudentsAsObject();
 * const student = allStudents['S-001'];
 * if (student) {
 *   console.log(student.realName);
 * }
 */
export function getAllStudentsAsObject(): {
    [x: string]: UserCore;
};
/**
 * 電話番号からユーザーを認証します。
 * @param {string} phone - 認証に使用する電話番号
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function authenticateUser(phone: string): ApiResponseGeneric<UserCore>;
/**
 * 電話番号が管理者パスワードと一致するかをチェック
 * PropertiesServiceに保存された管理者パスワード（電話番号形式）と照合します
 *
 * @param {string} phone - 電話番号（正規化済み）
 * @returns {boolean} 管理者の場合true
 *
 * @example
 * // 管理者パスワードの初回設定（GASエディタから一度だけ実行）
 * function setupAdminPassword() {
 *   PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', '99999999999');
 *   Logger.log('管理者パスワードを設定しました');
 * }
 */
export function isAdminLogin(phone: string): boolean;
/**
 * 生徒IDが管理者かどうかを判定
 * 生徒名簿から電話番号を取得し、管理者パスワードと照合します
 *
 * @param {string} studentId - 生徒ID
 * @returns {boolean} 管理者の場合true
 *
 * @example
 * if (isAdminUser(studentId)) {
 *   // 管理者限定の処理
 * }
 */
export function isAdminUser(studentId: string): boolean;
/**
 * ユーザーのプロフィール詳細を取得します（編集画面用）
 * （Phase 3: 型システム統一対応）
 *
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
/**
 * 新規ユーザーを生徒名簿シートに登録します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {UserCore} userData - 登録するユーザー情報
 * @returns {UserRegistrationResult | ApiErrorResponse}
 */
export function registerNewUser(userData: UserCore): UserRegistrationResult | ApiErrorResponse;
/**
 * ユーザーのログイン処理を行います。
 * （Phase 3: 型システム統一対応）
 *
 * 注: セッション管理はフロントエンドのlocalStorage/sessionStorageで行います。
 * バックエンドではユーザー認証のみを担当します。
 *
 * @param {string} phone - 電話番号
 * @param {string} realName - 本名
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function loginUser(phone: string, realName: string): ApiResponseGeneric<UserCore>;
/**
 * ユーザーのログアウト処理を行います。
 *
 * 注: セッション管理はフロントエンドで行うため、バックエンドでは
 * ログ記録のみを行います。実際のセッションクリアはフロントエンド側で実施されます。
 *
 * @returns {ApiResponse}
 */
export function logoutUser(): ApiResponse;
/**
 * 現在ログインしているユーザーの情報を取得します。
 *
 * @deprecated この関数はフロントエンドのstorage管理に移行したため非推奨です。
 * フロントエンドのstateManager.getState().currentUserを使用してください。
 *
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function getLoggedInUser(): ApiResponseGeneric<UserCore>;
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
 * 【開発用】全生徒キャッシュをクリアします。
 */
export function clearAllStudentsCache_DEV(): void;
/**
 * 【開発用】指定した生徒のキャッシュをクリアします。
 * @param {string} studentId - 生徒ID
 */
export function clearStudentCache_DEV(studentId: string): void;
/**
 * 【開発用】全予約キャッシュをクリアします。
 */
export function clearAllReservationsCache_DEV(): void;
/**
 * 【開発用】全キャッシュをクリアします。
 */
export function clearAllCache_DEV(): void;
/**
 * 管理者パスワードを設定する（初回セットアップ用）
 * GASエディタから一度だけ実行してください
 *
 * @param {string} password - 管理者パスワード（電話番号形式を推奨）
 * @returns {void}
 *
 * @example
 * // GASエディタから実行
 * setupAdminPassword('99999999999');
 */
export function setupAdminPassword(password: string): void;
/**
 * 現在の管理者パスワードを確認する（デバッグ用）
 *
 * @returns {void}
 */
export function getAdminPassword_DEV(): void;
export type InitialAppDataPayload = {
    accountingMaster: AccountingMasterItemCore[];
    cacheVersions: Record<string, unknown>;
    lessons: LessonCore[];
    myReservations: ReservationCore[];
};
