/**
 * 会計マスタデータを項目種別に分類
 * @param {AccountingMasterItemCore[]} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {ClassifiedAccountingItemsCore} 分類済み会計項目
 */
export function classifyAccountingItems(masterData: AccountingMasterItemCore[], classroom: string): ClassifiedAccountingItemsCore;
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
 * @returns {{ items: AccountingDetailsCore['tuition']['items']; subtotal: number }} 授業料計算結果
 */
export function calculateTuitionSubtotal(formData: AccountingFormDto, classifiedItems: ClassifiedAccountingItemsCore, classroom: string): {
    items: AccountingDetailsCore["tuition"]["items"];
    subtotal: number;
};
/**
 * 販売小計計算
 * @param {AccountingFormDto} formData - フォームデータ
 * @param {ClassifiedAccountingItemsCore} classifiedItems - 分類済み会計項目
 * @returns {{ items: AccountingDetailsCore['sales']['items']; subtotal: number }} 販売計算結果
 */
export function calculateSalesSubtotal(formData: AccountingFormDto, classifiedItems: ClassifiedAccountingItemsCore): {
    items: AccountingDetailsCore["sales"]["items"];
    subtotal: number;
};
/**
 * 統合計算
 *
 * 注意: この関数はformDataを直接変更します（動的項目の追加・削除）。
 * これは意図的な設計で、時間制授業料の場合に元の項目を削除して
 * 時間計算済みの項目に置き換える必要があるためです。
 *
 * @param {AccountingFormDto} formData - フォームデータ（この関数内で変更される）
 * @param {AccountingMasterItemCore[]} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @returns {AccountingDetailsCore} 統合計算結果
 */
export function calculateAccountingTotal(formData: AccountingFormDto, masterData: AccountingMasterItemCore[], classroom: string): AccountingDetailsCore;
