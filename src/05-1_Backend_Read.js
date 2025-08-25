/**
 * =================================================================
 * 【ファイル名】: 05-1_Backend_Read.gs
 * 【バージョン】: 3.0
 * 【役割】: WebAppからのデータ取得要求（Read）に特化したバックエンド機能。
 * - 予約枠、ユーザー自身の予約、会計マスタ、参加履歴などの読み取り処理を担当します。
 * 【v3.0での変更点】:
 * - フェーズ1リファクタリング: 統一APIレスポンス形式への移行
 * - 旧形式 { success: true, details: {...} } を統一形式 { success: true, data: {...}, meta: {...} } に変更
 * - 統一エラーハンドリングシステム（08_ErrorHandler.js）を使用
 * 【v2.0での変更点】:
 * - 設計変更の過程で残された、未使用の最適化関数群を削除。
 * =================================================================
 */

// =================================================================
// 統一定数ファイル（00_Constants.js）から定数を継承
// 統一エラーハンドラー（08_ErrorHandler.js）を使用
// 基本的な定数は00_Constants.jsで統一管理されています
// =================================================================

/**
 * 【旧・詳細取得】会計画面に表示する詳細情報を取得します。
 * @param {object} params - { reservationId: string, classroom: string }
 * @returns {object} - { success: boolean, details: object }
 */
function getReservationDetails(params) {
  try {
    const { reservationId, classroom } = params;
    const sheet = getSheetByName(classroom);
    if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);

    const targetRowIndex = findRowIndexByValue(
      sheet,
      headerMap.get(HEADER_RESERVATION_ID) + 1,
      reservationId,
    );
    if (targetRowIndex === -1)
      throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

    const rowData = sheet.getRange(targetRowIndex, 1, 1, header.length).getValues()[0];
    const timezone = getSpreadsheetTimezone();

    const details = {
      firstLecture: headerMap.has(HEADER_FIRST_LECTURE)
        ? rowData[headerMap.get(HEADER_FIRST_LECTURE)] === true
        : false,
      chiselRental: headerMap.has(HEADER_CHISEL_RENTAL)
        ? rowData[headerMap.get(HEADER_CHISEL_RENTAL)] === true
        : false,
      startTime:
        headerMap.has(HEADER_START_TIME) &&
        rowData[headerMap.get(HEADER_START_TIME)] instanceof Date
          ? Utilities.formatDate(rowData[headerMap.get(HEADER_START_TIME)], timezone, 'HH:mm')
          : null,
      endTime:
        headerMap.has(HEADER_END_TIME) && rowData[headerMap.get(HEADER_END_TIME)] instanceof Date
          ? Utilities.formatDate(rowData[headerMap.get(HEADER_END_TIME)], timezone, 'HH:mm')
          : null,
    };

    return createApiResponse(true, details);
  } catch (err) {
    return BackendErrorHandler.handle(err, 'getReservationDetails');
  }
}

/**
 * 【新・詳細取得】予約編集画面に必要な、予約の全詳細情報を取得します。
 * @param {string} reservationId - 予約ID。
 * @param {string} classroom - 教室名。
 * @returns {object} - { success: boolean, details: object }
 */
function getReservationDetailsForEdit(reservationId, classroom) {
  try {
    const sheet = getSheetByName(classroom);
    if (!sheet) throw new Error(`予約シート「${classroom}」が見つかりません。`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = createHeaderMap(header);
    const timezone = getSpreadsheetTimezone();

    const reservationIdColIdx = headerMap.get(HEADER_RESERVATION_ID);
    if (reservationIdColIdx === undefined) throw new Error('ヘッダー「予約ID」が見つかりません。');

    const targetRowIndex = findRowIndexByValue(sheet, reservationIdColIdx + 1, reservationId);
    if (targetRowIndex === -1)
      throw new Error(`予約ID「${reservationId}」が見つかりませんでした。`);

    const row = sheet.getRange(targetRowIndex, 1, 1, header.length).getValues()[0];

    const timeToString = date =>
      date instanceof Date ? Utilities.formatDate(date, timezone, 'HH:mm') : '';

    const details = {
      reservationId: reservationId,
      classroom: classroom,
      date:
        headerMap.has(HEADER_DATE) && row[headerMap.get(HEADER_DATE)] instanceof Date
          ? Utilities.formatDate(row[headerMap.get(HEADER_DATE)], timezone, 'yyyy-MM-dd')
          : '',
      venue: headerMap.has(HEADER_VENUE) ? row[headerMap.get(HEADER_VENUE)] : '',
      chiselRental: headerMap.has(HEADER_CHISEL_RENTAL)
        ? row[headerMap.get(HEADER_CHISEL_RENTAL)] === true
        : false,
      firstLecture: headerMap.has(HEADER_FIRST_LECTURE)
        ? row[headerMap.get(HEADER_FIRST_LECTURE)] === true
        : false,
      startTime: headerMap.has(HEADER_START_TIME)
        ? timeToString(row[headerMap.get(HEADER_START_TIME)])
        : '',
      endTime: headerMap.has(HEADER_END_TIME)
        ? timeToString(row[headerMap.get(HEADER_END_TIME)])
        : '',
      workInProgress: headerMap.has(HEADER_WORK_IN_PROGRESS)
        ? row[headerMap.get(HEADER_WORK_IN_PROGRESS)]
        : '',
      order: headerMap.has(HEADER_ORDER) ? row[headerMap.get(HEADER_ORDER)] : '',
      messageToTeacher: headerMap.has(HEADER_MESSAGE_TO_TEACHER)
        ? row[headerMap.get(HEADER_MESSAGE_TO_TEACHER)]
        : '',
    };

    return createApiResponse(true, details);
  } catch (err) {
    return BackendErrorHandler.handle(err, 'getReservationDetailsForEdit');
  }
}

/**
 * 会計マスタのデータを取得します。
 * @returns {object} - 統一APIレスポンス形式
 */
function getAccountingMasterData() {
  try {
    // 1. キャッシュからデータを取得
    const accountingCache = getCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA);

    if (accountingCache) {
      return createApiResponse(true, accountingCache.items || []);
    }

    // 2. キャッシュ再構築も失敗した場合のフォールバック
    Logger.log('会計マスタキャッシュ再構築に失敗しました。スプレッドシートから直接取得します。');
    const sheet = getSheetByName(ACCOUNTING_MASTER_SHEET_NAME);
    if (!sheet) throw new Error('シート「会計マスタ」が見つかりません。');

    if (sheet.getLastRow() < 2) {
      return createApiResponse(true, []);
    }

    const data = sheet.getDataRange().getValues();
    const header = data.shift();
    const timezone = getSpreadsheetTimezone();

    const timeColumns = [
      HEADER_CLASS_START,
      HEADER_CLASS_END,
      HEADER_BREAK_START,
      HEADER_BREAK_END,
    ];
    const timeColumnIndices = timeColumns.map(h => header.indexOf(h));

    const processedData = data.map(row => {
      const item = {};
      header.forEach((key, index) => {
        if (timeColumnIndices.includes(index) && row[index] instanceof Date) {
          item[key] = Utilities.formatDate(row[index], timezone, 'HH:mm');
        } else {
          item[key] = row[index];
        }
      });
      return item;
    });

    // 3. データをキャッシュに保存
    try {
      const cacheData = {
        version: new Date().getTime(),
        data: processedData,
      };
      cache.put('accounting_master_data', JSON.stringify(cacheData), 21600); // 6時間
      Logger.log(`会計マスタデータをキャッシュに保存しました。件数: ${processedData.length}`);
    } catch (cacheError) {
      Logger.log(`会計マスタキャッシュ保存エラー: ${cacheError.message}`);
    }

    return createApiResponse(true, processedData);
  } catch (err) {
    return BackendErrorHandler.handle(err, 'getAccountingMasterData');
  }
}

/**
 * 【改修】指定された生徒の過去の参加履歴を、件数と開始位置を指定して取得します。
 * 全ての予約シートとアーカイブシートを横断的に検索します。
 * @param {string} studentId - 生徒ID。
 * @param {number | null} limit - 取得する件数。nullの場合は全件取得。
 * @param {number | null} offset - 取得を開始する位置。
 * @returns {object} - { success: boolean, history: object[], total: number }
 */
function getParticipationHistory(studentId, limit, offset) {
  try {
    const ss = getActiveSpreadsheet();
    const timezone = getSpreadsheetTimezone();
    const allSheetNames = [...CLASSROOM_SHEET_NAMES, ...ARCHIVE_SHEET_NAMES];
    const history = [];

    allSheetNames.forEach(sheetName => {
      const sheet = getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;

      const data = sheet.getDataRange().getValues();
      const header = data.shift();
      const headerMap = createHeaderMap(header);

      const idCol = headerMap.get(HEADER_STUDENT_ID);
      const dateCol = headerMap.get(HEADER_DATE);
      const statusCol = headerMap.get(HEADER_PARTICIPANT_COUNT);
      const wipCol = headerMap.get(HEADER_WORK_IN_PROGRESS);
      const accCol = headerMap.get(HEADER_ACCOUNTING_DETAILS);
      const resIdCol = headerMap.get(HEADER_RESERVATION_ID);
      const venueCol = headerMap.get(HEADER_VENUE);

      if (idCol === undefined || dateCol === undefined) return;

      data.forEach(row => {
        const status = String(row[statusCol]).toLowerCase();
        const isCancelled =
          status === STATUS_CANCEL || status === 'キャンセル' || status === 'キャンセル済み';
        if (row[idCol] === studentId && !isCancelled && status !== STATUS_WAITING) {
          history.push({
            reservationId: row[resIdCol] || '',
            sheetName: sheetName,
            date: Utilities.formatDate(row[dateCol], timezone, 'yyyy-MM-dd'),
            classroom: sheetName.startsWith('old') ? `${sheetName.slice(3)}教室` : sheetName,
            venue: row[venueCol] || '',
            workInProgress: row[wipCol] || '',
            accountingDetails: row[accCol] || null,
          });
        }
      });
    });

    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = history.length;
    const limitedHistory =
      limit && offset !== null ? history.slice(offset, offset + limit) : history;

    return createApiResponse(true, { history: limitedHistory, total: total });
  } catch (err) {
    return BackendErrorHandler.handle(err, 'getParticipationHistory');
  }
}
