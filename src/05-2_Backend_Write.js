/**
 * =================================================================
 * 【ファイル名】: 05-2_Backend_Write.gs
 * 【バージョン】: 1.1
 * 【役割】: WebAppからのデータ書き込み・更新要求（Write）と、
 * それに付随する検証ロジックに特化したバックエンド機能。
 * 【構成】: 14ファイル構成のうちの7番目
 * 【v1.1での変更点】:
 * - FE-16: saveAccountingDetailsを修正。会計処理時に、時刻やオプションの値を
 * 予約シート本体に書き戻し、受講時間とガントチャートを再計算・再描画する機能を追加。
 * =================================================================
 */

/**
 * 時間制予約の時刻に関する検証を行うプライベートヘルパー関数。
 * @param {string} startTime - 開始時刻 (HH:mm)。
 * @param {string} endTime - 終了時刻 (HH:mm)。
 * @param {object} classroomRule - 料金・商品マスタから取得した教室ルール。
 * @throws {Error} 検証に失敗した場合、理由を示すエラーをスローする。
 */
function _validateTimeBasedReservation(startTime, endTime, classroomRule) {
    if (!startTime || !endTime) throw new Error("開始時刻と終了時刻の両方を指定してください。");
    if (startTime >= endTime) throw new Error("終了時刻は開始時刻より後に設定する必要があります。");

    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    if (durationMinutes < 120) {
        throw new Error("最低予約時間は2時間です。");
    }

    const breakStart = classroomRule[HEADER_BREAK_START] ? new Date(`1970-01-01T${classroomRule[HEADER_BREAK_START]}`) : null;
    const breakEnd = classroomRule[HEADER_BREAK_END] ? new Date(`1970-01-01T${classroomRule[HEADER_BREAK_END]}`) : null;
    if (breakStart && breakEnd) {
        if (start >= breakStart && start < breakEnd) throw new Error(`予約の開始時刻（${startTime}）を休憩時間内に設定することはできません。`);
        if (end > breakStart && end <= breakEnd) throw new Error(`予約の終了時刻（${endTime}）を休憩時間内に設定することはできません。`);
    }
}

/**
 * 予約を実行します。
 * 新しい定員管理ロジック（予約シートの直接スキャン）で予約可否を判断します。
 * @param {object} reservationInfo - 予約情報。
 * @returns {object} - 処理結果。
 */
function makeReservation(reservationInfo) {
    const lock = LockService.getScriptLock();
    lock.waitLock(LOCK_WAIT_TIME_MS);
    try {
        const { classroom, date, user, options } = reservationInfo;
        const { startTime, endTime } = options;

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classroom);
        if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

        const masterData = getAccountingMasterData().data;
        const classroomRule = masterData.find(item => item['対象教室'] && item['対象教室'].includes(classroom) && item['種別'] === ITEM_TYPE_TUITION);

        if (classroomRule && classroomRule['単位'] === UNIT_30_MIN) {
            _validateTimeBasedReservation(startTime, endTime, classroomRule);
        }

        const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const headerMap = createHeaderMap(header);
        const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
        const data = sheet.getRange(RESERVATION_DATA_START_ROW, 1, sheet.getLastRow() - RESERVATION_DATA_START_ROW + 1, sheet.getLastColumn()).getValues();

        const dateColIdx = headerMap.get(HEADER_DATE);
        const countColIdx = headerMap.get(HEADER_PARTICIPANT_COUNT);
        const nameColIdx = headerMap.get(HEADER_NAME);
        const startTimeColIdx = headerMap.get(HEADER_START_TIME);
        const endTimeColIdx = headerMap.get(HEADER_END_TIME);
        const wipColIdx = headerMap.get(HEADER_WORK_IN_PROGRESS);
        const orderColIdx = headerMap.get(HEADER_ORDER);
        const capacity = CLASSROOM_CAPACITIES[classroom] || 8;
        
        let isFull = false;
        
        const dateFilter = (row) => {
            const rowDate = row[dateColIdx];
            const status = String(row[countColIdx]).toLowerCase();
            const name = row[nameColIdx];
            return rowDate instanceof Date && Utilities.formatDate(rowDate, timezone, "yyyy-MM-dd") === date && status !== STATUS_CANCEL && !!name;
        };

        if (classroom === TSUKUBA_CLASSROOM_NAME) {
            const reqStartHour = startTime ? new Date(`1970-01-01T${startTime}`).getHours() : 0;
            const reqEndHour = endTime ? new Date(`1970-01-01T${endTime}`).getHours() : 24;
            
            let morningCount = 0;
            let afternoonCount = 0;
            data.filter(dateFilter).forEach(row => {
                const rStart = row[startTimeColIdx];
                const rEnd = row[endTimeColIdx];
                const rStartHour = rStart instanceof Date ? rStart.getHours() : 0;
                const rEndHour = rEnd instanceof Date ? rEnd.getHours() : 24;

                if (rStartHour < TSUKUBA_MORNING_SESSION_END_HOUR) morningCount++;
                if (rEndHour >= TSUKUBA_MORNING_SESSION_END_HOUR) afternoonCount++;
            });
            
            const morningFull = morningCount >= capacity;
            const afternoonFull = afternoonCount >= capacity;

            if (reqStartHour < TSUKUBA_MORNING_SESSION_END_HOUR && morningFull) isFull = true;
            if (reqEndHour >= TSUKUBA_MORNING_SESSION_END_HOUR && afternoonFull) isFull = true;

        } else {
            const reservationsOnDate = data.filter(dateFilter).length;
            isFull = reservationsOnDate >= capacity;
        }

        let newReservationId = '';
        const targetDate = new Date(date);
        let emptyRowIndex = -1;
        let targetRowValues = null; // 【NF-12】For cache object
        let lastRowOfBlock = -1;

        data.forEach((row, index) => {
            const rowDate = row[dateColIdx];
            if (rowDate instanceof Date && Utilities.formatDate(rowDate, timezone, "yyyy-MM-dd") === date) {
                lastRowOfBlock = index + RESERVATION_DATA_START_ROW;
                if (emptyRowIndex === -1 && (!row[nameColIdx] || String(row[nameColIdx]).trim() === '')) {
                    emptyRowIndex = index + RESERVATION_DATA_START_ROW;
                }
            }
        });
        if(lastRowOfBlock === -1) lastRowOfBlock = sheet.getLastRow();

        const setValuesInRow = (values) => {
            const studentIdColIdx = headerMap.get(HEADER_STUDENT_ID);
            const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
            const hayadeColIdx = headerMap.get(HEADER_EARLY_ARRIVAL);
            const rentalColIdx = headerMap.get(HEADER_CHISEL_RENTAL);

            if (classroom === TOKYO_CLASSROOM_NAME) {
                const master = getAccountingMasterData().data;
                const tokyoRule = master.find(item => item['項目名'] === ITEM_NAME_MAIN_LECTURE && item['対象教室'] === TOKYO_CLASSROOM_NAME);
                const hayadeRule = master.find(item => item['項目名'] === ITEM_NAME_EARLY_ARRIVAL && item['対象教室'] === TOKYO_CLASSROOM_NAME);
                
                if (tokyoRule) {
                    let finalStartTime = (options.earlyArrival || options.firstLecture) && hayadeRule ? hayadeRule[HEADER_CLASS_START] : tokyoRule[HEADER_CLASS_START];
                    let finalEndTime = tokyoRule[HEADER_CLASS_END];                    
                    if (startTimeColIdx !== undefined && finalStartTime) values[startTimeColIdx] = new Date(`1970-01-01T${finalStartTime}:00`);
                    if (endTimeColIdx !== undefined && finalEndTime) values[endTimeColIdx] = new Date(`1970-01-01T${finalEndTime}:00`);
                }
            } else {
                if (startTimeColIdx !== undefined && startTime) values[startTimeColIdx] = new Date(`1970-01-01T${startTime}:00`);
                if (endTimeColIdx !== undefined && endTime) values[endTimeColIdx] = new Date(`1970-01-01T${endTime}:00`);
            }

            newReservationId = values[reservationIdColIdx] || Utilities.getUuid();
            if (!values[reservationIdColIdx]) values[reservationIdColIdx] = newReservationId;
            values[studentIdColIdx] = user.studentId;
            values[nameColIdx] = user.displayName;
            if (headerMap.has(HEADER_FIRST_LECTURE)) values[headerMap.get(HEADER_FIRST_LECTURE)] = options.firstLecture || false;
            if (hayadeColIdx !== undefined) values[hayadeColIdx] = options.earlyArrival || false;
            if (rentalColIdx !== undefined) values[rentalColIdx] = options.chiselRental || false;
            if (wipColIdx !== undefined) values[wipColIdx] = options.workInProgress || '';
            if (orderColIdx !== undefined) values[orderColIdx] = options.order || '';

            targetRowValues = values; // 【NF-12】
        };

        if (!isFull && emptyRowIndex !== -1) {
            const targetRange = sheet.getRange(emptyRowIndex, 1, 1, sheet.getLastColumn());
            const currentValues = targetRange.getValues()[0];
            setValuesInRow(currentValues);
            targetRange.setValues([currentValues]);
            if (startTimeColIdx !== undefined) sheet.getRange(emptyRowIndex, startTimeColIdx + 1).setNumberFormat("HH:mm");
            if (endTimeColIdx !== undefined) sheet.getRange(emptyRowIndex, endTimeColIdx + 1).setNumberFormat("HH:mm");
            updateBillableTime(sheet, emptyRowIndex);
            updateGanttChart(sheet, emptyRowIndex);
            populateReservationWithRosterData(user.studentId, sheet, emptyRowIndex);
        } else {
            const newRowValues = new Array(header.length).fill('');
            newRowValues[dateColIdx] = targetDate;
            newRowValues[countColIdx] = isFull ? STATUS_WAITING : "";
            
            const venueColIdx = headerMap.get(HEADER_VENUE);
            const sameDateRow = data.find(r => r[dateColIdx] instanceof Date && Utilities.formatDate(r[dateColIdx], timezone, "yyyy-MM-dd") === date);
            if (classroom === TOKYO_CLASSROOM_NAME && venueColIdx !== undefined && sameDateRow) {
                newRowValues[venueColIdx] = sameDateRow[venueColIdx];
            }
            
            setValuesInRow(newRowValues);
            sheet.insertRowAfter(lastRowOfBlock);
            const newRowIndex = lastRowOfBlock + 1;
            sheet.getRange(newRowIndex, 1, 1, newRowValues.length).setValues([newRowValues]);
            if (startTimeColIdx !== undefined) sheet.getRange(newRowIndex, startTimeColIdx + 1).setNumberFormat("HH:mm");
            if (endTimeColIdx !== undefined) sheet.getRange(newRowIndex, endTimeColIdx + 1).setNumberFormat("HH:mm");
            updateBillableTime(sheet, newRowIndex);
            updateGanttChart(sheet, newRowIndex);
            populateReservationWithRosterData(user.studentId, sheet, newRowIndex);
        }
        
        sortAndRenumberDateBlock(sheet, targetDate);
        formatSheetWithBordersSafely(sheet);
        SpreadsheetApp.flush(); // Ensure all sheet writes are complete before cache update

        // 【NF-12】Construct new booking object for cache
        const timeToString = (date) => date instanceof Date ? Utilities.formatDate(date, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "HH:mm") : null;
        const newBookingObject = {
            reservationId: newReservationId,
            classroom: classroom,
            date: Utilities.formatDate(targetDate, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd"),
            isWaiting: isFull,
            venue: (headerMap.has(HEADER_VENUE) && targetRowValues[headerMap.get(HEADER_VENUE)]) ? targetRowValues[headerMap.get(HEADER_VENUE)] : '',
            startTime: timeToString(targetRowValues[startTimeColIdx]),
            endTime: timeToString(targetRowValues[endTimeColIdx]),
            earlyArrival: options.earlyArrival || false,
            firstLecture: options.firstLecture || false,
            workInProgress: options.workInProgress || '',
            order: options.order || '',
            accountingDone: false,
            accountingDetails: ''
        };
        const newBookingsCache = _updateFutureBookingsCacheIncrementally(user.studentId, 'add', newBookingObject);

        const message = !isFull ? '予約が完了しました。' : '満席のため、キャンセル待ちで登録しました。';
        return { success: true, message: message, newBookingsCache: newBookingsCache };
    } catch (err) {
        Logger.log(`makeReservation Error: ${err.message}\n${err.stack}`);
        return { success: false, message:  `予約処理中にエラーが発生しました。\n${err.message}`  };
    } finally {
        lock.releaseLock();
    }
}

/**
 * 予約をキャンセルします。
 * @param {object} cancelInfo - { reservationId: string, classroom: string, studentId: string }
 * @returns {object} - 処理結果。
 */
function cancelReservation(cancelInfo) {
    const lock = LockService.getScriptLock();
    lock.waitLock(LOCK_WAIT_TIME_MS);

    try {
        const { reservationId, classroom, studentId } = cancelInfo;
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classroom);
        if (!sheet) throw new Error( `予約シート「 ${classroom} 」が見つかりません。` );

        const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const headerMap = createHeaderMap(header);
        const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
        const studentIdColIdx = headerMap.get(HEADER_STUDENT_ID);
        const dateColIdx = headerMap.get(HEADER_DATE);
        const participantCountColIdx = headerMap.get(HEADER_PARTICIPANT_COUNT);
        const venueColIdx = headerMap.get(HEADER_VENUE);
      
        if (reservationIdColIdx === undefined || studentIdColIdx === undefined) {
           throw new Error("必要なヘッダー（予約ID, 生徒ID）が見つかりません。");
        }
      
        const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
        if (targetRowIndex === -1) throw new Error( "キャンセル対象の予約が見つかりませんでした。" );
        
        const ownerId = sheet.getRange(targetRowIndex, studentIdColIdx + 1).getValue();
        if (ownerId !== studentId) {
            throw new Error("この予約をキャンセルする権限がありません。");
        }

        const originalValues = sheet.getRange(targetRowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
        const status = String(originalValues[participantCountColIdx]).toLowerCase();
        const targetDate = originalValues[dateColIdx];
      
        const targetRowRange = sheet.getRange(targetRowIndex, 1, 1, sheet.getLastColumn());
        const valuesToUpdate = targetRowRange.getValues()[0];
        valuesToUpdate[participantCountColIdx] = STATUS_CANCEL;
        targetRowRange.setValues([valuesToUpdate]);

        if (status !== STATUS_WAITING) {
            const lastRowOfBlock = findLastRowOfDateBlock(sheet, targetDate, dateColIdx);
            sheet.insertRowAfter(lastRowOfBlock);
            const newEmptyRow = sheet.getRange(lastRowOfBlock + 1, 1, 1, sheet.getLastColumn());
            const emptyRowValues = new Array(header.length).fill('');
            emptyRowValues[reservationIdColIdx] = Utilities.getUuid();
            emptyRowValues[dateColIdx] = targetDate;
            if(venueColIdx !== undefined) emptyRowValues[venueColIdx] = originalValues[venueColIdx];
            newEmptyRow.setValues([emptyRowValues]);
        }
        
        if (targetDate instanceof Date) {
             sortAndRenumberDateBlock(sheet, targetDate);
        }

        formatSheetWithBordersSafely(sheet);
        SpreadsheetApp.flush();

        // 【NF-12】Update cache incrementally
        const newBookingsCache = _updateFutureBookingsCacheIncrementally(studentId, 'remove', { reservationId });

        return { success: true, message: "予約をキャンセルしました。", newBookingsCache: newBookingsCache };

    } catch (err) {
        Logger.log(`cancelReservation Error: ${err.message}\n${err.stack}`);
        return { success: false, message: `キャンセル処理中にエラーが発生しました。` };
    } finally {
        lock.releaseLock();
    }
}

/**
 * 予約の詳細情報を一括で更新します。
 * @param {object} details - 予約詳細情報。
 * @returns {object} - 処理結果。
 */
function updateReservationDetails(details) {
    const lock = LockService.getScriptLock();
    lock.waitLock(LOCK_WAIT_TIME_MS);
    try {
        const { reservationId, classroom } = details;
        const masterData = getAccountingMasterData().data;
        const classroomRule = masterData.find(item => item['対象教室'] && item['対象教室'].includes(classroom) && item['種別'] === ITEM_TYPE_TUITION);

        if (classroomRule && classroomRule['単位'] === UNIT_30_MIN) { 
            _validateTimeBasedReservation(details.startTime, details.endTime, classroomRule);
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classroom);
        if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

        const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const headerMap = createHeaderMap(header);
        
        const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
        if (reservationIdColIdx === undefined) throw new Error("ヘッダー「予約ID」が見つかりません。");

        // 【NF-12】Get studentId from the sheet
        const studentIdColIdx = headerMap.get(HEADER_STUDENT_ID);
        if (studentIdColIdx === undefined) throw new Error("ヘッダー「生徒ID」が見つかりません。");

        const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
        if (targetRowIndex === -1) throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

        const colMap = {
            earlyArrival: HEADER_EARLY_ARRIVAL,
            chiselRental: HEADER_CHISEL_RENTAL,
            startTime: HEADER_START_TIME,
            endTime: HEADER_END_TIME,
            workInProgress: HEADER_WORK_IN_PROGRESS,
            order: HEADER_ORDER
        };

        for (const key in colMap) {
            if (headerMap.has(colMap[key])) {
                const colIdx = headerMap.get(colMap[key]) + 1;
                const targetCell = sheet.getRange(targetRowIndex, colIdx);
                let value = details[key];
                if (key === 'startTime' || key === 'endTime') {
                    value = value ? new Date(`1970-01-01T${value}:00`) : '';
                    targetCell.setValue(value).setNumberFormat("HH:mm");
                } else if (typeof details[key] === 'boolean') {
                    targetCell.setValue(details[key]);
                } else {
                    targetCell.setValue(details[key] || '');
                }
            }
        }
        
        updateBillableTime(sheet, targetRowIndex);
        updateGanttChart(sheet, targetRowIndex);
        SpreadsheetApp.flush();

        // 【NF-12】Update cache incrementally
        const studentId = sheet.getRange(targetRowIndex, studentIdColIdx + 1).getValue();
        const updatedBookingObject = {
            reservationId: reservationId,
            startTime: details.startTime || null,
            endTime: details.endTime || null,
            earlyArrival: details.earlyArrival || false,
            chiselRental: details.chiselRental || false,
            workInProgress: details.workInProgress || '',
            order: details.order || ''
        };
        const newBookingsCache = _updateFutureBookingsCacheIncrementally(studentId, 'update', updatedBookingObject);
        return { success: true, newBookingsCache: newBookingsCache };

    } catch (err) {
        Logger.log(`updateReservationDetails Error: ${err.message}\n${err.stack}`);
        return { success: false, message: `詳細情報の更新中にエラーが発生しました。\n${err.message}` };
    } finally {
        lock.releaseLock();
    }
}

/**
 * 会計情報をJSON形式で保存し、同時に予約シートの関連情報を更新します。
 * @param {string} reservationId - 予約ID
 * @param {string} classroom - 教室名
 * @param {object} accountingDetails - 保存する会計情報のJSONオブジェクト
 * @param {object} options - シート更新用のオプション値 {startTime, endTime, firstLecture, ...}
 * @returns {object} - 処理結果。
 */
function saveAccountingDetails(reservationId, classroom, accountingDetails, options) {
    const lock = LockService.getScriptLock();
    lock.waitLock(LOCK_WAIT_TIME_MS);
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(classroom);
        if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

        const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const headerMap = createHeaderMap(header);
        const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
        const studentIdColIdx = headerMap.get(HEADER_STUDENT_ID);

        const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
        if (targetRowIndex === -1) throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

        const actualStudentId = sheet.getRange(targetRowIndex, studentIdColIdx + 1).getValue();
        if (actualStudentId !== studentId) {
          // 本来はエラーですが、ここではログに記録するに留めます
          Logger.log(`Warning: Mismatch user ID during accounting. Expected: ${studentId}, Actual: ${actualStudentId}`);
        }

        const options = {}; // optionsは現在フロントから渡されていないため空オブジェクトで初期化

        // 1. オプション値をシートに書き戻す
        const optionMap = {
            startTime: HEADER_START_TIME,
            endTime: HEADER_END_TIME,
            firstLecture: HEADER_FIRST_LECTURE,
            earlyArrival: HEADER_EARLY_ARRIVAL,
            chiselRental: HEADER_CHISEL_RENTAL
        };

        for (const key in optionMap) {
            if (options && options.hasOwnProperty(key) && headerMap.has(optionMap[key])) {
                const colIdx = headerMap.get(optionMap[key]) + 1;
                let value = options[key];
                if ((key === 'startTime' || key === 'endTime') && value) {
                    value = new Date(`1970-01-01T${value}`);
                }
                sheet.getRange(targetRowIndex, colIdx).setValue(value);
            }
        }

        // 2. 受講時間とガントチャートを再計算・再描画
        updateBillableTime(sheet, targetRowIndex);
        updateGanttChart(sheet, targetRowIndex);
        
        // 3. 最後に会計詳細JSONを保存
        const accountingDetailsColIdx = headerMap.get(HEADER_ACCOUNTING_DETAILS);
        if (accountingDetailsColIdx === undefined) throw new Error("ヘッダー「会計詳細」が見つかりません。");
        sheet.getRange(targetRowIndex, accountingDetailsColIdx + 1).setValue(JSON.stringify(accountingDetails));

    
        SpreadsheetApp.flush(); // 【追加】シートへの書き込みを確定

        // 4. 【追加】予約キャッシュを更新
        const updatedBookingCachePayload = {
            reservationId: reservationId,
            accountingDone: true,
            accountingDetails: jsonDetails
        };
        const newBookingsCache = _updateFutureBookingsCacheIncrementally(actualStudentId, 'update', updatedBookingCachePayload);

        return { success: true, newBookingsCache: newBookingsCache };

    } catch (err) {
        Logger.log(`saveAccountingDetails Error: ${err.message}\n${err.stack}`);
        return { success: false, message: `会計情報の保存中にエラーが発生しました。` };
    } finally {
        lock.releaseLock();
    }
}

/**
 * 【改修】指定された予約の制作メモを更新し、最新の参加履歴を返す。
 * @param {string} reservationId - 予約ID
 * @param {string} sheetName - 予約が記録されているシート名
 * @param {string} newMemo - 新しい制作メモの内容
 * @param {string} studentId - メモを更新する対象の生徒ID
 * @returns {object} - { success: boolean, history?: object[], total?: number, message?: string }
 */
function updateMemoAndGetLatestHistory(reservationId, sheetName, newMemo, studentId) {
    const lock = LockService.getScriptLock();
    lock.waitLock(LOCK_WAIT_TIME_MS);
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません。`);

        const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const headerMap = createHeaderMap(header);
        const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
        const wipColIdx = headerMap.get(HEADER_WORK_IN_PROGRESS);

        if (reservationIdColIdx === undefined || wipColIdx === undefined) {
            throw new Error(`必要なヘッダー（予約ID, 制作メモ）が見つかりません。`);
        }

        const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
        if (targetRowIndex === -1) {
            throw new Error(`予約ID「${reservationId}」がシート「${sheetName}」で見つかりませんでした。`);
        }

        sheet.getRange(targetRowIndex, wipColIdx + 1).setValue(newMemo);
        SpreadsheetApp.flush();

        return getParticipationHistory(studentId, null, null);
    } catch (err) {
        Logger.log(`updateMemo Error: ${err.message}\n${err.stack}`);
        return { success: false, message: `制作メモの更新中にエラーが発生しました。\n${err.message}` };
    } finally {
        lock.releaseLock();
    }
}
