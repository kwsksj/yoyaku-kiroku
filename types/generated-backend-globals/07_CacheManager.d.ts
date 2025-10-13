/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.js
 * 【バージョン】: 6.6
 * 【役割】: キャッシュ管理システム
 * 【v6.6での変更点】:
 * - 内部関数の `cacheKey` の型を `string` に統一し、型エラーを解消
 * =================================================================
 */
/**
 * ヘッダーマップから型安全にインデックスを取得するヘルパー関数
 * @param {HeaderMapType} headerMap - ヘッダーマップ（MapまたはRecord）
 * @param {string} headerName - ヘッダー名
 * @returns {number | undefined} インデックス値
 */
export function getHeaderIndex(headerMap: HeaderMapType, headerName: string): number | undefined;
/**
 * ヘッダーマップをRecord型に正規化するヘルパー関数
 * @param {HeaderMapType} headerMap - ヘッダーマップ（MapまたはRecord）
 * @returns {Record<string, number>} Record型のヘッダーマップ
 */
export function normalizeHeaderMap(headerMap: HeaderMapType): Record<string, number>;
/**
 * キャッシュデータの型安全な取得ヘルパー関数
 * @param {any} cacheData - キャッシュデータ
 * @param {string} property - プロパティ名
 * @returns {any} プロパティ値
 */
export function getCacheProperty(cacheData: any, property: string): any;
/**
 * 日付・時刻値をフォーマットするヘルパー関数
 * @param {any} dateValue - 日付値
 * @param {'date' | 'time'} type - フォーマット種別
 * @returns {string} フォーマット済み文字列
 */
export function formatDateTimeValue(dateValue: any, type: "date" | "time"): string;
/**
 * =================================================================
 * 【ファイル名】: 07_CacheManager.js
 * 【バージョン】: 5.5
 * 【役割】: CacheServiceベースの統合キャッシュ管理システム
 *
 * 【主要機能】:
 * ✅ 統合データキャッシュ管理
 *   - 全予約データ（予約記録シート）
 *   - 生徒基本情報（生徒名簿）
 *   - 日程マスターデータ
 *   - 会計マスターデータ
 *
 * ✅ キャッシュ操作API
 *   - getCachedData(): 統一キャッシュ取得インターフェース
 *   - 自動再構築機能（キャッシュ未存在時）
 *   - キャッシュ情報管理（バージョン、件数、更新日時）
 *
 * ✅ 管理・保守機能
 *   - 一括キャッシュ再構築（UI付き）
 *   - 定期自動再構築（トリガー実行）
 *   - PropertiesServiceクリーンアップ（古いキャッシュ削除）
 *
 * 【v5.0での変更点】:
 * - rebuild系関数名を統一（rebuildAll***Cache, rebuild***Cache）
 * - getCachedData()による統一キャッシュアクセスAPI導入
 * - CACHE_KEYS定数による一元管理
 * - JSDocとエラーハンドリングの全面改善
 * - PropertiesService整理機能の責任分離と特化
 * =================================================================
 */
/**
 * 予約キャッシュに新しい予約データを追加（インクリメンタル更新）
 * シート全体の再読み込みを避けて、パフォーマンスを大幅に向上
 * @param {(string|number|Date)[]} newReservationRow - 新しい予約行データ
 * @param {HeaderMapType} headerMap - ヘッダーマッピング
 */
export function addReservationToCache(newReservationRow: (string | number | Date)[], headerMap: HeaderMapType): void;
/**
 * キャッシュ内の予約ステータスを更新（インクリメンタル更新）
 * キャンセル処理などで使用し、シート全体の再読み込みを回避
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} newStatus - 新しいステータス
 */
export function updateReservationStatusInCache(reservationId: string, newStatus: string): void;
/**
 * キャッシュ内の予約データを完全に更新（インクリメンタル更新）
 * 予約詳細更新処理などで使用し、シート全体の再読み込みを回避
 * @param {string} reservationId - 更新対象の予約ID
 * @param {(string|number|Date)[]} updatedRowData - 更新された行データ
 * @param {HeaderMapType} headerMap - ヘッダーマッピング
 */
export function updateReservationInCache(reservationId: string, updatedRowData: (string | number | Date)[], headerMap: HeaderMapType): void;
/**
 * キャッシュ内の特定列を更新（インクリメンタル更新）
 * 会計詳細保存などで使用し、シート全体の再読み込みを回避
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} columnHeaderName - 更新する列のヘッダー名
 * @param {string|number|Date} newValue - 新しい値
 */
export function updateReservationColumnInCache(reservationId: string, columnHeaderName: string, newValue: string | number | Date): void;
/**
 * 全てのキャッシュデータを一括で再構築するエントリーポイント関数
 * UI確認ダイアログを表示してから、全種類のキャッシュを順次再構築します。
 * スプレッドシートのメニューから手動実行される場合に使用されます。
 *
 * 再構築対象:
 * - 統合予約データキャッシュ
 * - 生徒基本情報キャッシュ
 * - 会計マスターキャッシュ
 * - 日程マスターキャッシュ
 *
 * @throws {Error} いずれかのキャッシュ再構築中にエラーが発生した場合
 */
export function rebuildAllCachesEntryPoint(): void;
/**
 * キャッシュの再構築が必要かどうかを判定します。
 * 短時間での重複実行を防止するため。
 * @returns {boolean} 再構築が必要な場合true
 */
export function shouldRebuildReservationCache(): boolean;
/**
 * 予約記録シートから全予約データを読み込み、CacheServiceに保存する
 * 日付・時刻列を適切にフォーマットして配列形式でキャッシュに保存します。
 *
 * @throws {Error} 予約記録シートが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
export function rebuildAllReservationsCache(): void;
/**
 * 日程マスターデータを読み込み、CacheServiceに保存する
 * 今日から1年後までの日程データを取得し、キャッシュに保存します。
 *
 * @param {string} [fromDate] - 取得開始日（YYYY-MM-DD形式、省略時は今日）
 * @param {string} [toDate] - 取得終了日（YYYY-MM-DD形式、省略時は1年後）
 * @throws {Error} 日程データの取得や処理中にエラーが発生した場合
 */
export function rebuildScheduleMasterCache(fromDate?: string, toDate?: string): {
    version: number;
    schedule: any;
    dateRange: {
        from: string;
        to: string;
        cached: string;
    };
};
/**
 * 会計マスターデータを読み込み、CacheServiceに保存する
 * スプレッドシートの「会計マスタ」シートから直接データを読み込み、
 * 時間列を適切にフォーマットしてキャッシュに保存します。
 *
 * @throws {Error} 会計マスタシートが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
export function rebuildAccountingMasterCache(): {
    version: number;
    items: any;
};
/**
 * 生徒名簿から基本情報（ID、本名、ニックネーム、電話番号）を読み込み、CacheServiceに保存する
 * 生徒IDをキーとしたオブジェクト形式でキャッシュに保存します。
 *
 * @throws {Error} 生徒名簿シートが見つからない場合
 * @throws {Error} 必須ヘッダーが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
export function rebuildAllStudentsBasicCache(): void;
/**
 * 日程マスタのステータスを自動更新（開催予定 → 開催済み）
 * 現在日時を基準に、過去の開催予定講座を開催済みに変更します。
 *
 * 判定基準:
 * - 日付が今日より前
 * - ステータスが「開催予定」
 *
 * @returns {number} 更新した件数
 */
export function updateScheduleStatusToCompleted(): number;
/**
 * 時間主導型トリガーから自動実行されるキャッシュ再構築関数
 * 定期的にスケジュールされたトリガーが呼び出す関数です。
 * スクリプトロックを使用して同時実行を防止します。
 *
 * 処理内容:
 * - 日程マスタのステータス自動更新（開催予定 → 開催済み）
 * - 全キャッシュデータの定期再構築
 * - エラー発生時のログ記録
 * - ログシートの記録
 *
 * @throws {Error} ロック取得失敗やキャッシュ再構築中のエラーは内部でキャッチされログに記録
 */
export function triggerScheduledCacheRebuild(): void;
/**
 * 型定義に基づいたキャッシュ取得のオーバーロード定義
 * @template {CacheKey} K
 * @overload
 * @param {K} cacheKey
 * @param {boolean} [autoRebuild]
 * @returns {CacheDataType<K> | null}
 */
export function getTypedCachedData<K extends CacheKey>(cacheKey: K, autoRebuild?: boolean): CacheDataType<K> | null;
/**
 * 指定されたキャッシュキーからデータを取得する汎用関数（キャッシュがない場合は自動再構築）
 * @param {string} cacheKey - キャッシュキー（CACHE_KEYS定数の使用推奨）
 * @param {boolean} [autoRebuild=true] - キャッシュがない場合に自動再構築するか（デフォルト: true）
 * @returns {CacheDataStructure | null} キャッシュされたデータまたはnull
 */
export function getCachedData(cacheKey: string, autoRebuild?: boolean): CacheDataStructure | null;
/**
 * キャッシュの存在確認とバージョン情報を取得する
 * @param {string} cacheKey - キャッシュキー
 * @returns {CacheInfo} { exists: boolean, version: number|null, dataCount: number|null }
 */
export function getCacheInfo(cacheKey: string): CacheInfo;
/**
 * すべてのキャッシュの状態を取得する
 * @returns {{ [key: string]: CacheInfo }} 各キャッシュの状態情報
 */
export function getAllCacheInfo(): {
    [key: string]: CacheInfo;
};
/**
 * データを指定サイズで分割する関数
 * @param {(string|number|Date)[][]|StudentData[]} data - 分割対象のデータ配列
 * @param {number} maxSizeKB - 最大サイズ（KB）
 * @returns {((string|number|Date)[][]|StudentData[])[]} 分割されたデータチャンクの配列
 */
export function splitDataIntoChunks(data: (string | number | Date)[][] | StudentData[], maxSizeKB?: number): ((string | number | Date)[][] | StudentData[])[];
/**
 * 分割されたデータをキャッシュに保存する関数
 * @param {string} baseKey - ベースキャッシュキー
 * @param {((string|number|Date)[][]|StudentData[])[]} dataChunks - 分割されたデータチャンク配列
 * @param {ChunkedCacheMetadata} metadata - メタデータ
 * @param {number} expiry - キャッシュ有効期限（秒）
 * @returns {boolean} 保存成功の可否
 */
export function saveChunkedDataToCache(baseKey: string, dataChunks: ((string | number | Date)[][] | StudentData[])[], metadata: ChunkedCacheMetadata, expiry?: number): boolean;
/**
 * 分割キャッシュからデータを読み込んで統合する関数
 * @param {string} baseKey - ベースキャッシュキー
 * @returns {CacheDataStructure|null} 統合されたキャッシュデータまたはnull
 */
export function loadChunkedDataFromCache(baseKey: string): CacheDataStructure | null;
/**
 * 指定されたベースキーの全分割キャッシュを削除する関数
 * @param {string} baseKey - ベースキャッシュキー
 */
export function clearChunkedCache(baseKey: string): void;
/**
 * 生徒基本情報キャッシュを取得し、Record形式で返すヘルパー
 * @param {boolean} [autoRebuild=true] - キャッシュ未存在時に再構築を試行するか
 * @returns {Record<string, UserCore> | null} 生徒情報マップ
 */
export function getCachedAllStudents(autoRebuild?: boolean): Record<string, UserCore> | null;
/**
 * キャッシュ上の生徒情報を更新する
 * @param {UserCore} updatedStudent - 更新後の生徒情報（studentId必須）
 */
export function updateCachedStudent(updatedStudent: UserCore): void;
/**
 * キャッシュに新しい生徒情報を追加する
 * @param {UserCore} newStudent - 追加する生徒情報（studentId必須）
 */
export function addCachedStudent(newStudent: UserCore): void;
/**
 * 指定したキャッシュキーのデータを削除する
 * @param {CacheKey | string} cacheKey - 削除対象のキャッシュキー
 */
export function deleteCache(cacheKey: CacheKey | string): void;
/**
 * すべてのキャッシュを削除する（開発・デバッグ用途）
 */
export function deleteAllCache(): void;
/**
 * 各キャッシュキーに対応するデータ件数取得関数
 * @param {object} parsedData - パース済みキャッシュデータ
 * @param {string} cacheKey - キャッシュキー
 * @returns {number} データ件数
 */
export function getDataCount(parsedData: object, cacheKey: string): number;
/**
 * 予約IDを指定して、キャッシュから単一の予約データを取得する
 * @param {string} reservationId - 取得する予約のID
 * @returns {RawSheetRow | null} 予約データ配列、見つからない場合はnull
 */
export function getReservationByIdFromCache(reservationId: string): RawSheetRow | null;
/**
 * Schedule Master キャッシュの診断・修復機能
 * シートの存在確認とキャッシュの整合性チェックを実行
 * GASエディタから直接実行可能（メニューからトリガー登録推奨）
 */
export function diagnoseAndFixScheduleMasterCache(): void;
export namespace CACHE_KEYS {
    let ALL_RESERVATIONS: "all_reservations";
    let ALL_STUDENTS_BASIC: "all_students_basic";
    let MASTER_SCHEDULE_DATA: "master_schedule_data";
    let MASTER_ACCOUNTING_DATA: "master_accounting_data";
}
/**
 * 分割キャッシュ用の定数
 */
export const CHUNK_SIZE_LIMIT_KB: 90;
export const MAX_CHUNKS: 20;
export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];
export type CacheDataType<K extends CacheKey> = K extends "all_reservations" ? ReservationCacheData : K extends "all_students_basic" ? StudentCacheData : K extends "master_schedule_data" ? ScheduleCacheData : K extends "master_accounting_data" ? AccountingCacheData : never;
