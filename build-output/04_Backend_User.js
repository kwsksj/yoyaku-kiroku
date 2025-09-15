/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 04_Backend_User.gs
 * 【バージョン】: 3.5
 * 【役割】: Webアプリ連携のうち、ユーザー認証・管理を担当するバックエンド機能。
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
function _normalizeAndValidatePhone(phoneNumber, allowEmpty = false) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    if (allowEmpty) {
      return { isValid: true, normalized: '', message: '' };
    }
    return {
      isValid: false,
      normalized: '',
      message: '電話番号が入力されていません。',
    };
  }

  const normalized = phoneNumber
    .replace(/[‐－-]/g, '')
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');

  if (allowEmpty && normalized === '') {
    return { isValid: true, normalized: '', message: '' };
  }

  if (!/^(070|080|090)\d{8}$/.test(normalized)) {
    return {
      isValid: false,
      normalized: normalized,
      message:
        '電話番号の形式が正しくありません。（070, 080, 090で始まる11桁の番号を入力してください）',
    };
  }

  return { isValid: true, normalized: normalized, message: '' };
}

/**
 * キャッシュデータから個人用データを抽出する
 * @param {string} studentId - 生徒ID
 * @param {AppInitialData} cacheData - getAppInitialDataから取得したキャッシュデータ
 * @returns {PersonalDataResult} - 個人の予約、履歴、利用可能枠データ
 */
function extractPersonalDataFromCache(studentId, cacheData) {
  try {
    Logger.log(`個人データ抽出開始: ${studentId}`);

    // 引数のキャッシュデータを活用して効率化
    const { allReservationsCache } = cacheData;
    if (!allReservationsCache?.reservations) {
      Logger.log('予約キャッシュデータが利用できません');
      return { myReservations: [] };
    }

    const convertedReservations = convertReservationsToObjects(
      allReservationsCache.reservations,
      allReservationsCache.headerMap,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // キャンセル以外のステータスの予約のみをフィルタリング
    const myReservations = convertedReservations.filter(
      r => r.studentId === studentId && r.status !== CONSTANTS.STATUS.CANCELED,
    );

    Logger.log(
      `個人データ抽出完了: 予約件数${myReservations.length}件（キャンセル除く）`,
    );
    return {
      myReservations: /** @type {ReservationDataArray} */ (myReservations),
    };
  } catch (error) {
    Logger.log(`extractPersonalDataFromCacheエラー: ${error.message}`);
    return {
      myReservations: [],
    };
  }
}

/**
 * 電話番号を元にユーザーを認証します。スプレッドシートは読まず、キャッシュから認証します。
 * @param {string} phoneNumber - 認証に使用する電話番号。
 * @returns {AuthenticationResponse} - 認証結果と初期化データ
 */
function authenticateUser(phoneNumber) {
  try {
    Logger.log(`authenticateUser開始: ${phoneNumber}`);
    const noPhoneLoginCommand =
      PropertiesService.getScriptProperties().getProperty(
        'SPECIAL_NO_PHONE_LOGIN_COMMAND',
      );

    if (noPhoneLoginCommand && phoneNumber === noPhoneLoginCommand) {
      logActivity('N/A', '特殊ログイン試行', '成功', `Command: ${phoneNumber}`);
      return { success: false, commandRecognized: 'all' };
    }

    const initialDataResult = getAppInitialData();
    if (!initialDataResult.success) {
      throw new Error(
        `初期データの取得(キャッシュ)に失敗しました: ${initialDataResult.message}`,
      );
    }

    const allStudents = initialDataResult.data.allStudents;
    if (!allStudents) {
      throw new Error(
        '生徒データが取得できませんでした。allStudentsがundefinedです。',
      );
    }

    const studentIds = Object.keys(allStudents);
    const normalizedInputPhone =
      _normalizeAndValidatePhone(phoneNumber).normalized;

    let foundUser = null;
    for (const studentId of studentIds) {
      const student = allStudents[studentId];
      if (!student) continue;

      const storedPhone = _normalizeAndValidatePhone(student.phone).normalized;
      if (storedPhone && storedPhone === normalizedInputPhone) {
        foundUser = {
          studentId: student.studentId,
          displayName: String(student['nickname'] || student.realName),
          realName: student.realName,
          phone: student.phone,
        };
        break;
      }
    }

    if (foundUser) {
      const personalData = extractPersonalDataFromCache(
        foundUser.studentId,
        initialDataResult.data,
      );
      const enrichedInitialData = {
        ...initialDataResult.data,
        myReservations: personalData.myReservations,
      };

      logActivity(
        foundUser.studentId,
        'ログイン試行',
        '成功',
        `電話番号: ${phoneNumber}`,
      );
      return {
        success: true,
        user: foundUser,
        initialData: enrichedInitialData,
      };
    } else {
      logActivity('N/A', 'ログイン試行', '失敗', `電話番号: ${phoneNumber}`);
      return {
        success: false,
        message: '登録されている電話番号と一致しません。',
        registrationPhone: phoneNumber,
      };
    }
  } catch (err) {
    logActivity('N/A', 'ログイン試行', 'エラー', `Error: ${err.message}`);
    Logger.log(`authenticateUser Error: ${err.message}`);
    return {
      success: false,
      message: `サーバーエラーが発生しました。`,
      registrationPhone: phoneNumber,
    };
  }
}

/**
 * NF-01: 電話番号が未登録のユーザーリストを取得します。
 * @returns {Array<{ studentId: string, realName: string, nickname: string, searchName: string }>} - { studentId: string, realName: string, nickname: string, searchName: string } の配列。
 */
function getUsersWithoutPhoneNumber() {
  try {
    const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
    if (!studentsCache || !studentsCache['students']) {
      throw new Error('生徒データのキャッシュが利用できません。');
    }

    const usersWithoutPhone = [];
    const allStudents = Object.values(studentsCache['students']);
    for (const student of allStudents) {
      const storedPhone = _normalizeAndValidatePhone(student.phone).normalized;
      if (storedPhone === '') {
        const realName = String(student.realName || '').trim();
        const nickname = String(student.nickname || '').trim();
        const searchName = (realName + nickname)
          .replace(/\s+/g, '')
          .toLowerCase();

        usersWithoutPhone.push({
          studentId: student.studentId,
          realName: realName,
          nickname: nickname || realName,
          searchName: searchName,
        });
      }
    }
    logActivity(
      'N/A',
      '電話番号なしユーザー検索',
      '成功',
      `発見数: ${usersWithoutPhone.length}`,
    );
    return usersWithoutPhone;
  } catch (err) {
    logActivity(
      'N/A',
      '電話番号なしユーザー検索',
      'エラー',
      `Error: ${err.message}`,
    );
    Logger.log(`getUsersWithoutPhoneNumber Error: ${err.message}`);
    return [];
  }
}

/**
 * 新規ユーザーを生徒名簿に登録します。
 * @param {NewUserRegistration} userInfo - 新規ユーザー情報
 * @returns {ApiResponseGeneric<UserRegistrationResult>}
 */
function registerNewUser(userInfo) {
  return withTransaction(() => {
    try {
      const validationResult = _normalizeAndValidatePhone(
        userInfo?.phone || '',
        true,
      );
      const normalizedPhone = validationResult.normalized;

      if (!validationResult.isValid && userInfo?.phone) {
        return { success: false, message: validationResult.message };
      }
      if (normalizedPhone === '') {
        return { success: false, message: '電話番号は必須です。' };
      }

      const existingUser = authenticateUser(normalizedPhone);
      if (existingUser.success) {
        return {
          success: false,
          message: 'この電話番号は既に登録されています。',
        };
      }

      const rosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
      if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

      const header = rosterSheet
        .getRange(1, 1, 1, rosterSheet.getLastColumn())
        .getValues()[0];
      const idColIdx = header.indexOf(
        CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
      );
      const phoneColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.PHONE);
      const realNameColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.REAL_NAME);
      const nicknameColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.NICKNAME);

      if (
        idColIdx === -1 ||
        phoneColIdx === -1 ||
        realNameColIdx === -1 ||
        nicknameColIdx === -1
      ) {
        throw new Error('生徒名簿のヘッダーが正しくありません。');
      }

      const studentId = `user_${Utilities.getUuid()}`;
      const newRow = new Array(header.length).fill('');

      newRow[idColIdx] = studentId;
      newRow[phoneColIdx] = `'${normalizedPhone}`;
      newRow[realNameColIdx] = userInfo?.realName || '';
      newRow[nicknameColIdx] = userInfo?.nickname || '';

      // 新規登録のStep4で追加された項目を処理
      const futureParticipationColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.FUTURE_PARTICIPATION,
      );
      const triggerColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.TRIGGER);
      const firstMessageColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.FIRST_MESSAGE,
      );

      if (futureParticipationColIdx !== -1 && userInfo?.futureParticipation) {
        newRow[futureParticipationColIdx] = userInfo.futureParticipation;
      }
      if (triggerColIdx !== -1 && userInfo?.trigger) {
        newRow[triggerColIdx] = userInfo.trigger;
      }
      if (firstMessageColIdx !== -1 && userInfo?.firstMessage) {
        newRow[firstMessageColIdx] = userInfo.firstMessage;
      }

      // その他の標準項目
      const emailColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.EMAIL);
      const emailPreferenceColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.EMAIL_PREFERENCE,
      );
      const ageGroupColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.AGE_GROUP);
      const genderColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.GENDER);
      const dominantHandColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
      );
      const addressColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.ADDRESS);
      const woodcarvingExperienceColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.WOODCARVING_EXPERIENCE,
      );
      const pastCreationsColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.PAST_CREATIONS,
      );
      const futureCreationsColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS,
      );

      if (emailColIdx !== -1 && userInfo?.email) {
        const email = userInfo.email.trim();
        if (email && !_isValidEmail(email)) {
          throw new Error('メールアドレスの形式が正しくありません。');
        }
        newRow[emailColIdx] = email;
      }
      if (
        emailPreferenceColIdx !== -1 &&
        typeof userInfo?.wantsEmail === 'boolean'
      )
        newRow[emailPreferenceColIdx] = userInfo.wantsEmail ? 'TRUE' : 'FALSE';
      if (ageGroupColIdx !== -1 && userInfo?.ageGroup)
        newRow[ageGroupColIdx] = userInfo.ageGroup;
      if (genderColIdx !== -1 && userInfo?.gender)
        newRow[genderColIdx] = userInfo.gender;
      if (dominantHandColIdx !== -1 && userInfo?.dominantHand)
        newRow[dominantHandColIdx] = userInfo.dominantHand;
      if (addressColIdx !== -1 && userInfo?.address)
        newRow[addressColIdx] = userInfo.address;
      if (woodcarvingExperienceColIdx !== -1 && userInfo?.experience)
        newRow[woodcarvingExperienceColIdx] = userInfo.experience;
      if (pastCreationsColIdx !== -1 && userInfo?.pastWork)
        newRow[pastCreationsColIdx] = userInfo.pastWork;
      if (futureCreationsColIdx !== -1 && userInfo?.futureGoal)
        newRow[futureCreationsColIdx] = userInfo.futureGoal;

      const registrationDateColIdx = header.indexOf('登録日時');
      if (registrationDateColIdx !== -1)
        newRow[registrationDateColIdx] = new Date();

      rosterSheet.appendRow(newRow);
      rosterSheet
        .getRange(rosterSheet.getLastRow(), phoneColIdx + 1)
        .setNumberFormat('@');

      rebuildAllStudentsBasicCache();

      const newUserInfo = {
        studentId: studentId,
        displayName: userInfo?.nickname || userInfo?.realName || '',
        realName: userInfo?.realName || '',
        phone: normalizedPhone,
      };

      const initialData = getAppInitialData();
      if (initialData.success) {
        logActivity(
          studentId,
          '新規ユーザー登録',
          '成功',
          `電話番号: ${normalizedPhone}, キャッシュ再構築完了`,
        );
        return {
          success: true,
          user: newUserInfo,
          initialData: initialData.data,
        };
      } else {
        throw new Error(
          `新規登録には成功しましたが、初期データの取得に失敗しました: ${initialData.message}`,
        );
      }
    } catch (err) {
      logActivity('N/A', '新規ユーザー登録', 'エラー', `Error: ${err.message}`);
      Logger.log(`registerNewUser Error: ${err.message}`);
      return { success: false, message: `サーバーエラーが発生しました。` };
    }
  });
}

/**
 * メールアドレスの形式をチェックします。
 * @param {string} email - チェックするメールアドレス
 * @returns {boolean} - 形式が正しければtrue
 */
function _isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * ユーザーのプロフィール（本名、ニックネーム、電話番号、メールアドレス）を更新します。
 * @param {UserProfileUpdate} userInfo - プロフィール更新情報
 * @returns {ApiResponseGeneric<UserProfileUpdateResult>}
 */
function updateUserProfile(userInfo) {
  return withTransaction(() => {
    try {
      // 新しいヘルパー関数を使用して生徒データを取得
      /** @type {{rowIndex?: number, studentId: string, realName: string, nickname: string, phone: string} | null} */
      const targetStudent =
        /** @type {{rowIndex?: number, studentId: string, realName: string, nickname: string, phone: string} | null} */ (
          /** @type {unknown} */ (getCachedStudentById(userInfo.studentId))
        );
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

      // 電話番号の重複チェック（キャッシュベース）
      if (userInfo.phone !== undefined && userInfo.phone !== null) {
        const validationResult = _normalizeAndValidatePhone(
          userInfo.phone,
          true,
        );
        if (!validationResult.isValid && userInfo.phone !== '') {
          throw new Error(validationResult.message);
        }
        const normalizedNewPhone = validationResult.normalized;

        if (normalizedNewPhone !== '') {
          const allStudentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
          const otherStudents = Object.values(
            allStudentsCache['students'],
          ).filter(student => student.studentId !== userInfo.studentId);
          for (const student of otherStudents) {
            const storedPhone = _normalizeAndValidatePhone(
              student.phone,
            ).normalized;
            if (storedPhone === normalizedNewPhone) {
              throw new Error(
                'この電話番号は既に他のユーザーに登録されています。',
              );
            }
          }
        }
      }

      const rosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
      if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

      // ヘッダー情報を取得して更新対象の列インデックスを特定
      const header = rosterSheet
        .getRange(1, 1, 1, rosterSheet.getLastColumn())
        .getValues()[0];
      const realNameColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.REAL_NAME);
      const nicknameColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.NICKNAME);
      const phoneColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.PHONE);
      const emailColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.EMAIL);
      const emailPreferenceColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.EMAIL_PREFERENCE,
      );

      if (
        realNameColIdx === -1 ||
        nicknameColIdx === -1 ||
        phoneColIdx === -1
      ) {
        throw new Error('生徒名簿のヘッダーが正しくありません。');
      }

      // ★ ピンポイント更新
      // 注意：この例では3つの値が隣接していると仮定しています。もし列が離れている場合は、個別にgetRange/setValueが必要です。
      // ここでは簡潔さのため、隣接していると仮定して一度に書き込みます。
      // 実際には、各列のインデックスを元に個別に書き込む方が安全です。
      rosterSheet
        .getRange(targetRowIndex, realNameColIdx + 1)
        .setValue(userInfo?.realName || '');
      rosterSheet
        .getRange(targetRowIndex, nicknameColIdx + 1)
        .setValue(userInfo?.displayName || '');
      if (userInfo.phone !== undefined && userInfo.phone !== null) {
        const normalizedPhone = _normalizeAndValidatePhone(
          userInfo.phone,
          true,
        ).normalized;
        rosterSheet
          .getRange(targetRowIndex, phoneColIdx + 1)
          .setValue(normalizedPhone ? `'${normalizedPhone}` : '');
      }

      // メールアドレスのバリデーションと更新
      if (userInfo.email !== undefined && emailColIdx !== -1) {
        const email = userInfo.email ? userInfo.email.trim() : '';
        if (email && !_isValidEmail(email)) {
          throw new Error('メールアドレスの形式が正しくありません。');
        }
        rosterSheet.getRange(targetRowIndex, emailColIdx + 1).setValue(email);
      }

      // メール連絡希望の更新
      if (userInfo.wantsEmail !== undefined && emailPreferenceColIdx !== -1) {
        const emailPrefValue = userInfo.wantsEmail ? 'TRUE' : 'FALSE';
        rosterSheet
          .getRange(targetRowIndex, emailPreferenceColIdx + 1)
          .setValue(emailPrefValue);
      }

      logActivity(
        userInfo.studentId,
        'プロフィール更新',
        '成功',
        `本名: ${userInfo.realName}, 電話番号: ${userInfo.phone || 'N/A'}, メールアドレス: ${userInfo.email || 'N/A'}, メール連絡希望: ${userInfo.wantsEmail !== undefined ? (userInfo.wantsEmail ? '希望する' : '希望しない') : 'N/A'}`,
      );

      // プロフィール更新後に生徒データキャッシュを再構築
      rebuildAllStudentsBasicCache();

      return {
        success: true,
        message: 'プロフィールを更新しました。',
        updatedUser: userInfo,
      };
    } catch (err) {
      const details = `ID: ${userInfo.studentId}, Name: ${userInfo.displayName}, Error: ${err.message}`;
      logActivity(
        userInfo.studentId,
        'プロフィール更新エラー',
        '失敗',
        details,
      );
      Logger.log(`updateUserProfile Error: ${err.message}`);
      return {
        success: false,
        message: `サーバーエラーが発生しました。
${err.message}`,
      };
    }
  });
}
