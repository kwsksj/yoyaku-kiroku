// @ts-check

/// <reference path="types/constants.d.ts" />

/**
 * 深い階層のプロパティチェックテスト
 */

// 正しい深いプロパティアクセス（エラーなし）
const validStatus1 = CONSTANTS.STATUS.CONFIRMED; // 'の確定' - 正しい
const validStatus2 = CONSTANTS.STATUS.CANCELED; // '取消' - 正しい
const validClassroom = CONSTANTS.CLASSROOMS.TOKYO; // '東京教室' - 正しい
const validItem = CONSTANTS.ITEMS.MAIN_LECTURE; // '基本授業料' - 正しい

// 間違った深いプロパティアクセス（エラーが出るべき）
const invalidStatus1 = CONSTANTS.STATUS.INVALID_STATUS; // ←この行で赤いエラーが出るべき
const invalidStatus2 = CONSTANTS.STATUS.CONFIMED; // ←CONFIRMED の typo、エラーが出るべき
const invalidClassroom = CONSTANTS.CLASSROOMS.OSAKA; // ←存在しない教室、エラーが出るべき
const invalidItem = CONSTANTS.ITEMS.WRONG_ITEM; // ←存在しない項目、エラーが出るべき

// さらに深い階層のテスト
const validCapacity = CONSTANTS.CLASSROOM_CAPACITIES.東京教室; // 8 - 正しい
const invalidCapacity = CONSTANTS.CLASSROOM_CAPACITIES.大阪教室; // ←存在しない、エラーが出るべき

console.log('Deep property checking test completed');
