export namespace participantsActionHandlers {
    export { loadParticipantsView };
    export { toggleParticipantsLessonAccordion };
    export { selectParticipantsLesson };
    export { selectParticipantsStudent };
    export { backToParticipantsList };
    export { backToParticipantsReservations };
    export { filterParticipantsByClassroom };
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
declare function loadParticipantsView(forceReload?: boolean, shouldShowLoading?: boolean, baseAppState?: Partial<UIState> | null): void;
/**
 * アコーディオンの開閉を切り替えるハンドラ（複数展開対応・DOM直接操作版）
 * @param {string} lessonId - レッスンID
 */
declare function toggleParticipantsLessonAccordion(lessonId: string): void;
/**
 * レッスン選択ハンドラ（旧実装 - 互換性のため残す）
 * @param {string} lessonId - レッスンID
 */
declare function selectParticipantsLesson(lessonId: string): void;
/**
 * 生徒選択ハンドラ
 * @param {string} targetStudentId - 表示対象の生徒ID
 */
declare function selectParticipantsStudent(targetStudentId: string): void;
/**
 * レッスン一覧に戻る
 */
declare function backToParticipantsList(): void;
/**
 * 参加者リストに戻る
 */
declare function backToParticipantsReservations(): void;
/**
 * 教室フィルタハンドラ
 * @param {string} classroom - 選択された教室（'all'または教室名）
 */
declare function filterParticipantsByClassroom(classroom: string): void;
/**
 * 過去/未来のレッスン切り替えハンドラ
 * @param {boolean} showPast - 過去のレッスンを表示するか
 */
declare function togglePastLessons(showPast: boolean): void;
export {};
