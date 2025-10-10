/**
 * 会計システム統合ファイル
 * 3ファイル（Core_Accounting, Views_Accounting, Handlers_Accounting）を1ファイルに統合
 *
 * アーキテクチャ：
 * - 計算ロジック層：会計計算の核心処理
 * - UI生成層：画面要素の生成
 * - イベント処理層：ユーザー操作の処理
 * - ユーティリティ層：共通処理
 */
/**
 * 会計処理関連のローカルキャッシュをクリア
 */
export function clearAccountingCache(): void;
/**
 * 会計マスタデータを項目種別に分類
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {ClassifiedAccountingItemsCore} 分類済み会計項目
 */
export function classifyAccountingItems(masterData: any[], classroom: string): ClassifiedAccountingItemsCore;
/**
 * 時間単位の計算（30分刻み）
 * @param {string} startTime - 開始時刻 (HH:MM形式)
 * @param {string} endTime - 終了時刻 (HH:MM形式)
 * @param {number} breakTime - 休憩時間（分）
 * @returns {number} 30分単位の数
 */
export function calculateTimeUnits(startTime: string, endTime: string, breakTime?: number): number;
/**
 * 授業料小計計算
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @returns {Object} 授業料計算結果
 */
export function calculateTuitionSubtotal(formData: AccountingFormDto, classifiedItems: ClassifiedAccountingItemsCore, classroom: string): any;
/**
 * 販売小計計算
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @returns {Object} 販売計算結果
 */
export function calculateSalesSubtotal(formData: AccountingFormDto, classifiedItems: ClassifiedAccountingItemsCore): any;
/**
 * 統合計算
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {Object} 統合計算結果
 */
export function calculateAccountingTotal(formData: AccountingFormDto, masterData: any[], classroom: string): any;
/**
 * 時刻選択オプション生成
 * @param {string} selectedValue - 選択済みの値
 * @returns {string} HTML文字列
 */
export function generateTimeOptions(selectedValue?: string): string;
/**
 * 授業料セクション生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} formData - フォームデータ
 * @returns {string} HTML文字列
 */
export function generateTuitionSection(classifiedItems: ClassifiedAccountingItemsCore, classroom: string, formData?: AccountingFormDto): string;
/**
 * 材料行生成（Components.js活用）
 * @param {Array} materialItems - 材料項目配列
 * @param {number} index - 行インデックス
 * @param {Object} materialData - 既存の材料データ
 * @returns {string} HTML文字列
 */
export function generateMaterialRow(materialItems: any[], index?: number, materialData?: any): string;
/**
 * 販売セクション生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {AccountingFormDto} formData - フォームデータ
 * @returns {string} HTML文字列
 */
export function generateSalesSection(classifiedItems: ClassifiedAccountingItemsCore, formData?: AccountingFormDto): string;
/**
 * 物販行生成（Components.js活用）
 * @param {Array} productItems - 物販項目配列
 * @param {number} index - 行インデックス
 * @param {Object} productData - 既存の物販データ
 * @returns {string} HTML文字列
 */
export function generateProductRow(productItems: any[], index?: number, productData?: any): string;
/**
 * 自由入力物販行群生成
 * @param {Array} customSalesData - 自由入力物販データ配列
 * @returns {string} HTML文字列
 */
export function generateCustomSalesRows(customSalesData?: any[]): string;
/**
 * 自由入力物販行生成（物販行と同じデザイン）
 * @param {number} index - 行インデックス
 * @param {Object} itemData - 既存のアイテムデータ
 * @returns {string} HTML文字列
 */
export function generateCustomSalesRow(index?: number, itemData?: any): string;
/**
 * 会計画面用よやくカード生成（ボタン非表示、制作メモ編集モード）
 * @param {Object} reservationData - 予約データ
 * @returns {string} HTML文字列
 */
export function generateAccountingReservationCard(reservationData: any): string;
/**
 * メイン会計画面生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {Object} reservationData - 予約データ（講座基本情報表示用）
 * @returns {string} HTML文字列
 */
export function generateAccountingView(classifiedItems: ClassifiedAccountingItemsCore, classroom: string, formData?: AccountingFormDto, reservationData?: any): string;
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
 * @param {Array} materialItems - 材料項目配列
 */
export function handleMaterialTypeChange(event: Event, materialItems: any[]): void;
/**
 * 材料行追加
 * @param {Array} materialItems - 材料項目配列
 */
export function addMaterialRow(materialItems: any[]): void;
/**
 * 材料行削除
 * @param {string} index - 削除する行のインデックス
 */
export function removeMaterialRow(index: string): void;
/**
 * 物販タイプ変更時の処理
 * @param {Event} event - 変更イベント
 * @param {Array} productItems - 物販項目配列
 */
export function handleProductTypeChange(event: Event, productItems: any[]): void;
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
/**
 * 制作メモのデータを収集
 * @returns {Object} 制作メモデータ
 */
export function collectMemoData(): any;
/**
 * フォームデータ収集
 * @returns {AccountingFormDto} 収集されたフォームデータ
 */
export function collectAccountingFormData(): AccountingFormDto;
/**
 * 会計キャッシュ保存
 * @param {AccountingFormDto} formData - 保存するフォームデータ
 */
export function saveAccountingCache(formData: AccountingFormDto): void;
/**
 * 会計キャッシュ読込
 * @returns {AccountingFormDto} 読み込まれたフォームデータ
 */
export function loadAccountingCache(): AccountingFormDto;
/**
 * 会計システム初期化関数
 * @param {Array} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} initialFormData - 初期フォームデータ
 * @param {Object} reservationData - 予約データ（講座基本情報表示用）
 * @returns {string} 生成された会計画面HTML
 */
export function initializeAccountingSystem(masterData: any[], classroom: string, initialFormData?: AccountingFormDto, reservationData?: any): string;
/**
 * 会計システムクリーンアップ
 */
export function cleanupAccountingSystem(): void;
export function getPaymentOptionsHtml(selectedValue: string): string;
export function getPaymentInfoHtml(selectedPaymentMethod?: string): string;
