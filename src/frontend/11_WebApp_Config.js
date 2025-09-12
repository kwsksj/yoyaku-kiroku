// @ts-check
/// <reference path="../types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 11_WebApp_Config.html
 * 【バージョン】: 1.7
 * 【役割】: WebAppのフロントエンドで使用される設定とスタイル定義
 * 【構成】: 14ファイル構成のうちの11番目
 * 【v1.7での変更点】:
 * - 全体的な配色をよりエネルギッシュで温かみのあるテーマに更新
 * - ボタンのテキストの可読性を向上
 * - 会計ボタンに黄色系の配色を適用
 * - 記録カードに背景色を追加
 * =================================================================
 */

// =================================================================
// 1. APPLICATION CONSTANTS（統一定数システム）
// =================================================================

// 【重要】統一定数は getAppInitialData() で取得される constants オブジェクトを使用
// バックエンドの 00_Constants.js で定義された統一定数がフロントエンドに配信される
//
// 使用例:
// - stateManager.getState().constants.classrooms.TOKYO （'東京教室'）
// - stateManager.getState().constants.headers.STUDENT_ID （'生徒ID'）
// - STATUS.WAITLISTED （'waitlisted'）
// - stateManager.getState().constants.sessions.MORNING （'午前'）
// - BANK.NAME （'ゆうちょ銀行'）
// - stateManager.getState().constants.frontendUi.DISCOUNT_OPTIONS.THIRTY_MIN （30）
//
// 注意: このファイルでは、バックエンド定数との重複を避けるため
// フロントエンド固有の定数のみ定義する

// --- フロントエンド専用定数（統一定数システムに移行済み） ---

// 【移行完了】以下の定数は 00_Constants.js に移行し、constants オブジェクトでアクセス可能
// - ITEM_NAME_DISCOUNT → stateManager.getState().constants.items.DISCOUNT
// - SESSION_MORNING/AFTERNOON/ALL_DAY → stateManager.getState().constants.sessions.MORNING/AFTERNOON/ALL_DAY
// - UNIT_CM3 → stateManager.getState().constants.units.CM3
// - PAYMENT.* → stateManager.getState().constants.paymentDisplay.*
// - BANK_* → BANK.*
// - DISCOUNT_OPTION_* → stateManager.getState().constants.frontendUi.DISCOUNT_OPTIONS.*
// - TIME_STEP_MINUTES → stateManager.getState().constants.frontendUi.TIME_SETTINGS.STEP_MINUTES
// - TIME_END_BUFFER_HOURS → stateManager.getState().constants.frontendUi.TIME_SETTINGS.END_BUFFER_HOURS

// 【互換性】既存コードとの互換性のため、必要に応じて個別定数も利用可能
// 例: const SESSION_MORNING = stateManager.getState().constants.sessions.MORNING;

// 【純粋にフロントエンド専用】以下は本当にフロントエンドでしか使わない定数のみ

// ステータス定数（フロントエンド用 - バックエンドCONSTANTSとの重複を避けるためwindowオブジェクトに設定）
window.STATUS = window.STATUS || {
  CANCELED: '取消', // キャンセル済み
  WAITLISTED: '待機', // キャンセル待ち
  CONFIRMED: '確定', // 予約確定（会計前）
  COMPLETED: '完了', // 完了（会計済み）
};

// =================================================================
// 2. DESIGN CONFIGURATION
// =================================================================
window.DesignConfig = window.DesignConfig || {
  // テキストや背景の色設定（温かみと活気のある配色）
  colors: {
    text: 'text-brand-text', // メインテキスト
    textSubtle: 'text-brand-subtle', // サブテキスト
    textMuted: 'text-brand-muted', // 薄いテキスト
    primary:
      'bg-action-primary-bg text-action-primary-text active:bg-action-primary-hover', // プライマリ (テラコッタ)
    secondary:
      'bg-action-secondary-bg text-action-secondary-text active:bg-action-secondary-hover', // セカンダリ (明るいベージュ)
    attention:
      'bg-action-attention-bg text-action-attention-text active:bg-action-attention-hover', // 注意 (若葉色)
    accounting:
      'bg-action-accounting-bg text-action-accounting-text active:bg-action-accounting-hover', // 会計 (アンバー)
    danger:
      'bg-state-danger-bg text-state-danger-text active:bg-state-danger-hover', // 危険 (落ち着いた赤)
    success:
      'bg-state-success-bg text-state-success-text active:bg-state-success-hover', // 成功 (若葉色)
    paid: 'bg-action-paid-bg text-action-paid-text', // 支払い済み (薄い緑)
    info: 'bg-ui-surface text-brand-text border border-ui-border',
    warning:
      'bg-ui-warning-bg text-ui-warning-text border border-ui-warning-border',
    error: 'bg-ui-error-bg text-ui-error-text border border-ui-error-border',
  },

  // 教室別のボタン色設定
  classroomColors: {
    tokyo: {
      button: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
      colorClass: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
    },
    numazu: {
      button: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
      colorClass: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
    },
    tsukuba: {
      button: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100',
      colorClass:
        'bg-green-50 border-green-200 text-green-800 hover:bg-green-100',
    },
    default: {
      button:
        'bg-state-available-bg border-state-available-border text-brand-text hover:bg-gray-50',
      colorClass:
        'bg-state-available-bg border-state-available-border text-brand-text hover:bg-gray-50',
    },
  },

  // ボタンの基本スタイル
  buttons: {
    base: 'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly',
    full: 'w-[250px] mx-auto block',
    primary:
      'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-primary-bg text-action-primary-text active:bg-action-primary-hover',
    secondary:
      'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-secondary-bg text-action-secondary-text active:bg-action-secondary-hover',
    attention:
      'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-attention-bg text-action-attention-text active:bg-action-attention-hover',
    accounting:
      'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-accounting-bg text-action-accounting-text active:bg-action-accounting-hover',
  },

  // テキストスタイル設定
  text: {
    heading: 'text-xl font-bold text-brand-text',
    subheading: 'text-lg font-medium text-brand-text',
    body: 'text-base text-brand-text',
    bodySubtle: 'text-base text-brand-subtle',
    caption: 'text-sm text-brand-subtle',
    label: 'text-base font-bold text-brand-text',
    labelBlock: 'block text-brand-text text-base font-bold mb-2',
  },

  // レイアウトユーティリティ
  layout: {
    container: 'max-w-screen-sm mx-auto p-4',
    containerNoPadding: 'max-w-screen-sm mx-auto',
    section: 'mb-8',
    card: 'shadow-card rounded-lg border border-solid border-card-border',
    centerContent: 'flex items-center justify-center',
    spaceBetween: 'flex items-center justify-between',
  },

  // ユーティリティクラス
  utils: {
    hidden: 'hidden',
    loading: 'opacity-50 pointer-events-none',
    mobileFriendly: 'mobile-button touch-friendly',
    flexCenter: 'flex items-center justify-center',
    flexBetween: 'flex items-center justify-between',
    fullWidth: 'w-full',
    autoMargin: 'mx-auto',
  },

  // カードスタイル
  cards: {
    base: 'w-full text-left p-3 rounded-lg mobile-card touch-friendly transition-all duration-150',
    container: 'max-w-md mx-auto space-y-3',
    background: 'bg-ui-surface border border-ui-border',
    state: {
      available: {
        card: 'bg-state-available-bg border border-state-available-border mobile-card active:bg-state-success-hover',
        text: 'text-state-available-text',
      },
      waitlist: {
        card: 'bg-state-waitlist-bg border border-state-waitlist-border mobile-card',
        text: 'text-state-waitlist-text',
      },
      booked: {
        card: 'bg-state-booked-bg border border-state-booked-border mobile-card',
        text: 'text-state-booked-text',
      },
      history: {
        card: 'bg-brand-light border border-ui-border mobile-card',
      },
    },
  },

  // 入力フォームのスタイル
  inputs: {
    container: 'max-w-md mx-auto',
    base: 'text-lg w-full p-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text mobile-input touch-friendly bg-ui-input focus:bg-ui-input-focus transition-all duration-150',
    textarea:
      'text-lg w-full p-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text h-24 mobile-input bg-ui-input focus:bg-ui-input-focus transition-all duration-150',
  },
};

// =================================================================
// 3. CSS STYLES SETUP
// =================================================================
const addCustomStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
      /* ========== Viewport Height Fix for Mobile Keyboards ========== */
      body {
        /* min-h-screen の挙動を上書き */
        min-height: 100vh; /* フォールバック */
        min-height: calc(var(--vh, 1vh) * 100);
      }

      /* ========== Font Loading Optimization ========== */
      @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');

      /* Prevent FOUT (Flash of Unstyled Text) */
      .font-loading {
        visibility: hidden;
      }

      .fonts-loaded .font-loading {
        visibility: visible;
      }

      /* ========== CSS Variables - kibori-class.net完全調和デザイン ========== */
      :root {
        /* Energetic and warm theme for a wood carving school */
        --brand-text: #4E342E;       /* Dark Brown for high readability */
        --brand-subtle: #785A4E;     /* Medium Brown for sub-text */
        --brand-muted: #A1887F;      /* Lighter, soft brown */
        --brand-bg: #FFFDF5;         /* Warm, very light cream background */
        --brand-surface: #FFFFFF;    /* White for card backgrounds for a clean look */
        --brand-light: #F5F1ED;      /* Light, warm beige for hover states */

        --action-primary: #C86F34;   /* Energetic terracotta for main actions */
        --action-secondary: #E4CDBA; /* Light, warm beige for secondary actions */
        --action-attention: #5A8C36; /* Lively, fresh green for attention */
        --action-accounting: #F59E0B;/* Bright amber for accounting actions */
        --action-danger: #B91C1C;    /* A clear, strong red for danger */

        --state-available: #5A8C36;  /* Lively green for available slots */
        --state-waitlist: #F59E0B;   /* Bright amber for waitlist */
        --state-booked: #785A4E;     /* Medium brown for booked slots */

        /* UI要素 - より洗練された境界線と背景 */
        --ui-border: #D4C4B8;        /* 温かみのあるベージュ境界線 */
        --ui-border-light: #E8DDD6;  /* より薄い境界線 */
        --ui-input: #FAFAFA;         /* 入力フィールド背景 */
        --ui-input-focus: #FFFFFF;   /* フォーカス時背景 */
        --ui-surface: #FFFFFF;       /* サーフェス背景 */

        /* モーダルとオーバーレイ */
        --modal-overlay: rgba(73, 59, 49, 0.6); /* ブランドカラーベースのオーバーレイ */
        --spinner-border: #f3f4f6;

        /* 影とエフェクト */
        --shadow-sm: 0 1px 2px 0 rgba(73, 59, 49, 0.05);
        --shadow-md: 0 4px 6px -1px rgba(73, 59, 49, 0.1);
        --shadow-lg: 0 10px 15px -3px rgba(73, 59, 49, 0.1);
      }

      /* ========== Base Styles ========== */
      body {
        font-family: 'Zen Kaku Gothic New', sans-serif;
        color: var(--brand-text);
        background-color: var(--brand-bg);
        line-height: 1.6;
        /* モバイル環境でのGoogleサイト埋め込み対応 */
        padding-top: env(safe-area-inset-top, 0);
      }

      /* Googleサイト埋め込み時のモバイル対応 */
      @media screen and (max-width: 768px) {
        body.embedded-in-google-sites {
          padding-top: 60px; /* Googleサイトのメニューバー分の余白 */
        }

        body.embedded-in-google-sites .fixed.top-4 {
          top: 70px; /* 戻るボタン位置を調整 */
        }

        .app-container {
          min-height: calc(100vh - 60px);
        }
      }

      /* より大きなメニューバーの場合 */
      @media screen and (max-width: 480px) {
        body.embedded-in-google-sites {
          padding-top: 80px;
        }

        body.embedded-in-google-sites .fixed.top-4 {
          top: 90px; /* より小さなスクリーンでの戻るボタン調整 */
        }

        .app-container {
          min-height: calc(100vh - 80px);
        }
      }

      /* ========== Mobile-Friendly Components ========== */
      .mobile-button, .mobile-input, .mobile-card {
        min-height: 48px;
      }
      .touch-friendly {
        touch-action: pan-y pinch-zoom;
      }

      .scroll-container {
        touch-action: pan-y;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* ========== Animations ========== */
      .fade-in { animation: fadeInUp 0.3s ease-out; }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .spinner {
        border: 4px solid var(--spinner-border);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border-left-color: var(--brand-text);
        animation: spin 1s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ========== Layout Components ========== */
      #loading { z-index: 100; }
      .modal-overlay {
        position: fixed; inset: 0; background-color: var(--modal-overlay);
        display: flex; align-items: center; justify-content: center;
        z-index: 50; opacity: 0; transition: opacity 0.3s ease;
        pointer-events: none; backdrop-filter: blur(3px);
      }
      .modal-overlay.active { opacity: 1; pointer-events: auto; }
      #custom-modal {
        opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
      }
      #custom-modal.active { opacity: 1; pointer-events: auto; }
      /* 汎用モーダルのフェードインアニメーション */
      .modal-fade {
        opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
      }
      .modal-fade.active { opacity: 1; pointer-events: auto; }
      /* ローディング画面のフェードアニメーション */
      .loading-fade {
        opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
      }
      .loading-fade.active { opacity: 1; pointer-events: auto; }
      /* ローディング画面の背景を少し透明にして滑らかな遷移を実現 */
      #loading { background-color: rgba(255, 255, 255, 0.95); backdrop-filter: blur(2px); }
      .modal-content {
        background: white; padding: 1.5rem; border-radius: 0.75rem;
        width: 90%; max-width: 400px; text-align: center;
        max-height: 85vh; overflow-y: auto;
      }
      .modal-content p { margin-bottom: 1.25rem; }
      .modal-content .modal-buttons { justify-content: center; }

      /* ========== Custom Components ========== */
      details > summary { list-style: none; cursor: pointer; }
      details > summary::-webkit-details-marker { display: none; }

      .accounting-item, .reservation-card {
        background-color: var(--brand-surface);
        border: 1px solid var(--ui-border);
        transition: all 0.2s ease;
        position: relative;
      }
      .accounting-item:hover, .reservation-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--brand-accent);
      }

      /* ========== レイアウト改善 - memo.md問題対応 ========== */

      /* 戻るボタンの位置を右上に固定（問題#3対応） */
      .back-button-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 40;
        transform: none !important; /* 位置ズレ防止（問題#36対応） */
      }

      /* Googleサイト埋め込み時の戻るボタン調整（問題#14対応） */
      body.embedded-in-google-sites .back-button-container {
        top: 70px;
      }

      @media screen and (max-width: 480px) {
        body.embedded-in-google-sites .back-button-container {
          top: 90px;
        }
      }

      /* ========== 新カードレイアウト - よやく・きろくカード ========== */

      .booking-card, .record-card {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        position: relative;
      }

      /* カード上部: 教室情報 + 編集ボタン */
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .card-class-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .card-class-info .class-datetime {
        font-weight: 600;
        color: var(--brand-text);
        font-size: 1rem;
      }

      .card-class-info .class-venue {
        color: var(--brand-subtle);
        font-size: 0.875rem;
      }

      .card-edit-button {
        flex-shrink: 0;
        align-self: flex-start;
      }

      .card-edit-button button {
        font-size: 0.75rem;
        padding: 0.375rem 0.75rem;
        white-space: nowrap;
      }

      /* カード中央: 制作メモエリア */
      .card-memo-section {
        background-color: var(--brand-light);
        border: 1px solid var(--ui-border-light);
        border-radius: 0.5rem;
        padding: 0.75rem;
        min-height: 4rem;
      }

      .card-memo-section .memo-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--brand-subtle);
        margin-bottom: 0.5rem;
        display: block;
      }

      .card-memo-section .memo-content {
        color: var(--brand-text);
        font-size: 0.875rem;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .card-memo-section .memo-empty {
        color: var(--brand-muted);
        font-style: italic;
      }

      /* カード下部: 予約日以降に表示される会計ボタン */
      .card-accounting-section {
        border-top: 1px solid var(--ui-border-light);
        padding-top: 0.75rem;
        display: flex;
        justify-content: center;
      }

      .card-accounting-section button {
        min-width: 150px;
      }

      /* 予約日未満の場合は会計セクションを非表示 */
      .card-accounting-section.hidden {
        display: none;
      }

      /* ボタン配置の統一（問題#27,33対応） */
      .button-group {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
        margin: 1rem 0;
      }

      /* 左寄せが適切なページでは左寄せを維持 */
      .button-group.left-aligned {
        justify-content: flex-start;
      }

      /* オレンジ色ボタンの配置修正（問題#27対応） */
      .button-group button.accounting {
        flex-shrink: 0;
      }

      /* モーダル長さ制限（問題#15対応） */
      .modal-content {
        max-height: 80vh;
        overflow-y: auto;
      }

      @media screen and (max-height: 600px) {
        .modal-content {
          max-height: 70vh;
        }
      }

      /* ========== ページ遷移とスクロール位置管理（問題#16対応） ========== */
      .page-container {
        min-height: 100vh;
        scroll-behavior: smooth;
      }

      /* ページ遷移時のスクロール位置リセット */
      .view-transition {
        animation: pageSlideIn 0.3s ease-out;
      }

      @keyframes pageSlideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ========== 文字のちらつき防止（問題#6対応） ========== */
      .content-container {
        opacity: 0;
        transition: opacity 0.2s ease-in;
      }

      .content-container.loaded {
        opacity: 1;
      }

      /* フォント読み込み完了まで非表示 */
      .font-loading .content-container {
        visibility: hidden;
      }

      /* ========== Skeleton Loading States ========== */
      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
      }
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* ========== Enhanced Responsive Design ========== */

      /* タブレット用調整 */
      @media screen and (min-width: 641px) and (max-width: 1024px) {
        .container {
          max-width: 600px;
          padding: 2rem;
        }

        .button-group {
          gap: 1rem;
        }

        .reservation-card .card-actions button {
          font-size: 0.875rem;
          padding: 0.5rem 1rem;
        }
      }

      /* スマートフォン用調整 */
      @media (max-width: 640px) {
        .modal-content {
          width: 95%;
          padding: 1rem;
          margin: 1rem;
        }
        .mobile-button, .mobile-input { font-size: 16px; }

        /* ボタングループの小画面対応 */
        .button-group {
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .button-group button {
          width: 100%;
          max-width: 280px;
        }

        /* 戻るボタンのモバイル調整 */
        .back-button-container {
          top: 0.5rem;
          right: 0.5rem;
        }

        .back-button-container button {
          padding: 0.5rem;
          font-size: 0.875rem;
        }

        /* カードのモバイル最適化 */
        .booking-card, .record-card {
          padding: 0.5rem;
          gap: 0.5rem;
        }

        .card-header {
          flex-direction: column;
          gap: 0.75rem;
          align-items: stretch;
        }

        .card-edit-button {
          align-self: center;
        }

        .card-edit-button button {
          width: 100%;
          max-width: 120px;
        }

        .card-memo-section {
          padding: 0.5rem;
        }

        .card-accounting-section button {
          width: 100%;
          max-width: 200px;
        }
      }

      /* 極小画面（320px以下）対応 */
      @media (max-width: 320px) {
        .container {
          padding: 0.5rem;
        }

        .button-group button {
          font-size: 0.875rem;
          padding: 0.75rem;
        }

        .modal-content {
          margin: 0.5rem;
          padding: 0.75rem;
        }
      }
    `;
  document.head.appendChild(style);
};

// =================================================================
// Font Loading Detection
// =================================================================
const setupFontLoadingDetection = () => {
  if ('fonts' in document) {
    document.fonts.ready.then(() => {
      document.documentElement.classList.add('fonts-loaded');
    });
  } else {
    // Fallback for older browsers
    setTimeout(() => {
      document.documentElement.classList.add('fonts-loaded');
    }, 1000);
  }
};

// =================================================================
// Page Transition & Content Loading Management
// =================================================================
const setupPageTransitionManagement = () => {
  let currentView = null;
  let previousScrollPosition = 0;

  // ページ遷移時のスクロール位置リセット（問題#16対応）
  const resetScrollPosition = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  // スクロール位置を保存
  const saveScrollPosition = () => {
    previousScrollPosition = window.scrollY;
  };

  // スクロール位置を復元
  const restoreScrollPosition = () => {
    window.scrollTo({
      top: previousScrollPosition,
      left: 0,
      behavior: 'auto',
    });
  };

  // ページ遷移の判定とスクロール管理
  const handleViewChange = (newView, isModal = false) => {
    const hasViewChanged = currentView !== newView;

    if (isModal) {
      // モーダル開閉：スクロール位置を保持
      if (newView) {
        // モーダル開く時：現在位置を保存
        saveScrollPosition();
      } else {
        // モーダル閉じる時：位置を復元
        restoreScrollPosition();
      }
    } else if (hasViewChanged && newView) {
      // 実際のページ遷移：スクロール位置をリセット
      currentView = newView;
      resetScrollPosition();
    }
  };

  // コンテンツ読み込み完了時の表示制御（問題#6対応）
  const initializeContentVisibility = () => {
    // フォント読み込み完了を待機
    document.fonts.ready.then(() => {
      const contentContainers = document.querySelectorAll('.content-container');
      contentContainers.forEach(container => {
        container.classList.add('loaded');
      });
    });

    // ページ遷移アニメーション
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer) {
      pageContainer.classList.add('view-transition');
    }
  };

  // 戻るボタンの位置調整（問題#36対応）
  const stabilizeBackButtonPosition = () => {
    const backButtonContainer = document.querySelector(
      '.back-button-container',
    );
    if (backButtonContainer) {
      // 位置の強制リセット
      backButtonContainer.style.transform = 'none';
      backButtonContainer.style.transition = 'none';

      // 少し待ってからtransitionを復活（スムーズな動作のため）
      setTimeout(() => {
        backButtonContainer.style.transition = 'all 0.2s ease';
      }, 100);
    }
  };

  return {
    resetScrollPosition,
    saveScrollPosition,
    restoreScrollPosition,
    handleViewChange,
    initializeContentVisibility,
    stabilizeBackButtonPosition,

    // 統合初期化関数
    initializePage: () => {
      // 初回読み込み時は現在のビューを記録するのみ、スクロールリセットしない
      if (window.stateManager && window.stateManager.getState) {
        currentView = window.stateManager.getState().view;
      }
      initializeContentVisibility();
      stabilizeBackButtonPosition();
    },

    // ページ遷移時専用初期化（StateManagerから呼び出し）
    onPageTransition: newView => {
      handleViewChange(newView, false);
    },

    // モーダル操作時専用（showInfo, showConfirm等から呼び出し）
    onModalOpen: () => {
      handleViewChange('modal', true);
    },

    onModalClose: () => {
      handleViewChange(null, true);
    },
  };
};

// グローバルに公開（StateManagerから使用可能）
window.pageTransitionManager = setupPageTransitionManagement();

// =================================================================
// Mobile & Embedded Site Detection
// =================================================================
const setupMobileOptimizations = () => {
  // ビューポートの高さをCSSカスタムプロパティとして設定
  const setViewportHeight = () => {
    // window.innerHeight はキーボード表示時に変動する
    // この処理により、vh単位がキーボード表示に影響されなくなる
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  // 初期化時とウィンドウサイズ変更時に実行
  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);

  // Googleサイト埋め込み検知
  const detectEmbeddedEnvironment = () => {
    try {
      // iframe内での実行かどうかを判定
      const isInIframe = window.self !== window.top;

      // Googleサイトのreferrerを検知
      const isFromGoogleSites = document.referrer.includes('sites.google.com');

      // URLのクエリパラメータでの判定（将来的な拡張用）
      const urlParams = new URLSearchParams(window.location.search);
      const embedParam = urlParams.get('embedded');

      return isInIframe || isFromGoogleSites || embedParam === 'true';
    } catch (e) {
      // Cross-origin制限でエラーが発生した場合、埋め込み環境と判定
      return true;
    }
  };

  // モバイル環境の検知
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) || window.innerWidth <= 768;

  // viewport設定の最適化
  const optimizeViewport = () => {
    let viewport = document.querySelector('meta[name=viewport]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }

    if (isMobile) {
      viewport.content =
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    } else {
      viewport.content = 'width=device-width, initial-scale=1.0';
    }
  };

  // 埋め込み環境での調整を適用
  if (detectEmbeddedEnvironment()) {
    document.body.classList.add('embedded-in-google-sites');

    // 必要に応じて追加の調整
    if (isMobile) {
      document.body.classList.add('mobile-embedded');
    }
  }

  optimizeViewport();

  // タッチ操作の最適化
  if (isMobile) {
    document.body.classList.add('touch-device');

    // iOS Safariでのバウンス効果を制御（より柔軟に）
    document.addEventListener(
      'touchmove',
      e => {
        // スクロール可能なエリア内では許可
        if (
          e.target.closest(
            '.scrollable, .scroll-container, main, body, [data-view]',
          )
        ) {
          return; // スクロール許可エリア
        }
        // 固定要素（ヘッダー、フッターなど）でのスクロールを防止
        if (e.target.closest('header, footer, .fixed, .sticky')) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }
};

// =================================================================
// 4. TAILWIND CSS SETUP
// =================================================================
// 注意: CDN版Tailwindは本番環境では推奨されませんが、Google Apps Script環境では
// PostCSS pluginやTailwind CLIの利用が困難なため、CDN版を使用しています。
const setupTailwindCSS = () => {
  const tailwindScript = document.createElement('script');
  tailwindScript.src = 'https://cdn.tailwindcss.com';

  tailwindScript.onload = function () {
    // @ts-ignore
    if (window.tailwind) {
      // @ts-ignore
      window.tailwind.config = {
        theme: {
          extend: {
            fontSize: { '2xs': '0.625rem' },
            fontFamily: { sans: ['Zen Kaku Gothic New', 'sans-serif'] },
            colors: {
              brand: {
                bg: '#FFFDF5',
                surface: '#FFFFFF',
                text: '#4E342E',
                subtle: '#785A4E',
                light: '#F5F1ED',
                dark: '#4E342E',
                muted: '#A1887F',
              },
              action: {
                'primary-bg': '#C86F34',
                'primary-text': '#FFFFFF',
                'primary-hover': '#A95B2A',
                'secondary-bg': '#E4CDBA',
                'secondary-text': '#4E342E', // Improved contrast
                'secondary-hover': '#D7BCA9',
                'attention-bg': '#5A8C36',
                'attention-text': '#FFFFFF',
                'attention-hover': '#4A732C',
                'accounting-bg': '#F59E0B', // Amber
                'accounting-text': '#4E342E', // Dark text for readability
                'accounting-hover': '#D97706',
                'danger-bg': '#B91C1C',
                'danger-text': '#FFFFFF',
                'danger-hover': '#991B1B',
                'paid-bg': '#F0FDF4',
                'paid-text': '#166534',
              },
              state: {
                'available-text': '#166534',
                'available-bg': '#F0FDF4',
                'available-border': '#A7F3D0',
                'available-hover': '#D1FAE5',
                'waitlist-text': '#B45309',
                'waitlist-bg': '#FFFBEB',
                'waitlist-border': '#FDE68A',
                'booked-text': '#44403C',
                'booked-bg': '#F5F5F4',
                'booked-border': '#E7E5E4',
                'success-bg': '#F0FDF4',
                'success-text': '#166534',
                'success-border': '#A7F3D0',
                'success-hover': '#D1FAE5',
                'danger-bg': '#FEF2F2',
                'danger-text': '#B91C1C',
                'danger-border': '#FECACA',
                'danger-hover': '#FEE2E2',
              },
              ui: {
                border: '#E4CDBA',
                'border-light': '#F5F1ED',
                surface: '#FFFFFF',
                input: '#FAFAFA',
                'input-focus': '#FFFFFF',
                'error-text': '#B91C1C',
                'error-bg': '#FEF2F2',
                'error-border': '#FECACA',
                'warning-text': '#B45309',
                'warning-bg': '#FFFBEB',
                'warning-border': '#FDE68A',
                'link-text': '#0369A1',
                'weekend-sunday': '#B91C1C',
                'weekend-saturday': '#0369A1',
              },
            },
          },
        },
      };
    }
  };

  tailwindScript.onerror = function () {
    console.warn('[CONFIG] Tailwind CSS読み込みに失敗しました');
  };

  document.head.appendChild(tailwindScript);
};

// =================================================================
// 5. INITIALIZATION
// =================================================================
addCustomStyles();
setupTailwindCSS();
setupFontLoadingDetection();
setupMobileOptimizations();

// DOM読み込み完了後にページ遷移管理を初期化
document.addEventListener('DOMContentLoaded', () => {
  if (window.pageTransitionManager) {
    window.pageTransitionManager.initializePage();
  }
});
