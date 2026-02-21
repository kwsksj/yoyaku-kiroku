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
 *   - 全よやくデータ（予約記録シート）
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
 * よやくキャッシュに新しいよやくデータを追加（インクリメンタル更新）
 * シート全体の再読み込みを避けて、パフォーマンスを大幅に向上
 * @param {(string|number|Date)[]} newReservationRow - 新しいよやく行データ
 * @param {HeaderMapType} headerMap - ヘッダーマッピング
 */
export function addReservationToCache(newReservationRow: (string | number | Date)[], headerMap: HeaderMapType): void;
/**
 * キャッシュ内のよやくステータスを更新（インクリメンタル更新）
 * キャンセル処理などで使用し、シート全体の再読み込みを回避
 * @param {string} reservationId - 更新対象の予約ID
 * @param {string} newStatus - 新しいステータス
 */
export function updateReservationStatusInCache(reservationId: string, newStatus: string): void;
/**
 * キャッシュ内のよやくデータを完全に更新（インクリメンタル更新）
 * よやく詳細更新処理などで使用し、シート全体の再読み込みを回避
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
 * 生徒名簿からすべての情報を読み込み、CacheServiceに保存する
 * 生徒IDをキーとしたオブジェクト形式でキャッシュに保存します。
 *
 * @throws {Error} 生徒名簿シートが見つからない場合
 * @throws {Error} 必須ヘッダーが見つからない場合
 * @throws {Error} データ処理中にエラーが発生した場合
 */
export function rebuildAllStudentsCache(): void;
/**
 * 全てのキャッシュデータを一括で再構築するエントリーポイント関数
 * UI確認ダイアログを表示してから、全種類のキャッシュを順次再構築します。
 * スプレッドシートのメニューから手動実行される場合に使用されます。
 *
 * 再構築対象:
 * - 統合よやくデータキャッシュ
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
 * 予約記録シートから全よやくデータを読み込み、CacheServiceに保存する
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
 * @param {{ skipNotionSync?: boolean }} [options] - 追加オプション
 * @throws {Error} 日程データの取得や処理中にエラーが発生した場合
 */
export function rebuildScheduleMasterCache(fromDate?: string, toDate?: string, options?: {
    skipNotionSync?: boolean;
}): {
    version: number;
    schedule: LessonCore[];
    dateRange: {
        from: string;
        to: string;
        cached: string;
    };
};
/**
 * よやくキャッシュからlessonIdを使ってreservationIdsを再構築し、日程シートとキャッシュを更新する
 * キャッシュ一括更新時に呼び出され、データの整合性を保証する
 */
export function syncReservationIdsToSchedule(): void;
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
    items: AccountingMasterItem[];
};
/**
 * 日程マスタのステータスを自動更新（開催予定 → 開催済み）
 * 現在日時を基準に、過去の開催予定講座を開催済みに変更します。
 *
 * 判定基準:
 * - 日付が今日より前
 * - ステータスが「開催予定」
 *
 * @param {{ syncNotion?: boolean }} [options] - Notion同期設定
 * @returns {number} 更新した件数
 */
export function updateScheduleStatusToCompleted(options?: {
    syncNotion?: boolean;
}): number;
/**
 * 指定日の日程ステータスを開催済みに更新します。
 * 「教室完了 ⇢ 売上集計」実行時に、対象日のみ明示的に締めるために使用します。
 *
 * @param {string | Date} targetDate
 * @param {{ syncNotion?: boolean }} [options] - Notion同期設定
 * @returns {number} 更新した件数
 */
export function markScheduleStatusCompletedByDate(targetDate: string | Date, options?: {
    syncNotion?: boolean;
}): number;
/**
 * 日程シートの未設定状態を補完します。
 * 手編集で日程を追加したとき、状態=開催予定 / 売上転載状態=未転載 を自動で埋めます。
 *
 * @param {number[]} [targetRows=[]] - 補完対象の行番号（1始まり）。未指定時は全行。
 * @returns {number} 更新したセル数
 */
export function ensureScheduleStatusDefaults(targetRows?: number[]): number;
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
 * 画像アップロードUI向けの参加者候補インデックスを生成します（副作用なし）
 * - 予約キャッシュ（CacheService）から生成
 * - 取消は除外
 * - `date -> [{ lesson_id, classroom, venue, participants[] }]` を返す
 *
 * @returns {{
 *   generated_at: string,
 *   timezone: string,
 *   source: { reservations_cache_version: number | null },
 *   dates: Record<string, Array<{ lesson_id: string, classroom: string, venue: string, participants: Array<{ student_id: string, display_name: string, session_note?: string }> }>>,
 * }}
 */
export function buildParticipantsIndexForUploadUi(): {
    generated_at: string;
    timezone: string;
    source: {
        reservations_cache_version: number | null;
    };
    dates: Record<string, Array<{
        lesson_id: string;
        classroom: string;
        venue: string;
        participants: Array<{
            student_id: string;
            display_name: string;
            session_note?: string;
        }>;
    }>>;
};
/**
 * 画像アップロードUI向け参加者候補インデックスをCloudflare Workerへ送信します
 *
 * ScriptProperties:
 * - UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_URL
 * - UPLOAD_UI_PARTICIPANTS_INDEX_PUSH_TOKEN
 *
 * @returns {{success: boolean, message: string, statusCode?: number, durationMs?: number, bytes?: number, datesCount?: number, groupsCount?: number, participantsCount?: number}}
 */
export function pushParticipantsIndexToWorker(): {
    success: boolean;
    message: string;
    statusCode?: number;
    durationMs?: number;
    bytes?: number;
    datesCount?: number;
    groupsCount?: number;
    participantsCount?: number;
};
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
 * よやくキャッシュのインメモリスナップショットを無効化する
 */
export function invalidateReservationCacheSnapshot(): void;
/**
 * 生徒キャッシュのインメモリスナップショットを無効化する
 */
export function invalidateStudentCacheSnapshot(): void;
/**
 * よやくキャッシュのスナップショットを取得（実行中はインメモリ再利用）
 * @param {boolean} [autoRebuild=true] - キャッシュ未存在時に再構築を許可するか
 * @returns {ReservationCacheData | null}
 */
export function getReservationCacheSnapshot(autoRebuild?: boolean): ReservationCacheData | null;
/**
 * 生徒キャッシュのスナップショットを取得（実行中はインメモリ再利用）
 * @param {boolean} [autoRebuild=true] - キャッシュ未存在時に再構築を許可するか
 * @returns {StudentCacheData | null}
 */
export function getStudentCacheSnapshot(autoRebuild?: boolean): StudentCacheData | null;
/**
 * 予約IDを指定して、キャッシュから単一のよやくデータを取得する
 * @param {string} reservationId - 取得するよやくのID
 * @returns {RawSheetRow | null} よやくデータ配列、見つからない場合はnull
 */
export function getReservationByIdFromCache(reservationId: string): RawSheetRow | null;
/**
 * lessonIdでレッスン情報をキャッシュから取得（O(1)アクセス）
 *
 * @param {string} lessonId - 取得対象のレッスンID
 * @returns {LessonCore | null} レッスン情報、見つからない場合はnull
 *
 * @example
 * const lesson = getLessonByIdFromCache('c3e2a1b0-5b3a-4b9c-8b0a-0e1b0e1b0e1b');
 * if (lesson) {
 *   console.log(`教室: ${lesson.classroom}, 日付: ${lesson.date}`);
 * }
 */
export function getLessonByIdFromCache(lessonId: string): LessonCore | null;
/**
 * 複数の予約IDからよやくオブジェクトを一括取得
 *
 * @param {string[]} reservationIds - 取得対象の予約IDの配列
 * @param {{ includeStudents?: boolean }=} options - 付加情報取得の挙動を制御するオプション
 * @returns {ReservationCore[]} よやくオブジェクトの配列（見つからないIDはスキップ）
 *
 * @example
 * const reservations = getReservationsByIdsFromCache(['R-001', 'R-002', 'R-003']);
 * console.log(`取得したよやく数: ${reservations.length}`);
 */
export function getReservationsByIdsFromCache(reservationIds: string[], options?: {
    includeStudents?: boolean;
} | undefined): ReservationCore[];
/**
 * 日程キャッシュ内の特定レッスンの状態を差分更新します。
 *
 * @param {string[]} lessonIds - 更新対象のレッスンID配列
 * @param {string} nextStatus - 次状態
 * @returns {number} 更新した件数
 */
export function updateScheduleStatusInCacheByLessonIds(lessonIds: string[], nextStatus: string): number;
/**
 * 日程キャッシュ内の売上転載状態を差分更新します。
 *
 * @param {Map<string, { status: string; transferredAt: string }>} lessonTransferStatusMap
 * @returns {number} 更新した件数
 */
export function updateScheduleSalesTransferStatusInCache(lessonTransferStatusMap: Map<string, {
    status: string;
    transferredAt: string;
}>): number;
/**
 * 日程キャッシュ内の特定レッスンの予約ID配列を最新化する
 * @param {string} lessonId - レッスンID
 * @param {string[]} reservationIds - 最新の予約ID配列
 */
export function updateLessonReservationIdsInCache(lessonId: string, reservationIds: string[]): void;
/**
 * Schedule Master キャッシュの診断・修復機能
 * シートの存在確認とキャッシュの整合性チェックを実行
 * GASエディタから直接実行可能（メニューからトリガー登録推奨）
 */
export function diagnoseAndFixScheduleMasterCache(): void;
export namespace CACHE_KEYS {
    let ALL_RESERVATIONS: "all_reservations";
    let ALL_STUDENTS: "all_students";
    let MASTER_SCHEDULE_DATA: "master_schedule_data";
    let MASTER_ACCOUNTING_DATA: "master_accounting_data";
}
/**
 * 分割キャッシュ用の定数
 */
export const CHUNK_SIZE_LIMIT_KB: 90;
export const MAX_CHUNKS: 20;
export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];
export type CacheDataType<K extends CacheKey> = K extends "all_reservations" ? ReservationCacheData : K extends "all_students" ? StudentCacheData : K extends "master_schedule_data" ? ScheduleCacheData : K extends "master_accounting_data" ? AccountingCacheData : never;
