/**
 * 名前自動入力機能のテスト関数
 * この関数を実行して予約シートの名前自動入力機能をテストします
 */
function testNameAutoPopulation() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);

    if (!rosterSheet) {
      return {
        success: false,
        message: '生徒名簿シートが見つかりません',
      };
    }

    // 生徒名簿データを取得
    const rosterData = getRosterData(rosterSheet);

    console.log('生徒名簿データ:');
    console.log('データ行数:', rosterData.data.length);
    console.log('名前→ID マッピング数:', rosterData.nameToId.size);

    // マッピングの一部を表示
    const mappings = [];
    let count = 0;
    for (const [name, id] of rosterData.nameToId.entries()) {
      if (count < 5) {
        // 最初の5件だけ表示
        mappings.push({ name: name, id: id });
        count++;
      }
    }

    // 予約シートのイベントハンドラが設定されているかチェック
    const tokyoSheet = ss.getSheetByName(TOKYO_CLASSROOM_NAME);

    return {
      success: true,
      message: '名前自動入力機能の確認完了',
      details: {
        rosterDataRows: rosterData.data.length,
        nameToIdMappings: rosterData.nameToId.size,
        sampleMappings: mappings,
        tokyoSheetExists: !!tokyoSheet,
        syncTargetHeaders: SYNC_TARGET_HEADERS,
      },
    };
  } catch (error) {
    console.error('テストエラー:', error);
    return {
      success: false,
      message: 'テスト実行中にエラーが発生しました: ' + error.message,
      error: error.toString(),
    };
  }
}

/**
 * 特定の名前での自動入力をシミュレートするテスト関数
 * @param {string} testName - テストしたい名前
 */
function testNameLookup(testName) {
  try {
    if (!testName) {
      return {
        success: false,
        message: 'テスト用の名前を指定してください',
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);

    if (!rosterSheet) {
      return {
        success: false,
        message: '生徒名簿シートが見つかりません',
      };
    }

    const rosterData = getRosterData(rosterSheet);
    const studentId = rosterData.nameToId.get(testName.trim());

    if (studentId) {
      // 該当する生徒の詳細情報を取得
      const rosterIdColIdx = rosterData.headerMap.get(HEADER_STUDENT_ID);
      const userRosterRow = rosterData.data.find((row) => row[rosterIdColIdx] === studentId);

      const studentInfo = {};
      if (userRosterRow) {
        const realNameIdx = rosterData.headerMap.get(HEADER_REAL_NAME);
        const nicknameIdx = rosterData.headerMap.get(HEADER_NICKNAME);
        const phoneIdx = rosterData.headerMap.get(HEADER_PHONE);
        const unifiedCountIdx = rosterData.headerMap.get(HEADER_UNIFIED_CLASS_COUNT);

        studentInfo.realName = realNameIdx !== undefined ? userRosterRow[realNameIdx] : null;
        studentInfo.nickname = nicknameIdx !== undefined ? userRosterRow[nicknameIdx] : null;
        studentInfo.phone = phoneIdx !== undefined ? userRosterRow[phoneIdx] : null;
        studentInfo.classCount =
          unifiedCountIdx !== undefined ? userRosterRow[unifiedCountIdx] : null;
      }

      return {
        success: true,
        message: `名前「${testName}」で生徒が見つかりました`,
        details: {
          studentId: studentId,
          studentInfo: studentInfo,
        },
      };
    } else {
      return {
        success: false,
        message: `名前「${testName}」に対応する生徒IDが見つかりませんでした`,
        availableNames: Array.from(rosterData.nameToId.keys()).slice(0, 10), // 最初の10件を表示
      };
    }
  } catch (error) {
    console.error('名前検索テストエラー:', error);
    return {
      success: false,
      message: '名前検索テスト実行中にエラーが発生しました: ' + error.message,
      error: error.toString(),
    };
  }
}
