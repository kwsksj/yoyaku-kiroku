/**
 * =================================================================
 * 【ファイル名】: 09_Backend_Endpoints.gs
 * 【バージョン】: 2.2
 * 【役割】: WebAppとの通信を最適化するための統合APIエンドポイント。
 * 【v2.2での変更点】:
 * - getInitialDataForNewWebAppが料金マスタをCacheServiceから取得するように修正。
 * =================================================================
 */

/**
 * 予約を実行し、成功した場合に最新の全初期化データを返す。
 * @param {object} reservationInfo - 予約情報
 * @returns {object} 処理結果と最新の初期化データ
 */
function makeReservationAndGetLatestData(reservationInfo) {
  try {
    const result = makeReservation(reservationInfo);
    rebuildAllReservationsToCache();
    if (result.success) {
      const initialData = getInitialDataForNewWebApp();
      if (!initialData.success) {
        return initialData;
      }

      // 特定ユーザーの予約情報をフィルタリング
      const userReservations = filterUserReservations(
        initialData.data.allReservations,
        reservationInfo.studentId,
        initialData.data.today,
      );

      const response = createApiResponse(true, {
        message: result.message,
        data: {
          myBookings: userReservations.myBookings,
          initialData: initialData.data,
        },
      });

      return response;
    } else {
      return result;
    }
  } catch (e) {
    return createApiResponse(false, {
      message: `予約処理中にエラーが発生しました: ${e.message}`,
    });
  }
}

/**
 * 予約をキャンセルし、成功した場合に最新の全初期化データを返す。
 * @param {object} cancelInfo - キャンセル情報
 * @returns {object} 処理結果と最新の初期化データ
 */
function cancelReservationAndGetLatestData(cancelInfo) {
  try {
    const result = cancelReservation(cancelInfo);
    rebuildAllReservationsToCache();
    if (result.success) {
      const initialData = getInitialDataForNewWebApp();
      if (!initialData.success) {
        return initialData;
      }

      // 特定ユーザーの予約情報をフィルタリング
      const userReservations = filterUserReservations(
        initialData.data.allReservations,
        cancelInfo.studentId,
        initialData.data.today,
      );

      return createApiResponse(true, {
        message: result.message,
        data: {
          myBookings: userReservations.myBookings,
          initialData: initialData.data,
        },
      });
    } else {
      return result;
    }
  } catch (e) {
    return createApiResponse(false, {
      message: `キャンセル処理中にエラーが発生しました: ${e.message}`,
    });
  }
}

/**
 * 予約詳細を更新し、成功した場合に最新の全初期化データを返す。
 * @param {object} details - 更新する予約詳細
 * @returns {object} 処理結果と最新の初期化データ
 */
function updateReservationDetailsAndGetLatestData(details) {
  try {
    const result = updateReservationDetails(details);
    rebuildAllReservationsToCache();
    if (result.success) {
      const initialData = getInitialDataForNewWebApp();
      if (!initialData.success) {
        return initialData;
      }

      // 特定ユーザーの予約情報をフィルタリング
      const userReservations = filterUserReservations(
        initialData.data.allReservations,
        details.studentId,
        initialData.data.today,
      );

      const response = createApiResponse(true, {
        message: result.message,
        data: {
          myBookings: userReservations.myBookings,
          initialData: initialData.data,
        },
      });

      return response;
    } else {
      return result;
    }
  } catch (e) {
    return createApiResponse(false, {
      message: `予約詳細の更新中にエラーが発生しました: ${e.message}`,
    });
  }
}

/**
 * WebApp専用：電話番号未登録ユーザーをフィルタリングして検索する。
 * @param {string} filterText - 検索文字列
 * @returns {object} 処理結果とユーザーリスト
 */
function searchNoPhoneUsersByFilterForWebApp(filterText) {
  try {
    const users = getUsersWithoutPhoneNumber(filterText);
    return createApiResponse(true, {
      data: users,
    });
  } catch (e) {
    return createApiResponse(false, {
      message: `電話番号未登録ユーザーの検索中にエラーが発生しました: ${e.message}`,
    });
  }
}

/**
 * メモを更新し、最新の参加履歴を返す。
 * @param {string} reservationId - 予約ID
 * @param {string} studentId - 生徒ID
 * @param {string} newMemo - 新しいメモ
 * @returns {object} 処理結果と最新の参加履歴
 */
function updateMemo(reservationId, studentId, newMemo) {
  try {
    const result = updateMemoAndGetLatestHistory(reservationId, studentId, newMemo);
    if (result.success) {
      return createApiResponse(true, {
        data: result.history,
        meta: { total: result.total },
      });
    } else {
      return result;
    }
  } catch (e) {
    return createApiResponse(false, {
      message: `メモの更新中にエラーが発生しました: ${e.message}`,
    });
  }
}

/**
 * 【新WebApp用】新しいデータモデル（キャッシュ）から初期化データを取得する
 */
function getInitialDataForNewWebApp() {
  try {
    const cache = CacheService.getScriptCache();
    Logger.log('getInitialDataForNewWebApp開始');

    // 1. 予約データはフロントエンドに送信しない（個人用はgetUserReservationsで別途取得）
    // 予約キャッシュのバージョン情報のみ取得
    let allReservationsCacheJSON = cache.get('all_reservations');
    const allReservationsCache = JSON.parse(allReservationsCacheJSON || '{}');

    // 2. 生徒基本情報キャッシュを取得（なければ再構築）
    let studentsCacheJSON = cache.get('all_students_basic');
    Logger.log(`生徒キャッシュ取得: ${studentsCacheJSON ? 'あり' : 'なし'}`);
    if (!studentsCacheJSON) {
      Logger.log('生徒キャッシュを再構築中...');
      rebuildAllStudentsBasicToCache();
      studentsCacheJSON = cache.get('all_students_basic');
      Logger.log(`生徒キャッシュ再構築後: ${studentsCacheJSON ? 'あり' : 'なし'}`);
    }
    const studentsCache = JSON.parse(studentsCacheJSON || '{}');
    Logger.log(
      `生徒データ件数: ${studentsCache.students ? Object.keys(studentsCache.students).length : 0}`,
    );

    // 3. 料金マスタデータを取得（CacheServiceから, なければ再構築）
    let accountingMasterCacheJSON = cache.get('master_accounting_data');
    Logger.log(`会計マスタキャッシュ取得: ${accountingMasterCacheJSON ? 'あり' : 'なし'}`);
    if (!accountingMasterCacheJSON) {
      Logger.log('会計マスタキャッシュを再構築中...');
      const accountingMasterCache = buildAndCacheAccountingMasterToCache();
      accountingMasterCacheJSON = JSON.stringify(accountingMasterCache);
    }
    const accountingMaster = JSON.parse(accountingMasterCacheJSON || '{}');
    Logger.log(`会計マスタデータ件数: ${accountingMaster.items?.length || 0}`);

    // 4. 日程マスタはフロントエンドには送信しない（空席計算で内部使用）
    // バージョン情報のみ取得
    let scheduleMasterCacheJSON = cache.get('master_schedule_data');
    const scheduleMaster = JSON.parse(scheduleMasterCacheJSON || '{}');

    // 5. 今日の日付文字列を追加
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

    const result = {
      success: true,
      data: {
        allStudents: studentsCache.students || {},
        accountingMaster: accountingMaster.items || [],
        today: today,
        cacheVersions: {
          allReservations: allReservationsCache.version || 0,
          students: studentsCache.version || 0,
          accountingMaster: accountingMaster.version || 0,
          scheduleMaster: scheduleMaster.version || 0,
        },
      },
    };

    Logger.log('getInitialDataForNewWebApp完了');
    return result;
  } catch (e) {
    Logger.log(`getInitialDataForNewWebAppでエラー: ${e.message}\nStack: ${e.stack}`);
    return handleError(`新しいWebAppの初期データ取得中にエラー: ${e.message}`, true);
  }
}

/**
 * 【ログイン統合用】初期データと空席情報を同時に取得する
 * @param {string} phone - 電話番号（ユーザー認証用）
 */
function getInitialDataWithAvailableSlots(phone) {
  try {
    Logger.log(`getInitialDataWithAvailableSlots開始: phone=${phone}`);

    // 統合バッチ処理で一度にすべてのデータを取得
    const batchResult = getBatchDataForWebApp(['initial', 'slots', 'reservations'], phone);
    if (!batchResult.success) {
      return batchResult;
    }

    if (batchResult.data.userReservations) {
      batchResult.data.initial.userReservations = batchResult.data.userReservations;
    }

    const result = {
      success: true,
      data: batchResult.data.initial,
      availableSlots: batchResult.data.slots,
      userFound: batchResult.userFound,
      user: batchResult.user,
    };

    Logger.log(`getInitialDataWithAvailableSlots完了: userFound=${result.userFound}`);
    return result;
  } catch (e) {
    Logger.log(`getInitialDataWithAvailableSlotsでエラー: ${e.message}\nStack: ${e.stack}`);
    return handleError(`ログイン用データ取得中にエラー: ${e.message}`, true);
  }
}

/**
 * 【バッチ処理統合】複数データを一度に取得する統合エンドポイント
 * @param {Array} dataTypes - 取得するデータタイプの配列 ['initial', 'slots', 'history']
 * @param {string} phone - 電話番号（ユーザー特定用、任意）
 * @param {string} studentId - 生徒ID（履歴取得用、任意）
 * @returns {object} 要求されたすべてのデータを含む統合レスポンス
 */
function getBatchDataForWebApp(dataTypes = [], phone = null, studentId = null) {
  try {
    Logger.log(
      `getBatchDataForWebApp開始: dataTypes=${JSON.stringify(dataTypes)}, phone=${phone}, studentId=${studentId}`,
    );

    const result = {
      success: true,
      data: {},
      userFound: false,
      user: null,
    };

    // 1. 初期データが要求されている場合
    if (dataTypes.includes('initial')) {
      const initialDataResult = getInitialDataForNewWebApp();
      if (!initialDataResult.success) {
        return initialDataResult;
      }
      result.data.initial = initialDataResult.data;

      // 電話番号でユーザーを検索
      if (phone) {
        const currentUser = Object.values(initialDataResult.data.allStudents).find(
          student => student.phone === phone,
        );
        result.userFound = !!currentUser;
        result.user = currentUser || null;
      }
    }

    // 2. 空席情報が要求されている場合
    if (dataTypes.includes('slots')) {
      Logger.log('getBatchDataForWebApp: slots要求 - getAvailableSlots呼び出し開始');
      const availableSlotsResult = getAvailableSlots();
      Logger.log(`getBatchDataForWebApp: getAvailableSlots結果 - success: ${availableSlotsResult.success}, data.length: ${availableSlotsResult.data ? availableSlotsResult.data.length : 'null'}`);
      if (!availableSlotsResult.success) {
        Logger.log(`getBatchDataForWebApp: slots取得エラーのため処理中断 - ${availableSlotsResult.message}`);
        return availableSlotsResult;
      }
      result.data.slots = availableSlotsResult.data;
      Logger.log(`getBatchDataForWebApp: result.data.slotsに${availableSlotsResult.data.length}件設定完了`);
    }

    // 3. 個人予約データが要求されている場合
    if (dataTypes.includes('reservations')) {
      const targetStudentId = studentId || (result.user ? result.user.studentId : null);
      if (targetStudentId) {
        const userReservationsResult = getUserReservations(targetStudentId);
        if (userReservationsResult.success) {
          result.data.userReservations = userReservationsResult.data;
        }
      }
    }

    // 4. 履歴データが要求されている場合
    if (dataTypes.includes('history') && studentId) {
      const historyResult = getUserHistoryFromCache(studentId);
      if (historyResult.success) {
        result.data.history = historyResult.data;
        result.data.historyTotal = historyResult.total;
      }
    }

    // 5. ユーザー固有データが要求されている場合
    if (dataTypes.includes('userdata') && (studentId || result.user)) {
      const targetStudentId = studentId || result.user.studentId;
      const userData = filterUserDataFromBatch(result.data, targetStudentId);
      result.data.userBookings = userData.myBookings;
      result.data.userHistory = userData.myHistory;
    }

    Logger.log(`getBatchDataForWebApp完了: dataTypes=${dataTypes.length}件`);
    return result;
  } catch (e) {
    Logger.log(`getBatchDataForWebAppでエラー: ${e.message}\nStack: ${e.stack}`);
    return handleError(`バッチデータ取得中にエラー: ${e.message}`, true);
  }
}

/**
 * バッチ取得されたデータからユーザー固有データを抽出
 * @param {object} batchData - getBatchDataForWebAppで取得したデータ
 * @param {string} studentId - 生徒ID
 * @returns {object} ユーザーの予約・履歴データ
 */
function filterUserDataFromBatch(batchData, studentId) {
  const result = {
    myBookings: [],
    myHistory: [],
  };

  if (batchData.initial && batchData.initial.allReservations) {
    const today = batchData.initial.today;
    batchData.initial.allReservations.forEach(resArray => {
      // 配列形式の予約データをオブジェクト形式に変換
      const resObj = transformReservationArrayToObject(resArray);
      if (!resObj) return; // 変換失敗の場合はスキップ

      if (resObj.studentId === studentId && resObj.status !== STATUS_CANCEL) {
        if (resObj.date >= today) {
          result.myBookings.push(resObj);
        } else {
          result.myHistory.push(resObj);
        }
      }
    });
  }

  return result;
}

/**
 * 汎用エラーハンドラ（統一APIレスポンス形式を使用）
 * @param {string} message - エラーメッセージ
 * @param {boolean} log - Loggerに記録するかどうか
 * @returns {object} 統一されたエラーオブジェクト
 */
function handleError(message, log = false) {
  if (log) {
    Logger.log(message);
  }
  return createApiResponse(false, {
    message: message,
  });
}