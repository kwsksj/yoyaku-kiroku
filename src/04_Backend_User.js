/**
 * =================================================================
 * 【ファイル名】: 04_Backend_User.gs
 * 【バージョン】: 2.4
 * 【役割】: Webアプリ連携のうち、ユーザー認証・管理を担当するバックエンド機能。
 * WebApp.htmlから直接呼び出されます。
 * 【v2.4 での変更点】
 * - NF-01: 電話番号なしユーザーの特殊ログインと電話番号登録機能を追加
 * - _normalizeAndValidatePhone: 空の電話番号を許容するallowEmptyオプションを追加
 * - authenticateUser: 特殊ログインコマンドを認識するロジックを追加
 * - getUsersWithoutPhoneNumber: 電話番号未登録のユーザーをリストアップする関数を新設
 * - registerNewUser: Webアプリからの電話番号なしでの新規登録を禁止
 * - updateUserProfile: 電話番号の追加・更新・削除に対応
 * =================================================================
 */

/**
 * 電話番号を正規化し、日本の携帯電話番号形式か検証するプライベートヘルパー関数。
 * `allowEmpty` が `true` の場合、空文字列や空白のみの文字列も有効とみなす。
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

  // 全角数字を半角に変換し、数字以外のすべての文字（ハイフン、スペース等）を削除
  const normalized = phoneNumber
    .replace(/[‐－-]/g, '') // NF-01: ハイフンも除去対象に追加
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');

  if (allowEmpty && normalized === '') {
    // 追加: allowEmptyがtrueで、正規化後も空なら有効
    return { isValid: true, normalized: '', message: '' };
  }

  // 日本の携帯電話番号の形式（070, 080, 090で始まる11桁）を正規表現でチェック
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
 * 電話番号を元にユーザーを認証します。
 * 特殊コマンドが入力された場合は、対応する電話番号未登録ユーザーリスト取得を促す。
 * 成功時には、ユーザー情報全体（生徒ID含む）を返します。
 *
 * 【最適化ポイント】
 * - 「生徒名簿」シートから必要な列（生徒ID、電話番号、本名、ニックネーム）のみを読み込むことで、
 * 広範囲なシートでのパフォーマンスを向上させます。
 *
 * @param {string} phoneNumber - 認証に使用する電話番号。
 * @returns {object} - { success: boolean, studentId?: string, displayName?: string, message?: string, phoneForRegistration?: string, commandRecognized?: 'all'|'today'|false }
 */
function authenticateUser(phoneNumber) {
  try {
    const noPhoneLoginCommand = PropertiesService.getScriptProperties().getProperty(
      'SPECIAL_NO_PHONE_LOGIN_COMMAND',
    );

    // NF-01: 特殊コマンドが入力された場合、電話番号なしユーザーリストの表示を促す
    if (noPhoneLoginCommand && phoneNumber === noPhoneLoginCommand) {
      logActivity('N/A', '特殊ログイン試行', '成功', `Command: ${phoneNumber}`);
      return { success: false, commandRecognized: 'all' }; // commandRecognizedは'all'に固定
    }

    const validationResult = _normalizeAndValidatePhone(phoneNumber);
    if (!validationResult.isValid) {
      // 認証失敗時にも正規化後の電話番号を返す (登録画面へ遷移するため)
      return {
        success: false,
        message: validationResult.message,
        phoneForRegistration: validationResult.normalized,
      };
    }
    const normalizedInputPhone = validationResult.normalized;

    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    if (rosterSheet.getLastRow() < RESERVATION_DATA_START_ROW) {
      return {
        success: false,
        message: '生徒名簿にデータがありません。',
        phoneForRegistration: normalizedInputPhone,
      };
    }

    // --- 【最適化】必要な列のみを読み込む ---
    // ヘッダーを先に読み込み、必要な列のインデックスを取得
    const headerRow = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
    const idColIdx = headerRow.indexOf(HEADER_STUDENT_ID);
    const phoneColIdx = headerRow.indexOf(HEADER_PHONE);
    const realNameColIdx = headerRow.indexOf(HEADER_REAL_NAME);
    const nicknameColIdx = headerRow.indexOf(HEADER_NICKNAME);

    // 必要なヘッダーが全て見つかるか確認
    if (idColIdx === -1 || phoneColIdx === -1 || realNameColIdx === -1 || nicknameColIdx === -1) {
      throw new Error(
        '生徒名簿のヘッダーが正しくありません。必要な列（生徒ID, 電話番号, 本名, ニックネーム）が見つかりません。',
      );
    }

    // 必要な列の最小と最大のインデックスを特定
    const minColIdx = Math.min(idColIdx, phoneColIdx, realNameColIdx, nicknameColIdx);
    const maxColIdx = Math.max(idColIdx, phoneColIdx, realNameColIdx, nicknameColIdx);

    // データ範囲を、必要な列（minColからmaxColまで）に絞り込んで読み込む
    const fetchedDataRange = rosterSheet.getRange(
      RESERVATION_DATA_START_ROW,
      minColIdx + 1, // 1-based index
      rosterSheet.getLastRow() - RESERVATION_DATA_START_ROW + 1,
      maxColIdx - minColIdx + 1,
    );
    const fetchedData = fetchedDataRange.getValues();

    // 読み込んだデータ内での相対的な列インデックスを計算
    const relativeIdColIdx = idColIdx - minColIdx;
    const relativePhoneColIdx = phoneColIdx - minColIdx;
    const relativeRealNameColIdx = realNameColIdx - minColIdx;
    const relativeNicknameColIdx = nicknameColIdx - minColIdx;

    for (const row of fetchedData) {
      const storedPhone = String(row[relativePhoneColIdx])
        .replace(/^'/, '')
        .replace(/[^0-9]/g, '');
      if (storedPhone === normalizedInputPhone && storedPhone !== '') {
        const user = {
          success: true,
          studentId: row[relativeIdColIdx],
          displayName: row[relativeNicknameColIdx] || row[relativeRealNameColIdx],
          realName: row[relativeRealNameColIdx],
          phone: row[relativePhoneColIdx],
        };
        logActivity(user.studentId, 'ログイン試行', '成功', `電話番号: ${phoneNumber}`);
        // ★★★ 変更点 ★★★
        // 認証成功後、そのまま初期データを取得して結合する
        const initialData = getInitialWebApp_Data(user.studentId);
        if (initialData.success) {
          // フロントエンドに返す最終的な成功オブジェクト
          return {
            success: true,
            user: user, // 認証したユーザー情報
            initialData: initialData, // アプリ初期化データ
          };
        } else {
          // データ取得に失敗した場合はエラーとして扱う
          throw new Error('認証には成功しましたが、初期データの取得に失敗しました。');
        }
      }
    }
    logActivity('N/A', 'ログイン試行', '失敗', `電話番号: ${phoneNumber}`);
    return {
      success: false,
      message: '登録されている電話番号と一致しません。',
      phoneForRegistration: normalizedInputPhone,
    };
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
 * 本名とニックネームをスペースなしで結合した 'searchName' プロパティも追加します。
 * @returns {Array<object>} - { studentId: string, realName: string, nickname: string, searchName: string } の配列。
 */
function getUsersWithoutPhoneNumber() {
  try {
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    if (rosterSheet.getLastRow() < RESERVATION_DATA_START_ROW) {
      return []; // データがない場合は空配列を返す
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
      const storedPhone = String(row[phoneColIdx])
        .replace(/^'/, '')
        .replace(/[^0-9]/g, '');
      if (storedPhone === '') {
        // 電話番号が空の場合
        const realName = String(row[realNameColIdx] || '').trim();
        const nickname = String(row[nicknameColIdx] || '').trim();
        const searchName = (realName + nickname).replace(/\s+/g, '').toLowerCase(); // スペースを除去して結合、小文字化

        usersWithoutPhone.push({
          studentId: row[idColIdx],
          realName: realName,
          nickname: nickname || realName, // ニックネームがなければ本名を使用
          searchName: searchName, // 検索用の結合済み・スペース除去済み名前
        });
      }
    }
    logActivity('N/A', '電話番号なしユーザー検索', '成功', `発見数: ${usersWithoutPhone.length}`);
    return usersWithoutPhone;
  } catch (err) {
    logActivity('N/A', '電話番号なしユーザー検索', 'エラー', `Error: ${err.message}`);
    Logger.log(`getUsersWithoutPhoneNumber Error: ${err.message}`);
    return []; // エラー時は空配列を返す
  }
}

// src/04_Backend_User.js の getTodayParticipantsWithoutPhoneNumber 関数

/**
 * NF-01: 今日の予約シートから、電話番号が未登録の参加者リストを取得します。
 * ニックネームでの検索を考慮し、ニックネームと生徒IDを返します。
 * 本名とニックネームをスペースなしで結合した 'searchName' プロパティも追加します。
 *
 * 【最適化ポイント】
 * - 生徒名簿データを最初に一度だけMapに変換してメモリに保持。
 * - 各教室シートは、今日の日付の参加者行のみに絞って必要な列を読み込む。
 * - スプレッドシートからの読み込み回数とデータ量を最小化。
 *
 * @returns {Array<object>} - { studentId: string, realName: string, nickname: string, searchName: string } の配列。
 */

/**
 * 新規ユーザーを生徒名簿に登録します。
 * 登録時にユニークな生徒IDを生成します。電話番号なしでの登録も可能です。
 * (ただし、WebアプリのUIからは電話番号必須の新規登録を想定)
 * @param {object} userInfo - { phone?: string, realName: string, nickname?: string }
 * @returns {object} - { success: boolean, studentId?: string, ... }
 */
function registerNewUser(userInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    const validationResult = _normalizeAndValidatePhone(userInfo.phone || '', true); // 修正: 空文字列を許容しつつ形式チェック
    const normalizedPhone = validationResult.normalized;

    // 電話番号が提供されたが、不正な形式だった場合 (WebアプリのUIで必須とするため、ここではエラーを返す)
    if (!validationResult.isValid && userInfo.phone) {
      // userInfo.phone が存在しかつ無効ならエラー
      return { success: false, message: validationResult.message };
    }
    // WebアプリUI側で電話番号入力が必須となるため、ここでは normalizedPhone が空であることのエラーはチェックしない。
    // その代わり、UI側で電話番号が空の場合は登録できないようにする。

    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);
    if (!rosterSheet) throw new Error('シート「生徒名簿」が見つかりません。');

    // 電話番号が提供された場合のみ、既存ユーザーチェックを行う
    if (normalizedPhone !== '') {
      const existingUser = authenticateUser(normalizedPhone);
      if (existingUser.success) {
        return { success: false, message: 'この電話番号は既に登録されています。' };
      }
    } else {
      // NF-01: Webアプリからの新規登録では電話番号が必須となるため、ここを通過することはない想定。
      // 万が一通過した場合でも、電話番号なしの新規登録は許容しないため、ここでエラーを返す。
      return { success: false, message: '電話番号は必須です。' }; // 追加: Webアプリからの新規登録で電話番号が空の場合は弾く
    }

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
    newRow[phoneColIdx] = "'" + normalizedPhone; // 電話番号は必ず有効な形式でここに来る想定

    newRow[realNameColIdx] = userInfo.realName;
    newRow[nicknameColIdx] = userInfo.nickname || '';

    rosterSheet.appendRow(newRow);

    const lastRow = rosterSheet.getLastRow();
    rosterSheet.getRange(lastRow, phoneColIdx + 1).setNumberFormat('@');

    logActivity(studentId, '新規ユーザー登録', '成功', `電話番号: ${normalizedPhone}`);

    const newUserInfo = {
      studentId: studentId,
      displayName: userInfo.nickname || userInfo.realName,
      realName: userInfo.realName,
      phone: normalizedPhone,
    };

    // ★★★ 変更点 ★★★
    const initialData = getInitialWebApp_Data(studentId);
    if (initialData.success) {
      return {
        success: true,
        user: newUserInfo,
        initialData: initialData,
      };
    } else {
      throw new Error('新規登録には成功しましたが、初期データの取得に失敗しました。');
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
 * 生徒IDをキーに更新対象を特定します。電話番号の後からの登録・修正に対応します。
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
    const phoneColIdx = header.indexOf(HEADER_PHONE); // 追加

    if (idColIdx === -1 || realNameColIdx === -1 || nicknameColIdx === -1 || phoneColIdx === -1) {
      throw new Error(
        '生徒名簿のヘッダー（生徒ID, 本名, ニックネーム, 電話番号など）が正しくありません。',
      );
    }

    const targetRowIndex = data.findIndex(row => row[idColIdx] === userInfo.studentId);

    if (targetRowIndex !== -1) {
      const rowIndexToUpdate = targetRowIndex + 2; // +1 for header, +1 for 0-based index

      // 名前とニックネームの更新
      rosterSheet.getRange(rowIndexToUpdate, realNameColIdx + 1).setValue(userInfo.realName);
      rosterSheet.getRange(rowIndexToUpdate, nicknameColIdx + 1).setValue(userInfo.displayName);

      // 電話番号の更新ロジック
      // userInfo.phone が undefined または null の場合は、電話番号の更新は行わない
      if (userInfo.phone !== undefined && userInfo.phone !== null) {
        const validationResult = _normalizeAndValidatePhone(userInfo.phone, true); // 修正: 空文字列も許容

        // 電話番号が提供されたが、不正な形式だった場合
        if (!validationResult.isValid && userInfo.phone !== '') {
          throw new Error(validationResult.message);
        }
        const normalizedNewPhone = validationResult.normalized;

        // 新しい電話番号が既存の他のユーザーと重複していないかチェック
        if (normalizedNewPhone !== '') {
          // 新しい電話番号が空でない場合のみ重複チェック
          for (let i = 0; i < data.length; i++) {
            // 更新対象の行自身はスキップ
            if (i === targetRowIndex) continue; // 同じ生徒IDを持つ行自身はスキップ

            const storedPhone = String(data[i][phoneColIdx])
              .replace(/^'/, '')
              .replace(/[^0-9]/g, '');
            if (storedPhone === normalizedNewPhone) {
              throw new Error('この電話番号は既に他のユーザーに登録されています。');
            }
          }
          rosterSheet
            .getRange(rowIndexToUpdate, phoneColIdx + 1)
            .setValue("'" + normalizedNewPhone);
          rosterSheet.getRange(rowIndexToUpdate, phoneColIdx + 1).setNumberFormat('@'); // テキストとして保持
        } else {
          rosterSheet.getRange(rowIndexToUpdate, phoneColIdx + 1).setValue(''); // 空文字列で更新
        }
      }

      logActivity(
        userInfo.studentId,
        'プロフィール更新',
        '成功',
        `本名: ${userInfo.realName}, 電話番号: ${userInfo.phone || 'N/A'}`,
      );
      // ★★★ 変更点 ★★★
      // 更新後のユーザー情報を戻り値に追加
      return {
        success: true,
        message: 'プロフィールを更新しました。',
        updatedUser: userInfo,
      };
    } else {
      logActivity(userInfo.studentId, 'プロフィール更新', 'エラー', details);
      return { success: false, message: '更新対象のユーザーが見つかりませんでした。' };
    }
  } catch (err) {
    const details = `ID: ${userInfo.studentId}, Name: ${userInfo.displayName}, Error: ${err.message}`;
    logActivity(userInfo.studentId, 'プロフィール更新エラー', '失敗', details);
    Logger.log(`updateUserProfile Error: ${err.message}`);
    return { success: false, message: `サーバーエラーが発生しました。\n${err.message}` };
  } finally {
    lock.releaseLock();
  }
}
