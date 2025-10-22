/**
 * 会計システム - UI生成層
 *
 * 責務:
 * - 時刻選択オプション生成
 * - 授業料セクション生成
 * - 販売セクション生成（材料・物販）
 * - 支払い方法UI生成
 * - 会計画面全体のレイアウト生成
 */
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
 * @param {AccountingMasterItemCore[]} materialItems - 材料項目配列
 * @param {number} index - 行インデックス
 * @param {MaterialFormEntry=} materialData - 既存の材料データ
 * @returns {string} HTML文字列
 */
export function generateMaterialRow(materialItems: AccountingMasterItemCore[], index?: number, materialData?: MaterialFormEntry | undefined): string;
/**
 * 販売セクション生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {AccountingFormDto} formData - フォームデータ
 * @returns {string} HTML文字列
 */
export function generateSalesSection(classifiedItems: ClassifiedAccountingItemsCore, formData?: AccountingFormDto): string;
/**
 * 物販行生成（Components.js活用）
 * @param {AccountingMasterItemCore[]} productItems - 物販項目配列
 * @param {number} index - 行インデックス
 * @param {ProductSelectionEntry=} productData - 既存の物販データ
 * @returns {string} HTML文字列
 */
export function generateProductRow(productItems: AccountingMasterItemCore[], index?: number, productData?: ProductSelectionEntry | undefined): string;
/**
 * 自由入力物販行群生成
 * @param {CustomSalesEntry[]} customSalesData - 自由入力物販データ配列
 * @returns {string} HTML文字列
 */
export function generateCustomSalesRows(customSalesData?: CustomSalesEntry[]): string;
/**
 * 自由入力物販行生成（物販行と同じデザイン）
 * @param {number} index - 行インデックス
 * @param {CustomSalesEntry} [itemData={}] - 既存のアイテムデータ
 * @returns {string} HTML文字列
 */
export function generateCustomSalesRow(index?: number, itemData?: CustomSalesEntry): string;
/**
 * 会計画面用よやくカード生成（ボタン非表示、制作メモ編集モード）
 * @param {ReservationCore | null} reservationData - 予約データ
 * @returns {string} HTML文字列
 */
export function generateAccountingReservationCard(reservationData: ReservationCore | null): string;
/**
 * メイン会計画面生成（Components.js活用）
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {ReservationCore | null} reservationData - 予約データ（講座基本情報表示用）
 * @returns {string} HTML文字列
 */
export function generateAccountingView(classifiedItems: ClassifiedAccountingItemsCore, classroom: string, formData?: AccountingFormDto, reservationData?: ReservationCore | null): string;
export function getPaymentOptionsHtml(selectedValue: string): string;
export function getPaymentInfoHtml(selectedPaymentMethod?: string): string;
export type MaterialFormEntry = {
    type: string;
    l?: number;
    w?: number;
    h?: number;
};
export type ProductSelectionEntry = {
    name: string;
    price: number;
};
export type CustomSalesEntry = {
    name?: string;
    price?: number;
};
