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
