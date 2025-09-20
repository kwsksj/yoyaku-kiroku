/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />
/// <reference path="../../types/index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 09_Backend_Endpoints.js
 * 【バージョン】: 3.3
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

/* global getUserHistoryFromCache, getScheduleInfoForDate, getLessons, getUserReservations, makeReservation, cancelReservation, updateReservationDetails, getUsersWithoutPhoneNumber, saveAccountingDetails, authenticateUser, createApiResponse, createHeaderMap, getCachedData, diagnoseAndFixScheduleMasterCache, BackendErrorHandler, SS_MANAGER, CONSTANTS, CACHE_KEYS, Utilities, Logger, CacheService */

/**
 * 予約操作後に最新データを取得して返す汎用関数
 * @param {keyof ErrorMessages} operationType - 操作タイプ ('makeReservation'|'cancelReservation'|'updateReservation')
 * @param {Function} operationFunction - 実行する操作関数
 * @param {ReservationInfo|CancelInfo|ReservationDetails} operationParams - 操作関数に渡すパラメータ
 * @param {string} studentId - 対象生徒のID
 * @param {string} successMessage - 操作成功時のメッセージ
 * @returns {ApiResponseGeneric} 操作結果と最新データを含むAPIレスポンス
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
        ['initial', 'reservations', 'lessons'],
        null,
        studentId,
      );
      if (!batchResult.success) {
        return batchResult;
      }

      // デバッグログ: 返却するmyReservationsを確認
      const myReservationsData = batchResult.data.myReservations || [];
      Logger.log(
        `executeOperationAndGetLatestData: myReservations件数=${myReservationsData.length}`,
      );
      if (myReservationsData.length > 0) {
        Logger.log(
          `executeOperationAndGetLatestData: 最初の予約データ=${typeof myReservationsData[0]}`,
        );
      }

      const response = createApiResponse(true, {
        message: result.message || successMessage,
        data: {
          myReservations: myReservationsData,
          initialData: batchResult.data.initial || {},
          lessons: batchResult.data.lessons || [],
        },
      });

      return response;
    } else {
      return result;
    }
  } catch (e) {
    /** @type {ErrorMessages} */
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
 * @param {ReservationInfo} reservationInfo - 予約情報
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
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
 * @param {CancelInfo} cancelInfo - キャンセル情報
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
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
 * @param {ReservationDetails} details - 更新する予約詳細
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
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
 * @returns {ApiResponseGeneric} 検索結果とユーザーリスト
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
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
function updateReservationMemoAndGetLatestData(
  reservationId,
  studentId,
  newMemo,
) {
  return executeOperationAndGetLatestData(
    'updateReservation',
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
 * @param {AccountingPayload} payload - 会計処理情報（reservationId, classroom, studentId, userInput）
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
function saveAccountingDetailsAndGetLatestData(payload) {
  return executeOperationAndGetLatestData(
    'updateReservation',
    saveAccountingDetails,
    payload,
    payload.studentId,
    '会計処理が完了しました。',
  );
}

/**
 * 指定された予約の会計詳細をシートから直接取得する
 * @param {string} reservationId - 予約ID
 * @returns {ApiResponseGeneric<AccountingDetails>} 会計詳細データ
 */
function getAccountingDetailsFromSheet(reservationId) {
  try {
    Logger.log(`getAccountingDetailsFromSheet開始: ${reservationId}`);
    Logger.log(`CONSTANTS確認: ${typeof CONSTANTS}`);
    Logger.log(`CONSTANTS.SHEET_NAMES確認: ${typeof CONSTANTS.SHEET_NAMES}`);
    Logger.log(
      `CONSTANTS.SHEET_NAMES.RESERVATIONS確認: ${CONSTANTS.SHEET_NAMES.RESERVATIONS}`,
    );

    // 統合予約シートから該当予約を検索
    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.RESERVATIONS);
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const headerMap = createHeaderMap(headers);

    // 必要なカラムインデックスを取得
    const reservationIdColIdx = headerMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );
    const accountingDetailsColIdx = headerMap.get(
      CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
    );

    if (
      reservationIdColIdx === undefined ||
      accountingDetailsColIdx === undefined
    ) {
      throw new Error('必要なヘッダーが見つかりません');
    }

    // データ範囲を取得
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: false, message: '予約データが見つかりません' };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    const data = dataRange.getValues();

    // 該当予約を検索
    const targetRow = data.find(
      row => row[reservationIdColIdx] === reservationId,
    );

    if (!targetRow) {
      return { success: false, message: '指定された予約が見つかりません' };
    }

    // 会計詳細を取得・パース
    const accountingDetailsRaw = targetRow[accountingDetailsColIdx];
    /** @type {AccountingDetails} */
    let accountingDetails = {
      tuition: { items: [], subtotal: 0 },
      sales: { items: [], subtotal: 0 },
      grandTotal: 0,
      paymentMethod: '不明',
    };

    if (accountingDetailsRaw) {
      try {
        const parsed = JSON.parse(accountingDetailsRaw);
        accountingDetails = {
          tuition: parsed.tuition || { items: [], subtotal: 0 },
          sales: parsed.sales || { items: [], subtotal: 0 },
          grandTotal: parsed.grandTotal || 0,
          paymentMethod: parsed.paymentMethod || '不明',
        };
      } catch (parseError) {
        Logger.log(`JSON parse error: ${parseError.message}`);
        return { success: false, message: '会計データの解析に失敗しました' };
      }
    }

    Logger.log(`会計詳細取得成功: ${JSON.stringify(accountingDetails)}`);

    /** @type {ApiResponseGeneric<AccountingDetails>} */
    return {
      success: true,
      data: accountingDetails,
    };
  } catch (error) {
    Logger.log(`getAccountingDetailsFromSheet Error: ${error.message}`);
    const errorResult = BackendErrorHandler.handle(
      error,
      'getAccountingDetailsFromSheet',
    );
    return /** @type {ApiResponseGeneric<AccountingDetails>} */ (errorResult);
  }
}

/**
 * アプリ初期化用の基本データをキャッシュから取得する
 * @returns {ApiResponseGeneric<{
 *   allStudents: {[key: string]: StudentData},
 *   accountingMaster: AccountingMasterItem[],
 *   today: string,
 *   cacheVersions: {[key: string]: number}
 * }>}
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
      !scheduleMaster['schedule'] ||
      !Array.isArray(scheduleMaster['schedule']) ||
      scheduleMaster['schedule'].length === 0
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
        if (
          repairedScheduleMaster &&
          Array.isArray(repairedScheduleMaster['schedule'])
        ) {
          Logger.log(
            `✅ Schedule Master修復完了: ${repairedScheduleMaster['schedule'].length}件`,
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

    /** @type {ApiResponseGeneric<{ allStudents: { [key: string]: StudentData }, accountingMaster: AccountingMasterItem[], today: string, cacheVersions: { [key: string]: number } }>}*/
    const result = {
      success: true,
      data: {
        allStudents: /** @type {{ [key: string]: StudentData }} */ (
          studentsCache?.['students'] || {}
        ),
        accountingMaster: /** @type {AccountingMasterItem[]} */ (
          accountingMaster?.['items'] || []
        ),
        today: today,
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
 * フロントエンド用に構造化された会計マスタデータを生成して返す
 * @returns {ApiResponseGeneric<StructuredAccountingData>}
 */
function getStructuredAccountingData() {
  try {
    Logger.log('getStructuredAccountingData開始');

    const accountingMasterCache = getCachedData(
      CACHE_KEYS.MASTER_ACCOUNTING_DATA,
    );
    const rawData = accountingMasterCache?.['items'] || [];

    if (rawData.length === 0) {
      return createApiErrorResponse('会計マスタデータが見つかりません。', true);
    }

    /** @type {StructuredAccountingData} */
    const structuredData = {};

    // 教室ごとに初期化
    Object.values(CONSTANTS.CLASSROOMS).forEach(classroomName => {
      structuredData[classroomName] = {
        [CONSTANTS.ITEM_TYPES.TUITION]: [],
        [CONSTANTS.ITEM_TYPES.SALES]: [],
        [CONSTANTS.ITEM_TYPES.MATERIAL]: [],
      };
    });

    rawData.forEach(row => {
      const unit = row[CONSTANTS.HEADERS.ACCOUNTING.UNIT];
      const notes = row[CONSTANTS.HEADERS.ACCOUNTING.NOTES];

      /** @type {ProcessedAccountingItem} */
      const processedItem = {
        name: row[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
        price: Number(row[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]),
        unit_display: unit,
        remarks: notes,
        calc_type: 'count', // default
      };

      switch (unit) {
        case CONSTANTS.UNITS.THIRTY_MIN:
          processedItem.calc_type = 'time_block';
          processedItem.block_minutes = 30;
          break;
        case CONSTANTS.UNITS.CM3:
          processedItem.calc_type = 'volume';
          break;
        case CONSTANTS.UNITS.PIECE:
        case CONSTANTS.UNITS.SET:
          if (notes === '計算不要の材料') {
            processedItem.calc_type = 'fixed';
          } else {
            processedItem.calc_type = 'quantity';
          }
          break;
        default: // '回' など
          processedItem.calc_type = 'count';
          break;
      }

      const targetClassroom =
        row[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM];
      const itemType = row[CONSTANTS.HEADERS.ACCOUNTING.TYPE];

      if (targetClassroom === '共通') {
        Object.values(CONSTANTS.CLASSROOMS).forEach(classroomName => {
          if (
            structuredData[classroomName] &&
            structuredData[classroomName][itemType]
          ) {
            structuredData[classroomName][itemType].push(processedItem);
          }
        });
      } else {
        if (
          structuredData[targetClassroom] &&
          structuredData[targetClassroom][itemType]
        ) {
          structuredData[targetClassroom][itemType].push(processedItem);
        }
      }
    });

    Logger.log('getStructuredAccountingData完了');
    return createApiResponse(true, structuredData);
  } catch (e) {
    Logger.log(
      `getStructuredAccountingDataでエラー: ${e.message}\nStack: ${e.stack}`,
    );
    return createApiErrorResponse(
      `構造化会計データ生成中にエラー: ${e.message}`,
      true,
    );
  }
}

/**
 * ユーザーログイン時に必要な全データを取得する
 * @param {string} phone - 電話番号（ユーザー認証用）
 * @returns {ApiResponseGeneric} 初期データ、空席情報、ユーザー情報を含む結果
 */
function getLoginData(phone) {
  try {
    Logger.log(`getLoginData開始: phone=${phone}`);

    // 統合バッチ処理で一度にすべてのデータを取得
    const batchResult = getBatchData(['initial', 'reservations'], phone);
    if (!batchResult.success) {
      return batchResult;
    }

    if (batchResult.data.myReservations) {
      /** @type {any} */ (batchResult.data.initial).myReservations =
        batchResult.data.myReservations;
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
 * @returns {ApiResponseGeneric} - { success: boolean, versions: object }
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
      lessonsComposite: `${allReservationsCache.version || 0}-${scheduleMaster.version || 0}`,
    };

    Logger.log(`getCacheVersions完了: ${JSON.stringify(versions)}`);
    return /** @type {ApiResponseGeneric} */ (
      createApiResponse(true, versions)
    );
  } catch (err) {
    const errorResult = BackendErrorHandler.handle(err, 'getCacheVersions');
    return /** @type {ApiResponseGeneric} */ (errorResult);
  }
}

/**
 * 複数のデータタイプを一度に取得するバッチ処理関数
 * @param {string[]} dataTypes - 取得するデータタイプの配列 ['initial', 'lessons', 'reservations', 'history', 'userdata']
 * @param {string|null} phone - 電話番号（ユーザー特定用、任意）
 * @param {string|null} studentId - 生徒ID（個人データ取得用、任意）
 * @returns {BatchDataResult} 要求されたすべてのデータを含む統合レスポンス
 */
function getBatchData(dataTypes = [], phone = null, studentId = null) {
  try {
    Logger.log(
      `getBatchData開始: dataTypes=${JSON.stringify(dataTypes)}, phone=${phone}, studentId=${studentId}`,
    );

    /** @type {BatchDataResult} */
    const result = {
      success: true,
      data: {},
      userFound: false,
      user: /** @type {StudentData | null} */ (null),
    };

    // 1. 初期データが要求されている場合
    if (dataTypes.includes('initial')) {
      const initialDataResult = getAppInitialData();
      if (!initialDataResult.success) {
        return /** @type {BatchDataResult} */ (initialDataResult);
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
          result.commandRecognized = authResult.commandRecognized;
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

    // 2. 講座情報が要求されている場合
    if (dataTypes.includes('lessons')) {
      Logger.log('=== getBatchData: lessons要求を処理中 ===');
      const lessonsResult = getLessons();
      Logger.log(
        `=== getBatchData: getLessons結果 - success=${lessonsResult.success}, dataLength=${lessonsResult.data?.length} ===`,
      );
      if (!lessonsResult.success) {
        Logger.log(`=== getBatchData: lessons取得失敗で早期リターン ===`);
        return /** @type {BatchDataResult} */ (
          /** @type {unknown} */ (lessonsResult)
        );
      }
      result.data = {
        ...result.data,
        lessons: /** @type {ScheduleMasterData[]} */ (
          /** @type {unknown} */ (lessonsResult.data)
        ),
      };
      Logger.log(`=== getBatchData: lessonsデータ設定完了 ===`);
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
            myReservations: /** @type {ReservationDataArray[]} */ (
              /** @type {unknown} */ (
                userReservationsResult.data.myReservations
              )
            ),
          };
        }
      }
    }

    // 履歴データは reservations に統合済み（削除済み）

    Logger.log(`getBatchData完了: dataTypes=${dataTypes.length}件`);
    return result;
  } catch (e) {
    Logger.log(`getBatchDataでエラー: ${e.message}\nStack: ${e.stack}`);
    const errorResult = createApiErrorResponse(
      `バッチデータ取得中にエラー: ${e.message}`,
      true,
    );
    return /** @type {BatchDataResult} */ (errorResult);
  }
}

/**
 * 統一APIレスポンス形式のエラーハンドラ
 * @param {string} message - エラーメッセージ
 * @param {boolean} [log=false] - Loggerにエラーを記録するか
 * @returns {ApiResponseGeneric} 統一されたエラーレスポンス
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
 * @param {ScheduleInfoParams} params - {date: string, classroom: string}
 * @returns {ApiResponseGeneric} APIレスポンス（日程マスタ情報）
 */
function getScheduleInfo(params) {
  try {
    Logger.log(`🔍 getScheduleInfo API: 呼び出し開始`);
    Logger.log(`🔍 getScheduleInfo API: params =`, params);

    const { date, classroom } = params;

    if (!date || !classroom) {
      Logger.log(
        `❌ getScheduleInfo API: パラメータ不足 date=${date}, classroom=${classroom}`,
      );
      return createApiErrorResponse('日付と教室が必要です');
    }

    Logger.log(
      `🔍 getScheduleInfo API: getScheduleInfoForDate呼び出し date=${date}, classroom=${classroom}`,
    );
    const scheduleInfo = getScheduleInfoForDate(date, classroom);
    Logger.log(
      `🔍 getScheduleInfo API: getScheduleInfoForDate結果 =`,
      scheduleInfo,
    );

    if (!scheduleInfo) {
      Logger.log(`❌ getScheduleInfo API: 日程情報が見つかりません`);
      return createApiErrorResponse('該当する日程情報が見つかりません');
    }

    Logger.log(`✅ getScheduleInfo API: 成功`);
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
