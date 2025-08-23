/**
 * =================================================================
 * 【ファイル名】: 04_Backend_User.gs
 * 【バージョン】: 3.3
 * 【役割】: Webアプリ連携のうち、ユーザー認証・管理を担当するバックエンド機能。
 * 【v3.3での変更点】
 * - updateUserProfile, getUsersWithoutPhoneNumber 内の電話番号正規化ロジックを`_normalizeAndValidatePhone`に統一。
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
    return { isValid: false, normalized: '', message: '電話番号が入力されていません。' };
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
 * @param {object} cacheData - getAppInitialDataから取得したキャッシュデータ
 * @returns {object} - 個人の予約、履歴、利用可能枠データ
 */
function extractPersonalDataFromCache(studentId, cacheData) {
  try {
    Logger.log(`個人データ抽出開始: ${studentId}`);

    // 個人予約データを取得
    const userReservationsResult = getUserReservations(studentId);
    const { myBookings, myHistory } = userReservationsResult.success
      ? userReservationsResult.data
      : { myBookings: [], myHistory: [] };

    // 空き枠データを取得
    Logger.log('getAvailableSlotsを使用して空き枠を計算中...');
    const availableSlotsResult = getAvailableSlots();
    const availableSlots = availableSlotsResult.success ? availableSlotsResult.data : [];

    Logger.log(
      `個人データ抽出完了: 予約${myBookings.length}件, 履歴${myHistory.length}件, 枠${availableSlots.length}件`,
    );
    return { myBookings, myHistory, availableSlots };
  } catch (error) {
    Logger.log(`extractPersonalDataFromCacheエラー: ${error.message}`);
    return {
      myBookings: [],
      myHistory: [],
      availableSlots: [],
    };
  }
}

/**
 * 電話番号を元にユーザーを認証します。スプレッドシートは読まず、キャッシュから認証します。
 * @param {string} phoneNumber - 認証に使用する電話番号。
 * @returns {object} - 認証結果と初期化データ
 */
function authenticateUser(phoneNumber) {
  try {
    Logger.log(`authenticateUser開始: ${phoneNumber}`);
    const noPhoneLoginCommand = PropertiesService.getScriptProperties().getProperty(
      'SPECIAL_NO_PHONE_LOGIN_COMMAND',
    );

    if (noPhoneLoginCommand && phoneNumber === noPhoneLoginCommand) {
      logActivity('N/A', '特殊ログイン試行', '成功', `Command: ${phoneNumber}`);
      return { success: false, commandRecognized: 'all' };
    }

    Logger.log('初期データの取得を開始...');
    const initialDataResult = getAppInitialData();
    Logger.log(`初期データ取得結果: success=${initialDataResult.success}`);

    if (!initialDataResult.success) {
      Logger.log(`初期データ取得失敗: ${initialDataResult.message}`);
      throw new Error(`初期データの取得(キャッシュ)に失敗しました: ${initialDataResult.message}`);
    }

    const allStudents = initialDataResult.data.allStudents;
    Logger.log(`allStudents取得: ${allStudents ? 'オブジェクト取得済み' : 'undefined'}`);
    Logger.log(`allStudents type: ${typeof allStudents}`);

    if (!allStudents) {
      throw new Error('生徒データが取得できませんでした。allStudentsがundefinedです。');
    }

    const studentIds = Object.keys(allStudents);
    Logger.log(`生徒データ件数: ${studentIds.length}`);

    const normalizedInputPhone = _normalizeAndValidatePhone(phoneNumber).normalized;
    Logger.log(`正規化された入力電話番号: ${normalizedInputPhone}`);

    let foundUser = null;

    for (const studentId of studentIds) {
      const student = allStudents[studentId];
      Logger.log(`生徒チェック中: ${studentId}, student: ${student ? 'あり' : 'undefined'}`);

      if (!student) {
        Logger.log(`警告: 生徒ID ${studentId} のデータがundefinedです`);
        continue;
      }

      const storedPhone = _normalizeAndValidatePhone(student.phone).normalized;
      Logger.log(`生徒 ${studentId} の電話番号: ${storedPhone}`);

      if (storedPhone && storedPhone === normalizedInputPhone) {
        Logger.log(`マッチした生徒を発見: ${studentId}`);
        Logger.log(`生徒データ詳細: ${JSON.stringify(student)}`);
        foundUser = {
          success: true,
          studentId: student.studentId,
          displayName: student.nickname,
          realName: student.realName,
          phone: student.phone,
        };
        break;
      }
    }

    if (foundUser) {
      Logger.log('個人用データを準備中...');

      // 個人の予約・履歴データを取得
      const personalData = extractPersonalDataFromCache(
        foundUser.studentId,
        initialDataResult.data,
      );

      // initialDataに個人データを追加
      const enrichedInitialData = {
        ...initialDataResult.data,
        myBookings: personalData.myBookings,
        myHistory: personalData.myHistory,
        availableSlots: personalData.availableSlots,
      };

      Logger.log(
        `個人データ準備完了: 予約${personalData.myBookings.length}件, 履歴${personalData.myHistory.length}件`,
      );

      logActivity(foundUser.studentId, 'ログイン試行', '成功', `電話番号: ${phoneNumber}`);
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
        phoneForRegistration: phoneNumber,
      };
    }
  } catch (err) {
    logActivity('N/A', 'ログイン試行', 'エラー', `Error: ${err.message}`);
    Logger.log(`authenticateUser Error: ${err.message}`);
    return {
      success: false,
      message: `サーバーエラーが発生しました。`,
      phoneForRegistration: phoneNumber,
    };
  }
}

/**
 * NF-01: 電話番号が未登録のユーザーリストを取得します。
 * @returns {Array<object>} - { studentId: string, realName: string, nickname: string, searchName: string } の配列。
 */
function getUsersWithoutPhoneNumber() {
  try {
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    if (rosterSheet.getLastRow() < RESERVATION_DATA_START_ROW) {
      return [];
    }

    const data = rosterSheet.getDataRange().getValues();
    const header = data.shift();
    const idColIdx = header.indexOf(HEADER_STUDENT_ID);
    const phoneColIdx = header.indexOf(HEADER_PHONE);
    const realNameColIdx = header.indexOf(HEADER_REAL_NAME);
    const nicknameColIdx = header.indexOf(HEADER_NICKNAME);

    if (idColIdx === -1 || phoneColIdx === -1 || realNameColIdx === -1 || nicknameColIdx === -1) {
      throw new Error('生徒名簿のヘッダーが正しくありません。');
    }

    const usersWithoutPhone = [];
    for (const row of data) {
      const storedPhone = _normalizeAndValidatePhone(row[phoneColIdx]).normalized;
      if (storedPhone === '') {
        const realName = String(row[realNameColIdx] || '').trim();
        const nickname = String(row[nicknameColIdx] || '').trim();
        const searchName = (realName + nickname).replace(/\s+/g, '').toLowerCase();

        usersWithoutPhone.push({
          studentId: row[idColIdx],
          realName: realName,
          nickname: nickname || realName,
          searchName: searchName,
        });
      }
    }
    logActivity('N/A', '電話番号なしユーザー検索', '成功', `発見数: ${usersWithoutPhone.length}`);
    return usersWithoutPhone;
  } catch (err) {
    logActivity('N/A', '電話番号なしユーザー検索', 'エラー', `Error: ${err.message}`);
    Logger.log(`getUsersWithoutPhoneNumber Error: ${err.message}`);
    return [];
  }
}

/**
 * 新規ユーザーを生徒名簿に登録します。
 * @param {object} userInfo - { phone?: string, realName: string, nickname?: string }
 * @returns {object} - { success: boolean, studentId?: string, ... }
 */
function registerNewUser(userInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const validationResult = _normalizeAndValidatePhone(userInfo.phone || '', true);
    const normalizedPhone = validationResult.normalized;

    if (!validationResult.isValid && userInfo.phone) {
      return { success: false, message: validationResult.message };
    }
    if (normalizedPhone === '') {
      return { success: false, message: '電話番号は必須です。' };
    }

    const existingUser = authenticateUser(normalizedPhone);
    if (existingUser.success) {
      return { success: false, message: 'この電話番号は既に登録されています。' };
    }

    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    const header = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const idColIdx = header.indexOf(HEADER_STUDENT_ID);
    const phoneColIdx = header.indexOf(HEADER_PHONE);
    const realNameColIdx = header.indexOf(HEADER_REAL_NAME);
    const nicknameColIdx = header.indexOf(HEADER_NICKNAME);

    if (idColIdx === -1 || phoneColIdx === -1 || realNameColIdx === -1 || nicknameColIdx === -1) {
      throw new Error('生徒名簿のヘッダーが正しくありません。');
    }

    const studentId = `user_${Utilities.getUuid()}`;
    const newRow = new Array(header.length).fill('');

    newRow[idColIdx] = studentId;
    newRow[phoneColIdx] = `'${normalizedPhone}`;
    newRow[realNameColIdx] = userInfo.realName;
    newRow[nicknameColIdx] = userInfo.nickname || '';

    const registrationDateColIdx = header.indexOf('登録日時');
    if (registrationDateColIdx !== -1) newRow[registrationDateColIdx] = new Date();

    rosterSheet.appendRow(newRow);
    rosterSheet.getRange(rosterSheet.getLastRow(), phoneColIdx + 1).setNumberFormat('@');

    rebuildAllStudentsBasicCache();

    const newUserInfo = {
      studentId: studentId,
      displayName: userInfo.nickname || userInfo.realName,
      realName: userInfo.realName,
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
  } finally {
    lock.releaseLock();
  }
}

/**
 * ユーザーのプロフィール（本名、ニックネーム、電話番号）を更新します。
 * @param {object} userInfo - { studentId: string, realName: string, displayName: string, phone?: string }
 * @returns {object} - { success: boolean, message: string }
 */
function updateUserProfile(userInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    const data = rosterSheet.getDataRange().getValues();
    const header = data.shift();
    const idColIdx = header.indexOf(HEADER_STUDENT_ID);
    const realNameColIdx = header.indexOf(HEADER_REAL_NAME);
    const nicknameColIdx = header.indexOf(HEADER_NICKNAME);
    const phoneColIdx = header.indexOf(HEADER_PHONE);

    if (idColIdx === -1 || realNameColIdx === -1 || nicknameColIdx === -1 || phoneColIdx === -1) {
      throw new Error(
        '生徒名簿のヘッダー（生徒ID, 本名, ニックネーム, 電話番号など）が正しくありません。',
      );
    }

    const targetRowIndex = data.findIndex(row => row[idColIdx] === userInfo.studentId);

    if (targetRowIndex !== -1) {
      const rowIndexToUpdate = targetRowIndex + 2;

      rosterSheet.getRange(rowIndexToUpdate, realNameColIdx + 1).setValue(userInfo.realName);
      rosterSheet.getRange(rowIndexToUpdate, nicknameColIdx + 1).setValue(userInfo.displayName);

      if (userInfo.phone !== undefined && userInfo.phone !== null) {
        const validationResult = _normalizeAndValidatePhone(userInfo.phone, true);

        if (!validationResult.isValid && userInfo.phone !== '') {
          throw new Error(validationResult.message);
        }
        const normalizedNewPhone = validationResult.normalized;

        if (normalizedNewPhone !== '') {
          for (let i = 0; i < data.length; i++) {
            if (i === targetRowIndex) continue;

            const storedPhone = _normalizeAndValidatePhone(data[i][phoneColIdx]).normalized;
            if (storedPhone === normalizedNewPhone) {
              throw new Error('この電話番号は既に他のユーザーに登録されています。');
            }
          }
          rosterSheet
            .getRange(rowIndexToUpdate, phoneColIdx + 1)
            .setValue("'" + normalizedNewPhone);
          rosterSheet.getRange(rowIndexToUpdate, phoneColIdx + 1).setNumberFormat('@');
        } else {
          rosterSheet.getRange(rowIndexToUpdate, phoneColIdx + 1).setValue('');
        }
      }

      logActivity(
        userInfo.studentId,
        'プロフィール更新',
        '成功',
        `本名: ${userInfo.realName}, 電話番号: ${userInfo.phone || 'N/A'}`,
      );
      return {
        success: true,
        message: 'プロフィールを更新しました。',
        updatedUser: userInfo,
      };
    } else {
      return { success: false, message: '更新対象のユーザーが見つかりませんでした。' };
    }
  } catch (err) {
    const details = `ID: ${userInfo.studentId}, Name: ${userInfo.displayName}, Error: ${err.message}`;
    logActivity(userInfo.studentId, 'プロフィール更新エラー', '失敗', details);
    Logger.log(`updateUserProfile Error: ${err.message}`);
    return {
      success: false,
      message: `サーバーエラーが発生しました。
${err.message}`,
    };
  } finally {
    lock.releaseLock();
  }
}
