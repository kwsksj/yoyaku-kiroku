export namespace participantsActionHandlers {
    export { loadParticipantsView };
    export { selectParticipantsLesson };
    export { selectParticipantsStudent };
    export { backToParticipantsList };
    export { backToParticipantsReservations };
}
/**
 * 参加者リストビュー初期化
 * ログイン成功後、管理者の場合に呼ばれる
 *
 * @param {boolean} forceReload - 強制的に再取得する場合はtrue
 */
declare function loadParticipantsView(forceReload?: boolean): void;
/**
 * レッスン選択ハンドラ
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
export {};
