/**
 * 会計システム - イベント処理層
 *
 * 責務:
 * - イベントリスナー設定
 * - 入力変更ハンドラー
 * - 材料・物販・自由入力物販の変更処理
 * - 会計計算の更新
 * - UI状態の更新
 * - 支払い処理・モーダル表示
 * - 制作メモ保存処理
 */
/**
 * 会計システムのイベントリスナー設定
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function setupAccountingEventListeners(classifiedItems: ClassifiedAccountingItemsCore, classroom: string): void;
/**
 * 会計入力変更時の処理
 * @param {Event} event - 変更イベント
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function handleAccountingInputChange(event: Event, classifiedItems: ClassifiedAccountingItemsCore, classroom: string): void;
/**
 * チェックボックスのスタイルを更新（項目名と金額の両方）
 * @param {HTMLInputElement} checkbox - チェックボックス要素
 */
export function updateCheckboxStyle(checkbox: HTMLInputElement): void;
/**
 * 材料タイプ変更時の処理
 * @param {Event} event - 変更イベント
 * @param {AccountingMasterItemCore[]} materialItems - 材料項目配列
 */
export function handleMaterialTypeChange(event: Event, materialItems: AccountingMasterItemCore[]): void;
/**
 * 材料行追加
 * @param {AccountingMasterItemCore[]} materialItems - 材料項目配列
 */
export function addMaterialRow(materialItems: AccountingMasterItemCore[]): void;
/**
 * 材料行削除
 * @param {string} index - 削除する行のインデックス
 */
export function removeMaterialRow(index: string): void;
/**
 * 物販タイプ変更時の処理
 * @param {Event} event - 変更イベント
 * @param {AccountingMasterItemCore[]} productItems - 物販項目配列
 */
export function handleProductTypeChange(event: Event, productItems: AccountingMasterItemCore[]): void;
/**
 * 物販行削除
 * @param {string} index - 削除する行のインデックス
 */
export function removeProductRow(index: string): void;
/**
 * 自由入力物販の入力変更処理
 * @param {Event} event - 入力変更イベント
 */
export function handleCustomSalesInputChange(event: Event): void;
/**
 * 自由入力物販行追加
 */
export function addCustomSalesRow(): void;
/**
 * 自由入力物販行削除
 * @param {string} index - 削除する行のインデックス
 */
export function removeCustomSalesRow(index: string): void;
/**
 * 会計計算更新
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function updateAccountingCalculation(classifiedItems: ClassifiedAccountingItemsCore, classroom: string): void;
/**
 * 会計UI更新
 * @param {Object} result - 計算結果
 * @param {string} classroom - 教室名
 */
export function updateAccountingUI(result: any, classroom: string): void;
/**
 * 時間計算表示更新
 * @param {Object} result - 計算結果
 * @param {string} classroom - 教室名
 */
export function updateTimeCalculationDisplay(result: any, classroom: string): void;
/**
 * 材料価格個別表示更新
 * @param {Object} result - 計算結果
 */
export function updateMaterialPricesDisplay(result: any): void;
/**
 * 物販価格個別表示更新
 * @param {Object} result - 計算結果
 */
export function updateProductPricesDisplay(result: any): void;
/**
 * 自由入力物販価格個別表示更新
 * @param {Object} result - 計算結果
 */
export function updateCustomSalesPricesDisplay(result: any): void;
/**
 * 支払い方法UI初期化（既存関数を活用）
 * @param {string} selectedPaymentMethod - 選択済みの支払い方法
 */
export function initializePaymentMethodUI(selectedPaymentMethod?: string): void;
/**
 * 支払い方法変更時の処理（既存関数を活用）
 * @param {string} selectedMethod - 選択された支払い方法
 */
export function handlePaymentMethodChange(selectedMethod: string): void;
/**
 * 支払い方法のラベルスタイルを動的に更新
 * @param {string} selectedMethod - 選択された支払い方法
 */
export function updatePaymentMethodStyles(selectedMethod: string): void;
/**
 * 確認ボタンの有効/無効状態を更新
 */
export function updateConfirmButtonState(): void;
/**
 * 新フォームデータを既存バックエンド形式に変換
 * @param {AccountingFormDto} formData - 新フォームデータ
 * @param {Object} result - 計算結果
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @returns {Object} 既存バックエンド形式のuserInput
 */
export function convertToLegacyFormat(formData: AccountingFormDto, result: any, classifiedItems: ClassifiedAccountingItemsCore): any;
/**
 * ダッシュボード画面にもどる処理
 */
export function handleBackToDashboard(): void;
/**
 * 支払い確認モーダルHTML生成
 * @param {Object} result - 計算結果
 * @param {string} paymentMethod - 支払い方法
 * @returns {string} モーダルHTML
 */
export function generatePaymentConfirmModal(result: any, paymentMethod: string): string;
/**
 * 支払い確認モーダルを表示する処理
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 */
export function showPaymentConfirmModal(classifiedItems: ClassifiedAccountingItemsCore, classroom: string): void;
/**
 * 支払い確認モーダルを閉じる
 */
export function closePaymentConfirmModal(): void;
/**
 * 支払い処理を実行（モーダルから呼び出し）
 */
export function handleProcessPayment(): void;
/**
 * 制作メモ保存処理
 * @param {HTMLElement} target - ボタン要素
 */
export function handleSaveMemo(target: HTMLElement): void;
/**
 * 実際の会計処理を実行
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {Object} result - 計算結果
 */
export function processAccountingPayment(formData: AccountingFormDto, result: any): void;
