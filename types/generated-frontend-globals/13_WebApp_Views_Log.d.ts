/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp
 * @property {string} userId
 * @property {string} realName
 * @property {string} nickname
 * @property {string} action
 * @property {string} result
 * @property {string} classroom
 * @property {string} reservationId
 * @property {string} date
 * @property {string} message
 * @property {string} details
 */
/**
 * ログビューのメインHTMLを生成
 * @returns {string} HTML文字列
 */
export function getLogView(): string;
export type LogEntry = {
    timestamp: string;
    userId: string;
    realName: string;
    nickname: string;
    action: string;
    result: string;
    classroom: string;
    reservationId: string;
    date: string;
    message: string;
    details: string;
};
