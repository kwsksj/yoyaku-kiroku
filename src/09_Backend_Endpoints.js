/**
 * =================================================================
 * 【ファイル名】: 09_Backend_Endpoints.js
 * 【バージョン】: 3.0
 * 【役割】: WebApp用統合APIエンドポイント関数
 *
 * 【主要機能】:
 * ✅ アプリ初期化データ管理
 *   - getAppInitialData(): アプリ起動時の基本データ取得
 *   - getLoginData(): ユーザーログイン時の全データ取得
 *   - getBatchData(): 複数データタイプの一括取得
 *
 * ✅ 予約操作統合API
 *   - executeOperationAndGetLatestData(): 予約操作後の最新データ取得
 *   - makeReservationAndGetLatestData(): 予約作成+最新データ返却
 *   - cancelReservationAndGetLatestData(): 予約キャンセル+最新データ返却
 *   - updateReservationDetailsAndGetLatestData(): 予約更新+最新データ返却
 *
 * ✅ ユーザー管理・検索機能
 *   - searchUsersWithoutPhone(): 電話番号未登録ユーザー検索
 *   - updateReservationMemo(): 予約メモ更新+履歴取得
 *   - extractUserDataFromBatch(): バッチデータからユーザーデータ抽出
 *
 * ✅ ユーティリティ関数
 *   - createApiErrorResponse(): 統一APIレスポンス形式のエラーハンドラ
 *
 * 【データフロー】:
 * 1. フロントエンドからAPI呼び出し
 * 2. getCachedData()でキャッシュからデータ取得
 * 3. 必要に応じて他のBackend関数を呼び出し
 * 4. 統一APIレスポンス形式で結果を返却
 *
 * 【v3.0での変更点】:
 * - 関数名の統一化と明確化（getAppInitialData, getLoginData, getBatchData）
 * - JSDocコメントの全面改善と型情報の統一
 * - キャッシュ管理システムとの連携最適化
 * - エラーハンドリングとログ出力の改善
 * =================================================================
 */

/**
 * 予約操作後に最新データを取得して返す汎用関数
 * @param {string} operationType - 操作タイプ ('makeReservation'|'cancelReservation'|'updateReservation')
 * @param {Function} operationFunction - 実行する操作関数
 * @param {Object} operationParams - 操作関数に渡すパラメータ
 * @param {string} studentId - 対象生徒のID
 * @param {string} successMessage - 操作成功時のメッセージ
 * @returns {Object} 操作結果と最新データを含むAPIレスポンス
 */
function executeOperationAndGetLatestData(
  operationType,
  operationFunction,
  operationParams,
  studentId,
  successMessage,
) {
  try {
    const result = operationFunction(operationParams);
    // キャッシュ更新は各操作関数内で実行済み
    if (result.success) {
      // ログイン時と同じ方法でデータを取得
      const batchResult = getBatchData(['initial', 'reservations'], null, studentId);
      if (!batchResult.success) {
        return batchResult;
      }

      const response = createApiResponse(true, {
        message: result.message || successMessage,
        data: {
          myBookings: batchResult.data.userReservations
            ? batchResult.data.userReservations.myBookings
            : [],
          initialData: {
            ...batchResult.data.initial,
            myHistory: batchResult.data.userReservations
              ? batchResult.data.userReservations.myHistory
              : [],
          },
        },
      });

      return response;
    } else {
      return result;
    }
  } catch (e) {
    const errorMessages = {
      makeReservation: '予約処理中にエラーが発生しました',
      cancelReservation: 'キャンセル処理中にエラーが発生しました',
      updateReservation: '更新処理中にエラーが発生しました',
    };

    return createApiResponse(false, {
      message: `${errorMessages[operationType] || '処理中にエラーが発生しました'}: ${e.message}`,
    });
  }
}

/**
 * 予約を実行し、成功した場合に最新の全初期化データを返す。
 * @param {object} reservationInfo - 予約情報
 * @returns {object} 処理結果と最新の初期化データ
 */
function makeReservationAndGetLatestData(reservationInfo) {
  return executeOperationAndGetLatestData(
    'makeReservation',
    makeReservation,
    reservationInfo,
    reservationInfo.studentId,
    '予約を作成しました。',
  );
}

/**
 * 予約をキャンセルし、成功した場合に最新の全初期化データを返す。
 * @param {object} cancelInfo - キャンセル情報
 * @returns {object} 処理結果と最新の初期化データ
 */
function cancelReservationAndGetLatestData(cancelInfo) {
  return executeOperationAndGetLatestData(
    'cancelReservation',
    cancelReservation,
    cancelInfo,
    cancelInfo.studentId,
    '予約をキャンセルしました。',
  );
}

/**
 * 予約詳細を更新し、成功した場合に最新の全初期化データを返す。
 * @param {object} details - 更新する予約詳細
 * @returns {object} 処理結果と最新の初期化データ
 */
function updateReservationDetailsAndGetLatestData(details) {
  return executeOperationAndGetLatestData(
    'updateReservation',
    updateReservationDetails,
    details,
    details.studentId,
    '予約内容を更新しました。',
  );
}

/**
 * 電話番号未登録のユーザーをフィルタリング検索する
 * @param {string} filterText - 検索条件文字列
 * @returns {Object} 検索結果とユーザーリスト
 */
function searchUsersWithoutPhone(filterText) {
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
 * 予約のメモを更新し、成功した場合に最新の全初期化データを返す
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} studentId - 対象生徒のID
 * @param {string} newMemo - 新しいメモ内容
 * @returns {Object} 処理結果と最新の初期化データ
 */
function updateReservationMemoAndGetLatestData(reservationId, studentId, newMemo) {
  return executeOperationAndGetLatestData(
    'updateMemo',
    updateReservationDetails,
    {
      reservationId,
      studentId,
      workInProgress: newMemo, // 制作メモのみを更新
    },
    studentId,
    '制作メモを更新しました。',
  );
}

/**
 * アプリ初期化用の基本データをキャッシュから取得する
 * @returns {Object} 初期化データ（生徒情報、料金マスタ、バージョン情報等）
 */
function getAppInitialData() {
  try {
    Logger.log('getAppInitialData開始');

    // 1. 予約データはフロントエンドに送信しない（個人用はgetUserReservationsで別途取得）
    // 予約キャッシュのバージョン情報のみ取得
    const allReservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);

    // 2. 生徒基本情報キャッシュを取得（なければ再構築）
    const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
    Logger.log(
      `生徒データ件数: ${studentsCache?.students ? Object.keys(studentsCache.students).length : 0}`,
    );

    // 3. 料金マスタデータを取得（CacheServiceから, なければ再構築）
    const accountingMaster = getCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA);
    Logger.log(`会計マスタデータ件数: ${accountingMaster?.items?.length || 0}`);

    // 4. 日程マスタはフロントエンドには送信しない（空席計算で内部使用）
    // バージョン情報のみ取得
    const scheduleMaster = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);

    // 5. 今日の日付文字列を追加
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

    const result = {
      success: true,
      data: {
        allStudents: studentsCache?.students || {},
        accountingMaster: accountingMaster?.items || [],
        today: today,
        // 統一定数をフロントエンドに配信
        constants: {
          classrooms: CONSTANTS.CLASSROOMS,
          headers: CONSTANTS.HEADERS,
          items: CONSTANTS.ITEMS,
          status: CONSTANTS.STATUS,
          itemTypes: CONSTANTS.ITEM_TYPES,
          units: CONSTANTS.UNITS,
          paymentMethods: CONSTANTS.PAYMENT_METHODS,
          ui: CONSTANTS.UI,
          limits: CONSTANTS.LIMITS,
          sheetNames: CONSTANTS.SHEET_NAMES,
          sessions: CONSTANTS.SESSIONS,
          paymentDisplay: CONSTANTS.PAYMENT_DISPLAY,
          bankInfo: CONSTANTS.BANK_INFO,
          frontendUi: CONSTANTS.FRONTEND_UI,
          messages: CONSTANTS.MESSAGES,
          logActions: CONSTANTS.LOG_ACTIONS,
          colors: CONSTANTS.COLORS,
          classroomTypes: CONSTANTS.CLASSROOM_TYPES,
          scheduleStatus: CONSTANTS.SCHEDULE_STATUS,
          scheduleHeaders: CONSTANTS.SCHEDULE_HEADERS,
        },
        cacheVersions: {
          allReservations: allReservationsCache?.version || 0,
          students: studentsCache?.version || 0,
          accountingMaster: accountingMaster?.version || 0,
          scheduleMaster: scheduleMaster?.version || 0,
        },
      },
    };

    Logger.log('getAppInitialData完了');
    return result;
  } catch (e) {
    Logger.log(`getAppInitialDataでエラー: ${e.message}\nStack: ${e.stack}`);
    return createApiErrorResponse(`アプリ初期データ取得中にエラー: ${e.message}`, true);
  }
}

/**
 * ユーザーログイン時に必要な全データを取得する
 * @param {string} phone - 電話番号（ユーザー認証用）
 * @returns {Object} 初期データ、空席情報、ユーザー情報を含む結果
 */
function getLoginData(phone) {
  try {
    Logger.log(`getLoginData開始: phone=${phone}`);

    // 統合バッチ処理で一度にすべてのデータを取得
    const batchResult = getBatchData(['initial', 'reservations'], phone);
    if (!batchResult.success) {
      return batchResult;
    }

    if (batchResult.data.userReservations) {
      batchResult.data.initial.userReservations = batchResult.data.userReservations;
    }

    const result = {
      success: true,
      data: batchResult.data.initial,
      userFound: batchResult.userFound,
      user: batchResult.user,
    };

    Logger.log(`getLoginData完了: userFound=${result.userFound}`);
    return result;
  } catch (e) {
    Logger.log(`getLoginDataでエラー: ${e.message}\nStack: ${e.stack}`);
    return createApiErrorResponse(`ログインデータ取得中にエラー: ${e.message}`, true);
  }
}

/**
 * 軽量なキャッシュバージョンチェック用API
 * 空き枠データの更新有無を高速で判定
 * @returns {object} - { success: boolean, versions: object }
 */
function getCacheVersions() {
  try {
    Logger.log('getCacheVersions開始');

    // 関連キャッシュのバージョンのみ取得
    const allReservationsCache = JSON.parse(
      CacheService.getScriptCache().get(CACHE_KEYS.ALL_RESERVATIONS) || '{"version": 0}'
    );
    const scheduleMaster = JSON.parse(
      CacheService.getScriptCache().get(CACHE_KEYS.SCHEDULE_MASTER) || '{"version": 0}'
    );

    const versions = {
      allReservations: allReservationsCache.version || 0,
      scheduleMaster: scheduleMaster.version || 0,
      // 空き枠関連バージョンの合成（変更検知用）
      slotsComposite: `${allReservationsCache.version || 0}-${scheduleMaster.version || 0}`,
    };

    Logger.log(`getCacheVersions完了: ${JSON.stringify(versions)}`);
    return createApiResponse(true, versions);
  } catch (err) {
    return BackendErrorHandler.handle(err, 'getCacheVersions');
  }
}

/**
 * 複数のデータタイプを一度に取得するバッチ処理関数
 * @param {Array} dataTypes - 取得するデータタイプの配列 ['initial', 'slots', 'reservations', 'history', 'userdata']
 * @param {string|null} phone - 電話番号（ユーザー特定用、任意）
 * @param {string|null} studentId - 生徒ID（個人データ取得用、任意）
 * @returns {Object} 要求されたすべてのデータを含む統合レスポンス
 */
function getBatchData(dataTypes = [], phone = null, studentId = null) {
  try {
    Logger.log(
      `getBatchData開始: dataTypes=${JSON.stringify(dataTypes)}, phone=${phone}, studentId=${studentId}`,
    );

    const result = {
      success: true,
      data: {},
      userFound: false,
      user: null,
    };

    // 1. 初期データが要求されている場合
    if (dataTypes.includes('initial')) {
      const initialDataResult = getAppInitialData();
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
      } else if (studentId) {
        // studentIdが指定されている場合もユーザー情報を設定する
        const currentUser = initialDataResult.data.allStudents[studentId];
        result.userFound = !!currentUser;
        result.user = currentUser || null;
      }
    }

    // 2. 空席情報が要求されている場合
    if (dataTypes.includes('slots')) {
      Logger.log('getBatchData: slots要求 - getAvailableSlots呼び出し開始');
      const availableSlotsResult = getAvailableSlots();
      Logger.log(
        `getBatchData: getAvailableSlots結果 - success: ${availableSlotsResult.success}, data.length: ${availableSlotsResult.data ? availableSlotsResult.data.length : 'null'}`,
      );
      if (!availableSlotsResult.success) {
        Logger.log(`getBatchData: slots取得エラーのため処理中断 - ${availableSlotsResult.message}`);
        return availableSlotsResult;
      }
      result.data.slots = availableSlotsResult.data;
      Logger.log(`getBatchData: result.data.slotsに${availableSlotsResult.data.length}件設定完了`);
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
      const userData = extractUserDataFromBatch(result.data, targetStudentId);
      result.data.userBookings = userData.myBookings;
      result.data.userHistory = userData.myHistory;
    }

    Logger.log(`getBatchData完了: dataTypes=${dataTypes.length}件`);
    return result;
  } catch (e) {
    Logger.log(`getBatchDataでエラー: ${e.message}\nStack: ${e.stack}`);
    return createApiErrorResponse(`バッチデータ取得中にエラー: ${e.message}`, true);
  }
}

/**
 * バッチ取得されたデータから特定ユーザーのデータを抽出
 * @param {Object} batchData - getBatchDataで取得したデータ
 * @param {string} studentId - 抽出対象の生徒ID
 * @returns {Object} ユーザーの予約・履歴データ
 */
function extractUserDataFromBatch(batchData, studentId) {
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
 * 統一APIレスポンス形式のエラーハンドラ
 * @param {string} message - エラーメッセージ
 * @param {boolean} [log=false] - Loggerにエラーを記録するか
 * @returns {Object} 統一されたエラーレスポンス
 */
function createApiErrorResponse(message, log = false) {
  if (log) {
    Logger.log(message);
  }
  return createApiResponse(false, {
    message: message,
  });
}
