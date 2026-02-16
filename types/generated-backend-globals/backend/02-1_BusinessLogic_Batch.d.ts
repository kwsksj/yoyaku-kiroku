/**
 * 旧フォーマットの予約データを現行フォーマットへ変換して取り込みます。
 * `dryRun: true`（デフォルト）で実行すると、書き込みなしで結果のみ確認できます。
 *
 * @param {Object} [config={}] - 取り込み設定
 * @param {string} [config.sourceSheetName] - 取り込み元シート名
 * @param {string} [config.sourceSpreadsheetId] - 取り込み元スプレッドシートID（省略時は同一ブック）
 * @param {number} [config.sourceHeaderRow=1] - ヘッダー行番号
 * @param {number} [config.sourceDataStartRow=2] - データ開始行番号
 * @param {Record<string, any>} [config.fieldMap] - 現行項目名に対する列指定（列名/0始まり列番号/候補配列）
 * @param {Record<string, any>} [config.defaults] - 取り込み時のデフォルト値
 * @param {boolean} [config.dryRun=true] - true: 書き込まない
 * @param {number} [config.maxRows=0] - 処理件数上限（0は全件）
 * @param {'skip'|'regenerate'|'error'} [config.duplicateReservationIdStrategy='skip'] - 予約ID重複時の動作
 * @param {boolean} [config.skipEmptyRows=true] - 空行をスキップするか
 * @param {boolean} [config.stopOnError=false] - 行エラーで即中断するか
 * @param {boolean} [config.autoCreateStudentOnNameUnmatched=false] - 生徒名未一致時に名簿へ仮登録するか
 * @param {boolean} [config.autoCreateStudentOnNameAmbiguous=false] - 生徒名複数一致時に名簿へ仮登録するか
 * @returns {Object} 取り込み結果サマリー
 */
export function importLegacyReservations(config?: {
    sourceSheetName?: string;
    sourceSpreadsheetId?: string;
    sourceHeaderRow?: number;
    sourceDataStartRow?: number;
    fieldMap?: Record<string, any>;
    defaults?: Record<string, any>;
    dryRun?: boolean;
    maxRows?: number;
    duplicateReservationIdStrategy?: "skip" | "regenerate" | "error";
    skipEmptyRows?: boolean;
    stopOnError?: boolean;
    autoCreateStudentOnNameUnmatched?: boolean;
    autoCreateStudentOnNameAmbiguous?: boolean;
}): any;
/**
 * 旧つくばCSV（整形済み）を dry run で解析する
 * @param {Object} [config={}]
 * @returns {Object}
 */
export function dryRunTsukubaLegacyCsvImport(config?: any): any;
/**
 * 旧つくばCSV（整形済み）を本取り込みする
 * @param {Object} [config={}]
 * @returns {Object | null}
 */
export function runTsukubaLegacyCsvImport(config?: any): any | null;
/**
 * 旧沼津CSV（整形済み）を dry run で解析する（引数なし実行用）
 * @param {Object} [config={}]
 * @returns {Object}
 */
export function dryRunNumazuLegacyCsvImportAuto(config?: any): any;
/**
 * 旧沼津CSV（整形済み）を本取り込みする（引数なし実行用）
 * @param {Object} [config={}]
 * @returns {Object}
 */
export function runNumazuLegacyCsvImportAuto(config?: any): any;
/**
 * 既に取り込み済みの旧CSV予約について、元申込みシート（電話/メール）を使って生徒IDを再照合します。
 * - 対象は原則「生徒名簿 notes に [legacy-import] がある仮登録生徒ID」の予約
 * - dryRun=true では更新せず、差し替え候補のみ返します
 *
 * @param {Object} [config={}]
 * @param {boolean} [config.dryRun=true]
 * @param {string} [config.matchingApplicationSpreadsheetId]
 * @param {string} [config.matchingApplicationSheetName]
 * @param {number} [config.matchingApplicationSheetId]
 * @param {number} [config.matchingApplicationHeaderRow=1]
 * @param {number} [config.matchingApplicationDataStartRow=2]
 * @param {any} [config.matchingApplicationNameFieldMap]
 * @param {any} [config.matchingApplicationPhoneFieldMap]
 * @param {any} [config.matchingApplicationEmailFieldMap]
 * @param {boolean} [config.onlyLegacyImportedStudents=true] - true の場合、[legacy-import] 付与生徒のみ再照合
 * @param {'skip'|'error'} [config.duplicateIdentityStrategy='skip'] - 生徒ID差し替え後の重複時の扱い
 * @param {boolean} [config.updateRosterNotes=true] - 本実行時に名簿notesへ再照合結果を追記するか
 * @param {string} [config.targetClassroom] - 指定時、その教室の予約のみ更新
 * @param {string} [config.targetDateFrom] - 指定時、この日付以上のみ更新（YYYY-MM-DD）
 * @param {string} [config.targetDateTo] - 指定時、この日付以下のみ更新（YYYY-MM-DD）
 * @returns {Object}
 */
export function reconcileLegacyImportedReservationsByApplication(config?: {
    dryRun?: boolean;
    matchingApplicationSpreadsheetId?: string;
    matchingApplicationSheetName?: string;
    matchingApplicationSheetId?: number;
    matchingApplicationHeaderRow?: number;
    matchingApplicationDataStartRow?: number;
    matchingApplicationNameFieldMap?: any;
    matchingApplicationPhoneFieldMap?: any;
    matchingApplicationEmailFieldMap?: any;
    onlyLegacyImportedStudents?: boolean;
    duplicateIdentityStrategy?: "skip" | "error";
    updateRosterNotes?: boolean;
    targetClassroom?: string;
    targetDateFrom?: string;
    targetDateTo?: string;
}): any;
/**
 * 取り込み済み旧CSV予約の生徒ID再照合を dry run で確認します。
 * @param {Object} [config={}]
 * @returns {Object}
 */
export function dryRunReconcileLegacyImportedReservationsByApplication(config?: any): any;
/**
 * 取り込み済み旧CSV予約の生徒ID再照合を実行します（確認ダイアログ付き）。
 * @param {Object} [config={}]
 * @returns {Object | null}
 */
export function runReconcileLegacyImportedReservationsByApplication(config?: any): any | null;
/**
 * 元申込みシート（2023年1〜9月）から生徒名簿を補完します。
 * - 電話/メール/氏名で突き合わせ
 * - 既存名簿は空欄項目を優先して補完
 * - 一意に突き合わせできない場合はレポートに残す
 *
 * @param {Object} [config={}]
 * @param {boolean} [config.dryRun=true]
 * @param {string} [config.sourceSpreadsheetId]
 * @param {string[]} [config.sourceSheetNames]
 * @param {Array<RegExp | string>} [config.sourceSheetNameRegexes]
 * @param {number} [config.sourceHeaderRow=1]
 * @param {number} [config.sourceDataStartRow=2]
 * @param {boolean} [config.onlyFillEmpty=true]
 * @param {boolean} [config.createUnmatched=true]
 * @returns {Object}
 */
export function syncLegacyApplicationProfilesToRoster(config?: {
    dryRun?: boolean;
    sourceSpreadsheetId?: string;
    sourceSheetNames?: string[];
    sourceSheetNameRegexes?: Array<RegExp | string>;
    sourceHeaderRow?: number;
    sourceDataStartRow?: number;
    onlyFillEmpty?: boolean;
    createUnmatched?: boolean;
}): any;
/**
 * 2023年1〜9月 元申込みデータの名簿補完 dry run（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaLegacyApplicationRosterSync2023Auto(): any;
/**
 * 2023年1〜9月 元申込みデータの名簿補完 実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaLegacyApplicationRosterSync2023Auto(): any;
/**
 * 予約記録の重複（同一キー）を除去します。
 * 既定キー: 生徒ID + レッスンID + 日付 + ステータス
 *
 * @param {Object} [config={}]
 * @param {boolean} [config.dryRun=true]
 * @param {string} [config.targetDateFrom] - YYYY-MM-DD（この日付以上）
 * @param {string} [config.targetDateTo] - YYYY-MM-DD（この日付以下）
 * @param {string[]} [config.keyFields] - 使用キー（studentId, lessonId, date, status）
 * @returns {Object}
 */
export function dedupeReservationsByStudentLessonDateStatus(config?: {
    dryRun?: boolean;
    targetDateFrom?: string;
    targetDateTo?: string;
    keyFields?: string[];
}): any;
/**
 * 2023年分の予約重複を dry run で確認（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaReservationDedupe2023Auto(): any;
/**
 * 2023年分の予約重複を削除実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaReservationDedupe2023Auto(): any;
/**
 * 2023年10月21日〜2025年2月16日分の予約重複を dry run で確認（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaReservationDedupe2023OctTo2025FebAuto(): any;
/**
 * 2023年10月21日〜2025年2月16日分の予約重複を削除実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaReservationDedupe2023OctTo2025FebAuto(): any;
/**
 * 旧データ全期間（2023-01-01〜2025-02-16）の予約重複を dry run で確認（引数なし実行用）
 * @returns {Object}
 */
export function dryRunTsukubaReservationDedupeLegacyAllAuto(): any;
/**
 * 旧データ全期間（2023-01-01〜2025-02-16）の予約重複を削除実行（引数なし実行用）
 * @returns {Object}
 */
export function runTsukubaReservationDedupeLegacyAllAuto(): any;
/**
 * 2023年1〜9月CSV（整形済み）を「取り込み + 突き合わせ」込みで dry run します。
 * - GASエディタから引数なしで実行する専用関数
 * @returns {Object}
 */
export function dryRunTsukubaLegacyCsvImport2023JanToSepAuto(): any;
/**
 * 2023年1〜9月CSV（整形済み）を「取り込み + 突き合わせ」込みで実行します。
 * - GASエディタから引数なしで実行する専用関数
 * - UIダイアログを使わず、実行結果はログと返却値で確認
 * @returns {Object}
 */
export function runTsukubaLegacyCsvImport2023JanToSepAuto(): any;
/**
 * 旧「予約表（マトリクス）」形式を解析し、生徒名から生徒IDを照合して予約記録へ取り込みます。
 *
 * 対象レイアウト例:
 * - 左側: 時刻グリッド（▨ / 初 など）
 * - 右側: 名前、車、刀、備考、from、注文
 *
 * @param {Object} [config={}]
 * @param {string} [config.sourceSpreadsheetId] - 取り込み元スプレッドシートID。省略時は同一ブック
 * @param {string[]|string} [config.sourceSheetNames] - 対象シート名（省略時は全シート）
 * @param {boolean} [config.dryRun=true] - true: 書き込まずプレビューのみ
 * @param {string} [config.defaultClassroom='つくば教室'] - タイトルから推定できない場合の教室
 * @param {string} [config.defaultStatus='完了'] - 取り込み時のステータス既定値
 * @param {number} [config.maxRowsPerSheet=0] - シートごとの最大処理行数（0は無制限）
 * @param {'skip'|'error'} [config.duplicateIdentityStrategy='skip'] - 同一予約（生徒ID+日時+教室+時間）重複時の扱い
 * @param {boolean} [config.stopOnError=false] - 行エラーで即中断するか
 * @returns {Object} 取り込み結果
 */
export function importLegacyGridReservationsByName(config?: {
    sourceSpreadsheetId?: string;
    sourceSheetNames?: string[] | string;
    dryRun?: boolean;
    defaultClassroom?: string;
    defaultStatus?: string;
    maxRowsPerSheet?: number;
    duplicateIdentityStrategy?: "skip" | "error";
    stopOnError?: boolean;
}): any;
/**
 * 旧つくば予約表（マトリクス）を dry run で解析する簡易エントリー
 * - Apps Script エディタから手動実行し、ログで結果を確認する用途
 * @returns {Object}
 */
export function dryRunTsukubaLegacyGridImport(): any;
/**
 * 旧つくば予約表（マトリクス）を本取り込みする簡易エントリー
 * - 実行前に確認ダイアログを表示
 * @returns {Object | null}
 */
export function runTsukubaLegacyGridImport(): any | null;
/**
 * 【開発用】テスト環境をセットアップします。
 * 現在のスプレッドシートをコピーし、テスト用の新しい環境を作成します。
 */
export function setupTestEnvironment(): void;
/**
 * 直近60日間の会計済みよやく日を取得する
 * @returns {string[]} 日付文字列の配列（YYYY-MM-DD形式、降順）
 */
export function getRecentCompletedReservationDates(): string[];
/**
 * 指定した日付の予約記録から売上ログを再転載する（ダイアログ表示版）
 * カスタムメニューから手動実行する想定
 */
export function repostSalesLogByDate(): void;
/**
 * 指定した日付の予約記録から売上ログを転載する
 * HTMLダイアログ（手動再転載）またはバッチ処理（日次転載）から呼び出される
 * @param {string} [targetDate] - 対象日付（YYYY-MM-DD形式）。省略時は当日。
 * @returns {{ success: boolean, totalCount: number, successCount: number }} 転載結果
 */
export function transferSalesLogByDate(targetDate?: string): {
    success: boolean;
    totalCount: number;
    successCount: number;
};
/**
 * よやくシート全体をソートします（バッチ処理用）
 *
 * @description
 * よやくシートのデータを以下の順序でソートします:
 * 1. 日付順（降順: 新しい日付が上）
 * 2. ステータス順（完了=確定 > 待機 > 取消）
 * 3. 開始時間順（昇順）
 * 4. 終了時間順（昇順）
 * 5. 初回順（初回=true > 空白/false）
 *
 * @returns {{success: boolean, message: string, sortedCount: number}}
 */
export function sortReservationSheet(): {
    success: boolean;
    message: string;
    sortedCount: number;
};
/**
 * 【トリガー関数】毎日20時に実行: 当日の会計済みよやくを売上表に転載する
 * スクリプトのトリガー設定から呼び出される
 *
 * @description
 * このバッチ処理により、会計修正は当日20時まで可能となり、
 * 20時以降は確定された会計データが売上表に転載される。
 * これにより、会計処理時の売上ログ記録が不要になり、
 * 何度修正しても売上表に影響がない運用が実現できる。
 */
export function dailySalesTransferBatch(): void;
