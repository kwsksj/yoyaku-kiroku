/**
 * =================================================================
 * 【ファイル名】: types/view/components.d.ts
 * 【役割】: Component Props型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

// =================================================================
// 基本型定義
// =================================================================

export type HTMLString = string;
export type ComponentSize = 'normal' | 'full' | 'small' | 'xs' | 'large';
export type ComponentStyle =
  | 'primary'
  | 'secondary'
  | 'attention'
  | 'danger'
  | 'accounting'
  | 'bookingCard'
  | 'recordCard'
  | 'normal'
  | 'none';
export type BadgeType = 'success' | 'warning' | 'error' | 'info' | 'accounting' | 'attention';

// =================================================================
// Component Config（基本設定）
// =================================================================

/**
 * コンポーネント基本設定
 */
export interface ComponentConfig {
  [key: string]: any;
  id?: string;
  action?: string;
  text?: string;
  style?: ComponentStyle;
  size?: ComponentSize;
  disabled?: boolean;
  customClass?: string;
  dataAttributes?: Record<string, string | number | boolean>;
}

/**
 * コンポーネントProps
 */
export interface ComponentProps {
  [key: string]: any;
  id?: string;
  className?: string;
  action?: string;
  text?: string;
  style?: string;
  size?: string;
}

// =================================================================
// Form Components
// =================================================================

/**
 * ボタン設定
 */
export interface ButtonConfig {
  text: string;
  action?: string;
  onClick?: string;
  style?: ComponentStyle;
  type?: ComponentStyle;
  size?: ComponentSize;
  disabled?: boolean;
  customClass?: string;
  dataAttributes?: Record<string, string | number | boolean>;
  id?: string;
  disabledStyle?: 'auto' | 'none' | 'custom';
}

/**
 * 入力フィールド設定
 */
export interface InputConfig {
  id: string;
  label: string;
  type?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  description?: string;
  caption?: string;
  inputMode?: string;
  autocomplete?: string;
  customClass?: string;
  containerClass?: string;
  dataAttributes?: Record<string, string | number | boolean>;
  disabled?: boolean;
}

/**
 * セレクト設定
 */
export interface SelectConfig {
  id: string;
  label: string;
  options: string | Array<{ value?: string; label?: string } | string>;
  selectedValue?: string;
  description?: string;
  caption?: string;
  disabled?: boolean;
  dataAttributes?: Record<string, string | number | boolean>;
  customClass?: string;
}

/**
 * テキストエリア設定
 */
export interface TextareaConfig {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  rows?: number;
  description?: string;
  caption?: string;
  disabled?: boolean;
  dataAttributes?: Record<string, string | number | boolean>;
  customClass?: string;
}

/**
 * チェックボックス設定
 */
export interface CheckboxConfig {
  id: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  dynamicStyle?: boolean;
  dataAttributes?: Record<string, string | number | boolean>;
  description?: string;
  caption?: string;
  onChange?: string;
  customLabelClass?: string;
  required?: boolean;
}

/**
 * ラジオボタングループ設定
 */
export interface RadioGroupConfig {
  name: string;
  label: string;
  options: Array<{ value: string; label: string; checked?: boolean }>;
  selectedValue?: string;
  layout?: 'vertical' | 'horizontal';
  description?: string;
  caption?: string;
}

/**
 * 時刻選択オプション設定
 */
export interface TimeOptionsConfig {
  startTime: string;
  endTime: string;
  interval: number;
  selectedValue?: string;
}

// =================================================================
// Layout Components
// =================================================================

/**
 * ページコンテナ設定
 */
export interface PageContainerConfig {
  content: string;
  maxWidth?: string;
}

/**
 * カードコンテナ設定
 */
export interface CardContainerConfig {
  content: string;
  variant?:
    | 'default'
    | 'highlight'
    | 'success'
    | 'warning'
    | 'available'
    | 'waitlist'
    | 'booked'
    | 'history';
  padding?: 'compact' | 'normal' | 'spacious';
  touchFriendly?: boolean;
  customClass?: string;
  dataAttributes?: string;
  className?: string;
}

// =================================================================
// UI Elements
// =================================================================

/**
 * ステータスバッジ設定
 */
export interface StatusBadgeConfig {
  type: BadgeType;
  text: string;
}

/**
 * 価格表示設定
 */
export interface PriceDisplayConfig {
  amount: number | string;
  label?: string;
  size?: 'small' | 'normal' | 'large';
  style?: 'default' | 'highlight' | 'subtotal' | 'total';
  showCurrency?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * アクションボタンセクション設定
 */
export interface ActionButtonSectionConfig {
  primaryButton?: ButtonConfig;
  secondaryButton?: ButtonConfig;
  dangerButton?: ButtonConfig;
  layout?: 'vertical' | 'horizontal';
  spacing?: 'compact' | 'normal' | 'spacious';
}

/**
 * セクションヘッダー設定
 */
export interface SectionHeaderConfig {
  title: string;
  asSummary?: boolean;
}

/**
 * 小計セクション設定
 */
export interface SubtotalSectionConfig {
  title: string;
  amount: number;
  id?: string;
}

// =================================================================
// Specialized Components
// =================================================================

/**
 * 会計行設定
 */
export interface AccountingRowConfig {
  name: string;
  itemType: string;
  price: number;
  checked?: boolean;
  disabled?: boolean;
}

/**
 * 材料行設定
 */
export interface MaterialRowConfig {
  index: number;
  values?: {
    type?: string;
    l?: string | number;
    w?: string | number;
    h?: string | number;
  };
}

/**
 * その他販売行設定
 */
export interface OtherSalesRowConfig {
  index: number;
  values?: {
    name?: string;
    price?: string | number;
  };
}

/**
 * ダッシュボードセクション設定
 */
export interface DashboardSectionConfig {
  title: string;
  items: string[];
  showNewButton?: boolean;
  newAction?: string;
  showMoreButton?: boolean;
  moreAction?: string;
}

/**
 * リストカード設定
 */
export interface ListCardConfig {
  item: ReservationData;
  badges?: Array<{ type: BadgeType; text: string }>;
  editButtons?: Array<{
    action: string;
    text: string;
    style?: string;
    size?: string;
    details?: any;
  }>;
  accountingButtons?: Array<{
    action: string;
    text: string;
    style?: string;
    details?: any;
  }>;
  type?: 'booking' | 'record' | 'history' | 'accounting';
  isEditMode?: boolean;
  showMemoSaveButton?: boolean;
}

/**
 * メモセクション設定
 */
export interface MemoSectionConfig {
  reservationId: string;
  workInProgress?: string | null;
  isEditMode?: boolean;
  showSaveButton?: boolean;
}

/**
 * ユーザーフォーム設定
 */
export interface UserFormConfig {
  mode: 'register' | 'edit';
  phone?: string;
}

/**
 * モーダル設定
 */
export interface ModalConfig {
  id: string;
  title: string;
  content: string;
  maxWidth?: string;
  showCloseButton?: boolean;
}

/**
 * モーダルダイアログ設定
 */
export interface ModalDialogConfig {
  title?: string;
  message: string;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  confirmColorClass?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * 確認ダイアログ設定
 */
export interface ConfirmDialogConfig {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// =================================================================
// Component Functions
// =================================================================

/**
 * コンポーネント関数
 */
export interface ComponentFunction<T = ComponentProps> {
  (config: T): HTMLString;
}

/**
 * UI コンポーネント関数
 */
export interface UIComponentFunction<TConfig = ComponentConfig> {
  (config: TConfig): HTMLString;
}

/**
 * View生成関数
 */
export interface ViewGenerator {
  (): HTMLString;
}

/**
 * View生成関数（設定付き）
 */
export interface ViewGeneratorWithConfig<T = any> {
  (config: T): HTMLString;
}

/**
 * HTML生成関数
 */
export interface HTMLGeneratorFunction {
  (props?: ComponentProps): string;
}

// =================================================================
// Rendering
// =================================================================

/**
 * レンダリングコンテキスト
 */
export interface RenderContext {
  view: ViewType;
  state: UIState;
  isLoading: boolean;
  error?: string;
}

/**
 * コンポーネントレンダラー
 */
export interface ComponentRenderer {
  render(context: RenderContext): string;
  update(element: HTMLElement, newProps: ComponentProps): void;
}

// =================================================================
// Components Object（グローバル）
// =================================================================

declare global {
  /**
   * Componentsオブジェクト（グローバル）
   */
  export interface ComponentsObject {
    // 基本コンポーネント
    button: (config: ButtonConfig) => string;
    input: (config: InputConfig) => string;
    select: (config: SelectConfig) => string;
    textarea: (config: TextareaConfig) => string;
    checkbox: (config: CheckboxConfig) => string;

    // レイアウト
    pageContainer: (config: PageContainerConfig) => string;
    cardContainer: (config: CardContainerConfig) => string;

    // UI要素
    statusBadge: (config: StatusBadgeConfig) => string;
    priceDisplay: (config: PriceDisplayConfig) => string;
    actionButtonSection: (config: ActionButtonSectionConfig) => string;

    // ページヘッダー
    pageHeader: (config: {
      title: string;
      backAction?: string;
      showBackButton?: boolean;
    }) => string;

    // 会計系
    accountingRow: (config: AccountingRowConfig) => string;
    materialRow: (config: MaterialRowConfig) => string;
    otherSalesRow: (config: OtherSalesRowConfig) => string;
    salesSection: (config: any) => string;

    // リスト・カード
    listCard: (config: ListCardConfig) => string;
    memoSection: (config: MemoSectionConfig) => string;
    dashboardSection: (config: DashboardSectionConfig) => string;
    newReservationCard: (config: ComponentConfig & { action: string }) => string;

    // モーダル
    modal: (config: ModalConfig) => string;
    showModal: (modalId: string) => void;
    closeModal: (modalId: string) => void;
    closeModalOnBackdrop: (event: Event, modalId: string) => void;
    handleModalContentClick: (event: Event) => void;

    // ナビゲーション
    createBackButton: (action?: string, text?: string) => string;
    createSmartBackButton: (currentView: ViewType, appState?: UIState) => string;

    // フォーム関連の追加コンポーネント
    radioGroup: (config: RadioGroupConfig) => string;
    timeOptions: (config: TimeOptionsConfig) => string;

    // UI要素の追加コンポーネント
    sectionHeader: (config: SectionHeaderConfig) => string;
    subtotalSection: (config: SubtotalSectionConfig) => string;
  }

  var Components: ComponentsObject;
}
