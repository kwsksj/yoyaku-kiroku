/**
 * 参加者リストメインビュー
 * stateManagerの状態に応じて適切なサブビューを返す
 * @returns {string} HTML文字列
 */
export function getParticipantsView(): string;
export type ClassroomColorConfig = {
    /**
     * - 背景色クラス
     */
    bg: string;
    /**
     * - ボーダー色クラス
     */
    border: string;
    /**
     * - テキスト色クラス
     */
    text: string;
    /**
     * - バッジ色クラス
     */
    badge: string;
};
