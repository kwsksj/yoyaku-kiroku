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
