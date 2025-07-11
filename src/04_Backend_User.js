/**
 * =================================================================
 * 【ファイル名】: 04_Backend_User.gs
 * 【バージョン】: 2.3
 * 【役割】: Webアプリ連携のうち、ユーザー認証・管理を担当するバックエンド機能。
 * WebApp.htmlから直接呼び出されます。
 * 【v2.3 での変更点】
 * - authenticateUser: 認証失敗時にも、正規化後の電話番号を返すように変更。
 * - registerNewUser: 電話番号をシートに書き込む際、先頭にシングルクォートを付与し、先頭のゼロが消える問題を完全に防止。
 * =================================================================
 */

/**
 * 電話番号を正規化し、日本の携帯電話番号形式か検証するプライベートヘルパー関数。
 * @param {string} phoneNumber - 検証する電話番号。
 * @returns {{isValid: boolean, normalized: string, message: string}} - 検証結果オブジェクト。
 */
function _normalizeAndValidatePhone(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { isValid: false, normalized: '', message: '電話番号が入力されていません。' };
  }

  // 全角数字を半角に変換し、数字以外のすべての文字（ハイフン、スペース等）を削除
  const normalized = phoneNumber
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[^0-9]/g, '');

  // 日本の携帯電話番号の形式（070, 080, 090で始まる11桁）を正規表現でチェック
  if (!/^(070|080|090)\d{8}$/.test(normalized)) {
    return { isValid: false, normalized: normalized, message: '電話番号の形式が正しくありません。（090, 080, 070で始まる11桁の番号を入力してください）' };
  }

  return { isValid: true, normalized: normalized, message: '' };
}

/**
 * 電話番号を元にユーザーを認証します。
 * 成功時には、ユーザー情報全体（生徒ID含む）を返します。
 * @param {string} phoneNumber - 認証に使用する電話番号。
 * @returns {object} - { success: boolean, studentId?: string, displayName?: string, ... }
 */
function authenticateUser(phoneNumber) {
  try {
    const validationResult = _normalizeAndValidatePhone(phoneNumber);
    if (!validationResult.isValid) {
      return { success: false, message: validationResult.message };
    }
    const normalizedInputPhone = validationResult.normalized;

    const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    if (rosterSheet.getLastRow() < 2) {
      //【修正】認証失敗時にも正規化後の電話番号を返す
      return { success: false, message: '生徒名簿にデータがありません。', phoneForRegistration: normalizedInputPhone };
    }
    
    const data = rosterSheet.getDataRange().getValues();
    const header = data.shift();
    const idColIdx = header.indexOf(HEADER_STUDENT_ID);
    const phoneColIdx = header.indexOf(HEADER_PHONE);
    const realNameColIdx = header.indexOf(HEADER_REAL_NAME);
    const nicknameColIdx = header.indexOf(HEADER_NICKNAME);

    if (idColIdx === -1 || phoneColIdx === -1 || realNameColIdx === -1) {
      throw new Error("生徒名簿のヘッダー（生徒ID, 電話番号, 本名など）が正しくありません。");
    }

    for (const row of data) {
      const storedPhone = String(row[phoneColIdx]).replace(/[^0-9]/g, '');
      if (storedPhone === normalizedInputPhone && storedPhone !== '') {
        return { 
          success: true, 
          studentId: row[idColIdx],
          displayName: row[nicknameColIdx] || row[realNameColIdx], 
          realName: row[realNameColIdx], 
          phone: row[phoneColIdx] 
        };
      }
    }
    //【修正】認証失敗時にも正規化後の電話番号を返す
    return { success: false, message: '登録されている電話番号と一致しません。', phoneForRegistration: normalizedInputPhone };
  } catch (err) {
    Logger.log(`authenticateUser Error: ${err.message}`);
    return { success: false, message: `サーバーエラーが発生しました。` };
  }
}

/**
 * 新規ユーザーを生徒名簿に登録します。
 * 登録時にユニークな生徒IDを生成します。
 * @param {object} userInfo - { phone: string, realName: string, nickname?: string }
 * @returns {object} - { success: boolean, studentId?: string, ... }
 */
function registerNewUser(userInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const validationResult = _normalizeAndValidatePhone(userInfo.phone);
    if (!validationResult.isValid) {
      return { success: false, message: validationResult.message };
    }
    const normalizedPhone = validationResult.normalized;

    const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    const existingUser = authenticateUser(normalizedPhone);
    if (existingUser.success) {
      return { success: false, message: 'この電話番号は既に登録されています。' };
    }

    const header = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const idColIdx = header.indexOf(HEADER_STUDENT_ID);
    const phoneColIdx = header.indexOf(HEADER_PHONE);
    const realNameColIdx = header.indexOf(HEADER_REAL_NAME);
    const nicknameColIdx = header.indexOf(HEADER_NICKNAME);

    if (idColIdx === -1 || phoneColIdx === -1 || realNameColIdx === -1 || nicknameColIdx === -1) {
         throw new Error("生徒名簿のヘッダーが正しくありません。");
    }

    const studentId = `user_${Utilities.getUuid()}`;
    const newRow = new Array(header.length).fill('');
    
    newRow[idColIdx] = studentId;
    //【修正】先頭にシングルクォートを付与して文字列として強制
    newRow[phoneColIdx] = "'" + normalizedPhone; 
    newRow[realNameColIdx] = userInfo.realName;
    newRow[nicknameColIdx] = userInfo.nickname || '';
    
    rosterSheet.appendRow(newRow);

    // setNumberFormatはappendRowの後では効果が薄いため、上記の方法に変更。
    // 念のため残すが、本質的な解決策はシングルクォートの付与。
    const lastRow = rosterSheet.getLastRow();
    rosterSheet.getRange(lastRow, phoneColIdx + 1).setNumberFormat('@');

    return { 
      success: true,
      studentId: studentId,
      displayName: userInfo.nickname || userInfo.realName, 
      realName: userInfo.realName, 
      phone: normalizedPhone
    };
  } catch (err) {
    Logger.log(`registerNewUser Error: ${err.message}`);
    return { success: false, message: `サーバーエラーが発生しました。` };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ユーザーのプロフィール（本名、ニックネーム）を更新します。
 * 生徒IDをキーに更新対象を特定します。
 * @param {object} userInfo - { studentId: string, realName: string, displayName: string }
 * @returns {object} - { success: boolean, message: string }
 */
function updateUserProfile(userInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    const data = rosterSheet.getDataRange().getValues();
    const header = data.shift();
    const idColIdx = header.indexOf(HEADER_STUDENT_ID);
    const realNameColIdx = header.indexOf(HEADER_REAL_NAME);
    const nicknameColIdx = header.indexOf(HEADER_NICKNAME);

    if (idColIdx === -1 || realNameColIdx === -1 || nicknameColIdx === -1) {
      throw new Error("生徒名簿のヘッダー（生徒ID, 本名, ニックネームなど）が正しくありません。");
    }

    const targetRowIndex = data.findIndex(row => row[idColIdx] === userInfo.studentId);

    if (targetRowIndex !== -1) {
      const rowIndexToUpdate = targetRowIndex + 2; // +1 for header, +1 for 0-based index
      rosterSheet.getRange(rowIndexToUpdate, realNameColIdx + 1).setValue(userInfo.realName);
      rosterSheet.getRange(rowIndexToUpdate, nicknameColIdx + 1).setValue(userInfo.displayName);
      return { success: true, message: 'プロフィールを更新しました。' };
    } else {
      return { success: false, message: '更新対象のユーザーが見つかりませんでした。' };
    }
  } catch (err) {
     Logger.log(`updateUserProfile Error: ${err.message}`);
     return { success: false, message: `サーバーエラーが発生しました。` };
  } finally {
    lock.releaseLock();
  }
}
