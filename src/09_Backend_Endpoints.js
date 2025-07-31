/**
 * =================================================================
 * 【ファイル名】: 09_Backend_Endpoints.gs
 * 【バージョン】: 1.5
 * 【役割】: WebAppからの呼び出しを集約する統合エンドポイント。
 * 通信回数を削減し、UXを向上させることを目的とする。
 * 【構成】: 14ファイル構成のうちの10番目
 * 【v1.5での変更点】:
 * - 制作メモ更新用エンドポイント（updateMemo）を追加。
 * - きろくキャッシュと予約シートの両方を更新する機能を実装。
 * =================================================================
 */

/**
 * WebAppの初期化に必要な全てのデータを一度に取得する。
 * @param {string} studentId - ログインしたユーザーの生徒ID。
 * @returns {object} - 予約枠、自身の予約、会計マスタ、参加履歴を含むオブジェクト。
 */
function getInitialWebApp_Data(studentId) {
  try {
    // スプレッドシートマネージャーを使用（1回のみ取得）
    const ss = getActiveSpreadsheet();

    // --- 予約枠の取得 (サマリーから直接取得) ---
    let availableSlots = [];
    try {
      availableSlots = getAvailableSlotsFromSummary(ss);
    } catch (e) {
      Logger.log(`予約枠取得に失敗: ${e.message}`);
      availableSlots = [];
    }

    // --- 【NF-11/NF-12】自分の予約状況と参加記録の効率的な取得 (生徒名簿キャッシュから) ---
    let myBookings = [];
    let myHistory = [];
    const rosterSheet = getSheetByName(ROSTER_SHEET_NAME);

    if (rosterSheet) {
      // 1回のシート読み込みで全データを取得（効率化）
      const rosterData = rosterSheet.getDataRange().getValues();
      if (rosterData.length > 1) {
        const rosterHeader = rosterData[0];
        const rosterHeaderMap = createHeaderMap(rosterHeader);
        const studentIdCol = rosterHeaderMap.get(HEADER_STUDENT_ID);
        const cacheCol = rosterHeaderMap.get('よやくキャッシュ');

        if (studentIdCol !== undefined) {
          // 該当ユーザーの行を検索
          const userRow = rosterData.slice(1).find((row) => row[studentIdCol] === studentId);

          if (userRow) {
            // --- 【NF-12】予約キャッシュの取得 ---
            if (cacheCol !== undefined && userRow[cacheCol]) {
              try {
                myBookings = JSON.parse(userRow[cacheCol]);
              } catch (e) {
                Logger.log(`予約キャッシュのJSON解析に失敗 (生徒ID: ${studentId}): ${e.message}`);
              }
            }

            // --- 【NF-11】参加記録キャッシュの取得 ---
            rosterHeader.forEach((header, index) => {
              if (String(header).startsWith('きろく_')) {
                const jsonStr = userRow[index];
                if (jsonStr) {
                  try {
                    const records = JSON.parse(jsonStr);
                    myHistory.push(...records);
                  } catch (e) {
                    Logger.log(
                      `履歴JSONの解析に失敗しました (生徒ID: ${studentId}, 列: ${header}): ${e.message}`,
                    );
                  }
                }
              }
            });

            // 参加記録を日付順にソート
            myHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
          }
        }
      }
    }

    const accountingMaster = getAccountingMasterData();
    if (!accountingMaster.success) throw new Error('会計マスタの取得に失敗しました。');

    return {
      success: true,
      availableSlots: availableSlots,
      myBookings: myBookings,
      accountingMaster: accountingMaster.data,
      myHistory: myHistory,
    };
  } catch (err) {
    Logger.log(`getInitialWebApp_Data Error: ${err.message}`);
    return { success: false, message: `初期データの取得中にエラーが発生しました: ${err.message}` };
  }
}

/**
 * 予約を実行し、成功した場合、更新後の最新予約情報を返す。
 * @param {object} reservationInfo - 予約情報。
 * @returns {object} - 処理結果。
 */
function makeReservationAndGetLatestData(reservationInfo) {
  const result = makeReservation(reservationInfo);
  if (!result.success) {
    return result; // 予約失敗時はそのままエラーを返す
  }
  updateSummaryAndForm(reservationInfo.classroom, new Date(reservationInfo.date));

  return result;
}

/**
 * 予約をキャンセルし、成功した場合、更新後の最新予約情報を返す。
 * @param {object} cancelInfo - { reservationId, classroom, studentId }
 * @returns {object} - 処理結果。
 */
function cancelReservationAndGetLatestData(cancelInfo) {
  const result = cancelReservation(cancelInfo);
  if (!result.success) {
    return result;
  }
  updateSummaryAndForm(cancelInfo.classroom, new Date(cancelInfo.date));
  return result;
}

/**
 * 予約詳細を更新し、成功した場合、更新後の最新予約情報を返す。
 * @param {object} details - 予約詳細情報。
 * @returns {object} - 処理結果。
 */
function updateReservationDetailsAndGetLatestData(details) {
  const result = updateReservationDetails(details);
  // この処理では日付や予約数に変動はないため、サマリー更新は不要。
  return result;
}

/**
 * NF-01: 電話番号未登録ユーザーを検索するWebアプリ用エンドポイント。
 * @returns {Array<object>} - { studentId: string, realName: string, nickname: string } の配列。
 */
function searchNoPhoneUsersByFilterForWebApp() {
  return getUsersWithoutPhoneNumber();
}

/**
 * きろく画面で制作メモを更新し、最新の履歴を返すWebApp用エンドポイント。
 * @param {string} reservationId - 予約ID
 * @param {string} sheetName - 予約が記録されているシート名
 * @param {string} newMemo - 新しい制作メモの内容
 * @param {string} studentId - メモを更新する対象の生徒ID
 * @returns {object} - { success: boolean, history?: object[], total?: number, message?: string }
 */
function updateMemo(reservationId, sheetName, newMemo, studentId) {
  return updateMemoAndGetLatestHistory(reservationId, sheetName, newMemo, studentId);
}

/**
 * サマリーシートから予約枠データを直接取得するヘルパー関数
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト（省略時は自動取得）
 * @returns {Array} availableSlots - 予約枠の配列
 */
function getAvailableSlotsFromSummary(ss) {
  try {
    // スプレッドシートオブジェクトが渡されていない場合のみ取得
    const spreadsheet = ss || getActiveSpreadsheet();
    const summarySheet = getSheetByName(SUMMARY_SHEET_NAME);

    if (!summarySheet || summarySheet.getLastRow() <= 1) {
      return [];
    }

    const summaryData = summarySheet.getDataRange().getValues();
    if (summaryData.length <= 1) {
      return [];
    }

    const summaryHeader = summaryData[0];
    const summaryHeaderMap = createHeaderMap(summaryHeader);

    // サマリーシートから直接予約枠データを構築
    return summaryData
      .slice(1)
      .filter((row) => row[summaryHeaderMap.get(HEADER_DATE)] instanceof Date)
      .map((row) => ({
        classroom: row[summaryHeaderMap.get(HEADER_SUMMARY_CLASSROOM)],
        date: Utilities.formatDate(
          row[summaryHeaderMap.get(HEADER_DATE)],
          getSpreadsheetTimezone(),
          'yyyy-MM-dd',
        ),
        session: row[summaryHeaderMap.get(HEADER_SUMMARY_SESSION)],
        availableSlots: row[summaryHeaderMap.get(HEADER_SUMMARY_AVAILABLE_COUNT)],
        venue: row[summaryHeaderMap.get(HEADER_SUMMARY_VENUE)] || '',
        maxCapacity: row[summaryHeaderMap.get(HEADER_SUMMARY_CAPACITY)] || 0,
      }));
  } catch (e) {
    Logger.log(`サマリーシートからの予約枠取得に失敗: ${e.message}`);
    return [];
  }
}
