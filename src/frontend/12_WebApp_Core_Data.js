// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

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
 * 新しい初期データを受け取り、クライアントサイドで処理してappStateを構築する
 * @param {LoginDataResponse['data']} data - getAppInitialDataから返されたデータオブジェクト
 * @param {string} phone - ログイン試行された電話番号
 * @param {LessonData[]} lessons - バックエンドから取得済みの講座情報
 * @param {ReservationData[] | null} [myReservations=null] - ユーザーの予約データ配列
 * @returns {Partial<UIState>} setStateに渡すための新しい状態オブジェクト。ユーザーが見つからない場合は { currentUser: null }
 */
function processInitialData(data, phone, lessons, myReservations = null) {
  // データの安全性確認
  if (!data) {
    console.error('❌ processInitialData: 初期データが存在しません', data);
    return { currentUser: null };
  }

  // 実際のデータ構造に合わせて修正（data.initialではなくdata直下）
  const { allStudents, accountingMaster, cacheVersions, today } = data;

  // 1. 電話番号でユーザーを検索
  if (!allStudents) {
    console.warn('⚠️ processInitialData: allStudentsが存在しません', {
      data,
      allStudents,
    });
    return { currentUser: null };
  }

  const currentUser = Object.values(allStudents).find(
    student => student.phone === phone,
  );

  if (!currentUser) {
    return { currentUser: null }; // ユーザーが見つからない
  }

  // currentUserのdisplayNameをセット
  currentUser.displayName = currentUser.nickname || currentUser.realName;

  // 2. 個人予約データを直接保存（フィルタリングは表示時に実行）
  const reservations = myReservations || [];

  // 4. 講座バージョンを生成
  const lessonsVersion = cacheVersions
    ? `${cacheVersions['allReservations'] || 0}-${cacheVersions['scheduleMaster'] || 0}`
    : null;

  // 5. 会計システムの事前初期化（全教室分）
  preInitializeAccountingSystem(accountingMaster);

  // 6. appStateを構築（フィルタリングされていない生の予約データを保存）
  return {
    view: 'dashboard',
    currentUser: currentUser,
    myReservations: reservations, // 生データを直接保存
    lessons: lessons,
    classrooms: CONSTANTS.CLASSROOMS ? Object.values(CONSTANTS.CLASSROOMS) : [],
    accountingMaster: accountingMaster,
    today: today,
    _allStudents: allStudents,
    _cacheVersions: cacheVersions,
    _lessonsVersion: lessonsVersion, // 講座バージョンを設定（UIStateで定義済み）
  };
}

/**
 * 会計システムの事前初期化（アプリ起動時）
 * 全教室分の会計データを分類してキャッシュし、会計画面への高速遷移を実現
 * @param {Array<any>} accountingMaster - 会計マスタデータ
 */
function preInitializeAccountingSystem(accountingMaster) {
  if (!accountingMaster || accountingMaster.length === 0) {
    console.warn('⚠️ 会計マスタデータが存在しないため、事前初期化をスキップします');
    return;
  }

  try {
    // 全教室の分類済みデータを事前生成
    const classrooms = CONSTANTS.CLASSROOMS ? Object.values(CONSTANTS.CLASSROOMS) : [];
    /** @type {Record<string, ClassifiedAccountingItems>} */
    const preInitializedData = {};

    classrooms.forEach(classroom => {
      if (typeof classifyAccountingItems === 'function') {
        const classifiedItems = classifyAccountingItems(accountingMaster, classroom);
        preInitializedData[classroom] = classifiedItems;
      }
    });

    // グローバルキャッシュに保存
    /** @type {any} */ (window).accountingSystemCache = preInitializedData;

    if (!window.isProduction) {
      console.log('✅ 会計システム事前初期化完了:', {
        classrooms: classrooms.length,
        masterItems: accountingMaster.length
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
    if (window.stateManager && typeof setupViewListener === 'function') {
      setupViewListener();
    }
  });
} else {
  // 既にDOMが読み込み済みの場合は即座に実行
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
      lesson.schedule.date === reservation.date &&
      lesson.schedule.classroom === reservation.classroom,
  );

  if (!matchingLesson) {
    console.warn(
      '⚠️ getScheduleDataFromLessons: 一致する講座が見つかりません',
      {
        date: reservation.date,
        classroom: reservation.classroom,
        availableLessons: lessons.map(l => ({
          date: l.schedule.date,
          classroom: l.schedule.classroom,
        })),
      },
    );
    return null;
  }

  console.log('✅ getScheduleDataFromLessons: 講座発見', matchingLesson);

  // 日程マスタ形式の情報を返す
  const schedule = /** @type {ScheduleInfo} */ (matchingLesson.schedule);
  return {
    classroom: reservation.classroom,
    date: reservation.date,
    classroomType: /** @type {string} */ (
      schedule.classroomType || schedule['教室形式']
    ),
    firstStart: /** @type {string} */ (
      schedule.firstStart || schedule['1部開始']
    ),
    firstEnd: /** @type {string} */ (schedule.firstEnd || schedule['1部終了']),
    secondStart: /** @type {string} */ (
      schedule.secondStart || schedule['2部開始']
    ),
    secondEnd: /** @type {string} */ (
      schedule.secondEnd || schedule['2部終了']
    ),
  };
}
