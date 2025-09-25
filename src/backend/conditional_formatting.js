/**
 * 指定された複数のシートに、日付を基準とした高度な条件付き書式ルールを設定します。
 * (v5: 新規ルール「FALSE非表示」「初回」「彫刻刀レンタル」を追加)
 *
 * 実行すると、対象シートの既存のルールはすべてクリアされ、新しいルールで上書きされます。
 * 書式の変更や対象シートの指定は、先頭の「設定項目」で行うことができます。
 */
function setAdvancedConditionalFormatting() {
  // --- START: 設定項目 ---

  // ★★★ ここに対象としたいシート名を正確に入力してください ★★★
  const TARGET_SHEET_NAMES = ['東京'];

  const CONFIG = {
    DATE_COLUMN: '日付',
    VENUE_COLUMN: '会場',
    INITIAL_COLUMN: '初回', // 「初回」列の名前
    RENTAL_COLUMN: '彫刻刀レンタル', // 「彫刻刀レンタル」列の名前
  };

  // --- 1. スタイルの定義 ---
  // ここで基本的な書式（背景色・文字色・太字）を個別に定義します。
  const STYLES = {
    // 背景色のスタイル
    ODD_GROUP: { background: '#efefef' },
    EVEN_GROUP: { background: '#ffffff' },
    // 文字色のスタイル
    DEFAULT_FONT: { fontColor: '#000000' },
    SUNDAY_FONT: { fontColor: '#ff0000' },
    SATURDAY_FONT: { fontColor: '#0000ff' },
    // ★ 新規追加: 「初回」「彫刻刀レンタル」用のスタイル
    INITIAL_FONT: { fontColor: '#ff0000' }, // 赤・太字
    RENTAL_FONT: { fontColor: '#ff9900' }, // オレンジ・太字
    // 非表示用の文字色スタイル (背景色と合わせる)
    DUPLICATE_ODD_FONT: { fontColor: '#efefef' },
    DUPLICATE_EVEN_FONT: { fontColor: '#ffffff' },
  };
  // --- END: 設定項目 ---

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  TARGET_SHEET_NAMES.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      console.warn(
        `シート "${sheetName}" が見つかりませんでした。スキップします。`,
      );
      return;
    }

    const range = sheet.getRange(
      2,
      1,
      sheet.getMaxRows() - 1,
      sheet.getMaxColumns(),
    );
    sheet.clearConditionalFormatRules();
    const newRules = [];

    // --- 数式で使う共通定義 ---
    const commonLetParts = `
      date_col_num, IFERROR(MATCH("${CONFIG.DATE_COLUMN}", $1:$1, 0), -1),
      current_date, IF(date_col_num=-1, "", INDEX($A:$Z, ROW(), date_col_num)),
      date_col_letter, IF(date_col_num=-1, "", SUBSTITUTE(ADDRESS(1, date_col_num, 4), "1", "")),
      unique_dates, IF(date_col_letter="", "", UNIQUE(INDIRECT(date_col_letter & "2:" & date_col_letter))),
      group_num, IFERROR(MATCH(current_date, unique_dates, 0), 0),
      venue_col_num, IFERROR(MATCH("${CONFIG.VENUE_COLUMN}", $1:$1, 0), -1),
      initial_col_num, IFERROR(MATCH("${CONFIG.INITIAL_COLUMN}", $1:$1, 0), -1),
      rental_col_num, IFERROR(MATCH("${CONFIG.RENTAL_COLUMN}", $1:$1, 0), -1)
    `;

    // --- 条件式の部品 ---
    const isDateValid = `AND(date_col_num <> -1, current_date <> "")`;
    const isOddGroup = `MOD(group_num, 2) = 1`;
    const isEvenGroup = `MOD(group_num, 2) = 0`;
    const isDuplicate = `current_date = INDEX($A:$Z, ROW() - 1, date_col_num)`;
    const isTargetColumn = `OR(COLUMN() = date_col_num, COLUMN() = venue_col_num)`;
    const isSunday = `AND(COLUMN()=date_col_num, WEEKDAY(current_date)=1, NOT(${isDuplicate}))`;
    const isSaturday = `AND(COLUMN()=date_col_num, WEEKDAY(current_date)=7, NOT(${isDuplicate}))`;
    // ★ 新規追加: 新しいルールのための条件式
    const isFalseValue = `INDEX($A:$Z, ROW(), COLUMN())=FALSE`;
    const isInitialTrue = `AND(initial_col_num <> -1, COLUMN()=initial_col_num, INDEX($A:$Z, ROW(), COLUMN())=TRUE)`;
    const isRentalTrue = `AND(rental_col_num <> -1, COLUMN()=rental_col_num, INDEX($A:$Z, ROW(), COLUMN())=TRUE)`;

    // --- 2. 条件とスタイルのマッピング (優先度の高い順) ---
    const ruleMappings = [
      // 1. 値がFALSEのセルを非表示
      {
        condition: `AND(${isDateValid}, ${isFalseValue}, ${isEvenGroup})`,
        style: { ...STYLES.EVEN_GROUP, ...STYLES.DUPLICATE_EVEN_FONT },
      },
      {
        condition: `AND(${isDateValid}, ${isFalseValue}, ${isOddGroup})`,
        style: { ...STYLES.ODD_GROUP, ...STYLES.DUPLICATE_ODD_FONT },
      },
      // 2. 「初回」列がTRUEのセル
      {
        condition: `AND(${isDateValid}, ${isInitialTrue}, ${isEvenGroup})`,
        style: { ...STYLES.EVEN_GROUP, ...STYLES.INITIAL_FONT },
      },
      {
        condition: `AND(${isDateValid}, ${isInitialTrue}, ${isOddGroup})`,
        style: { ...STYLES.ODD_GROUP, ...STYLES.INITIAL_FONT },
      },
      // 3. 「彫刻刀レンタル」列がTRUEのセル
      {
        condition: `AND(${isDateValid}, ${isRentalTrue}, ${isEvenGroup})`,
        style: { ...STYLES.EVEN_GROUP, ...STYLES.RENTAL_FONT },
      },
      {
        condition: `AND(${isDateValid}, ${isRentalTrue}, ${isOddGroup})`,
        style: { ...STYLES.ODD_GROUP, ...STYLES.RENTAL_FONT },
      },
      // 4. (既存) 重複セル (日付・会場) を非表示
      {
        condition: `AND(${isDateValid}, ${isDuplicate}, ${isTargetColumn}, ${isEvenGroup})`,
        style: { ...STYLES.EVEN_GROUP, ...STYLES.DUPLICATE_EVEN_FONT },
      },
      {
        condition: `AND(${isDateValid}, ${isDuplicate}, ${isTargetColumn}, ${isOddGroup})`,
        style: { ...STYLES.ODD_GROUP, ...STYLES.DUPLICATE_ODD_FONT },
      },
      // 5. (既存) 週末の文字色
      {
        condition: `AND(${isDateValid}, ${isSunday}, ${isEvenGroup})`,
        style: {
          ...STYLES.EVEN_GROUP,
          ...STYLES.DEFAULT_FONT,
          ...STYLES.SUNDAY_FONT,
        },
      },
      {
        condition: `AND(${isDateValid}, ${isSunday}, ${isOddGroup})`,
        style: {
          ...STYLES.ODD_GROUP,
          ...STYLES.DEFAULT_FONT,
          ...STYLES.SUNDAY_FONT,
        },
      },
      {
        condition: `AND(${isDateValid}, ${isSaturday}, ${isEvenGroup})`,
        style: {
          ...STYLES.EVEN_GROUP,
          ...STYLES.DEFAULT_FONT,
          ...STYLES.SATURDAY_FONT,
        },
      },
      {
        condition: `AND(${isDateValid}, ${isSaturday}, ${isOddGroup})`,
        style: {
          ...STYLES.ODD_GROUP,
          ...STYLES.DEFAULT_FONT,
          ...STYLES.SATURDAY_FONT,
        },
      },
      // 6. (既存) 奇数グループの基本背景
      {
        condition: `AND(${isDateValid}, ${isOddGroup})`,
        style: { ...STYLES.ODD_GROUP, ...STYLES.DEFAULT_FONT },
      },
    ];

    // --- 3. ルールの自動生成と適用 ---
    ruleMappings.forEach(map => {
      const finalFormula = `=LET(${commonLetParts}, ${map.condition})`;
      const ruleBuilder = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(finalFormula)
        .setBackground(map.style.background)
        .setFontColor(map.style.fontColor);

      // ★ スタイルにbold:trueがあれば、太字設定を追加
      //       if (map.style.bold) {
      //         ruleBuilder.setBold(true);
      //       }

      const rule = ruleBuilder.setRanges([range]).build();
      newRules.push(rule);
    });

    sheet.setConditionalFormatRules(newRules);
  });
}
