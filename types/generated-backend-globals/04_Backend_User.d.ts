/**
 * =================================================================
 * 【ファイル名】: 04_Backend_User.js
 * 【バージョン】: 1.0
 * 【役割】: ユーザー関連のバックエンドロジック
 * - ユーザー情報の取得、更新
 * - ユーザー認証
 * =================================================================
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
declare function getAllStudentsAsObject(): {
    [x: string]: UserCore;
};
/**
 * 生徒名簿の行データからUserCoreオブジェクトを生成するヘルパー関数
 * （Phase 3: 型システム統一対応）
 *
 * @param {any[]} row - シートの1行分のデータ
 * @param {string[]} headers - ヘッダー配列
 * @param {number} rowIndex - 行番号（1-based）
 * @returns {UserCore}
 * @private
 */
declare function _createStudentObjectFromRow(row: any[], headers: string[], rowIndex: number): UserCore;
/**
 * 指定された電話番号と本名に一致するユーザーを検索します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} phone - 電話番号
 * @param {string} realName - 本名
 * @returns {ApiResponseGeneric<UserCore>}
 */
declare function findUserByPhoneAndRealName(phone: string, realName: string): ApiResponseGeneric<UserCore>;
/**
 * ユーザーのプロフィール詳細を取得します（編集画面用）
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponseGeneric<UserCore>}
 */
declare function getUserDetailForEdit(studentId: string): ApiResponseGeneric<UserCore>;
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
declare function updateUserProfile(userInfo: UserCore): ApiResponseGeneric<UserProfileUpdateResult>;
/**
 * 指定されたユーザーの予約履歴を取得します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponseGeneric<ReservationCore[]>}
 */
declare function getUserReservations(studentId: string): ApiResponseGeneric<ReservationCore[]>;
/**
 * 新規ユーザーを生徒名簿シートに登録します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {UserCore} userData - 登録するユーザー情報
 * @returns {ApiResponseGeneric<UserCore>}
 */
declare function registerNewUser(userData: UserCore): ApiResponseGeneric<UserCore>;
/**
 * 指定された電話番号のユーザーが既に存在するかチェックします。
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} phone - 電話番号
 * @returns {boolean} 存在する場合はtrue
 */
declare function checkExistingUserByPhone(phone: string): boolean;
/**
 * 新しい生徒ID（S-XXX形式）を生成します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 生徒名簿シート
 * @returns {string} 新しい生徒ID
 * @private
 */
declare function _generateNewStudentId(sheet: GoogleAppsScript.Spreadsheet.Sheet): string;
/**
 * ユーザーのログイン処理を行います。
 * 成功した場合、セッション情報を保存します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} phone - 電話番号
 * @param {string} realName - 本名
 * @returns {ApiResponseGeneric<UserCore>}
 */
declare function loginUser(phone: string, realName: string): ApiResponseGeneric<UserCore>;
/**
 * ユーザーのログアウト処理を行います。
 * セッション情報を削除します。
 * @returns {ApiResponse}
 */
declare function logoutUser(): ApiResponse;
/**
 * 現在ログインしているユーザーの情報を取得します。
 * @returns {ApiResponseGeneric<UserCore>}
 */
declare function getLoggedInUser(): ApiResponseGeneric<UserCore>;
/**
 * 【開発用】全生徒キャッシュをクリアします。
 */
declare function clearAllStudentsCache_DEV(): void;
/**
 * 【開発用】指定した生徒のキャッシュをクリアします。
 * @param {string} studentId - 生徒ID
 */
declare function clearStudentCache_DEV(studentId: string): void;
/**
 * 【開発用】全予約キャッシュをクリアします。
 */
declare function clearAllReservationsCache_DEV(): void;
/**
 * 【開発用】全キャッシュをクリアします。
 */
declare function clearAllCache_DEV(): void;
