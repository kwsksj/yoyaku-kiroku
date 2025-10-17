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

// 【重要】統一定数は 00_Constants.js から自動注入されます
// ビルド時にバックエンドの定数ファイルがフロントエンドJavaScriptの先頭に自動挿入されるため、
// CONSTANTSオブジェクトがグローバルに利用可能になります
//
// 注意: このファイルでは、バックエンド定数との重複を避けるため
// フロントエンド専用の定数のみ定義します

// --- フロントエンド専用定数（バックエンドとの重複なし） ---

// =================================================================
// appWindow グローバル宣言（AI型推論サポート強化）
// =================================================================
// appWindowをグローバルスコープに明示的に宣言することで、
// AIレビューツールの型推論を支援し、false positiveを防止します。
// types/view/window.d.ts で型定義済み

/** @type {Window & typeof globalThis} */
const appWindow = window;

// グローバルスコープにも割り当て（他のファイルからの参照をサポート）
if (typeof globalThis !== 'undefined') {
  globalThis.appWindow = appWindow;
}

/** @type {import('../../types/view/window').EmbedConfig} */
const embedConfig = (appWindow.EmbedConfig = {
  // Googleサイトのヘッダー高さ検出
  detectGoogleSiteOffset: () => {
    try {
      // 1. Googleサイト環境かどうかを検出
      const isInFrame = window.parent !== window;
      let isInGoogleSites = false;

      try {
        isInGoogleSites =
          isInFrame &&
          (window.parent.location.hostname.includes('sites.google.com') ||
            document.referrer.includes('sites.google.com') ||
            window.location.ancestorOrigins?.[0]?.includes('sites.google.com'));
      } catch (_e) {
        // Cross-origin制限でアクセスできない場合は他の方法で判定
        isInGoogleSites =
          isInFrame &&
          (document.referrer.includes('sites.google.com') ||
            window.location.search.includes('embedded=true'));
      }

      if (!isInGoogleSites) {
        return 0; // 直接アクセスの場合はオフセットなし
      }

      // 2. URLパラメータでの手動指定をチェック
      const urlParams = new URLSearchParams(window.location.search);
      const manualOffset = urlParams.get('headerOffset');
      if (manualOffset && !isNaN(parseInt(manualOffset))) {
        const offset = parseInt(manualOffset);
        console.log(`手動指定のヘッダーオフセット: ${offset}px`);
        return offset;
      }

      // 3. ローカルストレージでの記憶設定をチェック
      const savedOffset = localStorage.getItem('googleSitesHeaderOffset');
      if (savedOffset && !isNaN(parseInt(savedOffset))) {
        const offset = parseInt(savedOffset);
        console.log(`記憶されたヘッダーオフセット: ${offset}px`);
        return offset;
      }

      // 4. 動的にヘッダーサイズを検出
      const viewportHeight = window.innerHeight;
      const bodyRect = document.body.getBoundingClientRect();
      const documentHeight = document.documentElement.clientHeight;

      // ビューポートと実際のコンテンツ領域の差からヘッダー高さを推定
      const estimatedHeaderHeight = Math.max(
        0,
        Math.abs(bodyRect.top), // body要素のオフセット
        documentHeight - viewportHeight, // 文書とビューポートの差
      );

      // 5. デバイス・ブラウザ別のデフォルト値
      const isMobile = window.innerWidth <= 768;
      let defaultOffset = 60; // デスクトップデフォルト

      if (isMobile) {
        defaultOffset = 50; // モバイルデフォルト
      }

      // 6. 推定値に基づく調整
      if (estimatedHeaderHeight > 100) {
        return 120; // 大きなヘッダー（新しいGoogleサイト）
      } else if (estimatedHeaderHeight > 50) {
        return 80; // 中程度のヘッダー
      } else if (estimatedHeaderHeight > 0) {
        return Math.max(defaultOffset, estimatedHeaderHeight + 10); // 余裕を持たせる
      }

      return defaultOffset;
    } catch (error) {
      console.log('ヘッダーオフセット検出エラー:', error);
      return 60; // フォールバックオフセット
    }
  },

  // オフセット値をローカルストレージに保存
  saveOffset: (/** @type {number} */ offset) => {
    try {
      localStorage.setItem('googleSitesHeaderOffset', offset.toString());
      console.log(`ヘッダーオフセット保存: ${offset}px`);
    } catch (error) {
      console.log('オフセット保存エラー:', error);
    }
  },

  // 動的スタイル調整の適用
  applyEmbedStyles: () => {
    const offset = embedConfig.detectGoogleSiteOffset();

    if (offset > 0) {
      // オフセット値をローカルストレージに保存
      embedConfig.saveOffset(offset);

      // ページ全体のトップマージンを調整
      const style = document.createElement('style');
      style.id = 'google-sites-embed-styles';
      style.textContent = `
        body {
          margin-top: 0px !important;
          min-height: 100% !important;
        }

        /* フィックス要素の位置調整 */
        .fixed {
          top: 0px !important;
        }

        /* Googleサイト埋め込み用のスムーズスクロール */
        html {
          scroll-behavior: smooth;
          scroll-padding-top: 20px;
        }

        /* オフセット設定ボタン（デバッグ用） */
        .embed-offset-control {
          position: fixed;
          top: ${offset + 10}px;
          right: 10px;
          z-index: 9999;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 5px 10px;
          border-radius: 5px;
          font-size: 12px;
          cursor: pointer;
          display: none;
        }

        /* デバッグモードでのみ表示 */
        body.debug-mode .embed-offset-control {
          display: block;
        }
      `;
      document.head.appendChild(style);

      // デバッグ用のオフセット調整ボタンを追加
      embedConfig.addOffsetControl(offset);

      console.log(
        `Googleサイト環境を検出: ヘッダーオフセット ${offset}px を適用`,
      );
    }
  },

  // デバッグ用オフセット調整コントロールの追加
  addOffsetControl: (/** @type {number} */ currentOffset) => {
    // 既存のコントロールを削除
    const existingControl = document.getElementById('embed-offset-control');
    if (existingControl) {
      existingControl.remove();
    }

    // 新しいコントロールを追加
    const control = document.createElement('div');
    control.id = 'embed-offset-control';
    control.className = 'embed-offset-control';
    control.innerHTML = `オフセット: ${currentOffset}px`;
    control.onclick = () => {
      embedConfig.showOffsetAdjustment();
    };
    document.body.appendChild(control);

    // URLにdebug=trueがある場合はデバッグモードを有効化
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      document.body.classList.add('debug-mode');
    }
  },

  // オフセット調整のモーダル表示
  showOffsetAdjustment: () => {
    const currentOffset = embedConfig.detectGoogleSiteOffset();
    const newOffset = prompt(
      `現在のヘッダーオフセット: ${currentOffset}px\n\n` +
        '新しいオフセット値を入力してください（0-200）:',
      currentOffset.toString(),
    );

    if (newOffset !== null && !isNaN(parseInt(newOffset))) {
      const offset = Math.max(0, Math.min(200, parseInt(newOffset)));
      embedConfig.saveOffset(offset);
      embedConfig.reapplyStyles();
      alert(`ヘッダーオフセットを ${offset}px に設定しました。`);
    }
  },

  // スタイルの再適用
  reapplyStyles: (/** @type {number | undefined} */ _offset) => {
    // 既存のスタイルを削除
    const existingStyle = document.getElementById('google-sites-embed-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // 新しいオフセットで再適用
    embedConfig.applyEmbedStyles();
  },
});

// =================================================================
// 2. DESIGN CONFIGURATION
// =================================================================
appWindow.DesignConfig = /** @type {DesignSystemConfig} */ (
  appWindow.DesignConfig || {
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
        'bg-amber-100 text-amber-900 active:bg-amber-200 border-2 border-amber-300', // 会計 (黄金トーン)
      danger:
        'bg-state-danger-bg text-state-danger-text active:bg-state-danger-hover', // 危険 (落ち着いた赤)
      success:
        'bg-state-success-bg text-state-success-text active:bg-state-success-hover', // 成功 (若葉色)
      paid: 'bg-action-paid-bg text-action-paid-text', // 支払い済み (薄い緑)
      info: 'bg-ui-surface text-brand-text border-2 border-ui-border',
      warning:
        'bg-ui-warning-bg text-ui-warning-text border-2 border-ui-warning-border',
      error:
        'bg-ui-error-bg text-ui-error-text border-2 border-ui-error-border',
    },

    // 教室別のボタン色設定
    classroomColors: {
      tokyo: {
        button: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
        colorClass: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
      },
      numazu: {
        button: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
        colorClass:
          'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
      },
      tsukuba: {
        button:
          'bg-green-50 border-green-200 text-green-800 hover:bg-green-100',
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
      base: 'font-bold rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly',
      full: 'w-[250px] mx-auto block',
      primary:
        'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-primary-bg text-action-primary-text active:bg-action-primary-hover',
      secondary:
        'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-secondary-bg text-action-secondary-text active:bg-action-secondary-hover',
      attention:
        'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-attention-bg text-action-attention-text active:bg-action-attention-hover',
      danger:
        'font-bold py-2.5 px-5 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-action-danger-bg text-action-danger-text active:bg-action-danger-hover',
      accounting:
        'font-bold text-sm py-1.5 px-2 leading-tight rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-amber-100 text-amber-900 active:bg-amber-200 border-2 border-amber-300',
      // カード内ボタン専用スタイル（カードと調和する色）
      bookingCard:
        'font-bold text-sm py-1.5 px-1.5 leading-tight rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-green-100 text-green-800 active:bg-green-200 border-2 border-green-200',
      recordCard:
        'font-bold text-sm py-1.5 px-1.5 leading-tight rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly bg-amber-100 text-amber-800 active:bg-amber-200 border-2 border-amber-200',
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
      card: 'shadow-card rounded-lg border-2 border-solid border-card-border',
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
      background: 'bg-ui-surface border-2 border-ui-border',
      state: {
        available: {
          card: 'bg-state-available-bg border-2 border-state-available-border mobile-card active:bg-state-available-hover',
          text: 'text-state-available-text',
        },
        waitlist: {
          card: 'bg-state-waitlist-bg border-2 border-state-waitlist-border mobile-card',
          text: 'text-state-waitlist-text',
        },
        booked: {
          card: 'bg-state-booked-bg border-2 border-state-booked-border mobile-card',
          text: 'text-state-booked-text',
        },
        history: {
          card: 'bg-amber-50 border-2 border-amber-200 mobile-card',
        },
      },
    },

    // 入力フォームのスタイル
    inputs: {
      container: 'max-w-md mx-auto',
      base: 'text-base w-full p-3 border-2 border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text mobile-input touch-friendly bg-ui-input focus:bg-ui-input-focus transition-all duration-150',
      textarea:
        'text-base w-full p-3 border-2 border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text mobile-input bg-ui-input focus:bg-ui-input-focus transition-all duration-150',
      phone:
        'text-base w-48 max-w-full p-3 border-2 border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-text mobile-input touch-friendly bg-ui-input focus:bg-ui-input-focus transition-all duration-150 font-mono',
    },
  }
);

// =================================================================
// 3. CSS STYLES SETUP
// =================================================================
export const addCustomStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
      /* ========== Viewport Height Fix for Mobile Keyboards ========== */
      body {
        /* min-h-screen の挙動を上書き */
        min-height: 100vh; /* フォールバック */
        min-height: calc(var(--vh, 1vh) * 100);
      }

      /* ========== Font Loading Optimization ========== */
      /* フォントはHTMLのheadセクションで読み込み済み */

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

        --state-available: #1E40AF;  /* Clear blue for available slots */
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
          padding-top: 0;
          min-height: 100%;
        }

        body.embedded-in-google-sites .fixed.top-4 {
          top: 1rem;
        }

        body.embedded-in-google-sites #app {
          min-height: 100%;
        }
      }

      /* より大きなメニューバーの場合 */
      @media screen and (max-width: 480px) {
        body.embedded-in-google-sites {
          padding-top: 0;
          min-height: 100%;
        }

        body.embedded-in-google-sites .fixed.top-4 {
          top: 1rem;
        }

        body.embedded-in-google-sites #app {
          min-height: 100%;
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
      details > summary {
        list-style: none;
        cursor: pointer;
        /* スマホ向けタッチフィードバック */
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
      }
      details > summary::-webkit-details-marker { display: none; }

      /* スマホでのタップ時の視覚的フィードバック */
      details > summary:active {
        transform: scale(0.98);
        transition: transform 0.1s ease;
      }

      /* 矢印の回転アニメーション */
      details[open] > summary .transition-transform {
        transform: rotate(90deg);
      }

      .accounting-item, .reservation-card {
        background-color: var(--brand-surface);
        border: 2px solid var(--ui-border);
        transition: all 0.2s ease;
        position: relative;
      }
      .accounting-item:hover, .reservation-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--brand-accent);
      }

      /* よやくカード専用のほんのり緑系色 */
      .bg-state-booked-bg {
        background-color: #f0fdf4 !important; /* ほんのり緑系の薄い背景 */
      }
      .border-state-booked-border {
        border-color: #bbf7d0 !important; /* 優しい緑系の境界線 */
      }
      .text-state-booked-text {
        color: #15803d !important; /* 落ち着いた緑でコントラスト確保 */
      }

      /* きろくカード専用の茶色・ベージュ系色 */
      .bg-amber-50 {
        background-color: #fffbeb !important; /* 温かみのあるベージュ背景 */
      }
      .border-amber-200 {
        border-color: #fde68a !important; /* 茶色系の境界線 */
      }

      /* ========== レイアウト改善 - memo.md問題対応 ========== */

      /* もどるボタンの位置を右上に固定（問題#3対応） */
      .back-button-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 40;
        transform: none !important; /* 位置ズレ防止（問題#36対応） */
      }

      /* Googleサイト埋め込み時のもどるボタン調整（問題#14対応） */
      body.embedded-in-google-sites .back-button-container {
        top: 1rem;
      }

      @media screen and (max-width: 480px) {
        body.embedded-in-google-sites .back-button-container {
          top: 1rem;
        }
      }

      /* ========== 数字専用等幅フォント ========== */
      .font-mono-numbers {
        font-family: 'JetBrains Mono', 'Inconsolata', 'Monaco', 'Consolas', 'Courier New', monospace;
        font-feature-settings: 'tnum' 1; /* Tabular numbers */
        font-variant-numeric: tabular-nums;
      }

      /* 価格表示専用クラス */
      .price-amount {
        font-family: 'JetBrains Mono', 'Inconsolata', 'Monaco', 'Consolas', 'Courier New', monospace;
        font-feature-settings: 'tnum' 1;
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        display: inline-block;
        min-width: 4.5em;
        text-align: right;
      }

      /* 大きなサイズの価格表示用 */
      .price-amount.large {
        min-width: 5.5em; /* より大きな金額用 */
      }

      /* 小さなサイズの価格表示用 */
      .price-amount.small {
        min-width: 3.5em; /* より小さな金額用 */
      }

      /* 時間表示専用クラス */
      .time-display {
        font-family: 'JetBrains Mono', 'Inconsolata', 'Monaco', 'Consolas', 'Courier New', monospace;
        font-feature-settings: 'tnum' 1;
        font-variant-numeric: tabular-nums;
      }

      /* 電話番号・メールアドレス入力フィールド専用クラス */
      input[type="tel"], input[type="email"] {
        font-family: 'JetBrains Mono', 'Inconsolata', 'Monaco', 'Consolas', 'Courier New', monospace;
        font-feature-settings: 'tnum' 1;
        font-variant-numeric: tabular-nums;
        font-size: 1rem; /* プレースホルダと入力時のフォントサイズを統一 */
      }

      /* メールアドレス入力フィールドを広く */
      input[type="email"] {
        min-width: 280px;
        width: 100%;
      }

      /* プレースホルダのフォントサイズを明示的に設定 */
      input[type="tel"]::placeholder, input[type="email"]::placeholder {
        font-size: 1rem;
        opacity: 0.6;
      }

      /* ========== カスタムプルダウンスタイル ========== */
      .custom-select {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: none;
        background-color: white;
      }

      /* 時間選択プルダウン（中央揃え・矢印なし） */
      .time-select {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: none;
        background-color: white;
        text-align: center;
        padding-right: 0.75rem;
      }

      /* 材料・販売品プルダウン（左揃え・矢印なし） */
      .material-select, .product-select {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: none;
        background-color: white;
        text-align: left;
        padding-right: 0.75rem;
      }

      /* Firefox specific */
      .custom-select::-moz-focus-inner,
      .time-select::-moz-focus-inner,
      .material-select::-moz-focus-inner,
      .product-select::-moz-focus-inner {
        border: 0;
      }

      /* IE specific */
      .custom-select::-ms-expand,
      .time-select::-ms-expand,
      .material-select::-ms-expand,
      .product-select::-ms-expand {
        display: none;
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
        font-weight: 500;
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
        border: 2px solid var(--ui-border-light);
        border-radius: 0.5rem;
        padding: 0.75rem;
        min-height: 4rem;
      }

      .card-memo-section .memo-label {
        font-size: 0.75rem;
        font-weight: 500;
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
        border-top: 2px solid var(--ui-border-light);
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

      /* ========== 埋め込み環境での表示調整 ========== */
      /* 埋め込み時はパディングを無効化してズレを防ぐ */
      .embedded-no-padding {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }

      /* 埋め込み環境での固定ヘッダー調整 */
      body.embedded-in-google-sites .sticky {
        top: 0 !important;
        padding-top: 0.75rem;
        padding-bottom: 0.75rem;
      }

      /* 埋め込み環境でのページヘッダー最適化 */
      body.embedded-in-google-sites .sticky .back-button-container {
        position: relative;
        top: auto;
        right: auto;
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

      /* ========== 会計画面の境界線スタイル ========== */
      . {
        border-top: 2px solid var(--ui-border);
        border-bottom: 2px solid var(--ui-border);
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

        /* もどるボタンのモバイル調整 */
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
export const setupFontLoadingDetection = () => {
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
export const setupPageTransitionManagement =
  /** @type {() => import('../../types/view/window').PageTransitionManager} */ (
    () => {
      let currentView = /** @type {ViewType | null} */ (null);
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
      const handleViewChange = (
        /** @type {ViewType | string | null} */ newView,
        isModal = false,
      ) => {
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
          currentView = /** @type {ViewType | null} */ (newView);
          resetScrollPosition();
        }
      };

      // コンテンツ読み込み完了時の表示制御（問題#6対応）
      const initializeContentVisibility = () => {
        // フォント読み込み完了を待機
        document.fonts.ready.then(() => {
          const contentContainers =
            document.querySelectorAll('.content-container');
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

      // もどるボタンの位置調整（問題#36対応）
      const stabilizeBackButtonPosition = () => {
        const backButtonContainer = /** @type {HTMLElement | null} */ (
          document.querySelector('.back-button-container')
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

      return /** @type {import('../../types/view/window').PageTransitionManager} */ ({
        // PageTransitionManagerインターフェース準拠
        onPageTransition: (/** @type {ViewType} */ newView) => {
          handleViewChange(newView, false);
        },
        saveScrollPosition,
        restoreScrollPosition,
        getCurrentScrollPosition: () => previousScrollPosition,
        setScrollPosition: (/** @type {number} */ position) => {
          previousScrollPosition = position;
          window.scrollTo({ top: position, left: 0, behavior: 'auto' });
        },
        resetScrollPosition,

        // 追加機能（内部実装用）
        handleViewChange,
        initializeContentVisibility,
        stabilizeBackButtonPosition,

        // 統合初期化関数
        initializePage: () => {
          // 初回読み込み時は現在のビューを記録するのみ、スクロールリセットしない
          if (appWindow.stateManager && appWindow.stateManager.getState) {
            currentView = appWindow.stateManager.getState().view;
          }
          initializeContentVisibility();
          stabilizeBackButtonPosition();
        },

        // モーダル操作時専用（showInfo, showConfirm等から呼び出し）
        onModalOpen: () => {
          handleViewChange('modal', true);
        },

        onModalClose: () => {
          handleViewChange(null, true);
        },
      });
    }
  );

// グローバルに公開（StateManagerから使用可能）
appWindow.pageTransitionManager = setupPageTransitionManagement();

// =================================================================
// Mobile & Embedded Site Detection
// =================================================================
export const setupMobileOptimizations = () => {
  // ビューポートの高さをCSSカスタムプロパティとして設定
  const setViewportHeight = () => {
    // window.innerHeight はキーボード表示時に変動する
    // この処理により、vh単位がキーボード表示に影響されなくなる
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    // 埋め込み環境での基本調整のみ
    if (document.body.classList.contains('embedded-in-google-sites')) {
      console.log('Googleサイト埋め込み環境を検出しました');
    }
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
    } catch (_e) {
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
    let viewport = /** @type {HTMLMetaElement | null} */ (
      document.querySelector('meta[name=viewport]')
    );
    if (!viewport) {
      viewport = /** @type {HTMLMetaElement} */ (
        document.createElement('meta')
      );
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
        const target = /** @type {EventTarget | null} */ (e.target);
        if (!(target instanceof Element)) {
          return;
        }

        // スクロール可能なエリア内では許可
        if (
          target.closest(
            '.scrollable, .scroll-container, main, body, [data-view]',
          )
        ) {
          return; // スクロール許可エリア
        }
        // 固定要素（ヘッダー、フッターなど）でのスクロールを防止
        if (target.closest('header, footer, .fixed, .sticky')) {
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
export const setupTailwindCSS = () => {
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
                'available-text': '#1E40AF',
                'available-bg': '#EFF6FF',
                'available-border': '#93C5FD',
                'available-hover': '#DBEAFE',
                'waitlist-text': '#B45309',
                'waitlist-bg': '#FFFBEB',
                'waitlist-border': '#FDE68A',
                'booked-text': '#15803D',
                'booked-bg': '#F0FDF4',
                'booked-border': '#BBF7D0',
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
  const manager = appWindow.pageTransitionManager;
  if (manager && typeof manager?.['initializePage'] === 'function') {
    manager['initializePage']();
  }
});
