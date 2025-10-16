/**
 * =================================================================
 * 【ファイル名】: 04_Backend_User.js
 * 【バージョン】: 1.0
 * 【役割】: ユーザー関連のバックエンドロジック
 * - ユーザー情報の取得、更新
 * - ユーザー認証
 * =================================================================
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

  // 各プロパティを動的に設定
  for (const key in CONSTANTS.HEADERS.ROSTER) {
    const headerName = /** @type {Record<string, string>} */ (
      CONSTANTS.HEADERS.ROSTER
    )[key];
    const colIdx = headers.indexOf(headerName);

    if (colIdx !== -1) {
      const value = row[colIdx];
      // JSDocのプロパティ名に変換（例: STUDENT_ID -> studentId）
      const propName = key
        .toLowerCase()
        .replace(/_([a-z])/g, g => g[1].toUpperCase());

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

  // 必須プロパティと計算プロパティ
  student.studentId = String(
    row[headers.indexOf(CONSTANTS.HEADERS.ROSTER.STUDENT_ID)],
  );
  student.realName = String(
    row[headers.indexOf(CONSTANTS.HEADERS.ROSTER.REAL_NAME)],
  );
  student.phone = String(row[headers.indexOf(CONSTANTS.HEADERS.ROSTER.PHONE)]);
  student.nickname = String(
    row[headers.indexOf(CONSTANTS.HEADERS.ROSTER.NICKNAME)],
  );
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

    // 電話番号と本名でユーザーを検索
    const foundUser = Object.values(allStudents).find(
      user => user.phone === phone && user.realName === realName,
    );

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
        : { isValid: false };
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
    try {
      // 新しいヘルパー関数を使用して生徒データを取得
      const targetStudent = getCachedStudentById(userInfo.studentId);
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
      /** @type {Record<number, any>} */
      const updates = {};
      const rosterHeaders = /** @type {Record<string, string>} */ (
        CONSTANTS.HEADERS.ROSTER
      );
      for (const key in userInfo) {
        if (key === 'studentId' || key === 'displayName') continue; // 更新対象外

        const headerName =
          rosterHeaders[
            key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()
          ];
        if (headerName) {
          const colIdx = headers.indexOf(headerName);
          if (colIdx !== -1) {
            updates[colIdx] = userInfo[key];
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

      // シートに一括更新
      for (const colIdxStr in updates) {
        const colIdx = Number(colIdxStr);
        allStudentsSheet
          .getRange(targetRowIndex, colIdx + 1)
          .setValue(updates[colIdx]);
      }

      // 更新後のユーザー情報を生成
      const updatedUser = { ...targetStudent, ...userInfo };
      if (userInfo.nickname !== undefined) {
        updatedUser.displayName = userInfo.nickname || targetStudent.realName;
      }

      // キャッシュを更新
      updateCachedStudent(updatedUser);

      Logger.log(`ユーザー情報更新成功: ${userInfo.studentId}`);
      logActivity(
        userInfo.studentId,
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
        userInfo.studentId,
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
 * @returns {ApiResponseGeneric<UserCore>}
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

      // 電話番号の重複チェック
      const phoneExists = checkExistingUserByPhone(userData.phone);
      if (phoneExists) {
        return {
          success: false,
          message: 'この電話番号は既に使用されています。',
        };
      }

      // 新しい生徒IDを生成
      const newStudentId = _generateNewStudentId(allStudentsSheet);

      // ヘッダーと列インデックスを取得
      const headers = allStudentsSheet
        .getRange(1, 1, 1, allStudentsSheet.getLastColumn())
        .getValues()[0];
      const headerMap = createHeaderMap(headers);

      // 新しい行データを作成
      const newRow = Array(headers.length).fill('');
      newRow[headerMap[CONSTANTS.HEADERS.ROSTER.STUDENT_ID]] = newStudentId;
      newRow[headerMap[CONSTANTS.HEADERS.ROSTER.REGISTRATION_DATE]] =
        new Date();

      // userDataから対応する列に値を設定
      const rosterHeaders = /** @type {Record<string, string>} */ (
        CONSTANTS.HEADERS.ROSTER
      );
      for (const key in userData) {
        const headerName =
          rosterHeaders[
            key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()
          ];
        if (headerName && headerMap[headerName] !== undefined) {
          newRow[headerMap[headerName]] = userData[key];
        }
      }

      // 表示名を決定
      const displayName = userData.nickname || userData.realName;
      newRow[headerMap[CONSTANTS.HEADERS.ROSTER.NICKNAME]] = displayName;

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
        data: registeredUser,
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

    return Object.values(allStudents).some(user => user.phone === phone);
  } catch (error) {
    Logger.log(`電話番号重複チェックエラー: ${error.message}`);
    return false; // エラー時は重複なしとして処理を続行
  }
}

/**
 * 新しい生徒ID（S-XXX形式）を生成します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 生徒名簿シート
 * @returns {string} 新しい生徒ID
 * @private
 */
function _generateNewStudentId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 'S-001';
  }

  const lastStudentId = sheet.getRange(lastRow, 1).getValue();
  const lastNumber = parseInt(String(lastStudentId).split('-')[1] || '0');
  const newNumber = lastNumber + 1;
  return `S-${String(newNumber).padStart(3, '0')}`;
}

// =================================================================
// ★★★ ログイン・ログアウト処理 ★★★
// =================================================================

/**
 * ユーザーのログイン処理を行います。
 * 成功した場合、セッション情報を保存します。
 * （Phase 3: 型システム統一対応）
 *
 * @param {string} phone - 電話番号
 * @param {string} realName - 本名
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function loginUser(phone, realName) {
  try {
    const result = findUserByPhoneAndRealName(phone, realName);
    if (result.success && result.data) {
      // ユーザー情報をセッションに保存
      const session = PropertiesService.getUserProperties();
      session.setProperty('user', JSON.stringify(result.data));
      Logger.log(`ログイン成功: ${result.data.studentId}`);
      logActivity(
        result.data.studentId,
        'ログイン',
        '成功',
        'ログインしました',
      );
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
 * セッション情報を削除します。
 * @returns {ApiResponse}
 */
export function logoutUser() {
  try {
    const session = PropertiesService.getUserProperties();
    const userData = session.getProperty('user');
    if (userData) {
      const user = JSON.parse(userData);
      logActivity(user.studentId, 'ログアウト', '成功', 'ログアウトしました');
      session.deleteProperty('user');
    }
    Logger.log('ログアウト成功');
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
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function getLoggedInUser() {
  try {
    const session = PropertiesService.getUserProperties();
    const userData = session.getProperty('user');
    if (userData) {
      const user = JSON.parse(userData);
      return { success: true, data: user };
    } else {
      return { success: false, message: 'ログインしていません。' };
    }
  } catch (error) {
    Logger.log(`ログインユーザー取得エラー: ${error.message}`);
    return {
      success: false,
      message: `ログインユーザーの取得中にエラーが発生しました: ${error.message}`,
    };
  }
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
