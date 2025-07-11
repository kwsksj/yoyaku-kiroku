/**
 * =================================================================
 * 【ファイル名】: 09_Backend_Endpoints.gs
 * 【バージョン】: 1.4
 * 【役割】: WebAppからの呼び出しを集約する統合エンドポイント。
 * 通信回数を削減し、UXを向上させることを目的とする。
 * 【構成】: 14ファイル構成のうちの10番目
 * 【v1.4での変更点】:
 * - FE-18: make/cancelReservationAndGetLatestDataから、時間のかかる
 * getSlotsAndMyBookingsの呼び出しを削除。フロントエンドの体感速度を向上させる。
 * サマリー更新は同期的、予約キャッシュ更新は非同期的に行われる。
 * =================================================================
 */

/**
 * WebAppの初期化に必要な全てのデータを一度に取得する。
 * @param {string} studentId - ログインしたユーザーの生徒ID。
 * @returns {object} - 予約枠、自身の予約、会計マスタ、参加履歴を含むオブジェクト。
 */
function getInitialWebApp_Data(studentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- 予約枠の取得 (サマリーから) ---
    const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
    let availableSlots = [];
    if (summarySheet && summarySheet.getLastRow() > 1) {
        availableSlots = getSlotsAndMyBookings("").availableSlots; // studentIdなしで呼び出し、枠情報のみ取得
    }

    // --- 【NF-12】自分の予約状況の取得 (生徒名簿キャッシュから) ---
    let myBookings = [];
    const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
    if (rosterSheet) {
        const rosterHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
        const rosterHeaderMap = createHeaderMap(rosterHeader);
        const studentIdCol = rosterHeaderMap.get(HEADER_STUDENT_ID);
        const cacheCol = rosterHeaderMap.get('よやくキャッシュ');
        
        if (studentIdCol !== undefined && cacheCol !== undefined) {
            const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, rosterSheet.getLastColumn()).getValues();
            const userRow = rosterData.find(row => row[studentIdCol] === studentId);
            if (userRow && userRow[cacheCol]) {
                try {
                    myBookings = JSON.parse(userRow[cacheCol]);
                } catch(e) {
                    Logger.log(`予約キャッシュのJSON解析に失敗 (生徒ID: ${studentId}): ${e.message}`);
                }
            }
        }
    }

    const accountingMaster = getAccountingMasterData();
    if (!accountingMaster.success) throw new Error("会計マスタの取得に失敗しました。");

    // --- 【NF-11】自分の過去の参加記録の取得 (生徒名簿キャッシュから) ---
    let myHistory = [];
    if (rosterSheet) {
        const rosterHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
        const rosterData = rosterSheet.getDataRange().getValues();
        const studentIdCol = rosterHeader.indexOf(HEADER_STUDENT_ID);

        const userRow = rosterData.find(row => row[studentIdCol] === studentId);

        if (userRow) {
            rosterHeader.forEach((header, index) => {
                if (String(header).startsWith('きろく_')) {
                    const jsonStr = userRow[index];
                    if (jsonStr) {
                        try {
                            const records = JSON.parse(jsonStr);
                            myHistory.push(...records);
                        } catch (e) {
                            Logger.log(`履歴JSONの解析に失敗しました (生徒ID: ${studentId}, 列: ${header}): ${e.message}`);
                        }
                    }
                }
            });
        }
        myHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    return {
      success: true,
      availableSlots: availableSlots,
      myBookings: myBookings,
      accountingMaster: accountingMaster.data,
      myHistory: myHistory
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
