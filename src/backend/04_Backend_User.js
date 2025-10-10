/// <reference path="../../types/backend-index.d.ts" />

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
export function _normalizeAndValidatePhone(phoneNumber, allowEmpty = false) {
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
 * 軽量電話番号バリデーション（パフォーマンス最適化版）
 * フロントエンドで事前検証済みのデータに対する最小限チェック
 * @param {string} phoneNumber - 正規化済み電話番号（フロントエンドで処理済み想定）
 * @returns {boolean} 有効性
 */
export function _validatePhoneLight(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') return false;
  return /^(070|080|090)\d{8}$/.test(phoneNumber.replace(/\D/g, ''));
}

/**
 * 軽量認証：電話番号検証のみ実行（初期データ取得を除外）
 * フロントエンドで事前取得されたデータと組み合わせて使用
 * @param {string} phoneNumber - 認証する電話番号
 * @returns {Object} 認証結果（初期データなし）
 */
export function authenticateUserLightweight(phoneNumber) {
  try {
    Logger.log('軽量認証開始: ' + phoneNumber);

    // キャッシュから生徒データのみ取得（getAppInitialDataは呼ばない）
    const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
    if (!studentsCache || !studentsCache['students']) {
      throw new Error('生徒データのキャッシュが取得できません');
    }

    const allStudents = studentsCache['students'];
    const normalizedInputPhone =
      _normalizeAndValidatePhone(phoneNumber).normalized;

    // 電話番号検証
    let foundUser = null;
    const studentIds = Object.keys(allStudents);

    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      const student = /** @type {any} */ (allStudents)[studentId];
      if (!student) continue;

      const storedPhone = _normalizeAndValidatePhone(student.phone).normalized;
      if (storedPhone && storedPhone === normalizedInputPhone) {
        foundUser = {
          studentId: student.studentId,
          displayName: String(student.nickname || student.realName),
          realName: student.realName,
          phone: student.phone,
        };
        break;
      }
    }

    if (foundUser) {
      logActivity(
        foundUser.studentId,
        '軽量ログイン試行',
        '成功',
        '電話番号: ' + phoneNumber,
      );
      return {
        success: true,
        user: foundUser,
        // 初期データは含めない（事前取得データを使用）
      };
    } else {
      logActivity(
        'N/A',
        '軽量ログイン試行',
        '失敗',
        '電話番号: ' + phoneNumber,
      );
      return {
        success: false,
        message: '登録されている電話番号と一致しません。',
        registrationPhone: phoneNumber,
      };
    }
  } catch (err) {
    Logger.log('軽量認証エラー: ' + err.message);
    return {
      success: false,
      message: '認証処理中にエラーが発生しました。',
    };
  }
}

/**
 * キャッシュデータから個人用データを抽出する
 * @param {string} studentId - 生徒ID
 * @param {{allReservationsCache: ReservationCacheData}} cacheData - getAppInitialDataから取得したキャッシュデータ
 * @returns {PersonalDataResult} - 個人の予約、履歴、利用可能枠データ
 */
export function extractPersonalDataFromCache(studentId, cacheData) {
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

    // キャンセルと待機ステータス以外の予約のみをフィルタリング
    const myReservations = convertedReservations.filter(
      r =>
        r.studentId === studentId &&
        r.status !== CONSTANTS.STATUS.CANCELED &&
        r.status !== CONSTANTS.STATUS.WAITLISTED,
    );

    Logger.log(
      `個人データ抽出完了: 予約件数${myReservations.length}件（キャンセル除く）`,
    );
    return {
      myReservations: myReservations,
    };
  } catch (error) {
    Logger.log(`extractPersonalDataFromCacheエラー: ${error.message}`);
    return {
      myReservations: [],
    };
  }
}

/**
 * 電話番号を元にユーザーを認証します（軽量版）。
 * 初期データは含まず、ユーザー認証のみに特化。
 * @param {string} phoneNumber - 認証に使用する電話番号。
 * @returns {Object} - 認証結果のみ（初期データなし）
 */
export function authenticateUser(phoneNumber) {
  try {
    Logger.log(`authenticateUser開始: ${phoneNumber}`);

    // キャッシュから生徒データのみ取得
    const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
    if (!studentsCache || !studentsCache['students']) {
      throw new Error('生徒データのキャッシュが取得できません');
    }

    const allStudents = studentsCache['students'];
    const normalizedInputPhone =
      _normalizeAndValidatePhone(phoneNumber).normalized;

    // 電話番号検証
    let foundUser = null;
    const studentIds = Object.keys(allStudents);

    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      const student = /** @type {any} */ (allStudents)[studentId];
      if (!student) continue;

      const storedPhone = _normalizeAndValidatePhone(student.phone).normalized;
      if (storedPhone && storedPhone === normalizedInputPhone) {
        foundUser = {
          studentId: student.studentId,
          displayName: String(student.nickname || student.realName),
          realName: student.realName,
          phone: student.phone,
          email: student.email || '',
          wantsEmail: student.wantsEmail || false,
          wantsScheduleNotification: student.wantsScheduleNotification || false,
          notificationDay: student.notificationDay || null,
          notificationHour: student.notificationHour || null,
        };
        break;
      }
    }

    if (foundUser) {
      logActivity(
        foundUser.studentId,
        'ログイン試行',
        '成功',
        `電話番号: ${phoneNumber}`,
      );

      // ログイン成功時にスプレッドシートのウォームアップを実行（次回のスプレッドシートアクセスを高速化）
      try {
        SS_MANAGER.warmupAsync();
        Logger.log(
          `[AUTH] ログイン成功後にウォームアップ開始: ${foundUser.studentId}`,
        );
      } catch (warmupError) {
        // ウォームアップエラーは認証成功には影響させない
        Logger.log(
          `[AUTH] ウォームアップエラー（認証は成功）: ${warmupError.message}`,
        );
      }

      return {
        success: true,
        user: foundUser,
      };
    } else {
      logActivity('N/A', 'ログイン試行', '失敗', `電話番号: ${phoneNumber}`);
      return {
        success: false,
        message: '登録されている電話番号と一致しません。',
      };
    }
  } catch (err) {
    logActivity('N/A', 'ログイン試行', 'エラー', `Error: ${err.message}`);
    Logger.log(`authenticateUser Error: ${err.message}`);
    return {
      success: false,
      message: `サーバーエラーが発生しました。`,
    };
  }
}

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
export function registerNewUser(userInfo) {
  return withTransaction(() => {
    try {
      /** @type {UserCore} */
      const registrationDto = /** @type {UserCore} */ (userInfo);

      const validationResult = _normalizeAndValidatePhone(
        registrationDto?.phone || '',
        true,
      );
      const normalizedPhone = validationResult.normalized;

      // デバッグログを追加
      console.log('registerNewUser - 電話番号バリデーション:', {
        入力電話番号: userInfo?.phone,
        正規化結果: normalizedPhone,
        バリデーション結果: validationResult,
      });

      if (!validationResult.isValid && userInfo?.phone) {
        return { success: false, message: validationResult.message };
      }
      if (normalizedPhone === '') {
        return { success: false, message: '電話番号は必須です。' };
      }

      // 既存ユーザーの重複チェック
      const existingUser = authenticateUser(normalizedPhone);
      if (/** @type {any} */ (existingUser).success) {
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
        CONSTANTS.HEADERS.ROSTER.ATTENDANCE_INTENTION,
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
        CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL,
      );
      const ageGroupColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.AGE_GROUP);
      const genderColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.GENDER);
      const dominantHandColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
      );
      const addressColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.ADDRESS);
      const woodcarvingExperienceColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.EXPERIENCE,
      );
      const pastCreationsColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.PAST_WORK,
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

      // 通知設定の登録
      const notificationDayColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY,
      );
      const notificationHourColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR,
      );
      const scheduleNotificationPreferenceColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO,
      );

      if (notificationDayColIdx !== -1 && userInfo?.notificationDay) {
        newRow[notificationDayColIdx] = userInfo.notificationDay;
      }
      if (notificationHourColIdx !== -1 && userInfo?.notificationHour) {
        newRow[notificationHourColIdx] = userInfo.notificationHour;
      }

      // 日程連絡希望の設定
      if (
        scheduleNotificationPreferenceColIdx !== -1 &&
        userInfo?.wantsScheduleNotification !== undefined
      ) {
        newRow[scheduleNotificationPreferenceColIdx] =
          userInfo.wantsScheduleNotification ? 'TRUE' : 'FALSE';
      }

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
      if (futureCreationsColIdx !== -1 && userInfo?.futureCreations)
        newRow[futureCreationsColIdx] = userInfo.futureCreations;

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
        email: userInfo?.email || '',
        wantsEmail: userInfo?.wantsEmail || false,
      };

      // 登録完了
      logActivity(
        studentId,
        '新規ユーザー登録',
        '成功',
        `電話番号: ${normalizedPhone}`,
      );

      // 管理者通知メール送信
      try {
        const subject = `新規登録 ${userInfo?.realName || ''}:${userInfo?.nickname || ''}様`;
        const body =
          `新しいユーザーが登録されました。

` +
          `本名: ${userInfo?.realName || ''}
` +
          `ニックネーム: ${userInfo?.nickname || ''}
` +
          `電話番号: ${normalizedPhone}
` +
          `メールアドレス: ${userInfo?.email || '未設定'}
` +
          `メール配信希望: ${userInfo?.wantsEmail ? '希望する' : '希望しない'}
` +
          (userInfo?.futureParticipation
            ? `今後の参加予定: ${userInfo.futureParticipation}
`
            : '') +
          (userInfo?.trigger
            ? `きっかけ: ${userInfo.trigger}
`
            : '') +
          (userInfo?.firstMessage
            ? `初回メッセージ: ${userInfo.firstMessage}
`
            : '') +
          `
詳細はスプレッドシートを確認してください。`;
        sendAdminNotification(subject, body);
      } catch (notificationError) {
        Logger.log(
          `新規登録通知メール送信エラー: ${notificationError.message}`,
        );
      }

      return {
        success: true,
        data: {
          user: newUserInfo,
          message: '新規ユーザー登録が完了しました',
        },
      };
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
export function _isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

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

      const rosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
      if (!rosterSheet) {
        throw new Error('シート「生徒名簿」が見つかりません。');
      }

      // ヘッダー行を取得
      const header = rosterSheet
        .getRange(1, 1, 1, rosterSheet.getLastColumn())
        .getValues()[0];

      const studentIdColIdx = header.indexOf(
        CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
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

/**
 * プロフィール編集用にユーザーの詳細情報をシートから取得します。
 * @param {string} studentId - 生徒ID
 * @returns {ApiResponseGeneric<UserCore>}
 */
export function getUserDetailForEdit(studentId) {
  try {
    if (!studentId) {
      return { success: false, message: '生徒IDが指定されていません。' };
    }

    const rosterSheet = getSheetByName(CONSTANTS.SHEET_NAMES.ROSTER);
    if (!rosterSheet) {
      throw new Error('シート「生徒名簿」が見つかりません。');
    }

    // ヘッダー行を取得
    const header = rosterSheet
      .getRange(1, 1, 1, rosterSheet.getLastColumn())
      .getValues()[0];

    // 列インデックスを取得
    const studentIdColIdx = header.indexOf(
      CONSTANTS.HEADERS.RESERVATIONS.STUDENT_ID,
    );
    const realNameColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.REAL_NAME);
    const nicknameColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.NICKNAME);
    const phoneColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.PHONE);
    const emailColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.EMAIL);
    const emailPreferenceColIdx = header.indexOf(
      CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL,
    );
    const scheduleNotificationPreferenceColIdx = header.indexOf(
      CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO,
    );
    const addressColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.ADDRESS);
    const ageGroupColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.AGE_GROUP);
    const genderColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.GENDER);
    const dominantHandColIdx = header.indexOf(
      CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
    );
    const futureCreationsColIdx = header.indexOf(
      CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS,
    );
    const notificationDayColIdx = header.indexOf(
      CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY,
    );
    const notificationHourColIdx = header.indexOf(
      CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR,
    );

    if (studentIdColIdx === -1) {
      throw new Error('生徒名簿のヘッダーに「生徒ID」列が見つかりません。');
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
    let userRow = null;
    for (let i = 0; i < allData.length; i++) {
      if (allData[i][studentIdColIdx] === studentId) {
        userRow = allData[i];
        break;
      }
    }

    if (!userRow) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません。',
      };
    }

    // ユーザー詳細情報を構築
    const realName =
      realNameColIdx !== -1 ? String(userRow[realNameColIdx]) : '';
    const nickname =
      nicknameColIdx !== -1 ? String(userRow[nicknameColIdx]) : '';
    const notificationDayValue =
      notificationDayColIdx !== -1 ? userRow[notificationDayColIdx] : '';
    const notificationHourValue =
      notificationHourColIdx !== -1 ? userRow[notificationHourColIdx] : '';

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
          : null,
      notificationHour:
        notificationHourValue !== '' && notificationHourValue != null
          ? Number(notificationHourValue)
          : null,
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
            // 退会済みユーザー（_WITHDRAWN_プレフィックス付き）は無視
            if (
              student.phone &&
              String(student.phone).startsWith('_WITHDRAWN_')
            ) {
              continue;
            }
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
        CONSTANTS.HEADERS.ROSTER.WANTS_RESERVATION_EMAIL,
      );
      const scheduleNotificationPreferenceColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.WANTS_SCHEDULE_INFO,
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

      // 日程連絡希望の更新
      if (
        userInfo.wantsScheduleNotification !== undefined &&
        scheduleNotificationPreferenceColIdx !== -1
      ) {
        const scheduleNotificationPrefValue = userInfo.wantsScheduleNotification
          ? 'TRUE'
          : 'FALSE';
        rosterSheet
          .getRange(targetRowIndex, scheduleNotificationPreferenceColIdx + 1)
          .setValue(scheduleNotificationPrefValue);
      }

      // 通知設定の更新
      const notificationDayColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.NOTIFICATION_DAY,
      );
      const notificationHourColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.NOTIFICATION_HOUR,
      );

      if (
        userInfo.notificationDay !== undefined &&
        notificationDayColIdx !== -1
      ) {
        // バリデーション: 選択可能な日付のみ許可
        if (
          userInfo.notificationDay !== null &&
          !CONSTANTS.NOTIFICATION.DAYS.includes(
            Number(userInfo.notificationDay),
          )
        ) {
          throw new Error(
            `通知日は ${CONSTANTS.NOTIFICATION.DAYS.join(', ')} のいずれかを選択してください。`,
          );
        }
        rosterSheet
          .getRange(targetRowIndex, notificationDayColIdx + 1)
          .setValue(userInfo.notificationDay);
      }

      if (
        userInfo.notificationHour !== undefined &&
        notificationHourColIdx !== -1
      ) {
        // バリデーション: 選択可能な時刻のみ許可
        if (
          userInfo.notificationHour !== null &&
          !CONSTANTS.NOTIFICATION.HOURS.includes(
            Number(userInfo.notificationHour),
          )
        ) {
          throw new Error(
            `通知時刻は ${CONSTANTS.NOTIFICATION.HOURS.join(', ')} のいずれかを選択してください。`,
          );
        }
        rosterSheet
          .getRange(targetRowIndex, notificationHourColIdx + 1)
          .setValue(userInfo.notificationHour);
      }

      // 追加情報の更新（タスク3で追加）
      const addressColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.ADDRESS);
      const ageGroupColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.AGE_GROUP);
      const genderColIdx = header.indexOf(CONSTANTS.HEADERS.ROSTER.GENDER);
      const dominantHandColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.DOMINANT_HAND,
      );
      const futureCreationsColIdx = header.indexOf(
        CONSTANTS.HEADERS.ROSTER.FUTURE_CREATIONS,
      );

      if (userInfo.address !== undefined && addressColIdx !== -1) {
        rosterSheet
          .getRange(targetRowIndex, addressColIdx + 1)
          .setValue(userInfo.address || '');
      }

      if (userInfo.ageGroup !== undefined && ageGroupColIdx !== -1) {
        rosterSheet
          .getRange(targetRowIndex, ageGroupColIdx + 1)
          .setValue(userInfo.ageGroup || '');
      }

      if (userInfo.gender !== undefined && genderColIdx !== -1) {
        rosterSheet
          .getRange(targetRowIndex, genderColIdx + 1)
          .setValue(userInfo.gender || '');
      }

      if (userInfo.dominantHand !== undefined && dominantHandColIdx !== -1) {
        rosterSheet
          .getRange(targetRowIndex, dominantHandColIdx + 1)
          .setValue(userInfo.dominantHand || '');
      }

      if (
        userInfo.futureCreations !== undefined &&
        futureCreationsColIdx !== -1
      ) {
        rosterSheet
          .getRange(targetRowIndex, futureCreationsColIdx + 1)
          .setValue(userInfo.futureCreations || '');
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
