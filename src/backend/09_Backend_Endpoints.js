/**
 * =================================================================
 * 【ファイル名】  : 09_Backend_Endpoints.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : フロントエンドから呼び出される統合 API を公開し、認証・ルーティング・レスポンス整形を担う。
 *
 * 【主な責務】
 *   - ログイン／よやく操作／会計処理など、WebApp の主要エンドポイントを提供
 *   - 各業務モジュール（Write・AvailableSlots など）を呼び出し、結果を `ApiResponse` 形式で返却
 *   - バッチデータ取得 (`getBatchData`) でダッシュボード初期表示用のデータをまとめて返す
 *
 * 【関連モジュール】
 *   - `04_Backend_User.js`: 認証系関数
 *   - `05-2_Backend_Write.js`, `05-3_Backend_AvailableSlots.js`: よやく・空き枠の実処理
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
import { SS_MANAGER } from './00_SpreadsheetManager.js';
import {
  buildSalesTransferReportByDate,
  transferSalesLogByDate,
} from './02-1_BusinessLogic_Batch.js';
import {
  authenticateUser,
  isAdminLogin,
  issueAdminSessionToken,
  registerNewUser,
  validateAdminSessionToken,
} from './04_Backend_User.js';
import {
  cancelReservation,
  checkIfSalesAlreadyLogged,
  confirmWaitlistedReservation,
  createSalesOnlyReservation,
  getScheduleInfoForDate,
  logSalesForSingleReservation,
  makeReservation,
  saveAccountingDetails,
  updateAccountingDetails,
  updateReservationDetails,
} from './05-2_Backend_Write.js';
import {
  getLessons,
  getUserReservations,
} from './05-3_Backend_AvailableSlots.js';
import { getRecentLogs } from './05-4_Backend_Log.js';
import {
  CACHE_KEYS,
  clearChunkedCache,
  findHeaderIndexByCandidates,
  getStudentCacheSnapshot,
  getTypedCachedData,
  markScheduleStatusCompletedByDate,
} from './07_CacheManager.js';
import { BackendErrorHandler, createApiResponse } from './08_ErrorHandler.js';
import {
  getCachedReservationsAsObjects,
  getCachedStudentById,
  logActivity,
  updateStudentField,
  withTransaction,
} from './08_Utilities.js';

/**
 * @typedef {import('../../types/core/reservation').ReservationCoreWithAccounting} ReservationCoreWithAccounting
 */
const ADMIN_LOG_INITIAL_DAYS = CONSTANTS.UI.ADMIN_LOG_INITIAL_DAYS;
const PARTICIPANT_INITIAL_PAST_MONTHS =
  CONSTANTS.UI.PARTICIPANT_INITIAL_PAST_MONTHS;

/**
 * よやく操作後に最新データを取得して返す汎用関数
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

    // よやく操作後の更新されたデータを取得（lessonsも含める）
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
 * よやくを実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationInfo - よやく情報。`reservationId`と`status`はバックエンドで生成するため未設定でOK。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function makeReservationAndGetLatestData(reservationInfo) {
  const isFirstTime = reservationInfo['firstLecture'] || false;
  const nextLessonGoal = /** @type {any} */ (reservationInfo)['nextLessonGoal'];

  const result = executeOperationAndGetLatestData(
    makeReservation,
    reservationInfo,
    reservationInfo.studentId,
    'よやくを作成しました。',
  );

  // 初回フラグ情報を追加
  if (result.success && result.data) {
    result.data.wasFirstTimeBooking = isFirstTime;

    // nextLessonGoalが提供されている場合は生徒名簿を更新
    if (nextLessonGoal !== undefined) {
      try {
        updateNextLessonGoal({
          studentId: reservationInfo.studentId,
          nextLessonGoal: nextLessonGoal,
        });
      } catch (e) {
        Logger.log(`[makeReservation] nextLessonGoal更新エラー: ${e.message}`);
      }
    }
  }

  return result;
}

/**
 * よやくをキャンセルし、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} cancelInfo - キャンセル情報（reservationId, studentId, cancelMessageを含む）
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function cancelReservationAndGetLatestData(cancelInfo) {
  return executeOperationAndGetLatestData(
    cancelReservation,
    cancelInfo,
    cancelInfo.studentId,
    'よやくをキャンセルしました。',
  );
}

/**
 * よやく詳細を更新し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore & {nextLessonGoal?: string}} details - 更新するよやく詳細。`reservationId`と更新したいフィールドのみを持つ。
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function updateReservationDetailsAndGetLatestData(details) {
  const nextLessonGoal = /** @type {any} */ (details)['nextLessonGoal'];

  const result = executeOperationAndGetLatestData(
    updateReservationDetails,
    details,
    details.studentId,
    'よやく内容を更新しました。',
  );

  // nextLessonGoalが提供されている場合は生徒名簿を更新
  if (result.success && nextLessonGoal !== undefined) {
    try {
      updateNextLessonGoal({
        studentId: details.studentId,
        nextLessonGoal: nextLessonGoal,
      });
    } catch (e) {
      Logger.log(
        `[updateReservationDetails] nextLessonGoal更新エラー: ${e.message}`,
      );
    }
  }

  return result;
}

/**
 * よやくの参加日を変更し、成功した場合に最新の全初期化データを返す。
 * 内部的には新規よやく作成と旧よやくキャンセルを実行します。
 * @param {ReservationCore} newReservationData - 新しいよやくデータ
 * @param {string} originalReservationId - キャンセルする元の予約ID
 * @returns {ApiResponseGeneric} 処理結果と最新の初期化データ
 */
export function changeReservationDateAndGetLatestData(
  newReservationData,
  originalReservationId,
) {
  return withTransaction(() => {
    try {
      // 1. 新しいよやくを作成（先に実行して失敗時は元のよやくを保持）
      // 日程変更フラグを追加してログに「よやく作成（よやく日変更）」と記録
      const reservationDataWithFlag = {
        ...newReservationData,
        _isDateChange: true,
      };
      const bookingResult = makeReservation(reservationDataWithFlag);

      if (!bookingResult.success) {
        throw new Error(
          `新しいよやくの作成に失敗しました: ${bookingResult.message}`,
        );
      }

      // 2. 元のよやくをキャンセル（新規よやく成功後のみ実行）
      // 日程変更フラグを追加してログに「よやくキャンセル（よやく日変更）」と記録
      /** @type {import('../../types/core/reservation').CancelReservationParams} */
      const cancelParams = {
        reservationId: originalReservationId,
        studentId: newReservationData.studentId,
        cancelMessage: 'よやく日変更のため自動キャンセル',
        _isByAdmin: /** @type {any} */ (newReservationData)._isByAdmin || false,
        _adminToken:
          /** @type {any} */ (newReservationData)._adminToken || null,
        _isDateChange: true,
      };
      const cancelResult = cancelReservation(cancelParams);

      if (!cancelResult.success) {
        // キャンセル失敗時、新規よやくを削除して元の状態に戻す
        // 注: 理想的には新規よやくの削除処理を実装すべきだが、
        // 現時点では管理者による手動対応が必要
        throw new Error(
          `元のよやくのキャンセルに失敗しました: ${cancelResult.message}`,
        );
      }

      // 3. 成功時は最新データを返す
      const latestData = getBatchData(
        ['reservations', 'lessons'],
        null,
        newReservationData.studentId,
      );
      return {
        success: true,
        message: 'よやく日を変更しました。',
        data: latestData.data,
      };
    } catch (error) {
      Logger.log(`よやく日変更エラー: ${error.message}`);
      return {
        success: false,
        message: error.message || 'よやく日の変更に失敗しました。',
      };
    }
  });
}

/**
 * よやくのメモを更新し、成功した場合に最新の全初期化データを返す
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
  try {
    // 変更前のよやく情報を取得（ログ記録用）
    const existingReservations = getCachedReservationsAsObjects();
    const existingReservation = existingReservations.find(
      r => r.reservationId === reservationId,
    );
    const oldMemo = existingReservation?.sessionNote || '';

    // 内部関数を呼び出して更新
    const result = executeOperationAndGetLatestData(
      updateReservationDetails,
      {
        reservationId,
        studentId,
        sessionNote: newMemo, // 制作メモのみを更新
        _skipDefaultLog: true, // 汎用ログを抑制（専用ログを使用）
      },
      studentId,
      '制作メモを更新しました。',
    );

    // 専用のログアクションで記録（変更内容を詳細に）
    if (result.success) {
      const truncate = (/** @type {string} */ str, len = 50) =>
        str.length > len ? str.substring(0, len) + '...' : str;

      logActivity(
        studentId,
        CONSTANTS.LOG_ACTIONS.RESERVATION_MEMO_UPDATE,
        CONSTANTS.MESSAGES.SUCCESS,
        {
          reservationId,
          date: existingReservation?.date || '',
          classroom: existingReservation?.classroom || '',
          details: {
            変更前: truncate(oldMemo || '(空白)'),
            変更後: truncate(newMemo || '(空白に変更)'),
          },
        },
      );
    }

    return result;
  } catch (e) {
    Logger.log(`updateReservationMemoAndGetLatestData でエラー: ${e.message}`);
    // エラー時のログ
    logActivity(
      studentId,
      CONSTANTS.LOG_ACTIONS.RESERVATION_MEMO_UPDATE,
      CONSTANTS.MESSAGES.ERROR,
      {
        reservationId,
        details: {
          エラー: e.message,
        },
      },
    );
    return createApiResponse(false, {
      message: '制作メモの更新に失敗しました。',
    });
  }
}

/**
 * 生徒のけいかく・もくひょうを更新する
 * @param {{ studentId: string, nextLessonGoal: string, _isConclusion?: boolean }} payload - 更新内容
 * @returns {ApiResponse} 処理結果
 */
export function updateNextLessonGoal(payload) {
  try {
    const { studentId, nextLessonGoal, _isConclusion } = payload;
    if (!studentId) {
      return { success: false, message: '生徒IDが指定されていません。' };
    }

    // 差分チェック: 現在の値を取得して比較
    const currentStudent = getCachedStudentById(studentId);
    const currentGoal = currentStudent?.nextLessonGoal || '';
    const newGoal = nextLessonGoal || '';

    // 差分がない場合は更新をスキップ
    if (currentGoal === newGoal) {
      Logger.log(
        `[updateNextLessonGoal] 差分なし: studentId=${studentId}, goal="${newGoal}"`,
      );
      return { success: true, message: '変更はありませんでした。' };
    }

    // updateStudentField を使用して生徒名簿を更新
    const result = updateStudentField(
      studentId,
      CONSTANTS.HEADERS.ROSTER.NEXT_LESSON_GOAL,
      newGoal,
    );

    if (!result || !result.success) {
      // 終了フロー用のログアクションを使用
      const logAction = _isConclusion
        ? CONSTANTS.LOG_ACTIONS.USER_GOAL_UPDATE_CONCLUSION
        : CONSTANTS.LOG_ACTIONS.USER_GOAL_UPDATE;
      logActivity(studentId, logAction, '失敗', {
        details: {
          エラー: result?.message || '更新処理に失敗',
        },
      });
      return { success: false, message: '更新に失敗しました。' };
    }

    // キャッシュをクリア（生徒名簿データが更新されたので再取得が必要）
    clearChunkedCache(CACHE_KEYS.ALL_STUDENTS);
    Logger.log(
      `[updateNextLessonGoal] キャッシュクリア: CACHE_KEYS.ALL_STUDENTS`,
    );

    // ログシートに記録 - 終了フロー用のログアクションを使用
    const logAction = _isConclusion
      ? CONSTANTS.LOG_ACTIONS.USER_GOAL_UPDATE_CONCLUSION
      : CONSTANTS.LOG_ACTIONS.USER_GOAL_UPDATE;
    logActivity(studentId, logAction, '成功', {
      details: {
        更新内容: nextLessonGoal || '(空白にクリア)',
      },
    });

    Logger.log(
      `[updateNextLessonGoal] 成功: studentId=${studentId}, goal=${nextLessonGoal}`,
    );
    return { success: true, message: 'けいかく・もくひょうを更新しました。' };
  } catch (error) {
    Logger.log(`[updateNextLessonGoal] エラー: ${error.message}`);
    const logAction = payload?._isConclusion
      ? CONSTANTS.LOG_ACTIONS.USER_GOAL_UPDATE_CONCLUSION
      : CONSTANTS.LOG_ACTIONS.USER_GOAL_UPDATE;
    logActivity(payload?.studentId || 'unknown', logAction, '失敗', {
      details: {
        エラー: error.message,
      },
    });
    return { success: false, message: `更新に失敗しました: ${error.message}` };
  }
}

/**
 * 先生へのメッセージをログに記録する
 * @param {{ studentId: string, message: string }} payload - メッセージ内容
 * @returns {ApiResponse} 処理結果
 */
export function sendMessageToTeacher(payload) {
  try {
    const { studentId, message } = payload;
    if (!studentId) {
      return { success: false, message: '生徒IDが指定されていません。' };
    }
    if (!message || !message.trim()) {
      return { success: false, message: 'メッセージを入力してください。' };
    }

    // ログシートに記録
    logActivity(studentId, CONSTANTS.LOG_ACTIONS.USER_MESSAGE_SENT, '成功', {
      message: message.trim(),
    });

    Logger.log(
      `[sendMessageToTeacher] 成功: studentId=${studentId}, message=${message.substring(0, 50)}...`,
    );
    return { success: true, message: 'メッセージを送信しました。' };
  } catch (error) {
    Logger.log(`[sendMessageToTeacher] エラー: ${error.message}`);
    logActivity(
      payload?.studentId || 'unknown',
      CONSTANTS.LOG_ACTIONS.USER_MESSAGE_SENT,
      '失敗',
      {
        details: {
          エラー: error.message,
        },
      },
    );
    return { success: false, message: `送信に失敗しました: ${error.message}` };
  }
}

/**
 * 会計処理を実行し、成功した場合に最新の全初期化データを返す。
 * @param {ReservationCore} reservationWithAccounting - 会計情報が追加/更新されたよやくオブジェクト。
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
 * @param {ReservationCore} reservationWithAccounting - 修正後の会計情報を含むよやくオブジェクト。
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
 * 販売のみの予約レコードを作成し、最新データを返す
 * @param {{ studentId: string, lessonId: string, classroom: string, _adminToken?: string }} params - 作成パラメータ
 * @returns {ApiResponseGeneric} 処理結果と最新データ
 */
export function createSalesOnlyReservationAndGetLatestData(params) {
  try {
    const result = createSalesOnlyReservation(params);
    if (!result.success) {
      return result;
    }

    // 最新データを取得
    const batchResult = getBatchData(
      ['reservations', 'lessons'],
      null,
      params.studentId,
    );

    return createApiResponse(true, {
      message: result.message || '販売のみの予約レコードを作成しました。',
      reservationId: result.data ? result.data.reservationId : null,
      reservation: result.data ? result.data.reservation : null,
      data: batchResult.success ? batchResult.data : {},
    });
  } catch (e) {
    Logger.log(
      `createSalesOnlyReservationAndGetLatestData でエラー: ${e.message}`,
    );
    return createApiErrorResponse(
      '販売のみ予約の作成でエラーが発生しました。',
      true,
    );
  }
}

/**
 * 統合ログインエンドポイント：認証 + 初期データ + 個人データを一括取得
 *
 * @param {string} phone - 電話番号（ユーザー認証用）
 * @param {boolean} [isDataRefresh=false] - データ再取得フラグ（リロード時はtrue）
 * @param {string} [restorationReason] - 復元理由（データ再取得時のみ）
 * @param {number} [elapsedSeconds] - リロードからの経過時間（秒）
 * @param {string} [restoredView] - 復元されたビュー名
 * @returns {AuthenticationResponse | ApiErrorResponse} 認証結果、初期データ、個人データを含む結果
 */
export function getLoginData(
  phone,
  isDataRefresh = false,
  restorationReason,
  elapsedSeconds,
  restoredView,
) {
  try {
    Logger.log(
      `getLoginData統合処理開始: phone=${phone}, isDataRefresh=${isDataRefresh}, reason=${restorationReason || 'N/A'}, elapsed=${elapsedSeconds || 'N/A'}s, view=${restoredView || 'N/A'}`,
    );

    // 管理者パスワード一致の場合（名簿に存在しない管理者IDを許可）
    if (isAdminLogin(phone)) {
      Logger.log('管理者パスワード一致 - 管理者としてログイン');

      /** @type {UserCore} */
      const adminUser = {
        studentId: 'ADMIN',
        phone: phone,
        realName: '管理者',
        displayName: '管理者',
        isAdmin: true,
      };

      // 管理者用データ取得（会計・レッスン・参加者ビュー用データ）
      const batchResult = getBatchData(['accounting', 'lessons'], null, null);
      const adminToken = issueAdminSessionToken();
      const participantData = getLessonsForParticipantsView(
        'ADMIN',
        true,
        true,
        phone,
        PARTICIPANT_INITIAL_PAST_MONTHS,
      );
      // ログデータ取得（直近2週間）
      const logsResult = getRecentLogs(ADMIN_LOG_INITIAL_DAYS);

      /** @type {InitialAppDataPayload & {adminToken: string, adminLogs: any[]}} */
      const adminData = {
        accountingMaster: batchResult.success
          ? batchResult.data['accounting'] || []
          : [],
        cacheVersions: /** @type {Record<string, unknown>} */ (
          (batchResult.success && batchResult.data['cache-versions']) || {}
        ),
        lessons:
          (participantData.success && participantData.data?.lessons) ||
          (batchResult.success ? batchResult.data['lessons'] || [] : []),
        myReservations: [],
        participantData: participantData.success
          ? participantData.data
          : undefined,
        adminToken,
        adminLogs: logsResult.success ? logsResult.data || [] : [],
      };

      /** @type {AuthenticationResponse} */
      const adminResponse = {
        success: true,
        userFound: true,
        user: adminUser,
        isAdmin: true,
        data: adminData,
      };

      Logger.log('管理者ログイン完了（未登録）');
      return adminResponse;
    }

    // 1. 軽量認証実行（データ再取得フラグと復元理由を渡す）
    const authResult = authenticateUser(
      phone,
      isDataRefresh,
      restorationReason,
      elapsedSeconds,
      restoredView,
    );

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

      // 3. 管理者判定
      const isAdmin = isAdminLogin(authResult.user.phone || '');
      let participantData = null;
      if (isAdmin) {
        const participantResponse = getLessonsForParticipantsView(
          authResult.user.studentId || 'ADMIN',
          true,
          true,
          authResult.user.phone || '',
          PARTICIPANT_INITIAL_PAST_MONTHS,
        );
        if (participantResponse.success) {
          participantData = participantResponse.data || null;
        }
      }

      // 管理者の場合、ログデータも取得
      /** @type {any[]} */
      let adminLogs = [];
      if (isAdmin) {
        const logsResult = getRecentLogs(ADMIN_LOG_INITIAL_DAYS);
        if (logsResult.success) {
          adminLogs = logsResult.data || [];
        }
      }

      Logger.log(`管理者判定: ${isAdmin}`);

      // 4. レスポンス統合
      /** @type {AuthenticationResponse} */
      const result = {
        success: true,
        userFound: true,
        user: authResult.user,
        isAdmin: isAdmin,
        data: /** @type {InitialAppDataPayload & {adminLogs?: any[]}} */ ({
          accountingMaster: batchResult.data['accounting'] || [],
          cacheVersions: /** @type {Record<string, unknown>} */ (
            batchResult.data['cache-versions'] || {}
          ),
          lessons:
            (participantData && participantData['lessons']) ||
            batchResult.data['lessons'] ||
            [],
          myReservations: batchResult.data['myReservations'] || [],
          ...(participantData ? { participantData: participantData } : {}),
          ...(isAdmin ? { adminLogs: adminLogs } : {}),
        }),
      };

      Logger.log(`getLoginData統合処理完了: データ一括取得成功`);
      return result;
    } else {
      // 4. 認証失敗時：ユーザー未登録
      Logger.log(`認証失敗: ${authResult.message || 'Unknown error'}`);

      // 4-1. 管理者パスワードチェック（未登録でも管理者なら許可）
      if (isAdminLogin(phone)) {
        Logger.log('管理者パスワード一致 - 未登録でも管理者としてログイン');

        // 管理者用ダミーユーザーオブジェクト
        /** @type {UserCore} */
        const adminUser = {
          studentId: 'ADMIN',
          phone: phone,
          realName: '管理者',
          displayName: '管理者',
        };

        // データ一括取得（管理者用）
        const batchResult = getBatchData(['accounting', 'lessons'], null, null);
        if (!batchResult.success) {
          Logger.log('データ一括取得失敗（管理者）');
          return /** @type {ApiErrorResponse} */ (
            createApiErrorResponse(
              'データの取得に失敗しました。しばらくしてから再度お試しください。',
              true,
            )
          );
        }

        /** @type {AuthenticationResponse} */
        const adminResponse = {
          success: true,
          userFound: true,
          user: adminUser,
          isAdmin: true,
          data: /** @type {InitialAppDataPayload & {adminLogs?: any[]}} */ ({
            accountingMaster: batchResult.data['accounting'] || [],
            cacheVersions: /** @type {Record<string, unknown>} */ (
              batchResult.data['cache-versions'] || {}
            ),
            lessons: batchResult.data['lessons'] || [],
            myReservations: [],
            adminLogs: (() => {
              const logsResult = getRecentLogs(ADMIN_LOG_INITIAL_DAYS);
              return logsResult.success ? logsResult.data || [] : [];
            })(),
          }),
        };

        Logger.log('管理者ログイン完了（未登録）');
        return adminResponse;
      }

      // 4-2. 通常の認証失敗レスポンス
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
 * キャッシュバージョンスナップショットを生成します。
 * @returns {{allReservations: number, scheduleMaster: number, lessonsComposite: string}}
 */
function buildCacheVersionsSnapshot() {
  const allReservationsCache = JSON.parse(
    CacheService.getScriptCache().get(CACHE_KEYS.ALL_RESERVATIONS) ||
      '{"version": 0}',
  );
  const scheduleMaster = JSON.parse(
    CacheService.getScriptCache().get(CACHE_KEYS.MASTER_SCHEDULE_DATA) ||
      '{"version": 0}',
  );

  const allReservationsVersion = Number(allReservationsCache.version) || 0;
  const scheduleMasterVersion = Number(scheduleMaster.version) || 0;

  return {
    allReservations: allReservationsVersion,
    scheduleMaster: scheduleMasterVersion,
    // 空き枠関連バージョンの合成（変更検知用）
    lessonsComposite: `${allReservationsVersion}-${scheduleMasterVersion}`,
  };
}

/**
 *軽量なキャッシュバージョンチェック用API
 * 空き枠データの更新有無を高速で判定
 * @returns {ApiResponseGeneric} - { success: boolean, versions: object }
 */
export function getCacheVersions() {
  try {
    Logger.log('getCacheVersions開始');

    const versions = buildCacheVersionsSnapshot();

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
 * @param {string[]} dataTypes - 取得するデータタイプの配列 ['accounting', 'lessons', 'reservations', 'cache-versions']
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

    // 3. 個人よやくデータが要求されている場合
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

    // 4. キャッシュバージョンはデータ取得後に返却（再構築が発生した場合も整合を保つ）
    if (
      dataTypes.includes('cache-versions') ||
      dataTypes.includes('lessons') ||
      dataTypes.includes('reservations')
    ) {
      result.data = {
        ...result.data,
        'cache-versions': buildCacheVersionsSnapshot(),
      };
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
 * 指定したよやくの会計詳細データをよやくシートから取得する
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

    // よやくシートを取得
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

    // 該当するよやくを検索
    const targetRow = data.find(
      /** @param {(string|number|Date)[]} row */
      row => row[reservationIdColumnIndex] === reservationId,
    );

    if (!targetRow) {
      Logger.log(`❌ よやくが見つかりません: ${reservationId}`);
      return createApiErrorResponse('指定されたよやくが見つかりません');
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
 * 空席連絡希望のよやくを確定よやくに変更し、最新データを返却します。
 * @param {{reservationId: string, studentId: string}} confirmInfo - 確定情報
 * @returns {ApiResponseGeneric} 処理結果と最新データ
 */
export function confirmWaitlistedReservationAndGetLatestData(confirmInfo) {
  return executeOperationAndGetLatestData(
    confirmWaitlistedReservation,
    confirmInfo,
    confirmInfo.studentId,
    'よやくが確定しました。',
  );
}

// ================================================================
// 参加者リスト機能用のAPIエンドポイント
// ================================================================

/**
 * 日付値を `YYYY-MM-DD` 形式に正規化します。
 * @param {string|Date|number|null|undefined} dateValue
 * @returns {string}
 */
function normalizeDateToYmd(dateValue) {
  if (!dateValue) return '';
  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
  }

  const rawValue = String(dateValue).trim();
  if (!rawValue) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }

  const parsedDate = new Date(rawValue);
  if (isNaN(parsedDate.getTime())) {
    return '';
  }

  return Utilities.formatDate(parsedDate, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
}

/**
 * 日程シートの予約IDセルを配列に変換します。
 * @param {any} reservationIdsValue
 * @returns {string[]}
 */
function parseScheduleReservationIds(reservationIdsValue) {
  if (Array.isArray(reservationIdsValue)) {
    return reservationIdsValue
      .map(id => String(id || '').trim())
      .filter(id => id !== '');
  }

  if (!reservationIdsValue) return [];
  const rawValue = String(reservationIdsValue).trim();
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.map(id => String(id || '').trim()).filter(id => id !== '');
    }
  } catch (_error) {
    // JSON形式でない場合は下のフォールバックで処理
  }

  return rawValue
    .split(',')
    .map(id => id.trim())
    .filter(id => id !== '');
}

/**
 * 参加者ビュー用のよやくマップをレッスン単位で構築します。
 * @param {LessonCore[]} lessons
 * @param {Record<string, UserCore>} preloadedStudentsMap
 * @param {boolean} isAdmin
 * @returns {Record<string, any[]>}
 */
function buildParticipantReservationsMapForLessons(
  lessons,
  preloadedStudentsMap,
  isAdmin,
) {
  /** @type {Record<string, any[]>} */
  const reservationsMap = {};
  /** @type {Record<string, LessonCore>} */
  const lessonMapById = {};
  /** @type {Record<string, string>} */
  const fallbackLessonIdByReservationId = {};

  lessons.forEach(lesson => {
    const lessonId = lesson?.lessonId ? String(lesson.lessonId) : '';
    if (!lessonId) return;
    lessonMapById[lessonId] = lesson;
    reservationsMap[lessonId] = [];

    const reservationIds = Array.isArray(lesson?.reservationIds)
      ? lesson.reservationIds
      : [];
    reservationIds.forEach(reservationId => {
      const normalizedReservationId = String(reservationId || '').trim();
      if (!normalizedReservationId) return;
      if (fallbackLessonIdByReservationId[normalizedReservationId]) return;
      fallbackLessonIdByReservationId[normalizedReservationId] = lessonId;
    });
  });

  const lessonIds = Object.keys(lessonMapById);
  if (lessonIds.length === 0) {
    return reservationsMap;
  }

  const allReservations = getCachedReservationsAsObjects(preloadedStudentsMap);
  if (!allReservations || allReservations.length === 0) {
    return reservationsMap;
  }

  /** @type {Record<string, UserCore>} */
  const allStudents = preloadedStudentsMap || {};

  // 各生徒の完了済みよやく日リストを事前に計算（ソート済み）
  /** @type {Record<string, number[]>} */
  const completedDatesByStudent = {};
  allReservations.forEach(reservation => {
    if (reservation.status !== CONSTANTS.STATUS.COMPLETED) return;
    const targetStudentId = reservation.studentId;
    if (!completedDatesByStudent[targetStudentId]) {
      completedDatesByStudent[targetStudentId] = [];
    }
    const dateTs = new Date(reservation.date).getTime();
    if (!isNaN(dateTs)) {
      completedDatesByStudent[targetStudentId].push(dateTs);
    }
  });
  Object.values(completedDatesByStudent).forEach(dates =>
    dates.sort((a, b) => a - b),
  );

  /**
   * 指定日以前の完了済みよやく数をカウント（二分探索でupper bound）
   * @param {string} targetStudentId
   * @param {string|Date} reservationDate
   * @returns {number}
   */
  const getParticipationCountAsOf = (targetStudentId, reservationDate) => {
    const dates = completedDatesByStudent[targetStudentId];
    if (!dates || dates.length === 0) return 0;

    const targetTs = new Date(reservationDate).getTime();
    if (isNaN(targetTs)) return 0;

    let left = 0;
    let right = dates.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (dates[mid] <= targetTs) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    return left;
  };

  allReservations.forEach(reservation => {
    if (reservation.status === CONSTANTS.STATUS.CANCELED) return;

    let lessonId = reservation.lessonId ? String(reservation.lessonId) : '';
    if (!lessonId || !lessonMapById[lessonId]) {
      const reservationId = reservation.reservationId
        ? String(reservation.reservationId).trim()
        : '';
      lessonId = reservationId
        ? fallbackLessonIdByReservationId[reservationId] || ''
        : '';
    }
    if (!lessonId) return;
    const lesson = lessonMapById[lessonId];
    if (!lesson) return;

    const student = allStudents[reservation.studentId];
    const studentData = student || {};

    const nickname = studentData.nickname || '';
    const rawDisplayName = studentData.displayName || nickname || '';
    const realName = studentData.realName || '';
    const shouldMaskDisplayName =
      !isAdmin && realName && rawDisplayName && rawDisplayName === realName;
    const publicDisplayName = shouldMaskDisplayName
      ? rawDisplayName.substring(0, 2)
      : rawDisplayName;

    /** @type {any} */
    const baseInfo = {
      reservationId: reservation.reservationId,
      date: reservation.date || lesson.date,
      classroom: lesson.classroom,
      venue: lesson.venue || '',
      startTime: reservation.startTime || '',
      endTime: reservation.endTime || '',
      status: reservation.status,
      studentId: reservation.studentId,
      nickname: publicDisplayName,
      displayName: publicDisplayName,
      firstLecture: reservation.firstLecture || false,
      chiselRental: reservation.chiselRental || false,
      sessionNote: reservation.sessionNote || '',
      order: reservation.order || '',
      participationCount:
        getParticipationCountAsOf(
          reservation.studentId,
          reservation.date || lesson.date,
        ) + 1,
      futureCreations: studentData.futureCreations || '',
      nextLessonGoal: studentData.nextLessonGoal || '',
      companion: reservation.companion || '',
      transportation: reservation.transportation || '',
      pickup: reservation.pickup || '',
      car: reservation.car || '',
    };

    const fullInfo = isAdmin
      ? {
          ...baseInfo,
          nickname: nickname || rawDisplayName,
          displayName: rawDisplayName,
          realName: realName,
          messageToTeacher: reservation.messageToTeacher || '',
          phone: studentData.phone || '',
          email: studentData.email || '',
          ageGroup:
            studentData.ageGroup !== undefined && studentData.ageGroup !== null
              ? String(studentData.ageGroup)
              : '',
          gender: studentData.gender || '',
          address: studentData.address || '',
          notes: reservation.notes || '',
        }
      : baseInfo;

    reservationsMap[lessonId].push(fullInfo);
  });

  return reservationsMap;
}

/**
 * 参加者リスト表示用のレッスン一覧を取得する
 * - キャッシュから過去〜未来のレッスン情報を取得
 * - 管理者・一般生徒を問わず、同じデータを返す（レッスン情報は公開情報）
 *
 * @param {string} studentId - リクエストしている生徒のID（将来の権限チェック用によやく）
 * @param {boolean} [includeHistory=true] - 過去のレッスンを含めるか（デフォルト: true）
 * @param {boolean} [includeReservations=false] - よやくデータを含めるか
 * @param {string} [adminLoginId=''] - 管理者用ログインID（PropertyServiceと突合する）
 * @param {number} [pastMonthsLimit=0] - 過去データを含める場合の遡り月数（0なら制限なし）
 * @returns {ApiResponseGeneric} レッスン一覧
 */
export function getLessonsForParticipantsView(
  studentId,
  includeHistory = true,
  includeReservations = false,
  adminLoginId = '',
  pastMonthsLimit = 0,
) {
  try {
    Logger.log(
      `getLessonsForParticipantsView開始: studentId=${studentId}, includeHistory=${includeHistory}, includeReservations=${includeReservations}, pastMonthsLimit=${pastMonthsLimit}`,
    );

    // 生徒キャッシュを1回取得（以降の処理で使い回す）
    const studentCache = getStudentCacheSnapshot();
    /** @type {Record<string, UserCore>} */
    const preloadedStudentsMap = studentCache?.students || {};

    // 管理者判定（studentId="ADMIN"または登録済み管理者）+ PropertyServiceの管理者ID
    const adminLoginIdSafe =
      typeof adminLoginId === 'string' ? adminLoginId : '';
    const isAdminBySpecialId = studentId === 'ADMIN';
    const isAdminByLoginId = adminLoginIdSafe
      ? isAdminLogin(adminLoginIdSafe)
      : false;
    const isAdmin = isAdminBySpecialId || isAdminByLoginId;
    Logger.log(
      `管理者判定: studentId="${studentId}", isAdminBySpecialId=${isAdminBySpecialId}, isAdminByLoginId=${isAdminByLoginId}, 最終判定=${isAdmin}`,
    );

    // 空き枠計算済みのレッスン情報を取得
    const lessonsResult = getLessons(true);
    if (!lessonsResult.success || !Array.isArray(lessonsResult.data)) {
      Logger.log('レッスン情報の取得に失敗しました（getLessons）');
      return createApiErrorResponse(
        'レッスン情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }
    const allLessons = lessonsResult.data;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 今日の0時0分0秒に設定

    const normalizedPastMonthsLimit = includeHistory
      ? Math.max(0, Number(pastMonthsLimit) || 0)
      : 0;
    const historyBoundaryDate =
      normalizedPastMonthsLimit > 0
        ? (() => {
            const boundaryDate = new Date(today.getTime());
            boundaryDate.setMonth(
              boundaryDate.getMonth() - normalizedPastMonthsLimit,
            );
            boundaryDate.setHours(0, 0, 0, 0);
            return boundaryDate;
          })()
        : null;

    // レッスン一覧をフィルタリング
    const lessonsWithDate = allLessons.map(lesson => ({
      ...lesson,
      _dateObj: new Date(lesson.date),
    }));
    let filteredLessons = lessonsWithDate;
    let hasMorePastLessons = false;

    // 過去データを除外する場合
    if (!includeHistory) {
      filteredLessons = filteredLessons.filter(
        lesson => lesson._dateObj >= today,
      );
    } else if (historyBoundaryDate) {
      filteredLessons = filteredLessons.filter(
        lesson => lesson._dateObj >= historyBoundaryDate,
      );
      hasMorePastLessons = lessonsWithDate.some(
        lesson => lesson._dateObj < historyBoundaryDate,
      );
    }

    // 日付順にソート（新しい順）
    filteredLessons.sort((a, b) => b._dateObj.getTime() - a._dateObj.getTime());

    // 内部フィールドを削除して最終形にする
    const lessons = filteredLessons.map(lesson => {
      const { _dateObj, ...rest } = lesson;
      return rest;
    });

    const shouldIncludeReservations = includeReservations;

    const reservationsMap = shouldIncludeReservations
      ? buildParticipantReservationsMapForLessons(
          lessons,
          preloadedStudentsMap,
          isAdmin,
        )
      : {};

    if (!shouldIncludeReservations) {
      Logger.log(
        `❌ よやくデータ取得スキップ: includeReservations=${includeReservations}, isAdmin=${isAdmin}`,
      );
    } else {
      Logger.log(
        `✅ よやくデータ一括取得完了: ${Object.keys(reservationsMap).length}レッスン分`,
      );
    }

    // 全生徒データを準備（権限に応じてフィルタリング）
    /** @type {Record<string, any>} */
    const allStudentsForResponse = {};
    Object.entries(preloadedStudentsMap).forEach(([id, student]) => {
      if (isAdmin) {
        // 管理者: 全フィールドを返却
        allStudentsForResponse[id] = student;
      } else {
        // 一般ユーザー: 公開情報のみ
        const nickname = student.nickname || '';
        const rawDisplayName = student.displayName || nickname || '';
        const realName = student.realName || '';
        // 本名と表示名が同じ場合はマスク
        const shouldMaskDisplayName =
          realName && rawDisplayName && rawDisplayName === realName;
        const publicDisplayName = shouldMaskDisplayName
          ? rawDisplayName.substring(0, 2)
          : rawDisplayName;

        allStudentsForResponse[id] = {
          studentId: student.studentId,
          nickname: publicDisplayName,
          displayName: publicDisplayName,
          futureCreations: student.futureCreations || '',
        };
      }
    });

    Logger.log(
      `getLessonsForParticipantsView完了: ${lessons.length}件のレッスン, reservationsMapキー数=${Object.keys(reservationsMap).length}, allStudents=${Object.keys(allStudentsForResponse).length}件, hasMorePastLessons=${hasMorePastLessons}`,
    );

    return createApiResponse(true, {
      lessons: lessons,
      isAdmin: isAdmin,
      reservationsMap: shouldIncludeReservations ? reservationsMap : undefined,
      allStudents: allStudentsForResponse,
      hasMorePastLessons,
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
 * 参加者ビューの過去レッスンを、指定日より前から追加取得します。
 * データ量を抑えるため件数制限をかけ、同一日付は取りこぼし防止のためまとめて返します。
 *
 * @param {string} studentId - リクエストしている生徒ID
 * @param {string} beforeDate - この日付より古いデータを取得する基準日（YYYY-MM-DD）
 * @param {string} [adminLoginId=''] - 管理者用ログインID
 * @param {number} [limit] - 1回で取得する最大件数（同一日付分は上限超過して返却）
 * @returns {ApiResponseGeneric}
 */
export function getPastLessonsForParticipantsView(
  studentId,
  beforeDate,
  adminLoginId = '',
  limit = CONSTANTS.UI.HISTORY_LOAD_MORE_RECORDS || 10,
) {
  try {
    const normalizedBeforeDate = normalizeDateToYmd(beforeDate);
    if (!normalizedBeforeDate) {
      return createApiErrorResponse('取得基準日が不正です。');
    }

    const adminLoginIdSafe =
      typeof adminLoginId === 'string' ? adminLoginId : '';
    const isAdminBySpecialId = studentId === 'ADMIN';
    const isAdminByLoginId = adminLoginIdSafe
      ? isAdminLogin(adminLoginIdSafe)
      : false;
    const isAdmin = isAdminBySpecialId || isAdminByLoginId;

    // 生徒キャッシュを1回取得（よやく整形で再利用）
    const studentCache = getStudentCacheSnapshot();
    /** @type {Record<string, UserCore>} */
    const preloadedStudentsMap = studentCache?.students || {};

    const safeLimit = Math.max(1, Number(limit) || 10);

    const scheduleSheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);
    if (!scheduleSheet) {
      return createApiErrorResponse('日程マスターシートが見つかりません。');
    }

    const allValues = scheduleSheet.getDataRange().getValues();
    const headerRowCandidate = allValues.shift();
    if (!Array.isArray(headerRowCandidate)) {
      return createApiErrorResponse('日程データのヘッダー取得に失敗しました。');
    }
    const headerRow = /** @type {string[]} */ (headerRowCandidate);

    const dateColumn = headerRow.indexOf(CONSTANTS.HEADERS.SCHEDULE.DATE);
    const lessonIdColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.LESSON_ID,
    );
    const reservationIdsColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.RESERVATION_IDS,
    );
    const classroomColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.CLASSROOM,
    );
    const venueColumn = headerRow.indexOf(CONSTANTS.HEADERS.SCHEDULE.VENUE);
    const classroomTypeColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.TYPE,
    );
    const firstStartColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.FIRST_START,
    );
    const firstEndColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.FIRST_END,
    );
    const secondStartColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.SECOND_START,
    );
    const secondEndColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.SECOND_END,
    );
    const beginnerStartColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.BEGINNER_START,
    );
    const totalCapacityColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.TOTAL_CAPACITY,
    );
    const beginnerCapacityColumn = headerRow.indexOf(
      CONSTANTS.HEADERS.SCHEDULE.BEGINNER_CAPACITY,
    );
    const statusColumn = findHeaderIndexByCandidates(headerRow, [
      CONSTANTS.HEADERS.SCHEDULE.STATUS,
      '状態',
      'status',
    ]);
    const salesTransferStatusColumn = findHeaderIndexByCandidates(headerRow, [
      CONSTANTS.HEADERS.SCHEDULE.SALES_TRANSFER_STATUS,
      '売上転記状態',
      '売上転送状態',
      'salesTransferStatus',
    ]);
    const salesTransferAtColumn = findHeaderIndexByCandidates(headerRow, [
      CONSTANTS.HEADERS.SCHEDULE.SALES_TRANSFER_AT,
      '売上転記日時',
      '売上転送日時',
      'salesTransferredAt',
    ]);
    const notesColumn = headerRow.indexOf(CONSTANTS.HEADERS.SCHEDULE.NOTES);

    if (dateColumn === -1 || classroomColumn === -1) {
      return createApiErrorResponse(
        '日程シートの必須列（日付・教室）が見つかりません。',
      );
    }

    /**
     * 時刻セルを文字列化します。
     * @param {any} value
     * @returns {string}
     */
    const toTimeString = value => {
      if (!value) return '';
      if (value instanceof Date) {
        return Utilities.formatDate(value, CONSTANTS.TIMEZONE, 'HH:mm');
      }
      return String(value);
    };

    /**
     * 定員セルを数値化します。
     * @param {any} value
     * @returns {number}
     */
    const toCapacityNumber = value => {
      if (value === null || value === undefined || value === '') return 0;
      const parsed = parseInt(String(value), 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    /**
     * 日時セルを表示文字列へ変換します。
     * @param {any} value
     * @returns {string}
     */
    const toDateTimeString = value => {
      if (!value) return '';
      if (value instanceof Date) {
        return Utilities.formatDate(
          value,
          CONSTANTS.TIMEZONE,
          'yyyy-MM-dd HH:mm:ss',
        );
      }
      return String(value);
    };

    /** @type {LessonCore[]} */
    const candidateLessons = [];
    for (let i = 0; i < allValues.length; i += 1) {
      const row = allValues[i];
      const dateStr = normalizeDateToYmd(row[dateColumn]);
      if (!dateStr || dateStr >= normalizedBeforeDate) continue;

      const classroom = String(
        classroomColumn >= 0 ? row[classroomColumn] || '' : '',
      ).trim();
      if (!classroom) continue;

      const venue = String(
        venueColumn >= 0 ? row[venueColumn] || '' : '',
      ).trim();
      const classroomType = String(
        classroomTypeColumn >= 0 ? row[classroomTypeColumn] || '' : '',
      ).trim();
      const firstStart = toTimeString(
        firstStartColumn >= 0 ? row[firstStartColumn] : '',
      );
      const firstEnd = toTimeString(
        firstEndColumn >= 0 ? row[firstEndColumn] : '',
      );
      const secondStart = toTimeString(
        secondStartColumn >= 0 ? row[secondStartColumn] : '',
      );
      const secondEnd = toTimeString(
        secondEndColumn >= 0 ? row[secondEndColumn] : '',
      );
      const beginnerStart = toTimeString(
        beginnerStartColumn >= 0 ? row[beginnerStartColumn] : '',
      );
      const totalCapacity = toCapacityNumber(
        totalCapacityColumn >= 0 ? row[totalCapacityColumn] : 0,
      );
      const beginnerCapacity = toCapacityNumber(
        beginnerCapacityColumn >= 0 ? row[beginnerCapacityColumn] : 0,
      );
      const status = String(statusColumn >= 0 ? row[statusColumn] || '' : '');
      const salesTransferStatus = String(
        salesTransferStatusColumn >= 0
          ? row[salesTransferStatusColumn] || ''
          : '',
      );
      const salesTransferredAt = toDateTimeString(
        salesTransferAtColumn >= 0 ? row[salesTransferAtColumn] : '',
      );
      const notes = String(notesColumn >= 0 ? row[notesColumn] || '' : '');
      const reservationIds = parseScheduleReservationIds(
        reservationIdsColumn >= 0 ? row[reservationIdsColumn] : [],
      );

      const rawLessonId =
        lessonIdColumn >= 0 ? String(row[lessonIdColumn] || '').trim() : '';
      const fallbackClassroomKey = classroom.replace(/\s+/g, '');
      const lessonId =
        rawLessonId ||
        `legacy_${dateStr}_${fallbackClassroomKey || 'classroom'}_${i + 2}`;

      const isTimeDual = classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL;

      candidateLessons.push({
        lessonId,
        reservationIds,
        classroom,
        date: dateStr,
        venue,
        classroomType,
        notes,
        status,
        salesTransferStatus,
        salesTransferredAt,
        firstStart,
        firstEnd,
        secondStart,
        secondEnd,
        beginnerStart,
        startTime: firstStart,
        endTime: secondEnd || firstEnd,
        totalCapacity,
        beginnerCapacity,
        firstSlots: 0,
        secondSlots: isTimeDual ? 0 : undefined,
        beginnerSlots: 0,
      });
    }

    // 新しい日付順（同日の場合は教室名降順）に並べる
    candidateLessons.sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      if (dateCompare !== 0) return dateCompare;
      return String(b.classroom).localeCompare(String(a.classroom));
    });

    /** @type {LessonCore[]} */
    const lessons = [];
    let boundaryDate = '';
    for (const lesson of candidateLessons) {
      if (lessons.length < safeLimit) {
        lessons.push(lesson);
        boundaryDate = String(lesson.date || '');
        continue;
      }
      if (String(lesson.date || '') === boundaryDate) {
        lessons.push(lesson);
        continue;
      }
      break;
    }

    const hasMore =
      boundaryDate !== '' &&
      candidateLessons.some(lesson => String(lesson.date || '') < boundaryDate);

    const reservationsMap = buildParticipantReservationsMapForLessons(
      lessons,
      preloadedStudentsMap,
      isAdmin,
    );

    Logger.log(
      `getPastLessonsForParticipantsView完了: beforeDate=${normalizedBeforeDate}, 取得=${lessons.length}件, hasMore=${hasMore}`,
    );

    return createApiResponse(true, {
      lessons,
      reservationsMap,
      hasMore,
      isAdmin,
      message: '過去レッスンを取得しました',
    });
  } catch (error) {
    Logger.log(
      `getPastLessonsForParticipantsView エラー: ${error.message}\nStack: ${error.stack}`,
    );
    return createApiErrorResponse(
      `過去レッスン取得中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * 特定レッスンのよやく情報リストを取得する（権限に応じてフィルタリング）
 * - 管理者: 全項目を返す（本名、電話番号、メールアドレスなど）
 * - 一般生徒: 公開情報のみ（本名、電話番号、メールアドレスを除外）
 *
 * @param {string} lessonId - レッスンID
 * @param {string} studentId - リクエストしている生徒のID
 * @returns {ApiResponseGeneric} よやく情報リスト
 */
export function getReservationsForLesson(lessonId, studentId) {
  try {
    Logger.log(
      `getReservationsForLesson開始: lessonId=${lessonId}, studentId=${studentId}`,
    );

    // パラメータ検証
    if (!lessonId) {
      return createApiErrorResponse('レッスンIDが必要です');
    }

    // 管理者権限チェック（studentId="ADMIN"または登録済み管理者）
    const isAdmin = studentId === 'ADMIN';
    Logger.log(`管理者権限: ${isAdmin}`);

    // キャッシュからよやく情報を取得（ReservationCore[]として取得）
    const allReservations = getCachedReservationsAsObjects();

    if (!allReservations || allReservations.length === 0) {
      Logger.log('よやくデータが見つかりません');
      return createApiErrorResponse(
        'よやく情報の取得に失敗しました。しばらくしてから再度お試しください。',
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

    // 該当レッスンのよやくをフィルタリング
    const lessonReservations = allReservations.filter(
      reservation => reservation.lessonId === lessonId,
    );

    Logger.log(`該当レッスンのよやく: ${lessonReservations.length}件`);

    // よやく情報に生徒情報を結合し、権限に応じてフィルタリング
    const reservationsWithUserInfo = lessonReservations.map(reservation => {
      // 生徒情報を取得
      const student = getCachedStudentById(reservation.studentId);
      const nickname = student?.nickname || '';
      const rawDisplayName = student?.displayName || nickname;
      const realName = student?.realName || '';
      const shouldMaskDisplayName =
        !isAdmin && realName && rawDisplayName && rawDisplayName === realName;
      const publicDisplayName = shouldMaskDisplayName
        ? rawDisplayName.substring(0, 2)
        : rawDisplayName;

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
        nickname: publicDisplayName,
        displayName: publicDisplayName,
        firstLecture: reservation.firstLecture || false,
        chiselRental: reservation.chiselRental || false,
        sessionNote: reservation.sessionNote || '',
        order: reservation.order || '',
      };

      // 管理者の場合は個人情報を追加（表示名はフルで保持）
      if (isAdmin) {
        return {
          ...baseInfo,
          nickname: nickname || rawDisplayName,
          displayName: rawDisplayName,
          realName: realName,
          messageToTeacher: reservation.messageToTeacher || '',
          phone: student?.phone || '',
          email: student?.email || '',
          ageGroup:
            student?.ageGroup !== undefined && student?.ageGroup !== null
              ? String(student?.ageGroup)
              : '',
          gender: student?.gender || '',
          address: student?.address || '',
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
      message: 'よやく情報を取得しました',
    });
  } catch (error) {
    Logger.log(
      `getReservationsForLesson エラー: ${error.message}\nStack: ${error.stack}`,
    );
    return createApiErrorResponse(
      `よやく情報の取得中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * 特定生徒の詳細情報とよやく履歴を取得する（権限に応じてフィルタリング）
 * - 管理者: 全項目を返す
 * - 一般生徒（本人）: 自分の情報のみ閲覧可能
 * - 一般生徒（他人）: 公開情報のみ（ニックネーム、参加回数など）
 *
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} requestingStudentId - リクエストしている生徒のID
 * @returns {ApiResponseGeneric} 生徒詳細情報とよやく履歴
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
    if (!targetStudentId) {
      return createApiErrorResponse('対象生徒IDが必要です');
    }

    // 権限チェック（requestingStudentId="ADMIN"または登録済み管理者）
    const isAdmin = requestingStudentId === 'ADMIN';
    const isSelf = targetStudentId === requestingStudentId;
    Logger.log(`管理者権限: ${isAdmin}, 本人: ${isSelf}`);

    // 生徒情報を取得
    const targetStudent = getCachedStudentById(targetStudentId);

    if (!targetStudent) {
      return createApiErrorResponse('指定された生徒が見つかりません');
    }

    // よやく履歴を取得（ReservationCore[]として取得）
    const allReservations = getCachedReservationsAsObjects();

    if (!allReservations || allReservations.length === 0) {
      Logger.log('よやくデータが見つかりません');
      return createApiErrorResponse(
        'よやく情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }

    // レッスン情報も取得（よやく履歴に教室・会場情報を結合するため）
    const scheduleMasterCache = getTypedCachedData(
      CACHE_KEYS.MASTER_SCHEDULE_DATA,
    );

    if (!scheduleMasterCache || !Array.isArray(scheduleMasterCache.schedule)) {
      Logger.log('スケジュールマスターキャッシュが見つかりません');
      return createApiErrorResponse(
        'レッスン情報の取得に失敗しました。しばらくしてから再度お試しください。',
      );
    }

    // 該当生徒のよやく履歴をフィルタリング
    const studentReservations = allReservations.filter(
      reservation => reservation.studentId === targetStudentId,
    );

    // よやく履歴にレッスン情報を結合
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
          sessionNote: reservation.sessionNote || '',
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

    const rawNickname = targetStudent.nickname || '';
    const rawDisplayName = targetStudent.displayName || rawNickname;
    const realName = targetStudent.realName || '';
    const shouldMaskDisplayName =
      !isAdmin &&
      !isSelf &&
      realName &&
      rawDisplayName &&
      rawDisplayName === realName;
    const publicDisplayName = shouldMaskDisplayName
      ? rawDisplayName.substring(0, 2)
      : rawDisplayName;

    // 基本情報（公開）
    const publicInfo = {
      studentId: targetStudent.studentId,
      nickname: publicDisplayName,
      displayName: publicDisplayName,
      participationCount: participationCount,
      futureCreations: targetStudent.futureCreations || '',
      reservationHistory: reservationHistory,
    };

    // 管理者または本人の場合は詳細情報を追加
    if (isAdmin || isSelf) {
      const detailedInfo = {
        ...publicInfo,
        nickname: rawNickname || rawDisplayName,
        displayName: rawDisplayName,
        realName: targetStudent.realName || '',
        phone: targetStudent.phone || '',
        email: targetStudent.email || '',
        wantsEmail: targetStudent.wantsEmail || false,
        wantsScheduleNotification:
          targetStudent.wantsScheduleNotification || false,
        notificationDay: targetStudent.notificationDay || 0,
        notificationHour: targetStudent.notificationHour || 0,
        ageGroup:
          targetStudent.ageGroup !== undefined &&
          targetStudent.ageGroup !== null
            ? String(targetStudent.ageGroup)
            : '',
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

/**
 * 会計処理を実行（売上転載オプション付き）
 * @param {any} formData - フォームデータ
 * @param {AccountingDetailsCore} calculationResult - 計算結果
 * @param {boolean} withSalesTransfer - 売上転載を即時実行するか
 * @returns {ApiResponseGeneric<{message: string}>} 処理結果
 */
export function processAccountingWithTransferOption(
  formData,
  calculationResult,
  withSalesTransfer,
) {
  try {
    Logger.log(
      `[processAccountingWithTransferOption] 開始: withSalesTransfer=${withSalesTransfer}`,
    );

    // 4. 会計情報の保存（ログへの記録）
    // NOTE: saveAccountingDetailsは reservationWithAccounting (formData + accountingDetails) を期待する
    /** @type {ReservationCoreWithAccounting} */
    const reservationToSave = {
      ...formData,
      accountingDetails: calculationResult,
    };
    const accountingResult = saveAccountingDetails(reservationToSave);

    if (!accountingResult.success) {
      Logger.log(
        `[processAccountingWithTransferOption] 会計処理失敗: ${accountingResult.error}`,
      );
      return accountingResult;
    }

    // 即時転載が指定されている場合は売上ログに記録
    if (withSalesTransfer) {
      const reservationId = /** @type {string} */ (formData.reservationId);
      const date = /** @type {string} */ (formData.date);

      Logger.log(
        `[processAccountingWithTransferOption] 即時転載開始: ${reservationId}`,
      );

      // 重複チェック（売上ログに既に記録されているか確認）
      const isDuplicate = checkIfSalesAlreadyLogged(reservationId, date);

      if (!isDuplicate) {
        // よやく情報を取得
        const reservations = getCachedReservationsAsObjects();
        const reservation = reservations.find(
          r => r.reservationId === reservationId,
        );

        if (reservation) {
          logSalesForSingleReservation(reservation, calculationResult);
          Logger.log(
            `[processAccountingWithTransferOption] 売上ログに即時転載しました: ${reservationId}`,
          );
        } else {
          Logger.log(
            `[processAccountingWithTransferOption] よやく情報が見つかりません: ${reservationId}`,
          );
        }
      } else {
        Logger.log(
          `[processAccountingWithTransferOption] 既に売上ログに記録済みのためスキップ: ${reservationId}`,
        );
      }
    }

    return createApiResponse(true, {
      message: withSalesTransfer
        ? '会計処理と売上転載が完了しました'
        : '会計処理が完了しました（売上転載は管理画面から実行できます）',
    });
  } catch (error) {
    Logger.log(
      `[processAccountingWithTransferOption] エラー: ${error.message}\nStack: ${error.stack}`,
    );
    return createApiErrorResponse(
      `会計処理中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * 管理画面から売上転載を手動実行（または事前集計プレビュー）するエンドポイント
 * @param {{ targetDate?: string, previewOnly?: boolean, adminToken?: string, _adminToken?: string }} payload
 * @returns {ApiResponseGeneric<any>}
 */
export function runSalesTransferFromAdmin(payload = {}) {
  try {
    const adminToken = payload?._adminToken || payload?.adminToken || '';
    if (!validateAdminSessionToken(adminToken)) {
      return createApiErrorResponse(
        '管理者権限が確認できません。再ログインしてください。',
      );
    }

    const targetDate = payload?.targetDate || '';
    const previewOnly = payload?.previewOnly === true;

    const reportResult = buildSalesTransferReportByDate(targetDate);
    if (!reportResult.success) {
      return createApiErrorResponse('売上集計の作成に失敗しました。');
    }

    if (previewOnly) {
      return createApiResponse(true, {
        message: '売上集計を取得しました。',
        report: reportResult,
      });
    }

    const todayYmd = Utilities.formatDate(
      new Date(),
      CONSTANTS.TIMEZONE,
      'yyyy-MM-dd',
    );
    if (reportResult.targetDate > todayYmd) {
      return createApiErrorResponse(
        `未来日（${reportResult.targetDate}）は売上転載を実行できません。`,
      );
    }

    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_START,
      '実行中',
      `管理画面実行: 対象日 ${reportResult.targetDate}`,
    );

    const transferResult = transferSalesLogByDate(reportResult.targetDate);

    // 管理画面実行時は対象日の状態変化分のみ Notion 同期する
    const updatedTargetStatusCount = markScheduleStatusCompletedByDate(
      reportResult.targetDate,
      { syncNotion: true },
    );
    const updatedStatusCount = updatedTargetStatusCount;

    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_SUCCESS,
      '成功',
      `管理画面実行: 対象日 ${reportResult.targetDate}, 処理件数 ${transferResult.totalCount}件, 成功 ${transferResult.successCount}件, 日程更新 ${updatedStatusCount}件`,
    );

    return createApiResponse(true, {
      message: '売上転載が完了しました。',
      report: reportResult,
      transferResult,
      updatedStatusCount,
    });
  } catch (error) {
    Logger.log(
      `[runSalesTransferFromAdmin] エラー: ${error.message}\nStack: ${error.stack}`,
    );

    logActivity(
      'SYSTEM',
      CONSTANTS.LOG_ACTIONS.BATCH_SALES_TRANSFER_ERROR,
      '失敗',
      `管理画面実行エラー: ${error.message}`,
    );

    return createApiErrorResponse(
      `売上転載処理中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * セッション終了ウィザードの統合処理エンドポイント
 * 1. 今日の記録（sessionNote）を更新
 * 2. 会計処理を実行
 * 3. オプションで次回よやくを作成
 *
 * @param {any} payload - メイン処理データ
 * @param {any} nextReservationPayload - 次回よやくデータ（null = スキップ）
 * @returns {ApiResponseGeneric} 処理結果
 */
export function processSessionConclusion(payload, nextReservationPayload) {
  // 注意: withTransactionは使用しない
  // 内部で呼び出すupdateReservationDetails、saveAccountingDetails、makeReservationは
  // 各自でwithTransactionを持っているため、外側でラップすると多重ロック取得でエラーになる
  try {
    Logger.log(
      `[processSessionConclusion] 開始: reservationId=${payload.reservationId}`,
    );
    const isAdminOperation =
      Boolean(payload?._isByAdmin) || Boolean(payload?.isAdminOperation);
    const adminToken = payload?._adminToken || payload?.adminToken || null;
    const adminUserId = payload?.adminUserId || null;

    // 1. 今日のよやくの sessionNote を更新
    const memoUpdatePayload = /** @type {ReservationCore} */ (
      /** @type {any} */ ({
        reservationId: payload.reservationId,
        studentId: payload.studentId,
        sessionNote: payload.sessionNote || '',
        _skipDefaultLog: true, // 終了フロー専用ログを使用
        _isByAdmin: isAdminOperation,
        _adminToken: adminToken,
      })
    );
    const memoResult = updateReservationDetails(memoUpdatePayload);

    if (!memoResult.success) {
      Logger.log(
        `[processSessionConclusion] メモ更新失敗: ${memoResult.message}`,
      );
      return memoResult;
    }

    // 終了フロー専用のログアクションで記録
    const truncate = (/** @type {string} */ str, len = 500) =>
      str.length > len ? str.substring(0, len) + '...' : str;

    logActivity(
      payload.studentId,
      CONSTANTS.LOG_ACTIONS.RESERVATION_MEMO_UPDATE_CONCLUSION,
      CONSTANTS.MESSAGES.SUCCESS,
      {
        reservationId: payload.reservationId,
        classroom: payload.classroom,
        details: {
          セッションノート: truncate(payload.sessionNote || '(空白)'),
        },
      },
    );

    // 1.5. 次回目標を生徒名簿に保存（任意入力）- 共通関数を使用
    if (
      payload.nextLessonGoal !== undefined &&
      payload.nextLessonGoal !== null
    ) {
      const goalResult = updateNextLessonGoal({
        studentId: payload.studentId,
        nextLessonGoal: payload.nextLessonGoal,
        _isConclusion: true, // 終了フロー用のログアクションを使用
      });
      if (!goalResult.success) {
        // 失敗しても続行（警告ログのみ）
        Logger.log(
          `[processSessionConclusion] 次回目標保存失敗（警告）: ${goalResult.message}`,
        );
      } else {
        Logger.log(`[processSessionConclusion] 次回目標を保存しました`);
      }
    }

    // 2. 会計処理
    // フロントエンドから渡された会計詳細を使用（計算済み）
    // なければ簡易オブジェクト（後方互換性）
    const accountingDetails = /** @type {AccountingDetailsCore} */ (
      payload.accountingDetails ||
        /** @type {any} */ ({
          tuition: { items: [], total: 0 },
          sales: { items: [], total: 0 },
          paymentMethod: payload.paymentMethod,
          grandTotal: 0,
        })
    );

    const reservationWithAccounting =
      /** @type {ReservationCoreWithAccounting} */ (
        /** @type {any} */ ({
          reservationId: payload.reservationId,
          studentId: payload.studentId,
          classroom: payload.classroom,
          accountingDetails: accountingDetails,
          _isByAdmin: isAdminOperation,
          _adminToken: adminToken,
          isAdminOperation: isAdminOperation,
          adminUserId: adminUserId,
        })
      );

    const accountingResult = saveAccountingDetails(reservationWithAccounting);
    if (!accountingResult.success) {
      Logger.log(
        `[processSessionConclusion] 会計処理失敗: ${accountingResult.message}`,
      );
      return accountingResult;
    }

    // 3. 次回よやくを作成（ペイロードがある場合のみ）
    /** @type {{created: boolean, status?: string | undefined, expectedWaitlist?: boolean | undefined, message?: string | undefined, date?: string | undefined, classroom?: string | undefined}} */
    let nextReservationResult = { created: false };

    if (nextReservationPayload) {
      Logger.log(
        `[processSessionConclusion] 次回よやく作成: lessonId=${nextReservationPayload.lessonId}`,
      );

      // 終了フロー用のフラグを追加
      const payloadWithFlag = {
        ...nextReservationPayload,
        _isConclusion: true,
      };

      const reservationResult = makeReservation(
        /** @type {ReservationCore} */ (payloadWithFlag),
      );
      if (reservationResult.success) {
        // 成功の場合、makeReservationから返されたステータスを使用
        const actualStatus =
          /** @type {any} */ (reservationResult.data)?.status ||
          CONSTANTS.STATUS.CONFIRMED;
        const isWaitlisted = actualStatus === CONSTANTS.STATUS.WAITLISTED;
        // ユーザーの期待と実際の結果を記録
        const expectedWaitlist =
          /** @type {any} */ (nextReservationPayload).expectedWaitlist === true;
        nextReservationResult = {
          created: true,
          status: actualStatus,
          expectedWaitlist: expectedWaitlist,
          message: reservationResult.data?.message || reservationResult.message,
          date: nextReservationPayload.date,
          classroom: nextReservationPayload.classroom,
        };
        Logger.log(
          `[processSessionConclusion] よやく結果: status=${actualStatus}, isWaitlisted=${isWaitlisted}`,
        );
      } else {
        // 次回よやくの失敗は警告扱いで続行（会計は完了済み）
        Logger.log(
          `[processSessionConclusion] 次回よやく作成失敗（警告）: ${reservationResult.message}`,
        );
        nextReservationResult = {
          created: false,
          message: reservationResult.message,
        };
      }
    }

    // 4. 成功時は最新データを返す
    const latestData = getBatchData(
      ['reservations', 'lessons'],
      null,
      payload.studentId,
    );

    Logger.log(`[processSessionConclusion] 完了`);
    return createApiResponse(true, {
      message: 'セッション終了処理が完了しました。',
      myReservations: latestData.data?.myReservations || [],
      lessons: latestData.data?.lessons || [],
      nextReservationResult: nextReservationResult,
    });
  } catch (error) {
    Logger.log(
      `[processSessionConclusion] エラー: ${error.message}\nStack: ${error.stack}`,
    );
    return createApiErrorResponse(
      `セッション終了処理中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}
