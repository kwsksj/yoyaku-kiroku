// @ts-check
/// <reference path="../../types/index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_Core_Data.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、データ処理と環境管理を
 * 集約します。初期データ処理、環境検出、StateManager初期化など。
 * 【構成】: 12_WebApp_Core.jsから分割されたデータ管理ファイル
 * 【新規作成理由】:
 * - メインコアファイルの肥大化対策
 * - データ処理機能の独立性向上
 * - AIの作業効率向上のためのファイル分割
 * =================================================================
 */

// =================================================================
// --- Initial Data Processing ---
// -----------------------------------------------------------------

/**
 * シンプルなダッシュボード状態を構築する（簡素化版）
 * @param {any} currentUser - 軽量認証から取得したユーザー情報
 * @param {ReservationData[]} myReservations - 個人の予約データ
 * @returns {Partial<UIState>} シンプルなダッシュボード状態
 */
function createSimpleDashboardState(currentUser, myReservations) {
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
function preInitializeAccountingSystem(accountingMaster) {
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
    /** @type {Record<string, ClassifiedAccountingItems>} */
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
    /** @type {any} */ (window).accountingSystemCache = preInitializedData;

    if (!window.isProduction) {
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
const detectEnvironment = () => {
  try {
    // GAS環境の検出
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return 'production';
    }
    return 'test';
  } catch (error) {
    return 'test';
  }
};

/**
 * 環境に応じたデータ取得
 * @param {string} dataType - データタイプ
 * @param {unknown} fallback - フォールバックデータ
 */
const getEnvironmentData = (dataType, fallback = null) => {
  const env = detectEnvironment();

  if (env === 'test' && typeof MockData !== 'undefined') {
    return MockData[dataType] || fallback;
  }

  // GAS環境では初期値のみ返し、データは後でAPI呼び出しで取得
  return fallback;
};

// =================================================================
// --- StateManager Initialization ---
// -----------------------------------------------------------------

// StateManagerの再初期化（依存関数が読み込まれた後）
if (
  typeof window.initializeStateManager === 'function' &&
  !window.stateManager
) {
  console.log('🔄 StateManagerを再初期化中...');
  window.initializeStateManager();
}

// StateManagerが初期化された後にビューリスナーを設定
// DOMContentLoadedまたはページ読み込み完了後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Googleサイト埋め込み環境の調整を適用
    if (
      window.EmbedConfig &&
      typeof window.EmbedConfig.applyEmbedStyles === 'function'
    ) {
      window.EmbedConfig.applyEmbedStyles();
    }

    if (window.stateManager && typeof setupViewListener === 'function') {
      setupViewListener();
    }
  });
} else {
  // 既にDOMが読み込み済みの場合は即座に実行

  // Googleサイト埋め込み環境の調整を適用
  if (
    window.EmbedConfig &&
    typeof window.EmbedConfig.applyEmbedStyles === 'function'
  ) {
    window.EmbedConfig.applyEmbedStyles();
  }

  if (window.stateManager && typeof setupViewListener === 'function') {
    setupViewListener();
  }
}

// =================================================================
// --- Modal Management System ---
// -----------------------------------------------------------------

/**
 * モーダル管理オブジェクト
 * カプセル化された方式でモーダルのコールバック処理を管理する
 * グローバル変数の乱用を避けるための設計
 */
window.ModalManager = window.ModalManager || {
  onConfirmCallback: null,

  /**
   * モーダル確認時のコールバック関数を設定
   * @param {() => void} callback - 確認ボタン押下時に実行する関数
   */
  setCallback: function (callback) {
    this.onConfirmCallback = callback;
  },

  /**
   * 設定されたコールバック関数をクリア
   */
  clearCallback: function () {
    this.onConfirmCallback = null;
  },

  /**
   * 設定されたコールバック関数を実行し、自動でクリアする
   * モーダル確認ボタンから呼び出される
   */
  executeCallback: function () {
    if (this.onConfirmCallback) {
      this.onConfirmCallback();
      this.clearCallback();
    }
  },
};

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
function getClassroomTypeFromSchedule(scheduleData) {
  if (!scheduleData) return null;
  return scheduleData['classroomType'] || scheduleData['教室形式'] || null;
}

/**
 * 教室形式が時間制かどうかを判定します
 * @param {ScheduleInfo} scheduleData - 日程マスタのデータオブジェクト
 * @returns {boolean} 時間制の場合true
 */
function isTimeBasedClassroom(scheduleData) {
  const classroomType = getClassroomTypeFromSchedule(scheduleData);
  // 時間制の教室形式をすべてチェック（時間制・2部制、時間制・全日）
  return classroomType && classroomType.includes('時間制');
}

/**
 * バックエンドから特定の日程マスタ情報を取得
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} classroom - 教室名
 * @returns {Promise<ScheduleInfo | null>} 日程マスタ情報またはnull
 */
function getScheduleInfoFromCache(date, classroom) {
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
        if (window.FrontendErrorHandler) {
          window.FrontendErrorHandler.handle(
            error,
            'getScheduleInfoFromCache',
            { date, classroom },
          );
        }
        resolve(null);
      })
      .getScheduleInfo({ date, classroom });
  });
}

/**
 * 予約データから対応する日程マスタ情報を取得
 * @param {ReservationData} reservation - 予約データ (date, classroom を含む)
 * @returns {ScheduleInfo | null} 日程マスタ情報またはnull (lessons経由の場合)
 */
function getScheduleDataFromLessons(reservation) {
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
