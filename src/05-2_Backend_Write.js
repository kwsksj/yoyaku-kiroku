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

        // ログと通知
        const message = !isFull ? '予約が完了しました。' : '満席のため、キャンセル待ちで登録しました。';
        const logDetails = `Classroom: ${classroom}, Date: ${date}, Status: ${isFull ? 'Waiting' : 'Confirmed'}, ReservationID: ${newReservationId}`;
        logActivity(user.studentId, user.displayName, 'RESERVATION_CREATE', 'SUCCESS', logDetails);

        const subject = `新規予約 (${classroom}) - ${user.displayName}様`;
        const body = `新しい予約が入りました。\n\n` +
                     `本名: ${user.realName}\n` +
                     `ニックネーム: ${user.displayName}\n\n` +
                     `教室: ${classroom}\n` +
                     `日付: ${date}\n` +
                     `状態: ${isFull ? 'キャンセル待ち' : '確定'}\n\n` +
                     `詳細はスプレッドシートを確認してください。`;
        sendAdminNotification(subject, body);

        return { success: true, message: message, newBookingsCache: newBookingsCache };
    } catch (err) {
        logActivity(reservationInfo.user.studentId, reservationInfo.user.displayName, 'RESERVATION_CREATE_ERROR', 'FAILURE', `Error: ${err.message}`);
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
        const { reservationId, classroom, studentId } = cancelInfo; // フロントエンドから渡される情報
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(classroom);
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
        const targetDate = originalValues[dateColIdx]; // キャンセルされた予約の日付を取得

        // ユーザー情報を取得して、ログと通知をより具体的にする
        const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
        let userInfo = { realName: '(不明)', displayName: '(不明)' };
        if (rosterSheet) {
            // 02-3_BusinessLogic_SheetUtils.js の関数を呼び出し
            const rosterData = getRosterData(rosterSheet);
            const userRow = rosterData.data.find(row => row[rosterData.idColIdx] === studentId);
            if (userRow) {
                userInfo.realName = userRow[rosterData.headerMap.get(HEADER_REAL_NAME)];
                // ニックネームがなければ本名を使用
                userInfo.displayName = userRow[rosterData.headerMap.get(HEADER_NICKNAME)] || userInfo.realName;
            }
        }

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

        // ログと通知
        const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}`;
        logActivity(studentId, userInfo.displayName, 'RESERVATION_CANCEL', 'SUCCESS', logDetails);

        const subject = `予約キャンセル (${classroom}) - ${userInfo.displayName}様`;
        const body = `予約がキャンセルされました。\n\n` +
                     `本名: ${userInfo.realName}\n` +
                     `ニックネーム: ${userInfo.displayName}\n\n` +
                     `教室: ${classroom}\n` +
                     `日付: ${Utilities.formatDate(targetDate, ss.getSpreadsheetTimeZone(), 'yyyy/MM/dd')}\n` +
                     `予約ID: ${reservationId}\n\n` +
                     `詳細はスプレッドシートを確認してください。`;
        sendAdminNotification(subject, body);

        return { success: true, message: "予約をキャンセルしました。", newBookingsCache: newBookingsCache };

    } catch (err) {
        logActivity(cancelInfo.studentId, '(N/A)', 'RESERVATION_CANCEL_ERROR', 'FAILURE', `Error: ${err.message}`);
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
        logActivity(details.studentId, '(N/A)', 'RESERVATION_UPDATE_ERROR', 'FAILURE', `Error: ${err.message}`);
        Logger.log(`updateReservationDetails Error: ${err.message}\n${err.stack}`);
        return { success: false, message: `詳細情報の更新中にエラーが発生しました。\n${err.message}` };
    } finally {
        lock.releaseLock();
    }
}

/**
 * [設計思想] フロントエンドは「ユーザーが何を選択したか」という入力情報のみを渡し、
 * バックエンドが料金マスタと照合して金額を再計算・検証する責務を持つ。
 * これにより、フロントエンドのバグが誤った会計データを生成することを防ぎ、システムの堅牢性を高める。
 * @param {object} payload - フロントエンドから渡される会計情報ペイロード。
 * @param {string} payload.reservationId - 予約ID。
 * @param {string} payload.classroom - 教室名。
 * @param {string} payload.studentId - 生徒ID。
 * @param {object} payload.userInput - ユーザーの入力内容。
 * @returns {object} - 処理結果。
 */
function saveAccountingDetails(payload) {
    const lock = LockService.getScriptLock();
    lock.waitLock(LOCK_WAIT_TIME_MS);
    try {
        const { reservationId, classroom, studentId, userInput } = payload;
        if (!reservationId || !classroom || !studentId || !userInput) {
            throw new Error("会計情報が不足しています。");
        }

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
            throw new Error("この予約の会計処理を行う権限がありません。");
        }

        // --- バックエンドでの再計算・検証ロジック ---
        const masterData = getAccountingMasterData().data;
        const finalAccountingDetails = {
            tuition: { items: [], subtotal: 0 },
            sales: { items: [], subtotal: 0 },
            grandTotal: 0,
            paymentMethod: userInput.paymentMethod || '現金'
        };

        // 授業料の計算
        (userInput.tuitionItems || []).forEach(itemName => {
            const masterItem = masterData.find(m => m['項目名'] === itemName && m['種別'] === ITEM_TYPE_TUITION);
            if (masterItem) {
                const price = Number(masterItem['単価']);
                finalAccountingDetails.tuition.items.push({ name: itemName, price: price });
                finalAccountingDetails.tuition.subtotal += price;
            }
        });

        // 時間制授業料の計算
        if (userInput.timeBased) {
            const { startTime, endTime, breakMinutes, discountMinutes } = userInput.timeBased;
            const classroomRule = masterData.find(item => item['対象教室'] && item['対象教室'].includes(classroom) && item['種別'] === ITEM_TYPE_TUITION && item['単位'] === UNIT_30_MIN);
            if (classroomRule && startTime && endTime && startTime < endTime) {
                const start = new Date(`1970-01-01T${startTime}:00`);
                const end = new Date(`1970-01-01T${endTime}:00`);
                let diffMinutes = (end - start) / 60000 - (breakMinutes || 0);
                if (diffMinutes > 0) {
                    const billableUnits = Math.ceil(diffMinutes / 30);
                    const price = billableUnits * Number(classroomRule['単価']);
                    finalAccountingDetails.tuition.items.push({ name: `授業料 (${startTime} - ${endTime})`, price: price });
                    finalAccountingDetails.tuition.subtotal += price;
                }
            }
            // 割引の計算
            if (discountMinutes > 0) {
                const discountRule = masterData.find(item => item['項目名'] === ITEM_NAME_DISCOUNT);
                if (discountRule) {
                    const discountAmount = (discountMinutes / 30) * Math.abs(Number(discountRule['単価']));
                    finalAccountingDetails.tuition.items.push({ name: `${ITEM_NAME_DISCOUNT} (${discountMinutes}分)`, price: -discountAmount });
                    finalAccountingDetails.tuition.subtotal -= discountAmount;
                }
            }
        }

        // 物販・材料費の計算
        (userInput.salesItems || []).forEach(item => {
            const masterItem = masterData.find(m => m['項目名'] === item.name && (m['種別'] === ITEM_TYPE_SALES || m['種別'] === ITEM_TYPE_MATERIAL));
            if (masterItem) { // マスタに存在する商品
                const price = item.price || Number(masterItem['単価']); // 材料費のように価格が計算される場合を考慮
                finalAccountingDetails.sales.items.push({ name: item.name, price: price });
                finalAccountingDetails.sales.subtotal += price;
            } else if (item.price) { // 自由入力項目
                const price = Number(item.price);
                finalAccountingDetails.sales.items.push({ name: item.name, price: price });
                finalAccountingDetails.sales.subtotal += price;
            }
        });

        finalAccountingDetails.grandTotal = finalAccountingDetails.tuition.subtotal + finalAccountingDetails.sales.subtotal;
        // --- ここまで ---

        // 1. 時刻などをシートに書き戻す
        if (userInput.timeBased) {
            const { startTime, endTime } = userInput.timeBased;
            if (headerMap.has(HEADER_START_TIME)) sheet.getRange(targetRowIndex, headerMap.get(HEADER_START_TIME) + 1).setValue(startTime ? new Date(`1970-01-01T${startTime}`) : null).setNumberFormat("HH:mm");
            if (headerMap.has(HEADER_END_TIME)) sheet.getRange(targetRowIndex, headerMap.get(HEADER_END_TIME) + 1).setValue(endTime ? new Date(`1970-01-01T${endTime}`) : null).setNumberFormat("HH:mm");
        }

        // 2. 受講時間とガントチャートを再計算
        updateBillableTime(sheet, targetRowIndex);
        updateGanttChart(sheet, targetRowIndex);

        // 3. 検証済みの会計詳細JSONを保存
        const accountingDetailsColIdx = headerMap.get(HEADER_ACCOUNTING_DETAILS);
        if (accountingDetailsColIdx === undefined) throw new Error("ヘッダー「会計詳細」が見つかりません。");
        sheet.getRange(targetRowIndex, accountingDetailsColIdx + 1).setValue(JSON.stringify(finalAccountingDetails));

        SpreadsheetApp.flush();

        // 4. 「よやくキャッシュ」から会計済みの予約を削除
        //    会計が完了した予約は「未来の予約」ではなく「過去の記録」となるため、
        //    よやくキャッシュからは削除し、きろくキャッシュに責務を移管する。
        const newBookingsCache = _updateFutureBookingsCacheIncrementally(actualStudentId, 'remove', { reservationId });

        // --- ここからが追加の後続処理 ---
        const reservationDataRow = sheet.getRange(targetRowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

        // 5. 売上ログへの転記
        _logSalesForSingleReservation(reservationDataRow, headerMap, classroom, finalAccountingDetails);

        // 6. 「きろくキャッシュ」に会計情報を含めて追加
        _updateRecordCacheForSingleReservation(reservationDataRow, headerMap, classroom, finalAccountingDetails);

        // 7. サマリーの更新
        const targetDate = reservationDataRow[headerMap.get(HEADER_DATE)];
        if (targetDate instanceof Date) {
            updateSummaryAndForm(classroom, targetDate);
        }

        // 8. 最新の参加履歴を取得して返す
        const historyResult = getParticipationHistory(actualStudentId, null, null);
        if (!historyResult.success) {
            // 履歴取得に失敗しても、メインの会計処理は成功として扱う
            Logger.log(`会計処理後の履歴取得に失敗: ${historyResult.message}`);
        }

        // 9. 【NEW】会計済みの予約をアーカイブし、元の行を削除する
        _archiveSingleReservation(sheet, targetRowIndex, reservationDataRow);

        // ログと通知
        const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}, Total: ${finalAccountingDetails.grandTotal}`;
        logActivity(studentId, '(N/A)', 'ACCOUNTING_SAVE', 'SUCCESS', logDetails);

        const subject = `会計記録 (${classroom})`;
        const body = `会計が記録されました。\n\n` +
                     `教室: ${classroom}\n` +
                     `予約ID: ${reservationId}\n` +
                     `生徒ID: ${studentId}\n` +
                     `合計金額: ${finalAccountingDetails.grandTotal.toLocaleString()} 円\n\n` +
                     `詳細はスプレッドシートを確認してください。`;
        sendAdminNotification(subject, body);

        // --- 追加処理ここまで ---

        return { success: true, newBookingsCache: newBookingsCache, newHistory: historyResult.history, newHistoryTotal: historyResult.total, message: "会計処理と関連データの更新がすべて完了しました。" };

    } catch (err) {
        logActivity(payload.studentId, '(N/A)', 'ACCOUNTING_SAVE_ERROR', 'FAILURE', `Error: ${err.message}`);
        Logger.log(`saveAccountingDetails Error: ${err.message}\n${err.stack}`);
        return { success: false, message: `会計情報の保存中にエラーが発生しました。\n${err.message}` };
    } finally {
        lock.releaseLock();
    }
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {Array} reservationDataRow - 売上ログを生成する対象の予約データ行。
 * @param {Map<string, number>} headerMap - 予約シートのヘッダーマップ。
 * @param {string} classroomName - 教室名。
 * @param {object} accountingDetails - 計算済みの会計詳細オブジェクト。
 */
function _logSalesForSingleReservation(reservationDataRow, headerMap, classroomName, accountingDetails) {
    try {
        const baseInfo = {
            date: reservationDataRow[headerMap.get(HEADER_DATE)],
            studentId: reservationDataRow[headerMap.get(HEADER_STUDENT_ID)],
            name: reservationDataRow[headerMap.get(HEADER_NAME)],
            classroom: classroomName,
            venue: reservationDataRow[headerMap.get(HEADER_VENUE)] || '',
            paymentMethod: accountingDetails.paymentMethod || '不明'
        };

        const rowsToTransfer = [];
        (accountingDetails.tuition?.items || []).forEach(item => {
            rowsToTransfer.push(createSalesRow(baseInfo, ITEM_TYPE_TUITION, item.name, item.price));
        });
        (accountingDetails.sales?.items || []).forEach(item => {
            rowsToTransfer.push(createSalesRow(baseInfo, ITEM_TYPE_SALES, item.name, item.price));
        });

        if (rowsToTransfer.length > 0) {
            const salesSpreadsheet = SpreadsheetApp.openById(SALES_SPREADSHEET_ID);
            const salesSheet = salesSpreadsheet.getSheetByName('売上ログ');
            if (!salesSheet) throw new Error('売上スプレッドシートに「売上ログ」シートが見つかりません。');
            salesSheet.getRange(salesSheet.getLastRow() + 1, 1, rowsToTransfer.length, rowsToTransfer[0].length).setValues(rowsToTransfer);
        }
    } catch (err) {
        Logger.log(`_logSalesForSingleReservation Error: ${err.message}\n${err.stack}`);
    }
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {Array} reservationDataRow - きろくキャッシュを更新する対象の予約データ行。
 * @param {Map<string, number>} headerMap - 予約シートのヘッダーマップ。
 * @param {string} classroomName - 教室名。
 * @param {object} accountingDetails - 追加する会計詳細オブジェクト。
 */
function _updateRecordCacheForSingleReservation(reservationDataRow, headerMap, classroomName, accountingDetails) {
    try {
        const rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
        if (!rosterSheet) return;

        const studentId = reservationDataRow[headerMap.get(HEADER_STUDENT_ID)];
        const date = reservationDataRow[headerMap.get(HEADER_DATE)];
        if (!studentId || !(date instanceof Date)) return;

        const rosterHeader = rosterSheet.getRange(1, 1, 1, rosterSheet.getLastColumn()).getValues()[0];
        const rosterHeaderMap = createHeaderMap(rosterHeader);
        const studentIdColRoster = rosterHeaderMap.get(HEADER_STUDENT_ID);
        if (studentIdColRoster === undefined) return;

        const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 1).getValues();
        const targetRosterRow_0based = rosterData.findIndex(row => row[0] === studentId);
        if (targetRosterRow_0based === -1) return;
        const targetRosterRow_1based = targetRosterRow_0based + 2;

        const year = date.getFullYear();
        const colName = `きろく_${year}`;
        let recordColIdx = rosterHeaderMap.get(colName);

        if (recordColIdx === undefined) {
            const lastCol = rosterSheet.getLastColumn();
            rosterSheet.insertColumnAfter(lastCol);
            recordColIdx = lastCol;
            rosterSheet.getRange(1, recordColIdx + 1).setValue(colName);
        }

        const archiveSheetName = HEADER_ARCHIVE_PREFIX + classroomName.slice(0, -2);
        const newRecord = {
            reservationId: reservationDataRow[headerMap.get(HEADER_RESERVATION_ID)] || '',
            sheetName: archiveSheetName,
            date: Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
            classroom: classroomName,
            venue: reservationDataRow[headerMap.get(HEADER_VENUE)] || '',
            workInProgress: reservationDataRow[headerMap.get(HEADER_WORK_IN_PROGRESS)] || '',
            accountingDetails: JSON.stringify(accountingDetails)
        };

        const cell = rosterSheet.getRange(targetRosterRow_1based, recordColIdx + 1);
        const existingJson = cell.getValue();
        let records = [];
        if (existingJson) {
            try { records = JSON.parse(existingJson); } catch (e) { /* 不正なJSONは上書き */ }
        }

        const recordExists = records.some(r => r.reservationId === newRecord.reservationId);
        if (!recordExists) {
            records.push(newRecord);
            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            cell.setValue(JSON.stringify(records));
        }
    } catch (err) {
        Logger.log(`_updateRecordCacheForSingleReservation Error: ${err.message}\n${err.stack}`);
    }
}

/**
 * [設計思想] 後続処理でエラーが発生してもメインの会計処理は成功と見なすため、
 * この関数内でのエラーはログに記録するに留め、上位にはスローしない。
 * @private
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sourceSheet - 予約シート
 * @param {number} rowIndex - アーカイブ対象の行番号
 * @param {Array} reservationDataRow - アーカイブ対象の行データ
 */
function _archiveSingleReservation(sourceSheet, rowIndex, reservationDataRow) {
    try {
        const classroomName = sourceSheet.getName();
        const archiveSheetName = HEADER_ARCHIVE_PREFIX + classroomName.slice(0, -2);
        const archiveSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(archiveSheetName);

        if (!archiveSheet) {
            Logger.log(`アーカイブシート「${archiveSheetName}」が見つかりません。アーカイブ処理をスキップします。`);
            return;
        }

        // 1. アーカイブシートに転記
        archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, 1, reservationDataRow.length).setValues([reservationDataRow]);
        formatSheetWithBordersSafely(archiveSheet);

        // 2. 元の予約シートから行を削除
        sourceSheet.deleteRow(rowIndex);
    } catch (err) {
        Logger.log(`_archiveSingleReservation Error: ${err.message}\n${err.stack}`);
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

        logActivity(studentId, '(N/A)', 'MEMO_UPDATE_SUCCESS', 'SUCCESS', `ResID: ${reservationId}, Sheet: ${sheetName}`);
        return getParticipationHistory(studentId, null, null);
    } catch (err) {
        const details = `ResID: ${reservationId}, Sheet: ${sheetName}, Error: ${err.message}`;
        logActivity(studentId, '(N/A)', 'MEMO_UPDATE_ERROR', 'FAILURE', details);
        Logger.log(`updateMemo Error: ${err.message}\n${err.stack}`);
        return { success: false, message: `制作メモの更新中にエラーが発生しました。\n${err.message}` };
    } finally {
        lock.releaseLock();
    }
}
