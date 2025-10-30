/**
 * =================================================================
 * 【ファイル名】  : 09_Backend_Endpoints.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : フロントエンドから呼び出される統合 API を公開し、認証・ルーティング・レスポンス整形を担う。
 *
 * 【主な責務】
 *   - ログイン／予約操作／会計処理など、WebApp の主要エンドポイントを提供
 *   - 各業務モジュール（Write・AvailableSlots など）を呼び出し、結果を `ApiResponse` 形式で返却
 *   - バッチデータ取得 (`getBatchData`) でダッシュボード初期表示用のデータをまとめて返す
 *
 * 【関連モジュール】
 *   - `04_Backend_User.js`: 認証系関数
 *   - `05-2_Backend_Write.js`, `05-3_Backend_AvailableSlots.js`: 予約・空き枠の実処理
 *   - `08_ErrorHandler.js`: エラー発生時のレスポンス生成
 *
 * 【利用時の留意点】
 *   - 新しいエンドポイントを追加する場合は、返却フォーマットを `ApiResponseGeneric` で統一する
 *   - 認証が必要な関数は早期に `authenticateUser` を呼び、権限チェックを明示する
 *   - 実行時間の長い処理は `getBatchData` など既存の仕組みを再利用し、不要なシートアクセスを避ける
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import {
  authenticateUser,
  registerNewUser,
  isAdminUser,
} from './04_Backend_User.js';
import {
  getCachedStudentById,
  getCachedReservationsAsObjects,
} from './08_Utilities.js';
import {
  makeReservation,
  cancelReservation,
  updateReservationDetails,
  saveAccountingDetails,
  updateAccountingDetails,
  getScheduleInfoForDate,
  confirmWaitlistedReservation,
} from './05-2_Backend_Write.js';
import {
  getLessons,
  getUserReservations,
} from './05-3_Backend_AvailableSlots.js';
import { CACHE_KEYS, getTypedCachedData } from './07_CacheManager.js';
import { BackendErrorHandler, createApiResponse } from './08_ErrorHandler.js';
import { SS_MANAGER } from './00_SpreadsheetManager.js';

/**
 * 予約操作後に最新データを取得して返す汎用関数
 * @param {Function} operationFunction - 実行する操作関数 (makeReservation, cancelReservationなど)
 * @param {ReservationCore|AccountingDetailsCore|any} operationParams - 操作関数に渡すパラメータ (Core型)
 * @param {string} studentId - 対象生徒のID
 * @param {string} successMessage - 操作成功時のメッセージ
 * @returns {ApiResponseGeneric} 操作結果と最新データを含むAPIレスポンス
 */
export function executeOperationAndGetLatestData(
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
 * @param {ReservationCore} reservationInfo - 予約情報。`reservationId`と`status`はバックエンドで生成するため未設定でOK。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function makeReservationAndGetLatestData(reservationInfo) {
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
 * @param {ReservationCore} cancelInfo - キャンセル情報（reservationId, studentId, cancelMessageを含む）
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function cancelReservationAndGetLatestData(cancelInfo) {
  return executeOperationAndGetLatestData(
    cancelReservation,
    cancelInfo,
    cancelInfo.studentId,
    '予約をキャンセルしました。',
  );
}

/**
 * 予約詳細を更新し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} details - 更新する予約詳細。`reservationId`と更新したいフィールドのみを持つ。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateReservationDetailsAndGetLatestData(details) {
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
export function updateReservationMemoAndGetLatestData(
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
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新された予約オブジェクト。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function saveAccountingDetailsAndGetLatestData(
  reservationWithAccounting,
) {
  return executeOperationAndGetLatestData(
    saveAccountingDetails,
    reservationWithAccounting,
    reservationWithAccounting.studentId,
    '会計処理が完了しました。',
  );
}

/**
 * 会計修正を実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationWithAccounting - 修正後の会計情報を含む予約オブジェクト。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateAccountingDetailsAndGetLatestData(
  reservationWithAccounting,
) {
  return executeOperationAndGetLatestData(
    updateAccountingDetails,
    reservationWithAccounting,
    reservationWithAccounting.studentId,
    '会計情報を修正しました。',
  );
}

/**
 * 統合ログインエンドポイント：認証 + 初期データ + 個人データを一括取得
 *
 * @param {string} phone - 電話番号（ユーザー認証用）
 * @returns {AuthenticationResponse | ApiErrorResponse} 認証結果、初期データ、個人データを含む結果
 */
export function getLoginData(phone) {
  try {
    Logger.log(`getLoginData統合処理開始: phone=${phone}`);

    // 1. 軽量認証実行
    const authResult = authenticateUser(phone);

    if (authResult.success && authResult.user) {
      Logger.log(`認証成功: userId=${authResult.user.studentId}`);

      // 2. 認証成功時：一括データ取得
      const batchResult = getBatchData(
        ['accounting', 'lessons', 'reservations'],
        null,
        authResult.user.studentId,
      );

      if (!batchResult.success) {
        Logger.log('バッチデータ取得失敗');
        // データ取得失敗でも認証は成功しているため、空のデータで返す
        /** @type {AuthenticationResponse} */
        const fallbackResponse = {
          success: true,
          userFound: true,
          user: authResult.user,
          data: {
            accountingMaster: [],
            cacheVersions: /** @type {Record<string, unknown>} */ ({}),
            lessons: [],
            myReservations: [],
          },
        };
        return fallbackResponse;
      }

      // 3. レスポンス統合
      /** @type {AuthenticationResponse} */
      const result = {
        success: true,
        userFound: true,
        user: authResult.user,
        data: {
          accountingMaster: batchResult.data['accounting'] || [],
          cacheVersions: /** @type {Record<string, unknown>} */ (
            batchResult.data['cache-versions'] || {}
          ),
          lessons: batchResult.data['lessons'] || [],
          myReservations: batchResult.data['myReservations'] || [],
        },
      };

      Logger.log(`getLoginData統合処理完了: データ一括取得成功`);
      return result;
    } else {
      // 4. 認証失敗時：ユーザー未登録
      Logger.log(`認証失敗: ${authResult.message || 'Unknown error'}`);
      /** @type {AuthenticationResponse} */
      const notFoundResponse = {
        success: true,
        userFound: false,
        user: null,
        data: {
          accountingMaster: [],
          cacheVersions: /** @type {Record<string, unknown>} */ ({}),
          lessons: [],
          myReservations: [],
        },
        ...(authResult.message && { message: authResult.message }),
      };
      return notFoundResponse;
    }
  } catch (e) {
    Logger.log(`getLoginData統合処理エラー: ${e.message}\nStack: ${e.stack}`);
    return /** @type {ApiErrorResponse} */ (
      createApiErrorResponse(`統合ログイン処理中にエラー: ${e.message}`, true)
    );
  }
}

/**
 * 統合新規登録エンドポイント：ユーザー登録 + 初期データを一括取得
 *
 * @param {UserCore} userData - 登録するユーザー情報
 * @returns {AuthenticationResponse | ApiErrorResponse} 登録結果、初期データを含む結果
 */
export function getRegistrationData(userData) {
  try {
    Logger.log(`getRegistrationData統合処理開始`);

    // 1. ユーザー登録実行
    const registrationResult = registerNewUser(userData);

    if (!registrationResult.success) {
      Logger.log(
        `新規登録失敗: ${registrationResult.message || 'Unknown error'}`,
      );
      return /** @type {ApiErrorResponse} */ (registrationResult);
    }

    // 成功時は UserRegistrationResult として扱う
    const registeredUser = registrationResult.user;
    const studentId = registrationResult.studentId;

    Logger.log(`登録成功: userId=${studentId}`);

    // 2. 登録成功時：一括データ取得
    const batchResult = getBatchData(
      ['accounting', 'lessons', 'reservations'],
      null,
      studentId,
    );

    if (!batchResult.success) {
      Logger.log('バッチデータ取得失敗');
      // データ取得失敗でも登録自体は成功しているため、空のデータで返す
      /** @type {AuthenticationResponse} */
      const fallbackResponse = {
        success: true,
        userFound: true,
        user: registeredUser,
        data: {
          accountingMaster: [],
          cacheVersions: /** @type {Record<string, unknown>} */ ({}),
          lessons: [],
          myReservations: [],
        },
      };
      return fallbackResponse;
    }

    // 3. レスポンス統合
    /** @type {AuthenticationResponse} */
    const result = {
      success: true,
      userFound: true,
      user: registeredUser,
      data: {
        accountingMaster: batchResult.data['accounting'] || [],
        cacheVersions: /** @type {Record<string, unknown>} */ (
          batchResult.data['cache-versions'] || {}
        ),
        lessons: batchResult.data['lessons'] || [],
        myReservations: batchResult.data['myReservations'] || [],
      },
    };

    Logger.log(`getRegistrationData統合処理完了: データ一括取得成功`);
    return result;
  } catch (e) {
    Logger.log(
      `getRegistrationData統合処理エラー: ${e.message}\nStack: ${e.stack}`,
    );
    return /** @type {ApiErrorResponse} */ (
      createApiErrorResponse(`統合登録処理中にエラー: ${e.message}`, true)
    );
  }
}

/**
 *軽量なキャッシュバージョンチェック用API
 * 空き枠データの更新有無を高速で判定
 * @returns {ApiResponseGeneric} - { success: boolean, versions: object }
 */
export function getCacheVersions() {
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
export function getBatchData(dataTypes = [], phone = null, studentId = null) {
  try {
    Logger.log(
      `getBatchData開始: dataTypes=${JSON.stringify(dataTypes)}, phone=${phone}, studentId=${studentId}`,
    );

    /** @type {BatchDataResult} */
    const result = {
      success: true,
      data: /** @type {BatchDataPayload} */ ({}),
      userFound: false,
      user: /** @type {StudentData | null} */ (null),
    };

    // 1. 会計マスターデータが要求されている場合
    if (dataTypes.includes('accounting')) {
      const accountingMaster = getTypedCachedData(
        CACHE_KEYS.MASTER_ACCOUNTING_DATA,
      );
      if (accountingMaster && accountingMaster.items) {
        result.data = {
          ...result.data,
          accounting: accountingMaster.items,
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
        if (userReservationsResult.success && userReservationsResult.data) {
          const reservationsPayload =
            'myReservations' in userReservationsResult.data &&
            Array.isArray(userReservationsResult.data.myReservations)
              ? userReservationsResult.data.myReservations
              : [];
          result.data = {
            ...result.data,
            myReservations: reservationsPayload,
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
export function createApiErrorResponse(message, log = false) {
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
export function getScheduleInfo(params) {
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
 * @param {string} reservationId - 予約ID
 * @returns {ApiResponseGeneric<AccountingDetails>} 会計詳細データ
 */
export function getAccountingDetailsFromSheet(reservationId) {
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
      /** @param {string|number|Date} header */
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
      /** @param {string|number|Date} header */
      header => header === CONSTANTS.HEADERS.RESERVATIONS.RESERVATION_ID,
    );

    if (reservationIdColumnIndex === -1) {
      Logger.log(`❌ 予約ID列が見つかりません`);
      return createApiErrorResponse('予約ID列が見つかりません');
    }

    // 該当する予約を検索
    const targetRow = data.find(
      /** @param {(string|number|Date)[]} row */
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
        BackendErrorHandler.handle(
          e,
          'getAccountingDetailsFromSheet.jsonParse',
        );
      }
    }

    Logger.log(`📋 会計詳細取得成功:`, accountingDetails);

    Logger.log(`✅ getAccountingDetailsFromSheet API: 成功`);
    return /** @type {ApiResponseGeneric<AccountingDetails>} */ (
      createApiResponse(true, {
        accountingDetails: accountingDetails,
        message: '会計記録を取得しました',
      })
    );
  } catch (error) {
    Logger.log(`getAccountingDetailsFromSheet API エラー: ${error.message}`);
    return /** @type {ApiResponseGeneric<AccountingDetails>} */ (
      BackendErrorHandler.handle(error, 'getAccountingDetailsFromSheet')
    );
  }
}

/**
 * 空席連絡希望の予約を確定予約に変更し、最新データを返却します。
 * @param {{reservationId: string, studentId: string}} confirmInfo - 確定情報
 * @returns {ApiResponseGeneric} 処理結果と最新データ
 */
export function confirmWaitlistedReservationAndGetLatestData(confirmInfo) {
  return executeOperationAndGetLatestData(
    confirmWaitlistedReservation,
    confirmInfo,
    confirmInfo.studentId,
    '予約が確定しました。',
  );
}

// ================================================================
// 参加者リスト機能用のAPIエンドポイント
// ================================================================

/**
 * 参加者リスト表示用のレッスン一覧を取得する
 * - キャッシュから6ヶ月前〜1年後のレッスン情報を取得
 * - 管理者・一般生徒を問わず、同じデータを返す（レッスン情報は公開情報）
 *
 * @param {string} studentId - リクエストしている生徒のID（将来の権限チェック用に予約）
 * @param {boolean} [includeHistory=true] - 過去のレッスンを含めるか（デフォルト: true）
 * @returns {ApiResponseGeneric} レッスン一覧
 */
export function getLessonsForParticipantsView(
  studentId,
  includeHistory = true,
) {
  try {
    Logger.log(
      `getLessonsForParticipantsView開始: studentId=${studentId}, includeHistory=${includeHistory}`,
    );

    // studentIdの検証
    if (!studentId) {
      return createApiErrorResponse('生徒IDが必要です');
    }

    // キャッシュからレッスン情報を取得（6ヶ月前〜1年後のデータ）
    const scheduleMasterCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
    );

    if (!scheduleMasterCache || !Array.isArray(scheduleMasterCache.schedule)) {
      Logger.log('スケジュールマスターキャッシュが見つかりません');
      return createApiErrorResponse(
        'レッスン情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 今日の0時0分0秒に設定

    // レッスン一覧をフィルタリング（内部フィールド付き）
    let lessonsWithDate = scheduleMasterCache.schedule.map(lesson => {
      const lessonDate = new Date(lesson.date);
      lessonDate.setHours(0, 0, 0, 0);

      return {
        lessonId: lesson.lessonId,
        classroom: lesson.classroom,
        date: lesson.date,
        venue: lesson.venue || '',
        status: lessonDate >= today ? '開催予定' : '開催済み',
        // ソート用の内部フィールド
        _dateObj: lessonDate,
      };
    });

    // 過去データを除外する場合
    if (!includeHistory) {
      lessonsWithDate = lessonsWithDate.filter(
        lesson => lesson._dateObj >= today,
      );
    }

    // 日付順にソート（新しい順）
    lessonsWithDate.sort((a, b) => b._dateObj.getTime() - a._dateObj.getTime());

    // 内部フィールドを削除して最終形にする
    const lessons = lessonsWithDate.map(lesson => {
      const { _dateObj, ...rest } = lesson;
      return rest;
    });

    Logger.log(`getLessonsForParticipantsView完了: ${lessons.length}件`);

    return createApiResponse(true, {
      lessons: lessons,
      message: 'レッスン一覧を取得しました',
    });
  } catch (error) {
    Logger.log(
      `getLessonsForParticipantsView エラー: ${error.message}\nStack: ${error.stack}`,
    );
    return createApiErrorResponse(
      `レッスン一覧の取得中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * 特定レッスンの予約情報リストを取得する（権限に応じてフィルタリング）
 * - 管理者: 全項目を返す（本名、電話番号、メールアドレスなど）
 * - 一般生徒: 公開情報のみ（本名、電話番号、メールアドレスを除外）
 *
 * @param {string} lessonId - レッスンID
 * @param {string} studentId - リクエストしている生徒のID
 * @returns {ApiResponseGeneric} 予約情報リスト
 */
export function getReservationsForLesson(lessonId, studentId) {
  try {
    Logger.log(
      `getReservationsForLesson開始: lessonId=${lessonId}, studentId=${studentId}`,
    );

    // パラメータ検証
    if (!lessonId || !studentId) {
      return createApiErrorResponse('レッスンIDと生徒IDが必要です');
    }

    // 管理者権限チェック
    const isAdmin = isAdminUser(studentId);
    Logger.log(`管理者権限: ${isAdmin}`);

    // キャッシュから予約情報を取得（ReservationCore[]として取得）
    const allReservations = getCachedReservationsAsObjects();

    if (!allReservations || allReservations.length === 0) {
      Logger.log('予約データが見つかりません');
      return createApiErrorResponse(
        '予約情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }

    // キャッシュからレッスン情報を取得（教室・会場情報を結合するため）
    const scheduleMasterCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
    );

    if (!scheduleMasterCache || !Array.isArray(scheduleMasterCache.schedule)) {
      Logger.log('スケジュールマスターキャッシュが見つかりません');
      return createApiErrorResponse(
        'レッスン情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }

    // 該当レッスンを検索
    const targetLesson = scheduleMasterCache.schedule.find(
      lesson => lesson.lessonId === lessonId,
    );

    if (!targetLesson) {
      return createApiErrorResponse('指定されたレッスンが見つかりません');
    }

    // 該当レッスンの予約をフィルタリング
    const lessonReservations = allReservations.filter(
      reservation => reservation.lessonId === lessonId,
    );

    Logger.log(`該当レッスンの予約: ${lessonReservations.length}件`);

    // 予約情報に生徒情報を結合し、権限に応じてフィルタリング
    const reservationsWithUserInfo = lessonReservations.map(reservation => {
      // 生徒情報を取得
      const student = getCachedStudentById(reservation.studentId);

      // 基本情報（全員に公開）
      const baseInfo = {
        reservationId: reservation.reservationId,
        date: reservation.date || targetLesson.date,
        classroom: targetLesson.classroom,
        venue: targetLesson.venue || '',
        startTime: reservation.startTime || '',
        endTime: reservation.endTime || '',
        status: reservation.status,
        studentId: reservation.studentId,
        nickname: student?.nickname || '',
        displayName: student?.displayName || '',
        firstLecture: reservation.firstLecture || false,
        chiselRental: reservation.chiselRental || false,
        workInProgress: reservation.workInProgress || '',
        order: reservation.order || '',
      };

      // 管理者の場合は個人情報を追加
      if (isAdmin) {
        return {
          ...baseInfo,
          realName: student?.realName || '',
          phone: student?.phone || '',
          email: student?.email || '',
        };
      }

      // 一般生徒の場合は公開情報のみ
      return baseInfo;
    });

    Logger.log(
      `getReservationsForLesson完了: ${reservationsWithUserInfo.length}件`,
    );

    return createApiResponse(true, {
      reservations: reservationsWithUserInfo,
      lesson: {
        lessonId: targetLesson.lessonId,
        classroom: targetLesson.classroom,
        date: targetLesson.date,
        venue: targetLesson.venue || '',
      },
      message: '予約情報を取得しました',
    });
  } catch (error) {
    Logger.log(
      `getReservationsForLesson エラー: ${error.message}\nStack: ${error.stack}`,
    );
    return createApiErrorResponse(
      `予約情報の取得中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * 特定生徒の詳細情報と予約履歴を取得する（権限に応じてフィルタリング）
 * - 管理者: 全項目を返す
 * - 一般生徒（本人）: 自分の情報のみ閲覧可能
 * - 一般生徒（他人）: 公開情報のみ（ニックネーム、参加回数など）
 *
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} requestingStudentId - リクエストしている生徒のID
 * @returns {ApiResponseGeneric} 生徒詳細情報と予約履歴
 */
export function getStudentDetailsForParticipantsView(
  targetStudentId,
  requestingStudentId,
) {
  try {
    Logger.log(
      `getStudentDetailsForParticipantsView開始: targetStudentId=${targetStudentId}, requestingStudentId=${requestingStudentId}`,
    );

    // パラメータ検証
    if (!targetStudentId || !requestingStudentId) {
      return createApiErrorResponse('生徒IDが必要です');
    }

    // 権限チェック
    const isAdmin = isAdminUser(requestingStudentId);
    const isSelf = targetStudentId === requestingStudentId;
    Logger.log(`管理者権限: ${isAdmin}, 本人: ${isSelf}`);

    // 生徒情報を取得
    const targetStudent = getCachedStudentById(targetStudentId);

    if (!targetStudent) {
      return createApiErrorResponse('指定された生徒が見つかりません');
    }

    // 予約履歴を取得（ReservationCore[]として取得）
    const allReservations = getCachedReservationsAsObjects();

    if (!allReservations || allReservations.length === 0) {
      Logger.log('予約データが見つかりません');
      return createApiErrorResponse(
        '予約情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }

    // レッスン情報も取得（予約履歴に教室・会場情報を結合するため）
    const scheduleMasterCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
    );

    if (!scheduleMasterCache || !Array.isArray(scheduleMasterCache.schedule)) {
      Logger.log('スケジュールマスターキャッシュが見つかりません');
      return createApiErrorResponse(
        'レッスン情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }

    // 該当生徒の予約履歴をフィルタリング
    const studentReservations = allReservations.filter(
      reservation => reservation.studentId === targetStudentId,
    );

    // 予約履歴にレッスン情報を結合
    const reservationHistory = studentReservations
      .map(reservation => {
        const lesson = scheduleMasterCache.schedule.find(
          l => l.lessonId === reservation.lessonId,
        );

        return {
          date: reservation.date || lesson?.date || '',
          classroom: lesson?.classroom || '',
          venue: lesson?.venue || '',
          startTime: reservation.startTime || '',
          endTime: reservation.endTime || '',
          status: reservation.status,
          workInProgress: reservation.workInProgress || '',
          // ソート用の内部フィールド
          _dateObj: new Date(reservation.date || lesson?.date || ''),
        };
      })
      .sort((a, b) => b._dateObj.getTime() - a._dateObj.getTime()) // 新しい順
      .map(item => {
        const { _dateObj, ...rest } = item;
        return rest;
      }); // 内部フィールドを削除

    // 参加回数を計算（完了・会計待ち・会計済みのみカウント）
    const participationCount = studentReservations.filter(r =>
      ['完了', '会計待ち', '会計済み'].includes(r.status),
    ).length;

    // 基本情報（公開）
    const publicInfo = {
      studentId: targetStudent.studentId,
      nickname: targetStudent.nickname || '',
      displayName: targetStudent.displayName || '',
      participationCount: participationCount,
      futureCreations: targetStudent.futureCreations || '',
      reservationHistory: reservationHistory,
    };

    // 管理者または本人の場合は詳細情報を追加
    if (isAdmin || isSelf) {
      const detailedInfo = {
        ...publicInfo,
        realName: targetStudent.realName || '',
        phone: targetStudent.phone || '',
        email: targetStudent.email || '',
        wantsEmail: targetStudent.wantsEmail || false,
        wantsScheduleNotification:
          targetStudent.wantsScheduleNotification || false,
        notificationDay: targetStudent.notificationDay || 0,
        notificationHour: targetStudent.notificationHour || 0,
        ageGroup: targetStudent.ageGroup || '',
        gender: targetStudent.gender || '',
        dominantHand: targetStudent.dominantHand || '',
        address: targetStudent.address || '',
        experience: targetStudent.experience || '',
        pastWork: targetStudent.pastWork || '',
        futureParticipation: targetStudent.futureParticipation || '',
        trigger: targetStudent.trigger || '',
        firstMessage: targetStudent.firstMessage || '',
        companion: targetStudent['companion'] || '',
        transportation: targetStudent['transportation'] || '',
        pickupDropoff: targetStudent['pickupDropoff'] || '',
        notes: targetStudent['notes'] || '',
      };

      Logger.log(
        `getStudentDetailsForParticipantsView完了: 詳細情報（管理者/本人）`,
      );

      return createApiResponse(true, {
        student: detailedInfo,
        isAdmin: isAdmin,
        isSelf: isSelf,
        message: '生徒詳細情報を取得しました',
      });
    }

    // 一般生徒（他人）の場合は公開情報のみ
    Logger.log(`getStudentDetailsForParticipantsView完了: 公開情報のみ`);

    return createApiResponse(true, {
      student: publicInfo,
      isAdmin: false,
      isSelf: false,
      message: '生徒詳細情報を取得しました',
    });
  } catch (error) {
    Logger.log(
      `getStudentDetailsForParticipantsView エラー: ${error.message}\nStack: ${error.stack}`,
    );
    return createApiErrorResponse(
      `生徒詳細情報の取得中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}
