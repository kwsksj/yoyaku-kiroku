/**
 * =================================================================
 * 【ファイル名】: 09_Backend_Endpoints.js
 * 【バージョン】: 3.2
 * 【役割】: WebApp用統合APIエンドポイント関数
 *
 * 【主要機能】:
 * ✅ アプリ初期化データ管理
 *   - getAppInitialData(): アプリ起動時の基本データ取得
 *   - getLoginData(): ユーザーログイン時の全データ取得
 *   - getScheduleInfo(): 特定の日程マスタ情報取得
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
 *
 * ✅ ユーティリティ関数
 *   - createApiErrorResponse(): 統一APIレスポンス形式のエラーハンドラ
 *
 * 【データフロー】:
 * 1. フロントエンドからAPI呼び出し
 * 2. getCachedData()でキャッシュからデータ取得
 * 3. 必要に応じて他のBackend関数を呼び出し
 * 4. 統一APIレスポンス形式で結果を返却
 * =================================================================
 *
 * @global getUserHistoryFromCache - Cache manager function from 07_CacheManager.js
 * @global getScheduleInfoForDate - Business logic function from 02-4_BusinessLogic_ScheduleMaster.js
 */

/* global getUserHistoryFromCache, getScheduleInfoForDate */

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
    if (result.success) {
      const batchResult = getBatchData(
        ['initial', 'reservations', 'slots'],
        null,
        studentId,
      );
      if (!batchResult.success) {
        return batchResult;
      }

      // デバッグログ: 返却するmyReservationsを確認
      const myReservationsData =
        batchResult.data.userReservations?.myReservations || [];
      Logger.log(
        `executeOperationAndGetLatestData: myReservations件数=${myReservationsData.length}`,
      );
      if (myReservationsData.length > 0) {
        Logger.log(
          `executeOperationAndGetLatestData: 最初の予約ステータス=${myReservationsData[0].status}`,
        );
      }

      const response = createApiResponse(true, {
        message: result.message || successMessage,
        data: {
          myReservations: myReservationsData,
          initialData: {
            ...batchResult.data.initial,
          },
          slots: batchResult.data.slots || [],
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
  const isFirstTime = reservationInfo.options?.firstLecture || false;

  const result = executeOperationAndGetLatestData(
    'makeReservation',
    makeReservation,
    reservationInfo,
    reservationInfo.studentId,
    '予約を作成しました。',
  );

  // 初回フラグ情報を追加
  if (result.success && result.data) {
    result.data.wasFirstTimeBooking = isFirstTime;
  }

  return result;
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
 * @param {string} _filterText - 検索条件文字列（現在未使用）
 * @returns {Object} 検索結果とユーザーリスト
 */
function searchUsersWithoutPhone(_filterText) {
  try {
    const users = getUsersWithoutPhoneNumber();
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
function updateReservationMemoAndGetLatestData(
  reservationId,
  studentId,
  newMemo,
) {
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
 * 会計処理を実行し、成功した場合に最新の全初期化データを返す。
 * @param {object} payload - 会計処理情報（reservationId, classroom, studentId, userInput）
 * @returns {object} 処理結果と最新の初期化データ
 */
function saveAccountingDetailsAndGetLatestData(payload) {
  return executeOperationAndGetLatestData(
    'saveAccounting',
    saveAccountingDetails,
    payload,
    payload.studentId,
    '会計処理が完了しました。',
  );
}

/**
 * アプリ初期化用の基本データをキャッシュから取得する
 * @returns {Object} 初期化データ（生徒情報、料金マスタ、バージョン情報等）
 */
function getAppInitialData() {
  try {
    Logger.log('getAppInitialData開始');

    const allReservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
    const accountingMaster = getCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA);
    const scheduleMaster = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);

    // Schedule Master データが空の場合は診断・修復を試行
    if (
      !scheduleMaster ||
      !scheduleMaster.schedule ||
      scheduleMaster.schedule.length === 0
    ) {
      Logger.log(
        '⚠️ Schedule Master キャッシュが空です - 診断・修復を実行します',
      );
      try {
        diagnoseAndFixScheduleMasterCache();
        // 修復後のデータを再取得
        const repairedScheduleMaster = getCachedData(
          CACHE_KEYS.MASTER_SCHEDULE_DATA,
        );
        if (repairedScheduleMaster && repairedScheduleMaster.schedule) {
          Logger.log(
            `✅ Schedule Master修復完了: ${repairedScheduleMaster.schedule.length}件`,
          );
        }
      } catch (error) {
        Logger.log(`Schedule Master 修復中にエラー: ${error.message}`);
      }
    }

    const today = Utilities.formatDate(
      new Date(),
      CONSTANTS.TIMEZONE,
      'yyyy-MM-dd',
    );

    const result = {
      success: true,
      data: {
        allStudents: studentsCache?.students || {},
        accountingMaster: accountingMaster?.items || [],
        today: today,
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
          // scheduleHeaders: CONSTANTS.HEADERS.SCHEDULE, // headers で包含済み
          // headerMappings: CONSTANTS.HEADER_MAPPINGS, // 削除済み
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
    return createApiErrorResponse(
      `アプリ初期データ取得中にエラー: ${e.message}`,
      true,
    );
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
      batchResult.data.initial.userReservations =
        batchResult.data.userReservations;
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
    return createApiErrorResponse(
      `ログインデータ取得中にエラー: ${e.message}`,
      true,
    );
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
      CacheService.getScriptCache().get(CACHE_KEYS.ALL_RESERVATIONS) ||
        '{"version": 0}',
    );
    const scheduleMaster = JSON.parse(
      CacheService.getScriptCache().get(CACHE_KEYS.MASTER_SCHEDULE_DATA) ||
        '{"version": 0}',
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
      result.data = { ...result.data, initial: initialDataResult.data };

      // 電話番号でユーザーを検索（authenticateUserを使用して正規化と特殊コマンドチェックを実行）
      if (phone) {
        const authResult = authenticateUser(phone);
        if (authResult.success) {
          result.userFound = true;
          result.user = authResult.user;
        } else if (authResult.commandRecognized) {
          // 特殊コマンドが認識された場合
          result.userFound = false;
          result.user = null;
          result['commandRecognized'] = authResult.commandRecognized;
        } else {
          // 通常のユーザー未登録
          result.userFound = false;
          result.user = null;
        }
      } else if (studentId) {
        // studentIdが指定されている場合もユーザー情報を設定する
        const currentUser = initialDataResult.data.allStudents[studentId];
        result.userFound = !!currentUser;
        result.user = currentUser || null;
      }
    }

    // 2. 空席情報が要求されている場合
    if (dataTypes.includes('slots')) {
      Logger.log('=== getBatchData: slots要求を処理中 ===');
      const availableSlotsResult = getAvailableSlots();
      Logger.log(
        `=== getBatchData: getAvailableSlots結果 - success=${availableSlotsResult.success}, dataLength=${availableSlotsResult.data?.length} ===`,
      );
      if (!availableSlotsResult.success) {
        Logger.log(`=== getBatchData: slots取得失敗で早期リターン ===`);
        return availableSlotsResult;
      }
      result.data = { ...result.data, slots: availableSlotsResult.data };
      Logger.log(`=== getBatchData: slotsデータ設定完了 ===`);
    }

    // 3. 個人予約データが要求されている場合
    if (dataTypes.includes('reservations')) {
      const targetStudentId =
        studentId || (result.user ? result.user.studentId : null);
      if (targetStudentId) {
        const userReservationsResult = getUserReservations(targetStudentId);
        if (userReservationsResult.success) {
          result.data = {
            ...result.data,
            userReservations: userReservationsResult.data,
          };
        }
      }
    }

    // 履歴データは reservations に統合済み（削除済み）

    Logger.log(`getBatchData完了: dataTypes=${dataTypes.length}件`);
    return result;
  } catch (e) {
    Logger.log(`getBatchDataでエラー: ${e.message}\nStack: ${e.stack}`);
    return createApiErrorResponse(
      `バッチデータ取得中にエラー: ${e.message}`,
      true,
    );
  }
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

/**
 * 指定した日付・教室の日程マスタ情報を取得するAPIエンドポイント
 * フロントエンドから呼び出され、時間設定や定員情報を提供
 * @param {Object} params - {date: string, classroom: string}
 * @returns {Object} APIレスポンス（日程マスタ情報）
 */
function getScheduleInfo(params) {
  try {
    const { date, classroom } = params;

    if (!date || !classroom) {
      return createApiErrorResponse('日付と教室が必要です');
    }

    const scheduleInfo = getScheduleInfoForDate(date, classroom);

    if (!scheduleInfo) {
      return createApiErrorResponse('該当する日程情報が見つかりません');
    }

    return createApiResponse(true, {
      scheduleInfo: scheduleInfo,
      message: '日程情報を取得しました',
    });
  } catch (error) {
    Logger.log(`getScheduleInfo API エラー: ${error.message}`);
    return createApiErrorResponse(
      `日程情報の取得中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}
