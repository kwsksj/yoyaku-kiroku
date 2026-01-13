export namespace participantActionHandlers {
    export { loadParticipantView };
    export function goToParticipantsView(): void;
    export { refreshParticipantView };
    export function markAllLogsAsViewed(): void;
    export function refreshLogView(): void;
    export function goToLogView(): void;
    export { toggleParticipantLessonAccordion };
    export { expandAllAccordions };
    export { collapseAllAccordions };
    export { toggleAllAccordions };
    export { selectParticipantStudent };
    export { backToParticipantList };
    export function backToParticipantsView(): void;
    export { filterParticipantByClassroom };
    export { togglePastLessons };
}
/**
 * 参加者リストビュー初期化
 * ログイン成功後、管理者の場合に呼ばれる
 *
 * @param {boolean} forceReload - 強制的に再取得する場合はtrue
 * @param {string|boolean} loadingCategory - ローディングバリエーション（'participants' | 'dataFetch' 等）。falseの場合は非表示。
 * @param {Partial<UIState> | null} baseAppState - 初期状態
 * @param {boolean} _includeHistory - 過去の履歴も含めるか（現在は常にtrueで取得するため未使用）
 */
declare function loadParticipantView(forceReload?: boolean, loadingCategory?: string | boolean, baseAppState?: Partial<UIState> | null, _includeHistory?: boolean): void;
/**
 * 参加者リストビューのデータ更新（手動リフレッシュ）
 */
declare function refreshParticipantView(): void;
/**
 * アコーディオンの開閉を切り替えるハンドラ（DOM操作のみ、再描画なし）
 * @param {string} lessonId - レッスンID
 */
declare function toggleParticipantLessonAccordion(lessonId: string): void;
/**
 * すべてのアコーディオンを開くハンドラ（DOM操作のみ、再描画なし）
 */
declare function expandAllAccordions(): void;
/**
 * すべてのアコーディオンを閉じるハンドラ（DOM操作のみ、再描画なし）
 */
declare function collapseAllAccordions(): void;
/**
 * すべてのアコーディオンの開閉をトグル（DOM操作のみ、再描画なし）
 * 1つでも閉じているものがあれば全て開く、すべて開いていれば全て閉じる
 */
declare function toggleAllAccordions(): void;
/**
 * 生徒選択ハンドラ（モーダル表示）
 * プリロードされた生徒データから即座に詳細を表示
 * @param {string} targetStudentId - 表示対象の生徒ID
 * @param {string} [_lessonId] - レッスンID（未使用、後方互換性のため残す）
 */
declare function selectParticipantStudent(targetStudentId: string, _lessonId?: string): void;
/**
 * レッスン一覧に戻る
 */
declare function backToParticipantList(): void;
/**
 * 教室フィルタハンドラ
 * @param {string|{classroom?: string}} data - 選択された教室またはdataオブジェクト
 */
declare function filterParticipantByClassroom(data: string | {
    classroom?: string;
}): void;
/**
 * 過去/未来のレッスン切り替えハンドラ
 * @param {boolean} showPast - 過去のレッスンを表示するか
 */
declare function togglePastLessons(showPast: boolean): void;
export {};
