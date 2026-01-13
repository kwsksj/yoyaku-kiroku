/**
 * =================================================================
 * 【ファイル名】: types/view/design-system.d.ts
 * 【役割】: DesignSystemConfig完全型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

// =================================================================
// デザインシステム - 色設定
// =================================================================

/**
 * デザインシステムの色設定
 */
export interface DesignColors {
  /** メインテキスト */
  text: string;
  /** サブテキスト */
  textSubtle: string;
  /** 薄いテキスト */
  textMuted: string;
  /** プライマリ (テラコッタ) */
  primary: string;
  /** セカンダリ (明るいベージュ) */
  secondary: string;
  /** 注意 (若葉色) */
  attention: string;
  /** 会計 (黄金トーン) */
  accounting: string;
  /** 危険 (落ち着いた赤) */
  danger: string;
  /** 成功 (若葉色) */
  success: string;
  /** 支払い済み (薄い緑) */
  paid: string;
  /** 情報 */
  info: string;
  /** 警告 */
  warning: string;
  /** エラー */
  error: string;
}

// =================================================================
// デザインシステム - 教室別色設定
// =================================================================

/**
 * 教室別の色設定
 */
export interface ClassroomColorConfig {
  /** ボタンスタイル */
  button: string;
  /** カラークラス */
  colorClass: string;
  /** バッジクラス（縁取り線付き） */
  badgeClass: string;
}

/**
 * 教室別色マッピング
 */
export interface ClassroomColors {
  /** 東京教室 */
  tokyo: ClassroomColorConfig;
  /** 沼津教室 */
  numazu: ClassroomColorConfig;
  /** つくば教室 */
  tsukuba: ClassroomColorConfig;
  /** デフォルト */
  default: ClassroomColorConfig;
}

// =================================================================
// デザインシステム - 会場別色設定
// =================================================================

/**
 * 会場別の色設定
 */
export interface VenueColorConfig {
  /** カラークラス */
  colorClass: string;
  /** バッジクラス */
  badgeClass: string;
}

/**
 * 会場別色マッピング
 */
export interface VenueColors {
  /** 浅草橋（東京教室） */
  浅草橋?: VenueColorConfig;
  /** 東池袋（東京教室） */
  東池袋?: VenueColorConfig;
  /** デフォルト */
  default: VenueColorConfig;
  /** 任意の会場名 */
  [key: string]: VenueColorConfig | undefined;
}

// =================================================================
// デザインシステム - ボタンスタイル
// =================================================================

/**
 * ボタンスタイル定義
 */
export interface ButtonStyles {
  /** ベーススタイル */
  base: string;
  /** フル幅ボタン */
  full: string;
  /** プライマリボタン */
  primary: string;
  /** セカンダリボタン */
  secondary: string;
  /** 注意ボタン */
  attention: string;
  /** 危険ボタン */
  danger: string;
  /** 会計ボタン */
  accounting: string;
  /** 予約カード内ボタン */
  bookingCard: string;
  /** 記録カード内ボタン */
  recordCard: string;
}

// =================================================================
// デザインシステム - テキストスタイル
// =================================================================

/**
 * テキストスタイル定義
 */
export interface TextStyles {
  /** 見出し */
  heading: string;
  /** サブ見出し */
  subheading: string;
  /** 本文 */
  body: string;
  /** サブ本文 */
  bodySubtle: string;
  /** キャプション */
  caption: string;
  /** ラベル */
  label: string;
  /** ブロックラベル */
  labelBlock: string;
}

// =================================================================
// デザインシステム - レイアウトスタイル
// =================================================================

/**
 * レイアウトスタイル定義
 */
export interface LayoutStyles {
  /** コンテナ */
  container: string;
  /** パディングなしコンテナ */
  containerNoPadding: string;
  /** セクション */
  section: string;
  /** カード */
  card: string;
  /** 中央揃えコンテンツ */
  centerContent: string;
  /** 両端揃え */
  spaceBetween: string;
}

// =================================================================
// デザインシステム - 角丸スタイル
// =================================================================

/**
 * 角丸スタイル定義
 */
export interface BorderRadiusStyles {
  /** コンテナ/カード用角丸 */
  container: string;
  /** ボタン/入力用角丸 */
  button: string;
  /** バッジ/ピル用角丸 */
  badge: string;
}

// =================================================================
// デザインシステム - ユーティリティスタイル
// =================================================================

/**
 * ユーティリティスタイル定義
 */
export interface UtilStyles {
  /** 非表示 */
  hidden: string;
  /** ローディング中 */
  loading: string;
  /** モバイルフレンドリー */
  mobileFriendly: string;
  /** フレックス中央揃え */
  flexCenter: string;
  /** フレックス両端揃え */
  flexBetween: string;
  /** フル幅 */
  fullWidth: string;
  /** 自動マージン */
  autoMargin: string;
}

// =================================================================
// デザインシステム - カードスタイル
// =================================================================

/**
 * カード状態設定
 */
export interface CardStateConfig {
  /** カードスタイル */
  card: string;
  /** テキストスタイル */
  text: string;
}

/**
 * 履歴カード設定（textなし）
 */
export interface CardHistoryConfig {
  /** カードスタイル */
  card: string;
}

/**
 * カード状態別スタイル
 */
export interface CardStates {
  /** 空き状態 */
  available: CardStateConfig;
  /** 空き連絡希望状態 */
  waitlist: CardStateConfig;
  /** 予約済み状態 */
  booked: CardStateConfig;
  /** 履歴 */
  history: CardHistoryConfig;
}

/**
 * カードスタイル定義
 */
export interface CardStyles {
  /** ベーススタイル */
  base: string;
  /** コンテナスタイル */
  container: string;
  /** 背景スタイル */
  background: string;
  /** 状態別スタイル */
  state: CardStates;
}

// =================================================================
// デザインシステム - 入力フォームスタイル
// =================================================================

/**
 * 入力フォームスタイル定義
 */
export interface InputStyles {
  /** コンテナ */
  container: string;
  /** ベース入力フィールド */
  base: string;
  /** テキストエリア */
  textarea: string;
  /** 電話番号入力 */
  phone: string;
}

// =================================================================
// デザインシステム - 統合型定義
// =================================================================

/**
 * デザインシステム設定（完全型定義版）
 *
 * TS4111警告を完全に排除するために、すべてのプロパティを明示的に定義
 */
export interface DesignSystemConfig {
  /** 色設定 */
  colors: DesignColors;
  /** 教室の表示順序 */
  classroomOrder: string[];
  /** 教室別色設定 */
  classroomColors: ClassroomColors;
  /** 会場別色設定 */
  venueColors: VenueColors;
  /** ボタンスタイル */
  buttons: ButtonStyles;
  /** テキストスタイル */
  text: TextStyles;
  /** レイアウトスタイル */
  layout: LayoutStyles;
  /** 角丸スタイル */
  borderRadius: BorderRadiusStyles;
  /** ユーティリティスタイル */
  utils: UtilStyles;
  /** カードスタイル */
  cards: CardStyles;
  /** 入力フォームスタイル */
  inputs: InputStyles;
}
