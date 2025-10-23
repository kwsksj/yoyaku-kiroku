/**
 * =================================================================
 * 【ファイル名】  : 04_Backend_User.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 生徒（ユーザー）データの取得・更新・認証に関する中核ロジックをまとめる。
 *
 * 【主な責務】
 *   - `getAllStudentsAsObject` で名簿シートを正規化し、他モジュールへ提供
 *   - プロフィール更新・登録・ログインなどのユーザー操作を一元管理
 *   - CacheManager と連携し、生徒キャッシュの整合性を維持
 *
 * 【関連モジュール】
 *   - `00_SpreadsheetManager.js`: シート操作の基盤
 *   - `07_CacheManager.js`: 生徒キャッシュの取得・再構築
 *   - `08_Utilities.js`: withTransaction / normalizePhoneNumber などの共通ユーティリティ
 *
 * 【利用時の留意点】
 *   - すべての公開関数は `withTransaction` 等で排他制御を行う設計。呼び出し側で重複ロックを避けること
 *   - 電話番号比較は `normalizePhoneNumber` に必ず通す（`INVALID_PHONE_RESULT` を活用）
 *   - 新規フィールドを名簿シートへ追加した際は、ヘッダーマップ (`createHeaderMap`) とプロパティマッピングを更新する
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { SS_MANAGER } from './00_SpreadsheetManager.js';
import {
  CACHE_KEYS,
  addCachedStudent,
  deleteAllCache,
  deleteCache,
  getCachedAllStudents,
  rebuildAllStudentsBasicCache,
  updateCachedStudent,
} from './07_CacheManager.js';
import {
  createHeaderMap,
  getCachedStudentById,
  logActivity,
  normalizePhoneNumber,
  withTransaction,
} from './08_Utilities.js';

/** @type {PhoneNormalizationResult} */
const INVALID_PHONE_RESULT = {
  normalized: '',
  isValid: false,
};

/**
 * @typedef {Object} InitialAppDataPayload
 * @property {AccountingMasterItemCore[]} accountingMaster
 * @property {Record<string, unknown>} cacheVersions
 * @property {LessonCore[]} lessons
 * @property {ReservationCore[]} myReservations
 */

// =================================================================
// ★★★ 生徒データの取得（コア関数） ★★★
// =================================================================

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
export function getAllStudentsAsObject() {
  const allStudentsSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ROSTER);
  if (!allStudentsSheet) {
    throw new Error(`シートが見つかりません: ${CONSTANTS.SHEET_NAMES.ROSTER}`);
  }

  const allStudentsData = allStudentsSheet.getDataRange().getValues();
  const headers = allStudentsData[0];
  const studentIdColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.STUDENT_ID);

  if (studentIdColIdx === -1) {
    throw new Error(
      `必須ヘッダーが見つかりません: ${CONSTANTS.HEADERS.ROSTER.STUDENT_ID}`,
    );
  }

  /** @type {Object<string, UserCore>} */
  const studentsObject = {};

  // ヘッダー行を除いてループ
  for (let i = 1; i < allStudentsData.length; i++) {
    const row = allStudentsData[i];
    const studentId = String(row[studentIdColIdx]);

    if (studentId) {
      // ★改善: ヘルパー関数でオブジェクトを生成
      const student = _createStudentObjectFromRow(row, headers, i + 1);
      studentsObject[studentId] = student;
    }
  }

  return studentsObject;
}

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
function _createStudentObjectFromRow(row, headers, rowIndex) {
  /** @type {UserCore} */
  const student = {};

  // ヘッダー名からUserCoreプロパティ名への明示的なマッピング
  // (保守性向上: 将来的なプロパティ追加や変更に対応しやすくする)
  const headerToPropMap = {
    [CONSTANTS.HEADERS.ROSTER.STUDENT_ID]: 'studentId',
    [CONSTANTS.HEADERS.ROSTER.REAL_NAME]: 'realName',
    [CONSTANTS.HEADERS.ROSTER.NICKNAME]: 'nickname',
    [CONSTANTS.HEADERS.ROSTER.PHONE]: 'phone',
    [CONSTANTS.HEADERS.ROSTER.EMAIL]: 'email',
    [CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL]: 'wantsEmail', // ヘッダー名とプロパティ名の不一致を明示的に解決
    [CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO]: 'wantsScheduleNotification', // ヘッダー名とプロパティ名の不一致を明示的に解決
    [CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY]: 'notificationDay',
    [CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR]: 'notificationHour',
    [CONSTANTS.HEADERS.ROSTER.ADDRESS]: 'address',
    [CONSTANTS.HEADERS.ROSTER.AGE_GROUP]: 'ageGroup',
    [CONSTANTS.HEADERS.ROSTER.GENDER]: 'gender',
    [CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND]: 'dominantHand',
    [CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS]: 'futureCreations',
  };

  // 各プロパティを設定
  for (let i = 0; i < headers.length; i++) {
    const headerName = headers[i];
    const propName = headerToPropMap[headerName];

    if (propName) {
      const value = row[i];

      // 型変換と設定
      if (
        propName === 'wantsEmail' ||
        propName === 'wantsScheduleNotification'
      ) {
        student[propName] = String(value).toUpperCase() === 'TRUE';
      } else if (
        propName === 'notificationDay' ||
        propName === 'notificationHour'
      ) {
        student[propName] =
          value !== '' && value != null ? Number(value) : undefined;
      } else {
        student[propName] = String(value);
      }
    }
  }

  // 計算プロパティ
  student.displayName = student.nickname || student.realName;
  student.rowIndex = rowIndex; // 行番号を付与

  return student;
}

// =================================================================
// ★★★ ユーザー認証・情報取得 ★★★
// =================================================================

/**
 * 指定された電話番号と本名に一致するユーザーを検索します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} phone - 電話番号
 * @param {string} realName - 本名
 * @returns {ApiResponseGeneric<UserCore>}
 */
function findUserByPhoneAndRealName(phone, realName) {
  try {
    // 全生徒データをキャッシュから取得
    const allStudents = getCachedAllStudents();
    if (!allStudents || Object.keys(allStudents).length === 0) {
      return {
        success: false,
        message: '生徒データの取得に失敗しました。キャッシュを更新中です。',
      };
    }

    // 入力電話番号を正規化
    const normalizedInputPhone = normalizePhoneNumber(phone);
    if (!normalizedInputPhone.isValid) {
      return {
        success: false,
        message:
          normalizedInputPhone.error || '電話番号の形式が正しくありません。',
      };
    }

    // 電話番号と本名でユーザーを検索（電話番号は正規化して比較）
    const foundUser = Object.values(allStudents).find(user => {
      const normalizedUserPhone = user.phone
        ? normalizePhoneNumber(user.phone)
        : INVALID_PHONE_RESULT;
      return (
        normalizedUserPhone.isValid &&
        normalizedUserPhone.normalized === normalizedInputPhone.normalized &&
        user.realName === realName
      );
    });

    if (foundUser) {
      Logger.log(`ユーザー認証成功: ${foundUser.studentId}`);
      return {
        success: true,
        data: foundUser,
      };
    } else {
      Logger.log(`ユーザー認証失敗: ${phone}, ${realName}`);
      return {
        success: false,
        message: '電話番号または本名が一致しませんでした。',
      };
    }
  } catch (error) {
    Logger.log(`ユーザー検索エラー: ${error.message}`);
    return {
      success: false,
      message: `サーバーエラーが発生しました: ${error.message}`,
    };
  }
}

/**
 * 電話番号からユーザーを認証します。
 * @param {string} phone - 認証に使用する電話番号
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function authenticateUser(phone) {
  try {
    if (!phone) {
      return {
        success: false,
        message: '電話番号が指定されていません。',
      };
    }

    const normalizedInput = normalizePhoneNumber(phone);
    if (!normalizedInput.isValid) {
      return {
        success: false,
        message: normalizedInput.error || '電話番号の形式が正しくありません。',
      };
    }

    const allStudents = getCachedAllStudents();
    if (!allStudents) {
      return {
        success: false,
        message: '生徒データの取得に失敗しました。キャッシュを更新中です。',
      };
    }

    const matchedStudent = Object.values(allStudents).find(student => {
      const normalizedStudentPhone = student.phone
        ? normalizePhoneNumber(student.phone)
        : INVALID_PHONE_RESULT;
      return (
        normalizedStudentPhone.isValid &&
        normalizedStudentPhone.normalized === normalizedInput.normalized
      );
    });

    if (!matchedStudent) {
      return {
        success: false,
        message: '一致するユーザーが見つかりませんでした。',
        user: null,
      };
    }

    return {
      success: true,
      data: matchedStudent,
      user: matchedStudent,
    };
  } catch (error) {
    Logger.log(`authenticateUser エラー: ${error.message}`);
    return {
      success: false,
      message: `ユーザー認証に失敗しました: ${error.message}`,
      user: null,
    };
  }
}

/**
 * ユーザーのプロフィール詳細を取得します（編集画面用）
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function getUserDetailForEdit(studentId) {
  try {
    const allStudentsSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ROSTER);
    if (!allStudentsSheet) {
      throw new Error(
        `シートが見つかりません: ${CONSTANTS.SHEET_NAMES.ROSTER}`,
      );
    }

    const data = allStudentsSheet.getDataRange().getValues();
    const headers = data[0];

    // ヘッダーインデックスを取得
    const studentIdColIdx = headers.indexOf(
      CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
    );
    if (studentIdColIdx === -1)
      throw new Error('生徒IDヘッダーが見つかりません');

    // 対象ユーザーの行を検索
    const userRow = data.find(
      /**
       * @param {RawSheetRow} row
       * @returns {boolean}
       */
      row => String(row[studentIdColIdx]) === studentId,
    );
    if (!userRow) {
      throw new Error('対象のユーザーが見つかりませんでした。');
    }

    // 各列のインデックスを取得
    const realNameColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.REAL_NAME);
    const nicknameColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.NICKNAME);
    const phoneColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.PHONE);
    const emailColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.EMAIL);
    const emailPreferenceColIdx = headers.indexOf(
      CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL,
    );
    const scheduleNotificationPreferenceColIdx = headers.indexOf(
      CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO,
    );
    const notificationDayColIdx = headers.indexOf(
      CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY,
    );
    const notificationHourColIdx = headers.indexOf(
      CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR,
    );
    const addressColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.ADDRESS);
    const ageGroupColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.AGE_GROUP);
    const genderColIdx = headers.indexOf(CONSTANTS.HEADERS.ROSTER.GENDER);
    const dominantHandColIdx = headers.indexOf(
      CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
    );
    const futureCreationsColIdx = headers.indexOf(
      CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS,
    );

    // 値の取得と整形
    const realName =
      realNameColIdx !== -1 ? String(userRow[realNameColIdx]) : '';
    const nickname =
      nicknameColIdx !== -1 ? String(userRow[nicknameColIdx]) : '';
    const notificationDayValue =
      notificationDayColIdx !== -1 ? userRow[notificationDayColIdx] : '';
    const notificationHourValue =
      notificationHourColIdx !== -1 ? userRow[notificationHourColIdx] : '';

    /** @type {UserCore} */
    const userDetail = {
      studentId: studentId,
      realName: realName,
      displayName: nickname || realName, // displayNameとしてnicknameを返す（フロントエンドとの整合性）
      nickname: nickname, // 互換性のため残す
      phone: phoneColIdx !== -1 ? String(userRow[phoneColIdx]) : '',
      email: emailColIdx !== -1 ? String(userRow[emailColIdx]) : '',
      wantsEmail:
        emailPreferenceColIdx !== -1
          ? String(userRow[emailPreferenceColIdx]).toUpperCase() === 'TRUE'
          : false,
      wantsScheduleNotification:
        scheduleNotificationPreferenceColIdx !== -1
          ? String(
              userRow[scheduleNotificationPreferenceColIdx],
            ).toUpperCase() === 'TRUE'
          : false,
      address: addressColIdx !== -1 ? String(userRow[addressColIdx]) : '',
      ageGroup: ageGroupColIdx !== -1 ? String(userRow[ageGroupColIdx]) : '',
      gender: genderColIdx !== -1 ? String(userRow[genderColIdx]) : '',
      dominantHand:
        dominantHandColIdx !== -1 ? String(userRow[dominantHandColIdx]) : '',
      futureCreations:
        futureCreationsColIdx !== -1
          ? String(userRow[futureCreationsColIdx])
          : '',
      notificationDay:
        notificationDayValue !== '' && notificationDayValue != null
          ? Number(notificationDayValue)
          : undefined,
      notificationHour:
        notificationHourValue !== '' && notificationHourValue != null
          ? Number(notificationHourValue)
          : undefined,
    };

    Logger.log(
      `getUserDetailForEdit成功: studentId=${studentId}, realName=${userDetail.realName}`,
    );

    return {
      success: true,
      data: userDetail,
    };
  } catch (err) {
    Logger.log(`getUserDetailForEdit Error: ${err.message}`);
    logActivity(
      studentId || 'N/A',
      'プロフィール詳細取得エラー',
      '失敗',
      `Error: ${err.message}`,
    );
    return {
      success: false,
      message: `サーバーエラーが発生しました。`,
    };
  }
}

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
export function updateUserProfile(userInfo) {
  return withTransaction(() => {
    let studentId = '';
    try {
      if (!userInfo.studentId) {
        return {
          success: false,
          message: 'studentIdが指定されていません。',
        };
      }

      studentId = userInfo.studentId;

      // 新しいヘルパー関数を使用して生徒データを取得
      const targetStudent = getCachedStudentById(studentId);
      if (!targetStudent) {
        throw new Error('更新対象のユーザーが見つかりませんでした。');
      }

      const targetRowIndex = targetStudent.rowIndex;
      if (!targetRowIndex) {
        // rowIndexがキャッシュにない場合のエラーハンドリング（フェーズ2以降は必須）
        throw new Error(
          '対象ユーザーの行番号情報がキャッシュに見つかりません。',
        );
      }

      const allStudentsSheet = SS_MANAGER.getSheet(
        CONSTANTS.SHEET_NAMES.ROSTER,
      );
      if (!allStudentsSheet) {
        throw new Error(
          `シートが見つかりません: ${CONSTANTS.SHEET_NAMES.ROSTER}`,
        );
      }

      const headers = allStudentsSheet
        .getRange(1, 1, 1, allStudentsSheet.getLastColumn())
        .getValues()[0];

      // 更新対象の列と値をマッピング
      // (保守性向上: プロパティ名とヘッダー名の明示的なマッピング)
      /** @type {Record<number, any>} */
      const updates = {};

      /** @type {Record<string, string>} */
      const propToHeaderMap = {
        realName: CONSTANTS.HEADERS.ROSTER.REAL_NAME,
        nickname: CONSTANTS.HEADERS.ROSTER.NICKNAME,
        phone: CONSTANTS.HEADERS.ROSTER.PHONE,
        email: CONSTANTS.HEADERS.ROSTER.EMAIL,
        wantsEmail: CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL,
        wantsScheduleNotification: CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO,
        notificationDay: CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY,
        notificationHour: CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR,
        address: CONSTANTS.HEADERS.ROSTER.ADDRESS,
        ageGroup: CONSTANTS.HEADERS.ROSTER.AGE_GROUP,
        gender: CONSTANTS.HEADERS.ROSTER.GENDER,
        dominantHand: CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
        futureCreations: CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS,
        experience: CONSTANTS.HEADERS.ROSTER.EXPERIENCE,
        pastWork: CONSTANTS.HEADERS.ROSTER.PAST_WORK,
        futureParticipation: CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION,
        trigger: CONSTANTS.HEADERS.ROSTER.TRIGGER,
        firstMessage: CONSTANTS.HEADERS.ROSTER.FIRST_MESSAGE,
      };

      // 電話番号が更新される場合、バリデーションと重複チェックを実行
      if (
        userInfo.phone !== undefined &&
        userInfo.phone !== targetStudent.phone
      ) {
        // 電話番号の正規化とバリデーション
        const normalizedPhone = normalizePhoneNumber(userInfo.phone);
        if (!normalizedPhone.isValid) {
          return {
            success: false,
            message:
              normalizedPhone.error || '電話番号の形式が正しくありません。',
          };
        }

        // 他のユーザーとの重複チェック
        const allStudents = getCachedAllStudents();
        if (allStudents) {
          const isDuplicate = Object.values(allStudents).some(student => {
            // 自分自身は除外
            if (student.studentId === studentId) return false;

            const studentPhone = student.phone
              ? normalizePhoneNumber(student.phone)
              : INVALID_PHONE_RESULT;
            return (
              studentPhone.isValid &&
              studentPhone.normalized === normalizedPhone.normalized
            );
          });

          if (isDuplicate) {
            return {
              success: false,
              message: 'この電話番号は既に他のユーザーが使用しています。',
            };
          }
        }
      }

      for (const key in userInfo) {
        if (key === 'studentId' || key === 'displayName' || key === 'rowIndex')
          continue; // 更新対象外

        const headerName = propToHeaderMap[key];
        if (headerName) {
          const colIdx = headers.indexOf(headerName);
          if (colIdx !== -1) {
            // 電話番号はシングルクォートプレフィックスを追加（先頭の0を保持）
            if (key === 'phone' && userInfo[key]) {
              updates[colIdx] = `'${userInfo[key]}`;
            } else {
              updates[colIdx] = userInfo[key];
            }
          }
        }
      }

      // ニックネームが更新された場合、表示名も更新
      if (
        userInfo.nickname !== undefined &&
        userInfo.nickname !== targetStudent.nickname
      ) {
        const displayNameColIdx = headers.indexOf(
          CONSTANTS.HEADERS.ROSTER.NICKNAME,
        );
        if (displayNameColIdx !== -1) {
          updates[displayNameColIdx] =
            userInfo.nickname || targetStudent.realName;
        }
      }

      // シートに一括更新（パフォーマンス改善: 1回のAPI呼び出しで完了）
      const rowRange = allStudentsSheet.getRange(
        targetRowIndex,
        1,
        1,
        allStudentsSheet.getLastColumn(),
      );
      const rowValues = rowRange.getValues()[0];

      for (const colIdxStr in updates) {
        const colIdx = Number(colIdxStr);
        rowValues[colIdx] = updates[colIdx];
      }

      rowRange.setValues([rowValues]);

      // 更新後のユーザー情報を生成
      const updatedUser = { ...targetStudent, ...userInfo };
      if (userInfo.nickname !== undefined) {
        updatedUser.displayName = userInfo.nickname || targetStudent.realName;
      }

      // キャッシュを更新
      updateCachedStudent(updatedUser);

      Logger.log(`ユーザー情報更新成功: ${studentId}`);
      logActivity(
        studentId,
        'プロフィール更新',
        '成功',
        'プロフィールが更新されました',
      );

      return {
        success: true,
        data: {
          message: 'プロフィールが正常に更新されました。',
          updatedUser: updatedUser,
        },
      };
    } catch (error) {
      Logger.log(`ユーザー情報更新エラー: ${error.message}`);
      logActivity(
        studentId,
        'プロフィール更新',
        '失敗',
        `エラー: ${error.message}`,
      );
      return {
        success: false,
        message: `プロフィールの更新に失敗しました: ${error.message}`,
      };
    }
  });
}

// =================================================================
// ★★★ 新規ユーザー登録 ★★★
// =================================================================

/**
 * 新規ユーザーを生徒名簿シートに登録します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {UserCore} userData - 登録するユーザー情報
 * @returns {ApiResponseGeneric<InitialAppDataPayload>}
 */
export function registerNewUser(userData) {
  return withTransaction(() => {
    try {
      const allStudentsSheet = SS_MANAGER.getSheet(
        CONSTANTS.SHEET_NAMES.ROSTER,
      );
      if (!allStudentsSheet) {
        throw new Error(
          `シートが見つかりません: ${CONSTANTS.SHEET_NAMES.ROSTER}`,
        );
      }

      // 電話番号のバリデーションと重複チェック
      if (!userData.phone) {
        return {
          success: false,
          message: '電話番号は必須項目です。',
        };
      }

      const normalizedPhone = normalizePhoneNumber(userData.phone);
      if (!normalizedPhone.isValid) {
        return {
          success: false,
          message:
            normalizedPhone.error || '電話番号の形式が正しくありません。',
        };
      }

      const phoneExists = checkExistingUserByPhone(userData.phone);
      if (phoneExists) {
        return {
          success: false,
          message: 'この電話番号は既に使用されています。',
        };
      }

      // 新しい生徒IDを生成
      const newStudentId = _generateNewStudentId();

      // ヘッダーと列インデックスを取得
      const headers = allStudentsSheet
        .getRange(1, 1, 1, allStudentsSheet.getLastColumn())
        .getValues()[0];
      const headerMap = /** @type {Map<string, number>} */ (
        createHeaderMap(headers)
      );
      /**
       * @param {string} headerName
       * @returns {number | undefined}
       */
      const resolveColumnIndex = headerName => headerMap.get(headerName);

      // 新しい行データを作成
      const newRow = Array(headers.length).fill('');
      const studentIdColumn = resolveColumnIndex(
        CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
      );
      if (typeof studentIdColumn !== 'number') {
        throw new Error(
          '生徒名簿シートのヘッダーに「生徒ID」列が見つかりません。',
        );
      }
      newRow[studentIdColumn] = newStudentId;

      const registrationDateColumn = resolveColumnIndex(
        CONSTANTS.HEADERS.ROSTER.REGISTRATION_DATE,
      );
      if (typeof registrationDateColumn !== 'number') {
        throw new Error(
          '生徒名簿シートのヘッダーに「登録日時」列が見つかりません。',
        );
      }
      newRow[registrationDateColumn] = new Date();

      // userDataから対応する列に値を設定
      // (保守性向上: プロパティ名とヘッダー名の明示的なマッピング)
      /** @type {Record<string, string>} */
      const propToHeaderMap = {
        realName: CONSTANTS.HEADERS.ROSTER.REAL_NAME,
        nickname: CONSTANTS.HEADERS.ROSTER.NICKNAME,
        phone: CONSTANTS.HEADERS.ROSTER.PHONE,
        email: CONSTANTS.HEADERS.ROSTER.EMAIL,
        wantsEmail: CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL,
        wantsScheduleNotification: CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO,
        notificationDay: CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY,
        notificationHour: CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR,
        address: CONSTANTS.HEADERS.ROSTER.ADDRESS,
        ageGroup: CONSTANTS.HEADERS.ROSTER.AGE_GROUP,
        gender: CONSTANTS.HEADERS.ROSTER.GENDER,
        dominantHand: CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
        futureCreations: CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS,
        experience: CONSTANTS.HEADERS.ROSTER.EXPERIENCE,
        pastWork: CONSTANTS.HEADERS.ROSTER.PAST_WORK,
        futureParticipation: CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION,
        trigger: CONSTANTS.HEADERS.ROSTER.TRIGGER,
        firstMessage: CONSTANTS.HEADERS.ROSTER.FIRST_MESSAGE,
      };

      for (const key in userData) {
        const headerName = propToHeaderMap[key];
        const colIdx =
          headerName !== undefined ? resolveColumnIndex(headerName) : undefined;
        if (headerName && typeof colIdx === 'number') {
          // 電話番号はシングルクォートプレフィックスを追加（先頭の0を保持）
          if (key === 'phone' && userData[key]) {
            newRow[colIdx] = `'${userData[key]}`;
          } else {
            newRow[colIdx] = userData[key];
          }
        }
      }

      // 表示名を決定
      const displayName = userData.nickname || userData.realName;
      const nicknameColumn = resolveColumnIndex(
        CONSTANTS.HEADERS.ROSTER.NICKNAME,
      );
      if (typeof nicknameColumn === 'number') {
        newRow[nicknameColumn] = displayName;
      }

      // シートに新しい行を追加
      allStudentsSheet.appendRow(newRow);

      // 登録後のユーザーオブジェクトを作成
      const registeredUser = {
        ...userData,
        studentId: newStudentId,
        displayName: displayName,
      };

      // キャッシュを更新
      addCachedStudent(registeredUser);

      Logger.log(`新規ユーザー登録成功: ${newStudentId}`);
      logActivity(
        newStudentId,
        '新規登録',
        '成功',
        '新しいユーザーが登録されました',
      );

      return {
        success: true,
        userFound: true,
        user: registeredUser,
        data: {
          accountingMaster: [],
          cacheVersions: {},
          lessons: [],
          myReservations: [],
        },
      };
    } catch (error) {
      Logger.log(`新規ユーザー登録エラー: ${error.message}`);
      return {
        success: false,
        message: `ユーザー登録中にエラーが発生しました: ${error.message}`,
      };
    }
  });
}

/**
 * 指定された電話番号のユーザーが既に存在するかチェックします。
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} phone - 電話番号
 * @returns {boolean} 存在する場合はtrue
 */
function checkExistingUserByPhone(phone) {
  try {
    const allStudents = getCachedAllStudents();
    if (!allStudents) {
      // キャッシュがない場合は、常に重複なしとして扱う（エラー回避）
      return false;
    }

    // 入力電話番号を正規化
    const normalizedInput = normalizePhoneNumber(phone);
    if (!normalizedInput.isValid) {
      Logger.log(`電話番号重複チェック: 無効な電話番号形式 - ${phone}`);
      return false;
    }

    // 既存ユーザーの電話番号と正規化して比較
    return Object.values(allStudents).some(user => {
      const normalizedUserPhone = user.phone
        ? normalizePhoneNumber(user.phone)
        : INVALID_PHONE_RESULT;
      return (
        normalizedUserPhone.isValid &&
        normalizedUserPhone.normalized === normalizedInput.normalized
      );
    });
  } catch (error) {
    Logger.log(`電話番号重複チェックエラー: ${error.message}`);
    return false; // エラー時は重複なしとして処理を続行
  }
}

/**
 * 新しい生徒ID（user_UUID形式）を生成します。
 * UUIDを使用することで一意性を保証し、セキュリティとスケーラビリティを向上させます。
 * @returns {string} 新しい生徒ID（例: user_a71976a1-dff3-4fbc-9f23-6d91efd3d0ab）
 * @private
 */
function _generateNewStudentId() {
  const uuid = Utilities.getUuid();
  return `user_${uuid}`;
}

// =================================================================
// ★★★ ログイン・ログアウト処理 ★★★
// =================================================================

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
export function loginUser(phone, realName) {
  try {
    const result = findUserByPhoneAndRealName(phone, realName);
    if (result.success && result.data) {
      const studentId =
        typeof result.data.studentId === 'string'
          ? result.data.studentId
          : 'unknown-student';
      Logger.log(`ログイン成功: ${studentId}`);
      logActivity(studentId, 'ログイン', '成功', 'ログインしました');
    }
    return result;
  } catch (error) {
    Logger.log(`ログイン処理エラー: ${error.message}`);
    return {
      success: false,
      message: `ログイン処理中にエラーが発生しました: ${error.message}`,
    };
  }
}

/**
 * ユーザーのログアウト処理を行います。
 *
 * 注: セッション管理はフロントエンドで行うため、バックエンドでは
 * ログ記録のみを行います。実際のセッションクリアはフロントエンド側で実施されます。
 *
 * @returns {ApiResponse}
 */
export function logoutUser() {
  try {
    Logger.log('ログアウト処理呼び出し（フロントエンドでセッション管理）');
    return { success: true };
  } catch (error) {
    Logger.log(`ログアウト処理エラー: ${error.message}`);
    return {
      success: false,
      message: `ログアウト処理中にエラーが発生しました: ${error.message}`,
    };
  }
}

/**
 * 現在ログインしているユーザーの情報を取得します。
 *
 * @deprecated この関数はフロントエンドのstorage管理に移行したため非推奨です。
 * フロントエンドのstateManager.getState().currentUserを使用してください。
 *
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function getLoggedInUser() {
  // フロントエンド側でセッション管理しているため、常に未ログイン扱い
  return {
    success: false,
    message:
      'セッション管理はフロントエンドで行っています。stateManager.getState().currentUserを参照してください。',
  };
}

// =================================================================
// ★★★ アカウント退会処理 ★★★
// =================================================================

/**
 * ユーザーアカウントを退会（電話番号無効化）します
 * 電話番号にプレフィックスを追加してログイン不可にします
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponseGeneric<{message: string}>}
 */
export function requestAccountDeletion(studentId) {
  return withTransaction(() => {
    try {
      if (!studentId) {
        return { success: false, message: '生徒IDが指定されていません。' };
      }

      const rosterSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.ROSTER);
      if (!rosterSheet) {
        throw new Error('シート「生徒名簿」が見つかりません。');
      }

      // ヘッダー行を取得
      const header = rosterSheet
        .getRange(1, 1, 1, rosterSheet.getLastColumn())
        .getValues()[0];

      const studentIdColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.STUDENT_ID,
      );
      const phoneColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.PHONE);

      if (studentIdColIdx === -1) {
        throw new Error('生徒名簿のヘッダーに「生徒ID」列が見つかりません。');
      }

      if (phoneColIdx === -1) {
        throw new Error('生徒名簿のヘッダーに「電話番号」列が見つかりません。');
      }

      // 全データを取得
      const lastRow = rosterSheet.getLastRow();
      if (lastRow < 2) {
        throw new Error('生徒名簿にデータがありません。');
      }

      const allData = rosterSheet
        .getRange(2, 1, lastRow - 1, header.length)
        .getValues();

      // 該当ユーザーを検索
      let targetRowIndex = -1;
      let currentPhone = '';

      for (let i = 0; i < allData.length; i++) {
        if (allData[i][studentIdColIdx] === studentId) {
          targetRowIndex = i + 2; // ヘッダーを考慮して+2
          currentPhone = String(allData[i][phoneColIdx] || '');
          break;
        }
      }

      if (targetRowIndex === -1) {
        return {
          success: false,
          message: '指定されたユーザーが見つかりません。',
        };
      }

      // セキュリティチェック: 既に退会済みの場合はエラー
      if (currentPhone.startsWith('_WITHDRAWN_')) {
        return {
          success: false,
          message: 'このアカウントは既に退会済みです。',
        };
      }

      // 電話番号を無効化（プレフィックス追加）
      const withdrawnDate = Utilities.formatDate(
        new Date(),
        CONSTANTS.TIMEZONE,
        'yyyyMMdd',
      );
      const newPhone = `_WITHDRAWN_${withdrawnDate}_${currentPhone}`;

      rosterSheet.getRange(targetRowIndex, phoneColIdx + 1).setValue(newPhone);

      // ログ記録
      logActivity(
        studentId,
        'アカウント退会',
        '成功',
        `退会処理完了: studentId=${studentId}, 元電話番号=${currentPhone}`,
      );

      // キャッシュ更新
      rebuildAllStudentsBasicCache();

      Logger.log(
        `requestAccountDeletion成功: studentId=${studentId}, 新電話番号=${newPhone}`,
      );

      return {
        success: true,
        data: {
          message: '退会処理が完了しました。',
        },
      };
    } catch (err) {
      Logger.log(`requestAccountDeletion Error: ${err.message}`);
      logActivity(
        studentId || 'N/A',
        'アカウント退会エラー',
        '失敗',
        `Error: ${err.message}`,
      );
      return {
        success: false,
        message: `サーバーエラーが発生しました。`,
      };
    }
  });
}

// =================================================================
// ★★★ 開発・テスト用関数 ★★★
// =================================================================

/**
 * 【開発用】全生徒キャッシュをクリアします。
 */
export function clearAllStudentsCache_DEV() {
  deleteCache(CACHE_KEYS.ALL_STUDENTS_BASIC);
  Logger.log('全生徒キャッシュをクリアしました。');
}

/**
 * 【開発用】指定した生徒のキャッシュをクリアします。
 * @param {string} studentId - 生徒ID
 */
export function clearStudentCache_DEV(studentId) {
  const cacheKey = `student_detail_${studentId}`;
  deleteCache(cacheKey);
  Logger.log(`生徒キャッシュをクリアしました: ${studentId}`);
}

/**
 * 【開発用】全予約キャッシュをクリアします。
 */
export function clearAllReservationsCache_DEV() {
  deleteCache(CACHE_KEYS.ALL_RESERVATIONS);
  Logger.log('全予約キャッシュをクリアしました。');
}

/**
 * 【開発用】全キャッシュをクリアします。
 */
export function clearAllCache_DEV() {
  deleteAllCache();
  Logger.log('全てのキャッシュをクリアしました。');
}
