/**
 * 会計システム - ユーティリティ層
 *
 * 責務:
 * - キャッシュ管理（clearAccountingCache, saveAccountingCache, loadAccountingCache）
 * - データ収集（collectMemoData, collectAccountingFormData）
 * - システム初期化・クリーンアップ（initializeAccountingSystem, cleanupAccountingSystem）
 */
/**
 * 会計処理関連のローカルキャッシュをクリア
 */
export function clearAccountingCache(): void;
/**
 * 制作メモのデータを収集
 * @returns {{ reservationId?: string; sessionNote?: string }} 制作メモデータ
 */
export function collectMemoData(): {
    reservationId?: string;
    sessionNote?: string;
};
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
 * よやくデータから会計詳細をロードする（会計修正用）
 *
 * @param {ReservationCore} reservation - よやくデータ
 * @returns {AccountingFormDto} フォームデータ
 *
 * @description
 * 既存の会計データをフォームに復元するための関数。
 * 会計修正モードで使用され、保存済みの会計詳細をUIに反映する。
 */
export function loadAccountingFromReservation(reservation: ReservationCore): AccountingFormDto;
/**
 * 会計システム初期化関数
 * @param {AccountingMasterItemCore[]} masterData - 会計マスタデータ
 * @param {string} classroom - 教室名
 * @param {AccountingFormDto} initialFormData - 初期フォームデータ
 * @param {ReservationCore | null} reservationData - よやくデータ（講座基本情報表示用）
 * @returns {string} 生成された会計画面HTML
 */
export function initializeAccountingSystem(masterData: AccountingMasterItemCore[], classroom: string, initialFormData?: AccountingFormDto, reservationData?: ReservationCore | null): string;
/**
 * 会計システムクリーンアップ
 */
export function cleanupAccountingSystem(): void;
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
