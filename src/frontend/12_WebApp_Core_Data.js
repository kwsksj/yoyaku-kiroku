/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12_WebApp_Core_Data.js
 * 目的: フロントエンドの初期データ整形と環境判定、StateManager初期化を担う
 * 主な責務:
 *   - 会計データなどの事前計算・キャッシュ化
 *   - 実行環境（GAS/ブラウザ）の判定と適切な初期化フローの選択
 *   - Coreモジュール間の連携（ビューリスナー、エラーハンドラー）のハブ
 * AI向けメモ:
 *   - データ取得処理を追加する際は副作用を明確にし、初期化タイミングに注意する
 * =================================================================
 */

// ================================================================
// ハンドラ系モジュール
// ================================================================
import { setupViewListener } from './12_WebApp_Core.js';

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { classifyAccountingItems } from './12-1_Accounting_Calculation.js';
import { FrontendErrorHandler } from './12_WebApp_Core_ErrorHandler.js';

/**
 * グローバルに登録済みのエラーハンドラーを取得
 * @returns {typeof FrontendErrorHandler}
 */
const getFrontendErrorHandler = () =>
  /** @type {typeof FrontendErrorHandler} */ (
    /** @type {unknown} */ (
      appWindow.FrontendErrorHandler || FrontendErrorHandler
    )
  );

// =================================================================
// --- Initial Data Processing ---
// -----------------------------------------------------------------

/**
 * シンプルなダッシュボード状態を構築する（簡素化版）
 * @param {any} currentUser - 軽量認証から取得したユーザー情報
 * @param {ReservationCore[]} myReservations - 個人の予約データ
 * @returns {Partial<UIState>} シンプルなダッシュボード状態
 */
export function createSimpleDashboardState(currentUser, myReservations) {
  return {
    view: 'dashboard',
    currentUser: currentUser,
    myReservations: myReservations || [],
    // 他のデータは必要時に取得
    lessons: [],
    classrooms: CONSTANTS.CLASSROOMS ? Object.values(CONSTANTS.CLASSROOMS) : [],
    today: new Date().toISOString().split('T')[0], // フロントで生成
  };
}

/**
 * 会計システムの事前初期化（アプリ起動時）
 * 全教室分の会計データを分類してキャッシュし、会計画面への高速遷移を実現
 * @param {Array<any>} accountingMaster - 会計マスタデータ
 */
export function preInitializeAccountingSystem(accountingMaster) {
  if (!accountingMaster || accountingMaster.length === 0) {
    console.warn(
      '⚠️ 会計マスタデータが存在しないため、事前初期化をスキップします',
    );
    return;
  }

  try {
    // 全教室の分類済みデータを事前生成
    const classrooms = CONSTANTS.CLASSROOMS
      ? Object.values(CONSTANTS.CLASSROOMS)
      : [];
    /** @type {Record<string, ClassifiedAccountingItemsCore>} */
    const preInitializedData = {};

    classrooms.forEach(classroom => {
      if (typeof classifyAccountingItems === 'function') {
        const classifiedItems = classifyAccountingItems(
          accountingMaster,
          classroom,
        );
        preInitializedData[classroom] = classifiedItems;
      }
    });

    // グローバルキャッシュに保存
    appWindow.accountingSystemCache = preInitializedData;

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.log('✅ 会計システム事前初期化完了:', {
        classrooms: classrooms.length,
        masterItems: accountingMaster.length,
      });
    }
  } catch (error) {
    console.error('❌ 会計システム事前初期化エラー:', error);
    // エラーが発生してもアプリ全体の動作は継続
  }
}

// =================================================================
// --- Environment Detection & Data Management ---
// -----------------------------------------------------------------
// 実行環境を自動検出し、適切なデータソースを選択します。
// テスト環境: ブラウザ + モックデータ
// 本番環境: Google Apps Script + 実データ
// =================================================================

/**
 * 実行環境の検出
 * @returns {string} 'test' | 'production'
 */
export const detectEnvironment = () => {
  try {
    // GAS環境の検出
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return 'production';
    }
    return 'test';
  } catch (_error) {
    return 'test';
  }
};

/**
 * 環境に応じたデータ取得
 * @param {string} dataType - データタイプ
 * @param {unknown} fallback - フォールバックデータ
 */
export const getEnvironmentData = (dataType, fallback = null) => {
  const env = detectEnvironment();
  const mockData = appWindow.MockData;

  if (env === 'test' && mockData) {
    return mockData[dataType] ?? fallback;
  }

  // GAS環境では初期値のみ返し、データは後でAPI呼び出しで取得
  return fallback;
};

// =================================================================
// --- StateManager Initialization ---
// -----------------------------------------------------------------

// StateManagerの再初期化（依存関数が読み込まれた後）
if (
  typeof appWindow.initializeStateManager === 'function' &&
  !appWindow.stateManager
) {
  console.log('🔄 StateManagerを再初期化中...');
  appWindow.initializeStateManager();
}

// StateManagerが初期化された後にビューリスナーを設定
// DOMContentLoadedまたはページ読み込み完了後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Googleサイト埋め込み環境の調整を適用
    if (
      appWindow.EmbedConfig &&
      typeof appWindow.EmbedConfig.applyEmbedStyles === 'function'
    ) {
      appWindow.EmbedConfig.applyEmbedStyles();
    }

    if (appWindow.stateManager && typeof setupViewListener === 'function') {
      setupViewListener();
    }
  });
} else {
  // 既にDOMが読み込み済みの場合は即座に実行

  // Googleサイト埋め込み環境の調整を適用
  if (
    appWindow.EmbedConfig &&
    typeof appWindow.EmbedConfig.applyEmbedStyles === 'function'
  ) {
    appWindow.EmbedConfig.applyEmbedStyles();
  }

  if (appWindow.stateManager && typeof setupViewListener === 'function') {
    setupViewListener();
  }
}

// =================================================================
// --- Modal Management System (Moved) ---
// -----------------------------------------------------------------
// モーダル管理機能は 12_WebApp_Core_Modal.js に移動しました。
// =================================================================

// =================================================================
// --- Schedule Master Helper Functions ---
// -----------------------------------------------------------------
// 日程マスタデータから情報を取得するヘルパー関数群
// フェーズ1: tuitionItemRule依存からの脱却のための新機能
// =================================================================

/**
 * 日程マスタから教室形式を取得します
 * @param {ScheduleInfo} scheduleData - 日程マスタのデータオブジェクト
 * @returns {string | null} 教室形式 ('時間制' | '回数制' | '材料制') またはnull
 */
export function getClassroomTypeFromSchedule(scheduleData) {
  if (!scheduleData) return null;
  return scheduleData['classroomType'] || scheduleData['教室形式'] || null;
}

/**
 * 教室形式が時間制かどうかを判定します
 * @param {ScheduleInfo} scheduleData - 日程マスタのデータオブジェクト
 * @returns {boolean} 時間制の場合true
 */
export function isTimeBasedClassroom(scheduleData) {
  const classroomType = getClassroomTypeFromSchedule(scheduleData);
  // 時間制の教室形式をすべてチェック（時間制・2部制、時間制・全日）
  return Boolean(classroomType && classroomType.includes('時間制'));
}

/**
 * バックエンドから特定の日程マスタ情報を取得
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} classroom - 教室名
 * @returns {Promise<ScheduleInfo | null>} 日程マスタ情報またはnull
 */
export function getScheduleInfoFromCache(date, classroom) {
  return new Promise(resolve => {
    google.script.run['withSuccessHandler'](
      (
        /** @type {ServerResponse<{ scheduleInfo: ScheduleInfo }>} */ response,
      ) => {
        if (response.success && response.data) {
          console.log(
            '✅ getScheduleInfoFromCache: 日程マスタ情報取得成功',
            response.data.scheduleInfo,
          );
          resolve(response.data.scheduleInfo);
        } else {
          console.warn(
            '⚠️ getScheduleInfoFromCache: 日程マスタ情報が見つかりません',
            { date, classroom, message: response.message },
          );
          resolve(null);
        }
      },
    )
      ['withFailureHandler']((/** @type {Error} */ error) => {
        console.error('❌ getScheduleInfoFromCache: API呼び出しエラー', error);
        getFrontendErrorHandler().handle(error, 'getScheduleInfoFromCache', {
          date,
          classroom,
        });
        resolve(null);
      })
      .getScheduleInfo({ date, classroom });
  });
}

/**
 * 予約データから対応する日程マスタ情報を取得
 * @param {ReservationCore} reservation - 予約データ (date, classroom を含む)
 * @returns {ScheduleInfo | null} 日程マスタ情報またはnull (lessons経由の場合)
 */
export function getScheduleDataFromLessons(reservation) {
  if (!reservation || !reservation.date || !reservation.classroom) {
    console.warn(
      '⚠️ getScheduleDataFromLessons: 予約データが不正',
      reservation,
    );
    return null;
  }

  const state = stateManager.getState();
  const lessons = state.lessons;

  if (!lessons || !Array.isArray(lessons)) {
    console.warn(
      '⚠️ getScheduleDataFromLessons: lessonsが存在しません',
      lessons,
    );
    return null;
  }

  console.log('🔍 getScheduleDataFromLessons: 検索対象', {
    date: reservation.date,
    classroom: reservation.classroom,
    lessonsLength: lessons.length,
  });

  // 予約の日付と教室に対応する講座を検索
  const matchingLesson = lessons.find(
    lesson =>
      lesson.date === reservation.date &&
      lesson.classroom === reservation.classroom,
  );

  if (!matchingLesson) {
    console.warn(
      '⚠️ getScheduleDataFromLessons: 一致する講座が見つかりません',
      {
        date: reservation.date,
        classroom: reservation.classroom,
        availableLessons: lessons.map(l => ({
          date: l.date,
          classroom: l.classroom,
        })),
      },
    );
    return null;
  }

  console.log('✅ getScheduleDataFromLessons: 講座発見', matchingLesson);

  // LessonCoreから日程マスタ形式の情報を返す
  return {
    classroom: reservation.classroom,
    date: reservation.date,
    classroomType: matchingLesson.classroomType || '',
    firstStart: matchingLesson.firstStart || '',
    firstEnd: matchingLesson.firstEnd || '',
    secondStart: matchingLesson.secondStart || '',
    secondEnd: matchingLesson.secondEnd || '',
  };
}
