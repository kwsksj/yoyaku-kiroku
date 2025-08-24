/**
 * =================================================================
 * 【ファイル名】: 02-4_BusinessLogic_ScheduleMaster.js
 * 【バージョン】: 2.0
 * 【役割】: 日程マスタシートの管理機能
 * 【構成】: 18ファイル構成のうちの追加ファイル（00_Constants.js、08_ErrorHandler.jsを含む）
 * 【v2.0での変更点】:
 * - フェーズ1リファクタリング: 統一定数ファイル（00_Constants.js）から定数を参照
 * - 旧定数（TOKYO_CLASSROOM_NAME等）を統一定数（CONSTANTS.CLASSROOMS.TOKYO等）に移行
 * - 定数の重複定義を削除し、保守性を向上
 * 【新機能】:
 * - 日程マスタシートの作成・初期化
 * - 開催日程データの取得・更新
 * - 教室形式別の統一的な処理
 * =================================================================
 */

// =================================================================
// 統一定数ファイル（00_Constants.js）から定数を継承
// 基本的な定数は00_Constants.jsで統一管理されています
// 日程マスタ関連の定数は01_Code.jsで定義済み
// =================================================================

/**
 * 日程マスタシートを作成または初期化する
 * スプレッドシートのメニューから手動実行される管理者用関数
 */
function createScheduleMasterSheet() {
  try {
    const ss = getActiveSpreadsheet();
    let scheduleSheet = getSheetByName(SCHEDULE_MASTER_SHEET_NAME);

    // シートが既に存在する場合は確認
    if (scheduleSheet) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        MSG_SHEET_INITIALIZATION,
        MSG_EXISTING_SHEET_WARNING,
        ui.ButtonSet.YES_NO,
      );

      if (response !== ui.Button.YES) {
        ui.alert(MSG_PROCESSING_INTERRUPTED);
        return;
      }

      // 既存シートを削除
      ss.deleteSheet(scheduleSheet);
    }

    // 新しいシートを作成
    scheduleSheet = ss.insertSheet(SCHEDULE_MASTER_SHEET_NAME);

    // ヘッダーを設定
    scheduleSheet
      .getRange(HEADER_ROW, 1, 1, SCHEDULE_MASTER_HEADERS.length)
      .setValues([SCHEDULE_MASTER_HEADERS]);

    // ヘッダー行の書式設定
    const headerRange = scheduleSheet.getRange(HEADER_ROW, 1, 1, SCHEDULE_MASTER_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground(COLOR_HEADER_BACKGROUND);
    headerRange.setHorizontalAlignment('center');

    // 列幅の調整
    scheduleSheet.setColumnWidth(1, COLUMN_WIDTH_DATE); // 日付
    scheduleSheet.setColumnWidth(2, COLUMN_WIDTH_CLASSROOM); // 教室
    scheduleSheet.setColumnWidth(3, COLUMN_WIDTH_VENUE); // 会場
    scheduleSheet.setColumnWidth(4, COLUMN_WIDTH_CLASSROOM_TYPE); // 教室形式
    scheduleSheet.setColumnWidths(5, 4, COLUMN_WIDTH_TIME); // 時刻関連（講座開始〜休憩終了）
    scheduleSheet.setColumnWidth(9, COLUMN_WIDTH_BEGINNER_START); // 初心者開始
    scheduleSheet.setColumnWidths(10, 2, COLUMN_WIDTH_CAPACITY); // 定員関連
    scheduleSheet.setColumnWidth(12, COLUMN_WIDTH_STATUS); // 状態
    scheduleSheet.setColumnWidth(13, COLUMN_WIDTH_NOTES); // 備考

    // サンプルデータを挿入
    const sampleData = createSampleScheduleData();
    if (sampleData.length > 0) {
      scheduleSheet
        .getRange(DATA_START_ROW, 1, sampleData.length, SCHEDULE_MASTER_HEADERS.length)
        .setValues(sampleData);
    }

    // 成功メッセージ
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '日程マスタシート作成完了',
      `「${SCHEDULE_MASTER_SHEET_NAME}」シートを作成しました。\nサンプルデータ ${sampleData.length} 件を挿入しました。`,
      ui.ButtonSet.OK,
    );

    // 作成後、シートキャッシュをクリア
    SS_MANAGER.clearSheetCache(SCHEDULE_MASTER_SHEET_NAME);

    // アクティビティログに記録
    logActivity(
      Session.getActiveUser().getEmail(),
      '日程マスタ作成',
      '成功',
      `シート作成、サンプルデータ${sampleData.length}件`,
    );
  } catch (error) {
    Logger.log(`日程マスタシート作成エラー: ${error.message}`);
    handleError(`日程マスタシートの作成中にエラーが発生しました: ${error.message}`, true);
  }
}

/**
 * サンプルデータを生成する
 * @returns {Array<Array>} サンプルデータの2次元配列
 */
function createSampleScheduleData() {
  const today = new Date();
  const sampleData = [];

  // 今日から指定日数分のサンプルデータを生成
  for (let i = 0; i < SAMPLE_DATA_DAYS; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);

    // 土日のみ開催と仮定
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === WEEKEND_SUNDAY || dayOfWeek === WEEKEND_SATURDAY) {
      // 日曜日または土曜日

      // 教室をローテーション
      const classrooms = [
        {
          name: CONSTANTS.CLASSROOMS.TOKYO,
          venue: '新宿区民会館',
          type: CLASSROOM_TYPE_SESSION_BASED,
        },
        {
          name: CONSTANTS.CLASSROOMS.TSUKUBA,
          venue: 'つくば市民会館',
          type: CLASSROOM_TYPE_TIME_DUAL,
        },
        {
          name: CONSTANTS.CLASSROOMS.NUMAZU,
          venue: '沼津市民会館',
          type: CLASSROOM_TYPE_TIME_FULL,
        },
      ];

      const classroomIndex = Math.floor(sampleData.length / 2) % classrooms.length;
      const classroom = classrooms[classroomIndex];

      // 教室形式に応じた時間設定
      let firstStart, firstEnd, secondStart, secondEnd, beginnerStart;

      if (classroom.type === CLASSROOM_TYPE_SESSION_BASED) {
        // ${CONSTANTS.CLASSROOMS.TOKYO}：セッション制（本講座と初心者講習が同時間帯）
        firstStart = '10:00';
        firstEnd = '16:00';
        secondStart = ''; // 2部なし
        secondEnd = '';
        beginnerStart = '13:30'; // 初心者は午後から
      } else if (classroom.type === CLASSROOM_TYPE_TIME_DUAL) {
        // ${CONSTANTS.CLASSROOMS.TSUKUBA}：2部制
        firstStart = '10:00'; // 1部（午前）
        firstEnd = '12:30';
        secondStart = '13:30'; // 2部（午後）
        secondEnd = '16:00';
        beginnerStart = '13:30'; // 初心者は午後から
      } else {
        // ${CONSTANTS.CLASSROOMS.NUMAZU}：全日制
        firstStart = '10:00';
        firstEnd = '16:00';
        secondStart = ''; // 2部なし
        secondEnd = '';
        beginnerStart = '10:00'; // 初心者は最初から
      }

      sampleData.push([
        Utilities.formatDate(targetDate, getSpreadsheetTimezone(), 'yyyy-MM-dd'),
        classroom.name,
        classroom.venue,
        classroom.type,
        firstStart, // 1部開始
        firstEnd, // 1部終了
        secondStart, // 2部開始
        secondEnd, // 2部終了
        beginnerStart, // 初心者開始
        8, // 全体定員
        4, // 初心者定員
        SCHEDULE_STATUS_SCHEDULED, // 状態
        classroom.name === CONSTANTS.CLASSROOMS.TOKYO ? '初心者歓迎日' : '', // 備考
      ]);
    }
  }

  return sampleData;
}

/**
 * 全ての開催予定日程を取得する（キャッシュ優先）
 * フロントエンドから呼び出されるAPI関数
 * @param {string} fromDate - 取得開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 取得終了日（YYYY-MM-DD形式、オプション）
 * @returns {Array<Object>} 開催日程データの配列
 */
function getAllScheduledDates(fromDate, toDate) {
  try {
    // 1. キャッシュからデータを取得
    const scheduleCache = getCachedData(CACHE_KEYS.MASTER_SCHEDULE_DATA);

    if (scheduleCache) {
      const cachedSchedules = scheduleCache.schedule || [];
      Logger.log(`キャッシュから日程マスタデータを取得: ${cachedSchedules.length} 件`);
      return filterSchedulesByDateRange(cachedSchedules, fromDate, toDate);
    }

    // 3. キャッシュ再構築も失敗した場合のフォールバック
    Logger.log('キャッシュ再構築に失敗しました。スプレッドシートから直接取得します。');
    return getScheduleDataFromSheet(fromDate, toDate);
  } catch (error) {
    Logger.log(`getAllScheduledDates エラー: ${error.message}`);
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
  const toDateTime = toDate ? new Date(toDate).getTime() : Number.MAX_SAFE_INTEGER;

  return schedules.filter(schedule => {
    const scheduleDate = new Date(schedule.date);
    const dateTime = scheduleDate.getTime();
    return dateTime >= fromDateTime && dateTime <= toDateTime;
  });
}

/**
 * スプレッドシートから直接日程データを取得する（キャッシュ未利用時のフォールバック）
 * @param {string} fromDate - 開始日（YYYY-MM-DD形式）
 * @param {string} toDate - 終了日（YYYY-MM-DD形式、オプション）
 * @returns {Array<Object>} 日程データ配列
 */
function getScheduleDataFromSheet(fromDate, toDate) {
  try {
    const scheduleSheet = getSheetByName(SCHEDULE_MASTER_SHEET_NAME);

    if (!scheduleSheet) {
      Logger.log('日程マスタシートが見つかりません');
      return [];
    }

    const lastRow = scheduleSheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('日程マスタシートにデータがありません');
      return [];
    }

    // 全データを取得
    const data = scheduleSheet
      .getRange(2, 1, lastRow - 1, SCHEDULE_MASTER_HEADERS.length)
      .getValues();
    const schedules = [];

    const fromDateTime = fromDate ? new Date(fromDate).getTime() : 0;
    const toDateTime = toDate ? new Date(toDate).getTime() : Number.MAX_SAFE_INTEGER;

    data.forEach(row => {
      const [
        date,
        classroom,
        venue,
        classroomType,
        firstStart,
        firstEnd,
        secondStart,
        secondEnd,
        beginnerStart,
        totalCapacity,
        beginnerCapacity,
        status,
        notes,
      ] = row;

      // 日付フィルタリング
      if (date instanceof Date) {
        const dateTime = date.getTime();
        if (dateTime >= fromDateTime && dateTime <= toDateTime) {
          // scheduled状態のみを返す（キャンセルや完了は除外）
          if (status === SCHEDULE_STATUS_SCHEDULED) {
            schedules.push({
              date: Utilities.formatDate(date, getSpreadsheetTimezone(), 'yyyy-MM-dd'),
              classroom: String(classroom),
              venue: String(venue || ''),
              classroomType: String(classroomType),
              firstStart: String(firstStart),
              firstEnd: String(firstEnd),
              secondStart: String(secondStart || ''),
              secondEnd: String(secondEnd || ''),
              beginnerStart: String(beginnerStart),
              totalCapacity: Number(totalCapacity) || 8,
              beginnerCapacity: Number(beginnerCapacity) || 4,
              status: String(status),
              notes: String(notes || ''),
            });
          }
        }
      }
    });

    Logger.log(`スプレッドシートから開催日程データを ${schedules.length} 件取得しました`);
    return schedules;
  } catch (error) {
    Logger.log(`getScheduleDataFromSheet エラー: ${error.message}`);
    return [];
  }
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
    Logger.log(`ユニークな日付・教室の組み合わせ: ${uniqueDateClassrooms.size} 件`);

    if (uniqueDateClassrooms.size === 0) {
      Logger.log('生成エラー: 予約データから有効な日程が見つかりませんでした');
      return { success: false, message: '予約データから有効な日程が見つかりませんでした' };
    }

    // 2. 日程マスタシートの準備
    prepareScheduleMasterSheet();

    // 3. デフォルト設定を適用して日程マスタデータを生成
    const scheduleData = generateScheduleDataWithDefaults(uniqueDateClassrooms);
    Logger.log(`生成される日程データ: ${scheduleData.length} 件`);

    // 4. 日程マスタシートにデータを書き込み
    writeScheduleDataToSheet(scheduleData);

    // キャッシュをクリア
    SS_MANAGER.clearSheetCache(SCHEDULE_MASTER_SHEET_NAME);

    // アクティビティログに記録
    logActivity(
      Session.getActiveUser().getEmail(),
      '予約データからの日程マスタ生成',
      '成功',
      `生成件数: ${scheduleData.length} 件`,
    );

    Logger.log(`予約データから日程マスタ生成が完了しました。生成件数: ${scheduleData.length} 件`);
    return {
      success: true,
      count: scheduleData.length,
      message: `日程マスタを生成しました（${scheduleData.length} 件）`,
    };
  } catch (error) {
    Logger.log(`日程マスタ生成エラー: ${error.message}`);
    handleError(`日程マスタの生成中にエラーが発生しました: ${error.message}`, true);
    return { success: false, message: `エラーが発生しました: ${error.message}` };
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
      '既存の予約データから日程マスタを自動生成します。\n既存の日程マスタは上書きされます。実行しますか？',
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
    ui.alert('エラー', `処理中にエラーが発生しました: ${error.message}`, ui.ButtonSet.OK);
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
        const headers = sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
        const dateIndex = headers.findIndex(
          header => header === '日付' || header === 'date' || header === '開催日',
        );
        const classroomIndex = headers.findIndex(
          header => header === '教室' || header === 'classroom',
        );
        const venueIndex = headers.findIndex(header => header === '会場' || header === 'venue');
        const statusIndex = headers.findIndex(header => header === '状態' || header === 'status');

        if (dateIndex === -1 || classroomIndex === -1) {
          Logger.log(
            `シート ${sheetName} で必要な列が見つかりません (日付: ${dateIndex}, 教室: ${classroomIndex})`,
          );
          return;
        }

        // データ範囲を取得
        const dataRange = sheet.getRange(DATA_START_ROW, 1, lastRow - 1, sheet.getLastColumn());
        const data = dataRange.getValues();

        data.forEach((row, index) => {
          const date = row[dateIndex];
          const classroom = row[classroomIndex];
          const venue = venueIndex !== -1 ? row[venueIndex] : '';
          const status = statusIndex !== -1 ? row[statusIndex] : '';

          // 有効な日付かチェック
          if (date instanceof Date && classroom) {
            // キャンセルや待機中の予約は除外
            if (status !== STATUS_CANCEL && status !== STATUS_WAITING) {
              const dateString = Utilities.formatDate(date, getSpreadsheetTimezone(), 'yyyy-MM-dd');
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
    '予約サマリー',
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
  let scheduleSheet = getSheetByName(SCHEDULE_MASTER_SHEET_NAME);

  if (!scheduleSheet) {
    // シートが存在しない場合は作成
    const ss = getActiveSpreadsheet();
    scheduleSheet = ss.insertSheet(SCHEDULE_MASTER_SHEET_NAME);

    // ヘッダーを設定
    scheduleSheet
      .getRange(HEADER_ROW, 1, 1, SCHEDULE_MASTER_HEADERS.length)
      .setValues([SCHEDULE_MASTER_HEADERS]);

    // ヘッダー行の書式設定
    const headerRange = scheduleSheet.getRange(HEADER_ROW, 1, 1, SCHEDULE_MASTER_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground(COLOR_HEADER_BACKGROUND);
    headerRange.setHorizontalAlignment('center');
  } else {
    // 既存データをクリア（ヘッダーは保持）
    const lastRow = scheduleSheet.getLastRow();
    if (lastRow > HEADER_ROW) {
      scheduleSheet
        .getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, SCHEDULE_MASTER_HEADERS.length)
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

  uniqueCombinations.forEach((combo, key) => {
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
      classroomDefaults.beginnerStart, // 初心者開始
      classroomDefaults.totalCapacity, // 全体定員
      classroomDefaults.beginnerCapacity, // 初心者定員
      SCHEDULE_STATUS_SCHEDULED, // 状態
      '既存予約から自動生成', // 備考
    ]);
  });

  // 日付順にソート
  scheduleData.sort((a, b) => new Date(a[0]) - new Date(b[0]));

  return scheduleData;
}

/**
 * 教室名に基づくデフォルト設定を取得
 * @param {string} classroom - 教室名
 * @returns {Object} 教室のデフォルト設定
 */
function getClassroomDefaults(classroom) {
  // 教室名に基づいて設定を決定
  if (classroom.includes('東京') || classroom === TOKYO_CLASSROOM_NAME) {
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
  } else if (classroom.includes('つくば') || classroom === TSUKUBA_CLASSROOM_NAME) {
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
  } else if (classroom.includes('沼津') || classroom === NUMAZU_CLASSROOM_NAME) {
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

  const scheduleSheet = getSheetByName(SCHEDULE_MASTER_SHEET_NAME);
  if (!scheduleSheet) {
    throw new Error('日程マスタシートが見つかりません');
  }

  // データを書き込み
  const range = scheduleSheet.getRange(
    DATA_START_ROW,
    1,
    scheduleData.length,
    SCHEDULE_MASTER_HEADERS.length,
  );
  range.setValues(scheduleData);

  Logger.log(`日程マスタに ${scheduleData.length} 件のデータを書き込みました`);
}

// 使用されていない関数 getCapacityRulesByType と updateScheduleMaster は削除されました
