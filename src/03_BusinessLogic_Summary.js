/**
 * =================================================================
 * 【ファイル名】: 03_BusinessLogic_Summary.gs
 * 【バージョン】: 4.4
 * 【役割】: 予約サマリーシートの構築と更新を担当するロジック。
 * 【構成】: 14ファイル構成のうちの4番目
 * 【v4.4での変更点】:
 * - BUG-16: rebuildSummarySheetを修正。予約者がいない開催日もサマリーに
 * 反映されるように、集計ロジックを二段階処理に変更。
 * =================================================================
 */

/**
 * サマリーシートと、それに関連するGoogleフォームの選択肢を更新する統合関数。
 * @param {string} classroom - 教室名
 * @param {Date} date - 対象の日付
 */
function updateSummaryAndForm(classroom, date) {
  try {
    // Step 1: サマリーシートを更新
    _updateSummaryForDate(classroom, date);
    // Step 2: 対応する教室のフォーム選択肢を更新
    try { setCheckboxChoices(classroom); } catch (e) { Logger.log(`フォーム選択肢の更新に失敗: ${e.message}`); }
  } catch (err) {
    logActivity('system', 'system', 'SUMMARY_UPDATE_ERROR', 'FAILURE', `教室: ${classroom}, 日付: ${date}, エラー: ${err.message}`);
    Logger.log(`updateSummaryAndForm Error for ${classroom} on ${date}: ${err.message}`);
  }
}

/**
 * 編集イベントを元に、関連する日付のサマリー更新をトリガーする。
 * @param {Object} e - Google Sheets の編集イベントオブジェクト。
 */
function triggerSummaryUpdateFromEdit(e) {
  try {
    if (!e || !e.range) return; // イベントオブジェクトがない場合は終了

    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();

    if (!CLASSROOM_SHEET_NAMES.includes(sheetName)) {
      return;
    }

    const headerMap = createHeaderMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    const dateColIdx = headerMap.get(HEADER_DATE);
    if (dateColIdx === undefined) return;

    const editedDates = new Set();
    // 編集された行の日付を取得
    for (let i = 1; i <= range.getNumRows(); i++) {
        const dateCell = sheet.getRange(range.getRow() + i - 1, dateColIdx + 1);
        const date = dateCell.getValue();
        if(date instanceof Date){
            editedDates.add(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime());
        }
    }
    // 編集前の値が日付だった場合、それも更新対象に含める
    if(e.oldValue && !isNaN(new Date(e.oldValue).getTime())){
        const oldDate = new Date(e.oldValue);
        if(oldDate.getFullYear() > 2000) { // 有効な日付か簡易チェック
            editedDates.add(new Date(oldDate.getFullYear(), oldDate.getMonth(), oldDate.getDate()).getTime());
        }
    }

    editedDates.forEach(time => {
      _updateSummaryForDate(sheetName, new Date(time));
    });

    // フォームの選択肢も更新する
    try { setCheckboxChoices(sheetName); } catch (e) { Logger.log(`フォーム選択肢の更新に失敗: ${e.message}`); }

  } catch (err) {
    logActivity('system', 'system', 'SUMMARY_TRIGGER_ERROR', 'FAILURE', `シート: ${sheetName}, エラー: ${err.message}`);
    Logger.log(`triggerSummaryUpdateFromEdit Error: ${err.message} \n${err.stack}`);
  }
}

/**
 * 特定の教室・日付の予約状況を再計算し、サマリーシートに書き込む。
 * @param {string} sheetName - 教室名 (例: '東京教室')
 * @param {Date} date - 対象の日付
 */
function _updateSummaryForDate(sheetName, date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) return;

  const capacity = CLASSROOM_CAPACITIES[sheetName] || 8;
  const summaryHeaderMap = createHeaderMap(summarySheet.getRange(1, 1, 1, summarySheet.getLastColumn()).getValues()[0]);
  const venue = _getVenueForDate(sheetName, date);

  const counts = _getReservationCountsForDate(sheetName, date);
  const timezone = ss.getSpreadsheetTimeZone();

  const newRows = _createSummaryRowData(sheetName, date, counts, venue, timezone);

  newRows.forEach(rowData => {
      const key = rowData[0];
      _writeOrUpdateSummaryRow(summarySheet, key, rowData, summaryHeaderMap);
  });
}

/**
 * サマリーシートの特定の行を更新または新規作成するヘルパー関数
 */
function _writeOrUpdateSummaryRow(summarySheet, key, newRowData, headerMap) {
    const summaryData = summarySheet.getDataRange().getValues();
    const keyColIdx = headerMap.get(HEADER_SUMMARY_UNIQUE_KEY);
    let targetRow = -1;
    for (let i = 1; i < summaryData.length; i++) {
        if (summaryData[i][keyColIdx] === key) {
            targetRow = i + 1;
            break;
        }
    }

    if (targetRow !== -1) {
        summarySheet.getRange(targetRow, 1, 1, newRowData.length).setValues([newRowData]);
    } else {
        summarySheet.appendRow(newRowData);
    }
}

/**
 * 予約サマリーシートをゼロから再構築します。
 * メニューから手動で実行されることを想定しています。
 * 各シートへの読み込みを1回に抑えるワンパス処理を実装。
 */
function rebuildSummarySheet() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
        if (!summarySheet) throw new Error("「予約サマリー」シートが見つかりません。");

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const timezone = ss.getSpreadsheetTimeZone();

        const summaryAggregator = new Map();

        CLASSROOM_SHEET_NAMES.forEach(sheetName => {
            const sheet = ss.getSheetByName(sheetName);
            if (!sheet || sheet.getLastRow() < RESERVATION_DATA_START_ROW) return;

            const data = sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn()).getValues();
            const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const headerMap = createHeaderMap(header);

            const dateIdx = headerMap.get(HEADER_DATE);
            const venueIdx = headerMap.get(HEADER_VENUE);
            const countIdx = headerMap.get(HEADER_PARTICIPANT_COUNT);
            const nameIdx = headerMap.get(HEADER_NAME);
            const startTimeIdx = headerMap.get(HEADER_START_TIME);
            const endTimeIdx = headerMap.get(HEADER_END_TIME);
            const firstLectureIdx = headerMap.get(HEADER_FIRST_LECTURE);

            if (dateIdx === undefined) return;

            // Pass 1: 全ての開催日を登録
            data.forEach(row => {
                const date = row[dateIdx];
                if (!(date instanceof Date) || date < today) return;

                const dateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
                const venue = venueIdx !== undefined ? row[venueIdx] : '';

                let sessionsToCreate = [];
                if (sheetName === TSUKUBA_CLASSROOM_NAME) {
                    sessionsToCreate.push(SESSION_MORNING, SESSION_AFTERNOON, ITEM_NAME_FIRST_LECTURE);
                } else if (sheetName === TOKYO_CLASSROOM_NAME) {
                    sessionsToCreate.push(ITEM_NAME_MAIN_LECTURE, ITEM_NAME_FIRST_LECTURE);
                } else {
                    sessionsToCreate.push(SESSION_ALL_DAY, ITEM_NAME_FIRST_LECTURE);
                }

                sessionsToCreate.forEach(session => {
                    const key = `${dateString}|${sheetName}|${session}`;
                    if (!summaryAggregator.has(key)) {
                        summaryAggregator.set(key, {
                            date: new Date(date),
                            classroom: sheetName,
                            session: session,
                            venue: venue,
                            count: 0
                        });
                    }
                    if (venue && !summaryAggregator.get(key).venue) {
                        summaryAggregator.get(key).venue = venue;
                    }
                });
            });

            // Pass 2: 予約者数を集計
            data.forEach(row => {
                const date = row[dateIdx];
                const name = row[nameIdx];
                const status = String(row[countIdx]).toLowerCase();

                if (!(date instanceof Date) || date < today || !name || status === STATUS_CANCEL || status === STATUS_WAITING) {
                    return;
                }

                const isFirstLecture = firstLectureIdx !== undefined && row[firstLectureIdx] === true;
                const dateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');

                if (sheetName === TSUKUBA_CLASSROOM_NAME) {
                    const startTime = row[startTimeIdx];
                    const endTime = row[endTimeIdx];
                    if (startTime instanceof Date && endTime instanceof Date) {
                        const startHour = startTime.getHours();
                        const endHour = endTime.getHours();
                        const endMinutes = endTime.getMinutes();

                        if (startHour < TSUKUBA_MORNING_SESSION_END_HOUR) {
                            const key = `${dateString}|${sheetName}|${SESSION_MORNING}`;
                            if (summaryAggregator.has(key)) summaryAggregator.get(key).count++;
                        }
                        const isInAfternoon = endHour > TSUKUBA_MORNING_SESSION_END_HOUR || (endHour === TSUKUBA_MORNING_SESSION_END_HOUR && endMinutes > 0);
                        if (isInAfternoon) {
                           const afternoonKey = `${dateString}|${sheetName}|${SESSION_AFTERNOON}`;
                           if (summaryAggregator.has(afternoonKey)) summaryAggregator.get(afternoonKey).count++;
                           if (isFirstLecture) {
                               const introKey = `${dateString}|${sheetName}|${ITEM_NAME_FIRST_LECTURE}`;
                               if (summaryAggregator.has(introKey)) summaryAggregator.get(introKey).count++;
                           }
                        }
                    }
                } else if (sheetName === TOKYO_CLASSROOM_NAME) {
                    const mainKey = `${dateString}|${sheetName}|${ITEM_NAME_MAIN_LECTURE}`;
                    if (summaryAggregator.has(mainKey)) {
                        summaryAggregator.get(mainKey).count++;
                    }
                    if (isFirstLecture) {
                        const introKey = `${dateString}|${sheetName}|${ITEM_NAME_FIRST_LECTURE}`;
                        if (summaryAggregator.has(introKey)) {
                            summaryAggregator.get(introKey).count++;
                        }
                    }
                } else {
                    const key = `${dateString}|${sheetName}|${SESSION_ALL_DAY}`;
                    if (summaryAggregator.has(key)) {
                        summaryAggregator.get(key).count++;
                    }
                    if (isFirstLecture) {
                        const introKey = `${dateString}|${sheetName}|${ITEM_NAME_FIRST_LECTURE}`;
                        if (summaryAggregator.has(introKey)) summaryAggregator.get(introKey).count++;
                    }
                }
            });
        });

        // --- STEP 2: 集計結果をシート書き込み用の配列に変換 ---
        const groupedByDateAndClassroom = new Map();
        summaryAggregator.forEach((value, key) => {
            const dateString = Utilities.formatDate(value.date, timezone, 'yyyy-MM-dd');
            const groupKey = `${dateString}|${value.classroom}`;
            if (!groupedByDateAndClassroom.has(groupKey)) {
                groupedByDateAndClassroom.set(groupKey, {});
            }
            groupedByDateAndClassroom.get(groupKey)[value.session] = value;
        });

        let summaryData = [];
        groupedByDateAndClassroom.forEach((sessions, groupKey) => {
            const [dateString, classroom] = groupKey.split('|');
            const date = new Date(dateString);
            const counts = new Map();
            let venue = '';
            for (const sessionName in sessions) {
                const sessionData = sessions[sessionName];
                counts.set(sessionName, sessionData.count);
                if (sessionData.venue) venue = sessionData.venue;
            }
            const newRows = _createSummaryRowData(classroom, date, counts, venue, timezone);
            summaryData.push(...newRows);
        });

        // --- STEP 3: データをソートしてシートに書き込み ---
        summaryData.sort((a, b) => {
            const dateComp = a[1].getTime() - b[1].getTime();
            if (dateComp !== 0) return dateComp;
            return a[2].localeCompare(b[2]);
        });

        const lastRow = summarySheet.getLastRow();
        if (lastRow > 1) {
            summarySheet.getRange(2, 1, lastRow - 1, summarySheet.getLastColumn()).clearContent();
        }
        if (summaryData.length > 0) {
            summarySheet.getRange(2, 1, summaryData.length, summaryData[0].length).setValues(summaryData);
        }

        // STEP 4: 全ての教室のフォーム選択肢を更新
        Object.keys(GOOGLE_FORM_IDS).forEach(classroomName => {
            try { setCheckboxChoices(classroomName); } catch (e) { Logger.log(`サマリー再構築後のフォーム選択肢更新に失敗 (${classroomName}): ${e.message}`); }
        });

        handleError("予約サマリーの再構築が完了しました。", false);
        logActivity('user', Session.getActiveUser().getEmail(), 'SUMMARY_REBUILD', 'SUCCESS', '全教室・全期間');

    } catch (err) {
        handleError(`予約サマリーの再構築中にエラーが発生しました: ${err.message}`, true);
    }
}

/**
 * 特定の教室・日付の予約数をセッションごとに集計して返すプライベートヘルパー関数。
 * @param {string} classroom - 教室名
 * @param {Date} date - 対象の日付
 * @returns {Map<string, number>} セッション名をキー、予約数を値とするMap
 */
function _getReservationCountsForDate(classroom, date) {
    const counts = new Map();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classroom);
    if (!sheet || sheet.getLastRow() < RESERVATION_DATA_START_ROW) return counts;

    const data = sheet.getRange(RESERVATION_DATA_START_ROW, 1, sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1, sheet.getLastColumn()).getValues();
    const headerMap = createHeaderMap(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);

    const dateIdx = headerMap.get(HEADER_DATE);
    const countIdx = headerMap.get(HEADER_PARTICIPANT_COUNT);
    const nameIdx = headerMap.get(HEADER_NAME);
    const startTimeIdx = headerMap.get(HEADER_START_TIME);
    const endTimeIdx = headerMap.get(HEADER_END_TIME);
    const firstLectureIdx = headerMap.get(HEADER_FIRST_LECTURE);

    if (dateIdx === undefined) return counts;
    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const targetDateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');

    data.forEach(row => {
        const rowDate = row[dateIdx];
        const status = String(row[countIdx]).toLowerCase();
        const name = row[nameIdx];

        const isFirstLecture = firstLectureIdx !== undefined && row[firstLectureIdx] === true;

        if (name && status !== STATUS_CANCEL && status !== STATUS_WAITING && rowDate instanceof Date && Utilities.formatDate(rowDate, timezone, 'yyyy-MM-dd') === targetDateString) {
            if (classroom === TSUKUBA_CLASSROOM_NAME) {
                const startTime = row[startTimeIdx];
                const endTime = row[endTimeIdx];
                if (startTime instanceof Date && endTime instanceof Date) {
                    const startHour = startTime.getHours();
                    const endHour = endTime.getHours();
                    const endMinutes = endTime.getMinutes();

                    if (startHour < TSUKUBA_MORNING_SESSION_END_HOUR) {
                        counts.set(SESSION_MORNING, (counts.get(SESSION_MORNING) || 0) + 1);
                    }
                    const isInAfternoon = endHour > TSUKUBA_MORNING_SESSION_END_HOUR || (endHour === TSUKUBA_MORNING_SESSION_END_HOUR && endMinutes > 0);
                    if (isInAfternoon) {
                        counts.set(SESSION_AFTERNOON, (counts.get(SESSION_AFTERNOON) || 0) + 1);
                        if (isFirstLecture) {
                            counts.set(ITEM_NAME_FIRST_LECTURE, (counts.get(ITEM_NAME_FIRST_LECTURE) || 0) + 1);
                        }
                    }
                }
            } else if (classroom === TOKYO_CLASSROOM_NAME) {
                // 本講座の予約数をインクリメント
                counts.set(ITEM_NAME_MAIN_LECTURE, (counts.get(ITEM_NAME_MAIN_LECTURE) || 0) + 1);

                if (isFirstLecture) {
                    // 初回講習の予約数をインクリメント
                    counts.set(ITEM_NAME_FIRST_LECTURE, (counts.get(ITEM_NAME_FIRST_LECTURE) || 0) + 1);
                }
            } else { // 沼津など
                counts.set(SESSION_ALL_DAY, (counts.get(SESSION_ALL_DAY) || 0) + 1);
                if (isFirstLecture) {
                    counts.set(ITEM_NAME_FIRST_LECTURE, (counts.get(ITEM_NAME_FIRST_LECTURE) || 0) + 1);
                }
            }
        }
    });
    return counts;
}

/**
 * 予約数と教室情報から、サマリーシートに書き込むための行データ配列を生成する。
 * @private
 * @param {string} classroom - 教室名
 * @param {Date} date - 対象の日付
 * @param {Map<string, number>} counts - セッションごとの予約数
 * @param {string} venue - 会場名
 * @param {string} timezone - タイムゾーン
 * @returns {Array<Array<any>>} サマリーシートに書き込む行データの配列
 */
function _createSummaryRowData(classroom, date, counts, venue, timezone) {
    const rows = [];
    const dateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
    const introCount = counts.get(ITEM_NAME_FIRST_LECTURE) || 0;

    if (classroom === TSUKUBA_CLASSROOM_NAME) {
        const capacity = CLASSROOM_CAPACITIES[classroom] || 8;
        const morningReservations = counts.get(SESSION_MORNING) || 0;
        const afternoonReservations = counts.get(SESSION_AFTERNOON) || 0;
        const morningAvailable = Math.max(0, capacity - morningReservations);
        const afternoonAvailable = Math.max(0, capacity - afternoonReservations);

        rows.push([`${dateString}_${classroom}_${SESSION_MORNING}`, date, classroom, SESSION_MORNING, venue, capacity, morningReservations, morningAvailable, new Date()]);
        rows.push([`${dateString}_${classroom}_${SESSION_AFTERNOON}`, date, classroom, SESSION_AFTERNOON, venue, capacity, afternoonReservations, afternoonAvailable, new Date()]);

        // つくばの初回講習は午後の空きに依存
        const introSpecificAvailable = Math.max(0, INTRO_LECTURE_CAPACITY - introCount);
        const finalIntroAvailable = Math.min(afternoonAvailable, introSpecificAvailable);
        rows.push([`${dateString}_${classroom}_${ITEM_NAME_FIRST_LECTURE}`, date, classroom, ITEM_NAME_FIRST_LECTURE, venue, INTRO_LECTURE_CAPACITY, introCount, finalIntroAvailable, new Date()]);

    } else if (classroom === TOKYO_CLASSROOM_NAME) {
        const mainCount = counts.get(ITEM_NAME_MAIN_LECTURE) || 0;
        const availability = _calculateTokyoAvailability(mainCount, introCount);

        rows.push([`${dateString}_${classroom}_${ITEM_NAME_MAIN_LECTURE}`, date, classroom, ITEM_NAME_MAIN_LECTURE, venue, CLASSROOM_CAPACITIES[TOKYO_CLASSROOM_NAME], mainCount, availability.mainAvailable, new Date()]);
        rows.push([`${dateString}_${classroom}_${ITEM_NAME_FIRST_LECTURE}`, date, classroom, ITEM_NAME_FIRST_LECTURE, venue, INTRO_LECTURE_CAPACITY, introCount, availability.introAvailable, new Date()]);

    } else { // 沼津など
        const capacity = CLASSROOM_CAPACITIES[classroom] || 8;
        const reservations = counts.get(SESSION_ALL_DAY) || 0;
        const available = Math.max(0, capacity - reservations);
        rows.push([`${dateString}_${classroom}_${SESSION_ALL_DAY}`, date, classroom, SESSION_ALL_DAY, venue, capacity, reservations, available, new Date()]);

        // 沼津などの初回講習は全日の空きに依存
        const introSpecificAvailable = Math.max(0, INTRO_LECTURE_CAPACITY - introCount);
        const finalIntroAvailable = Math.min(available, introSpecificAvailable);
        rows.push([`${dateString}_${classroom}_${ITEM_NAME_FIRST_LECTURE}`, date, classroom, ITEM_NAME_FIRST_LECTURE, venue, INTRO_LECTURE_CAPACITY, introCount, finalIntroAvailable, new Date()]);
    }
    return rows;
}

/**
 * 東京教室の「本講座」と「初回講習」の空席数を計算するヘルパー関数。
 * @param {number} mainCount - 本講座の予約数（初回講習者も含む）
 * @param {number} introCount - 初回講習の予約数
 * @returns {{mainAvailable: number, introAvailable: number}} - 本講座と初回講習のそれぞれの空席数
 */
function _calculateTokyoAvailability(mainCount, introCount) {
    const totalCapacity = CLASSROOM_CAPACITIES[TOKYO_CLASSROOM_NAME];
    const introCapacity = INTRO_LECTURE_CAPACITY;

    const mainAvailable = Math.max(0, totalCapacity - mainCount);
    const introSpecificAvailable = Math.max(0, introCapacity - introCount);
    const finalIntroAvailable = Math.min(mainAvailable, introSpecificAvailable);

    return { mainAvailable: mainAvailable, introAvailable: finalIntroAvailable };
}

/**
 * 特定の日付の会場名を取得するヘルパー関数。
 * @param {string} sheetName - 教室名
 * @param {Date} date - 対象の日付
 * @returns {string} 会場名
 */
function _getVenueForDate(sheetName, date) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return '';
    const data = sheet.getDataRange().getValues();
    const headerMap = createHeaderMap(data.shift());
    const dateIdx = headerMap.get(HEADER_DATE);
    const venueIdx = headerMap.get(HEADER_VENUE);
    if (dateIdx === undefined || venueIdx === undefined) return '';

    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const targetDateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');

    const row = data.find(r => r[dateIdx] instanceof Date && Utilities.formatDate(r[dateIdx], timezone, 'yyyy-MM-dd') === targetDateString && r[venueIdx]);
    return row ? row[venueIdx] : '';
}
