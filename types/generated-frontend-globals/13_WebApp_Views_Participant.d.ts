/**
 * 参加者リストメインビュー
 * stateManagerの状態に応じて適切なサブビューを返す
 * @returns {string} HTML文字列
 */
export function getParticipantView(): string;
export type LessonCore = import("../../types/core/lesson").LessonCore;
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
export type ParticipantColumnConfig = {
    /**
     * - データのキー
     */
    key: string;
    /**
     * - 列のラベル
     */
    label: string;
    /**
     * - 列の幅（CSS grid用）
     */
    width: string;
    /**
     * - テキスト配置（center, left, right）
     */
    align?: string;
    /**
     * - 管理者のみ表示
     */
    adminOnly?: boolean;
    /**
     * - カスタムレンダリング関数
     */
    render?: (row: any) => string;
};
