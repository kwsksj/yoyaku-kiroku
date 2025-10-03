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
 * @param {Function} operationFunction - 実行する操作関数
 * @param {ReservationInfo|CancelInfo|ReservationDetails|any} operationParams - 操作関数に渡すパラメータ
 * @param {string} studentId - 対象生徒のID
 * @param {string} successMessage - 操作成功時のメッセージ
 * @returns {ApiResponseGeneric} 操作結果と最新データを含むAPIレスポンス
 */
function executeOperationAndGetLatestData(
  operationFunction,
  operationParams,
  studentId,
  successMessage,
) {
  try {
    const result = operationFunction(operationParams);
    if (!result.success) {
      return result;
    }

    // 予約操作後の更新されたデータを取得（lessonsも含める）
    const batchResult = getBatchData(
      ['reservations', 'lessons'],
      null,
      studentId,
    );
    if (!batchResult.success) {
      return batchResult;
    }

    return createApiResponse(true, {
      message: result.message || successMessage,
      data: {
        myReservations: batchResult.data.myReservations || [],
        lessons: batchResult.data.lessons || [],
      },
    });
  } catch (e) {
    Logger.log(`executeOperationAndGetLatestData でエラー: ${e.message}`);
    return createApiErrorResponse('操作処理でエラーが発生しました。', true);
  }
}

/**
 * 予約を実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationInfo} reservationInfo - 予約情報
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
function makeReservationAndGetLatestData(reservationInfo) {
  const isFirstTime = reservationInfo['firstLecture'] || false;

  const result = executeOperationAndGetLatestData(
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
    updateReservationDetails,
    details,
    details.studentId,
    '予約内容を更新しました。',
  );
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
 * 統合ログインエンドポイント：認証 + 初期データ + 個人データを一括取得
 * @param {string} phone - 電話番号（ユーザー認証用）
 * @returns {ApiResponseGeneric} 認証結果、初期データ、個人データを含む結果
 */
function getLoginData(phone) {
  try {
    Logger.log(`getLoginData統合処理開始: phone=${phone}`);

    // 1. 軽量認証実行
    const authResult = authenticateUser(phone);

    if (/** @type {any} */ (authResult).success) {
      Logger.log(
        `認証成功: userId=${/** @type {any} */ (authResult).user.studentId}`,
      );

      // 2. 認証成功時：一括データ取得
      const batchResult = getBatchData(
        ['accounting', 'lessons', 'reservations'],
        null,
        /** @type {any} */ (authResult).user.studentId,
      );

      if (!batchResult.success) {
        Logger.log('バッチデータ取得失敗');
        return batchResult;
      }

      // 3. レスポンス統合
      const result = {
        success: true,
        userFound: true,
        user: /** @type {any} */ (authResult).user,
        data: {
          accountingMaster: batchResult.data['accounting'] || [],
          cacheVersions: batchResult.data['cache-versions'] || {},
          lessons: batchResult.data['lessons'] || [],
          myReservations: batchResult.data['myReservations'] || [],
        },
      };

      Logger.log(`getLoginData統合処理完了: データ一括取得成功`);
      return result;
    } else {
      // 4. 認証失敗時：ユーザー未登録
      Logger.log(`認証失敗: ${/** @type {any} */ (authResult).message}`);
      return /** @type {any} */ ({
        success: true,
        userFound: false,
        message: /** @type {any} */ (authResult).message,
        registrationPhone: phone,
      });
    }
  } catch (e) {
    Logger.log(`getLoginData統合処理エラー: ${e.message}\nStack: ${e.stack}`);
    return createApiErrorResponse(
      `統合ログイン処理中にエラー: ${e.message}`,
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
 * @param {string[]} dataTypes - 取得するデータタイプの配列 ['accounting', 'lessons', 'reservations']
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

    // 1. 会計マスターデータが要求されている場合
    if (dataTypes.includes('accounting')) {
      const accountingMaster = getCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA);
      if (accountingMaster && accountingMaster['items']) {
        result.data = {
          ...result.data,
          accounting: accountingMaster['items'],
        };
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

// getPersonalReservationsData関数は削除しました
// 代わりに、既存のgetBatchData(['lessons', 'reservations'], null, studentId)を使用してください

/**
 * 指定した予約の会計詳細データを予約シートから取得する
 * @param {ReservationId} reservationId - 予約ID
 * @returns {ApiResponse} 会計詳細データを含むレスポンス
 */
function getAccountingDetailsFromSheet(reservationId) {
  try {
    Logger.log(
      `🔍 getAccountingDetailsFromSheet API: 開始 reservationId=${reservationId}`,
    );

    if (!reservationId) {
      return createApiErrorResponse('必要なパラメータが不足しています');
    }

    // 予約シートを取得
    const sheetName = CONSTANTS.SHEET_NAMES.RESERVATIONS;
    const sheet = SS_MANAGER.getSheet(sheetName);

    if (!sheet) {
      Logger.log(`❌ シートが見つかりません: ${sheetName}`);
      return createApiErrorResponse(`シート「${sheetName}」が見つかりません`);
    }

    // ヘッダー行を取得して"会計詳細"列のインデックスを特定
    const headerRow = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const accountingDetailsColumnIndex = headerRow.findIndex(
      header => header === CONSTANTS.HEADERS.RESERVATIONS.ACCOUNTING_DETAILS,
    );

    if (accountingDetailsColumnIndex === -1) {
      Logger.log(`❌ 会計詳細列が見つかりません`);
      return createApiErrorResponse('会計詳細列が見つかりません');
    }

    // 予約IDで該当行を検索
    const dataRange = sheet.getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      sheet.getLastColumn(),
    );
    const data = dataRange.getValues();

    // 予約ID列のインデックスを取得
    const reservationIdColumnIndex = headerRow.findIndex(
      header => header === CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );

    if (reservationIdColumnIndex === -1) {
      Logger.log(`❌ 予約ID列が見つかりません`);
      return createApiErrorResponse('予約ID列が見つかりません');
    }

    // 該当する予約を検索
    const targetRow = data.find(
      row => row[reservationIdColumnIndex] === reservationId,
    );

    if (!targetRow) {
      Logger.log(`❌ 予約が見つかりません: ${reservationId}`);
      return createApiErrorResponse('指定された予約が見つかりません');
    }

    // 会計詳細データを取得
    let accountingDetails = targetRow[accountingDetailsColumnIndex] || '';

    // JSON文字列の場合はパース
    if (
      typeof accountingDetails === 'string' &&
      accountingDetails.trim().startsWith('{')
    ) {
      try {
        accountingDetails = JSON.parse(accountingDetails);
      } catch (e) {
        // パースに失敗した場合は文字列のまま
      }
    }

    Logger.log(`📋 会計詳細取得成功:`, accountingDetails);

    Logger.log(`✅ getAccountingDetailsFromSheet API: 成功`);
    return createApiResponse(true, {
      accountingDetails: accountingDetails,
      message: '会計記録を取得しました',
    });
  } catch (error) {
    Logger.log(`getAccountingDetailsFromSheet API エラー: ${error.message}`);
    return BackendErrorHandler.handle(error, 'getAccountingDetailsFromSheet');
  }
}

/**
 * 空席連絡希望の予約を確定予約に変更し、最新データを返却します。
 * @param {{reservationId: string, studentId: string}} confirmInfo - 確定情報
 * @returns {ApiResponseGeneric} 処理結果と最新データ
 */
function confirmWaitlistedReservationAndGetLatestData(confirmInfo) {
  return executeOperationAndGetLatestData(
    confirmWaitlistedReservation,
    confirmInfo,
    confirmInfo.studentId,
    '予約が確定しました。',
  );
}
