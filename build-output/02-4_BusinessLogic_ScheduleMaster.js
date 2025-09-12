/**
 * =================================================================
 * 【ファイル名】: 02-4_BusinessLogic_ScheduleMaster.js
 * 【バージョン】: 2.2
 * 【役割】: 日程マスタシートの管理機能
 * =================================================================
 */

/**
 * 統合予約シートから日程マスタシートを作成または再構築する
 * 旧来のシステムから移行時に既存の予約データから日程マスタを自動生成するための関数
 * スプレッドシートのメニューから手動実行される管理者用関数
 */
function createScheduleMasterSheet() {
  try {
    Logger.log('統合予約シートから日程マスタ生成を開始します');

    const ui = SpreadsheetApp.getUi();

    // 確認ダイアログ
    const response = ui.alert(
      '日程マスタ生成',
      '統合予約シートから日程マスタを自動生成します。既存の日程マスタは上書きされます。実行しますか？',
      ui.ButtonSet.YES_NO,
    );

    if (response !== ui.Button.YES) {
      ui.alert('処理を中断しました。');
      return;
    }

    // 1. 全ての予約データから日付・教室の組み合わせを抽出
    const uniqueDateClassrooms = extractUniqueDateClassroomCombinations();
    Logger.log(
      `ユニークな日付・教室の組み合わせ: ${uniqueDateClassrooms.size} 件`,
    );

    if (uniqueDateClassrooms.size === 0) {
      Logger.log('生成エラー: 予約データから有効な日程が見つかりませんでした');
      ui.alert(
        '生成エラー',
        '予約データから有効な日程が見つかりませんでした',
        ui.ButtonSet.OK,
      );
      return;
    }

    // 2. 日程マスタシートの準備
    prepareScheduleMasterSheet();

    // 3. デフォルト設定を適用して日程マスタデータを生成
    const scheduleData = generateScheduleDataWithDefaults(uniqueDateClassrooms);
    Logger.log(`生成される日程データ: ${scheduleData.length} 件`);

    // 4. 日程マスタシートにデータを書き込み
    writeScheduleDataToSheet(scheduleData);

    // キャッシュをクリア
    SS_MANAGER.clearSheetCache(CONSTANTS.SHEET_NAMES.SCHEDULE);

    // 成功メッセージ
    ui.alert(
      '日程マスタ生成完了',
      `統合予約シートから日程マスタを生成しました。\n生成件数: ${scheduleData.length} 件`,
      ui.ButtonSet.OK,
    );

    // アクティビティログに記録
    logActivity(
      Session.getActiveUser().getEmail(),
      '統合予約データからの日程マスタ生成',
      '成功',
      `生成件数: ${scheduleData.length} 件`,
    );

    Logger.log(
      `統合予約シートから日程マスタ生成が完了しました。生成件数: ${scheduleData.length} 件`,
    );
  } catch (error) {
    Logger.log(`日程マスタシート生成エラー: ${error.message}`);
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '生成エラー',
      `処理中にエラーが発生しました: ${error.message}`,
      ui.ButtonSet.OK,
    );
    handleError(
      `日程マスタシートの生成中にエラーが発生しました: ${error.message}`,
      true,
    );
  }
}

/**
 * 全ての開催予定日程を取得する（キャッシュのみ利用）
 * フロントエンドから呼び出されるAPI関数
 * @param {string} fromDate - 取得開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 取得終了日（YYYY-MM-DD形式、オプション）
 * @returns {Array<Object>} 開催日程データの配列
 */
function getAllScheduledDates(fromDate, toDate) {
  try {
    const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);
    Logger.log(
      `scheduleCache: ${JSON.stringify(scheduleCache ? { version: scheduleCache.version, hasSchedule: !!scheduleCache.schedule, scheduleLength: scheduleCache.schedule?.length } : null)}`,
    );

    const cachedSchedules = scheduleCache?.schedule || [];
    Logger.log(
      `キャッシュから日程マスタデータを取得: ${cachedSchedules.length} 件`,
    );
    Logger.log(
      `=== 日付フィルタリング: fromDate=${fromDate}, toDate=${toDate} ===`,
    );
    const filtered = filterSchedulesByDateRange(
      cachedSchedules,
      fromDate,
      toDate,
    );
    Logger.log(`=== フィルタリング結果: ${filtered.length} 件 ===`);
    return filtered;
  } catch (error) {
    Logger.log(`getAllScheduledDates エラー: ${error.message}`);
    // エラーが発生した場合は、フロントエンドに空の配列を返す
    return [];
  }
}

/**
 * キャッシュデータから日付範囲でフィルタリングする
 * @param {Array<Object>} schedules - 日程データ配列
 * @param {string} fromDate - 開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 終了日（YYYY-MM-DD形式、オプション）
 * @returns {Array<Object>} フィルタリングされた日程データ配列
 */
function filterSchedulesByDateRange(schedules, fromDate, toDate) {
  if (!schedules || schedules.length === 0) {
    return [];
  }

  const fromDateTime = fromDate ? new Date(fromDate).getTime() : 0;
  const toDateTime = toDate
    ? new Date(toDate).getTime()
    : Number.MAX_SAFE_INTEGER;

  const results = [];
  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];
    const scheduleDate =
      schedule.date instanceof Date ? schedule.date : new Date(schedule.date);
    const dateTime = scheduleDate.getTime();
    const isInRange = dateTime >= fromDateTime && dateTime <= toDateTime;

    if (i < 3) {
      // 最初の3件のデバッグ情報
      Logger.log(
        `=== schedule[${i}]: date=${schedule.date}, scheduleDate=${scheduleDate}, dateTime=${dateTime}, fromDateTime=${fromDateTime}, toDateTime=${toDateTime}, inRange=${isInRange} ===`,
      );
    }

    if (isInRange) {
      results.push(schedule);
    }
  }

  return results;
}

/**
 * 現在の予約データから日程マスタを生成する
 * システム移行時に既存の予約データから日程マスタを自動生成するための関数
 */
function generateScheduleMasterFromExistingReservations() {
  try {
    Logger.log('予約データから日程マスタ生成を開始します');

    // 1. 全ての予約データから日付・教室の組み合わせを抽出
    const uniqueDateClassrooms = extractUniqueDateClassroomCombinations();
    Logger.log(
      `ユニークな日付・教室の組み合わせ: ${uniqueDateClassrooms.size} 件`,
    );

    if (uniqueDateClassrooms.size === 0) {
      Logger.log('生成エラー: 予約データから有効な日程が見つかりませんでした');
      return {
        success: false,
        message: '予約データから有効な日程が見つかりませんでした',
      };
    }

    // 2. 日程マスタシートの準備
    prepareScheduleMasterSheet();

    // 3. デフォルト設定を適用して日程マスタデータを生成
    const scheduleData = generateScheduleDataWithDefaults(uniqueDateClassrooms);
    Logger.log(`生成される日程データ: ${scheduleData.length} 件`);

    // 4. 日程マスタシートにデータを書き込み
    writeScheduleDataToSheet(scheduleData);

    // キャッシュをクリア
    SS_MANAGER.clearSheetCache(CONSTANTS.SHEET_NAMES.SCHEDULE);

    // アクティビティログに記録
    logActivity(
      Session.getActiveUser().getEmail(),
      '予約データからの日程マスタ生成',
      '成功',
      `生成件数: ${scheduleData.length} 件`,
    );

    Logger.log(
      `予約データから日程マスタ生成が完了しました。生成件数: ${scheduleData.length} 件`,
    );
    return {
      success: true,
      count: scheduleData.length,
      message: `日程マスタを生成しました（${scheduleData.length} 件）`,
    };
  } catch (error) {
    Logger.log(`日程マスタ生成エラー: ${error.message}`);
    handleError(
      `日程マスタの生成中にエラーが発生しました: ${error.message}`,
      true,
    );
    return {
      success: false,
      message: `エラーが発生しました: ${error.message}`,
    };
  }
}

/**
 * UIダイアログ付きで日程マスタを生成する（スプレッドシートから手動実行用）
 */
function generateScheduleMasterFromExistingReservationsWithUI() {
  try {
    const ui = SpreadsheetApp.getUi();

    // 確認ダイアログ
    const response = ui.alert(
      '予約データから日程マスタ生成',
      '既存の予約データから日程マスタを自動生成します。既存の日程マスタは上書きされます。実行しますか？',
      ui.ButtonSet.YES_NO,
    );

    if (response !== ui.Button.YES) {
      ui.alert('処理を中断しました。');
      return;
    }

    // UI無しバージョンを実行
    const result = generateScheduleMasterFromExistingReservations();

    if (result.success) {
      ui.alert('日程マスタ生成完了', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('生成エラー', result.message, ui.ButtonSet.OK);
    }
  } catch (error) {
    Logger.log(`日程マスタ生成（UI付き）エラー: ${error.message}`);
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'エラー',
      `処理中にエラーが発生しました: ${error.message}`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * 全ての予約シートから日付・教室のユニークな組み合わせを抽出
 * @returns {Map} 日付・教室の組み合わせをキーとしたMapオブジェクト
 */
function extractUniqueDateClassroomCombinations() {
  const uniqueCombinations = new Map();
  const ss = getActiveSpreadsheet();
  const allSheets = ss.getSheets();

  // 各シートを確認
  allSheets.forEach(sheet => {
    const sheetName = sheet.getName();

    // 予約シート（教室名を含む）かどうかをチェック
    if (isReservationSheet(sheetName)) {
      Logger.log(`予約シート処理中: ${sheetName}`);

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        Logger.log(`シート ${sheetName} にはデータがありません`);
        return;
      }

      try {
        // ヘッダー行を取得してインデックスを確認
        const headers = sheet
          .getRange(HEADER_ROW, 1, 1, sheet.getLastColumn())
          .getValues()[0];
        const dateIndex = headers.findIndex(
          header =>
            header === CONSTANTS.HEADERS.SCHEDULE.DATE ||
            header === 'date' ||
            header === '開催日',
        );
        const classroomIndex = headers.findIndex(
          header =>
            header === CONSTANTS.HEADERS.SCHEDULE.CLASSROOM ||
            header === 'classroom',
        );
        const venueIndex = headers.findIndex(
          header =>
            header === CONSTANTS.HEADERS.SCHEDULE.VENUE || header === 'venue',
        );
        const statusIndex = headers.findIndex(
          header =>
            header === CONSTANTS.HEADERS.SCHEDULE.STATUS || header === 'status',
        );

        if (dateIndex === -1 || classroomIndex === -1) {
          Logger.log(
            `シート ${sheetName} で必要な列が見つかりません (日付: ${dateIndex}, 教室: ${classroomIndex})`,
          );
          return;
        }

        // データ範囲を取得
        const dataRange = sheet.getRange(
          DATA_START_ROW,
          1,
          lastRow - 1,
          sheet.getLastColumn(),
        );
        const data = dataRange.getValues();

        data.forEach((row, _index) => {
          const date = row[dateIndex];
          const classroom = row[classroomIndex];
          const venue = venueIndex !== -1 ? row[venueIndex] : '';
          const status = statusIndex !== -1 ? row[statusIndex] : '';

          // 有効な日付かチェック
          if (date instanceof Date && classroom) {
            // キャンセルや待機中の予約は除外
            if (
              status !== CONSTANTS.STATUS.CANCELED &&
              status !== CONSTANTS.STATUS.WAITLISTED
            ) {
              const dateString = Utilities.formatDate(
                date,
                CONSTANTS.TIMEZONE,
                'yyyy-MM-dd',
              );
              const key = `${dateString}|${classroom}`;

              if (!uniqueCombinations.has(key)) {
                uniqueCombinations.set(key, {
                  date: dateString,
                  classroom: classroom,
                  venue: venue || '',
                  originalSheet: sheetName,
                });
              } else {
                // 既存のエントリに会場情報を追加（${CONSTANTS.CLASSROOMS.TOKYO}の場合）
                const existingEntry = uniqueCombinations.get(key);
                if (venue && !existingEntry.venue) {
                  existingEntry.venue = venue;
                }
              }
            }
          }
        });
      } catch (error) {
        Logger.log(`シート ${sheetName} の処理中にエラー: ${error.message}`);
      }
    }
  });

  return uniqueCombinations;
}

/**
 * シート名が予約シートかどうかを判定
 * @param {string} sheetName - シート名
 * @returns {boolean} 予約シートの場合はtrue
 */
function isReservationSheet(sheetName) {
  // 除外するシート名のパターン
  const excludePatterns = [
    '生徒名簿',
    '会計マスタ',
    'アクティビティログ',
    '日程マスタ',
    'Activity',
    'Summary',
    'Master',
    'Roster',
    'Cache',
  ];

  return !excludePatterns.some(pattern => sheetName.includes(pattern));
}

/**
 * 日程マスタシートを準備する（既存データをクリア）
 */
function prepareScheduleMasterSheet() {
  let scheduleSheet = getSheetByName(CONSTANTS.SHEET_NAMES.SCHEDULE);

  if (!scheduleSheet) {
    // シートが存在しない場合は作成
    const ss = getActiveSpreadsheet();
    scheduleSheet = ss.insertSheet(CONSTANTS.SHEET_NAMES.SCHEDULE);

    // ヘッダーを設定
    scheduleSheet
      .getRange(
        HEADER_ROW,
        1,
        1,
        Object.keys(CONSTANTS.HEADERS.SCHEDULE).length,
      )
      .setValues([Object.values(CONSTANTS.HEADERS.SCHEDULE)]);

    // ヘッダー行の書式設定
    const headerRange = scheduleSheet.getRange(
      HEADER_ROW,
      1,
      1,
      Object.keys(CONSTANTS.HEADERS.SCHEDULE).length,
    );
    headerRange.setFontWeight('bold');
    headerRange.setBackground(COLOR_HEADER_BACKGROUND);
    headerRange.setHorizontalAlignment('center');
  } else {
    // 既存データをクリア（ヘッダーは保持）
    const lastRow = scheduleSheet.getLastRow();
    if (lastRow > HEADER_ROW) {
      scheduleSheet
        .getRange(
          DATA_START_ROW,
          1,
          lastRow - HEADER_ROW,
          Object.keys(CONSTANTS.HEADERS.SCHEDULE).length,
        )
        .clear();
    }
  }
}

/**
 * デフォルト設定を適用して日程マスタデータを生成
 * @param {Map} uniqueCombinations - ユニークな日付・教室の組み合わせ
 * @returns {Array<Array>} 日程マスタ用の2次元配列
 */
function generateScheduleDataWithDefaults(uniqueCombinations) {
  const scheduleData = [];

  uniqueCombinations.forEach((combo, _key) => {
    const { date, classroom, venue } = combo;

    // 教室に応じたデフォルト設定を適用
    const classroomDefaults = getClassroomDefaults(classroom);

    // 会場情報：予約データから取得した会場を優先、なければデフォルト
    const finalVenue = venue || classroomDefaults.venue;

    scheduleData.push([
      date, // 日付
      classroom, // 教室
      finalVenue, // 会場（予約データ優先）
      classroomDefaults.classroomType, // 教室形式
      classroomDefaults.firstStart, // 1部開始
      classroomDefaults.firstEnd, // 1部終了
      classroomDefaults.secondStart, // 2部開始
      classroomDefaults.secondEnd, // 2部終了
      classroomDefaults.beginnerStart, // 初回者開始
      classroomDefaults.totalCapacity, // 全体定員
      classroomDefaults.beginnerCapacity, // 初回者定員
      CONSTANTS.SCHEDULE_STATUS.SCHEDULED, // 状態
      '既存予約から自動生成', // 備考
    ]);
  });

  // 日付順にソート
  scheduleData.sort((a, b) => {
    const dateA = a[0] instanceof Date ? a[0] : new Date(a[0]);
    const dateB = b[0] instanceof Date ? b[0] : new Date(b[0]);
    return dateA.getTime() - dateB.getTime();
  });

  return scheduleData;
}

/**
 * 教室名に基づくデフォルト設定を取得
 * @param {string} classroom - 教室名
 * @returns {Object} 教室のデフォルト設定
 */
function getClassroomDefaults(classroom) {
  // 教室名に基づいて設定を決定
  if (classroom.includes('東京') || classroom === CONSTANTS.CLASSROOMS.TOKYO) {
    return {
      venue: '', // ${CONSTANTS.CLASSROOMS.TOKYO}は予約データから取得するため空欄
      classroomType: CLASSROOM_TYPE_SESSION_BASED,
      firstStart: '12:00',
      firstEnd: '16:00',
      secondStart: '',
      secondEnd: '',
      beginnerStart: '12:00',
      totalCapacity: 8,
      beginnerCapacity: 4,
    };
  } else if (
    classroom.includes('つくば') ||
    classroom === CONSTANTS.CLASSROOMS.TSUKUBA
  ) {
    return {
      venue: '', // ${CONSTANTS.CLASSROOMS.TSUKUBA}は空欄
      classroomType: CLASSROOM_TYPE_TIME_DUAL,
      firstStart: '09:00',
      firstEnd: '13:00',
      secondStart: '14:00',
      secondEnd: '17:00',
      beginnerStart: '14:00',
      totalCapacity: 8,
      beginnerCapacity: 4,
    };
  } else if (
    classroom.includes('沼津') ||
    classroom === CONSTANTS.CLASSROOMS.NUMAZU
  ) {
    return {
      venue: '', // ${CONSTANTS.CLASSROOMS.NUMAZU}は空欄
      classroomType: CLASSROOM_TYPE_TIME_FULL,
      firstStart: '12:00',
      firstEnd: '16:00',
      secondStart: '',
      secondEnd: '',
      beginnerStart: '10:00',
      totalCapacity: 8,
      beginnerCapacity: 4,
    };
  } else {
    // デフォルト設定（不明な教室の場合）
    return {
      venue: '', // 不明な教室も空欄
      classroomType: CLASSROOM_TYPE_TIME_FULL,
      firstStart: '10:00',
      firstEnd: '16:00',
      secondStart: '',
      secondEnd: '',
      beginnerStart: '10:00',
      totalCapacity: 8,
      beginnerCapacity: 4,
    };
  }
}

/**
 * 生成した日程データを日程マスタシートに書き込み
 * @param {Array<Array>} scheduleData - 日程データの2次元配列
 */
function writeScheduleDataToSheet(scheduleData) {
  if (scheduleData.length === 0) {
    Logger.log('書き込むデータがありません');
    return;
  }

  const scheduleSheet = getSheetByName(CONSTANTS.SHEET_NAMES.SCHEDULE);
  if (!scheduleSheet) {
    throw new Error('日程マスタシートが見つかりません');
  }

  // データを書き込み
  const range = scheduleSheet.getRange(
    DATA_START_ROW,
    1,
    scheduleData.length,
    Object.keys(CONSTANTS.HEADERS.SCHEDULE).length,
  );
  range.setValues(scheduleData);

  Logger.log(`日程マスタに ${scheduleData.length} 件のデータを書き込みました`);
}
