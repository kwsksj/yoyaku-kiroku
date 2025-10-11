/**
 * 会計システム - 計算ロジック層
 *
 * 責務:
 * - 会計マスタデータの分類
 * - 時間単位の計算
 * - 授業料・販売の小計計算
 * - 統合計算処理
 */
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
