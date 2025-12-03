export namespace participantActionHandlers {
    export { loadParticipantView };
    export function goToParticipantsView(): void;
    export { toggleParticipantLessonAccordion };
    export { selectParticipantStudent };
    export { backToParticipantList };
    export function backToParticipantsView(): void;
    export { filterParticipantByClassroom };
    export { togglePastLessons };
}
export type CacheEntry = {
    /**
     * - キャッシュされたデータ
     */
    data: any;
    /**
     * - キャッシュ保存時刻
     */
    timestamp: number;
    /**
     * - キャッシュ有効期限（ミリ秒）
     */
    maxAge: number;
};
/**
 * 参加者リストビュー初期化
 * ログイン成功後、管理者の場合に呼ばれる
 *
 * @param {boolean} forceReload - 強制的に再取得する場合はtrue
 */
declare function loadParticipantView(forceReload?: boolean, shouldShowLoading?: boolean, baseAppState?: Partial<UIState> | null, includeHistory?: boolean): void;
/**
 * アコーディオンの開閉を切り替えるハンドラ（DOM操作のみ、再描画なし）
 * @param {string} lessonId - レッスンID
 */
declare function toggleParticipantLessonAccordion(lessonId: string): void;
/**
 * 生徒選択ハンドラ（モーダル表示）
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} [lessonId] - レッスンID（プリロードデータ検索用）
 */
declare function selectParticipantStudent(targetStudentId: string, lessonId?: string): void;
/**
 * レッスン一覧に戻る
 */
declare function backToParticipantList(): void;
/**
 * 教室フィルタハンドラ
 * @param {string} classroom - 選択された教室（'all'または教室名）
 */
declare function filterParticipantByClassroom(classroom: string): void;
/**
 * 過去/未来のレッスン切り替えハンドラ
 * @param {boolean} showPast - 過去のレッスンを表示するか
 */
declare function togglePastLessons(showPast: boolean): void;
export {};
