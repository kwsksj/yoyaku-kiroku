# 日程マスタ・フロントエンド統合改修計画

## 概要

現在、フロントエンドは日程マスタの「教室形式」データを十分に活用せず、会計マスタから複雑に取得している。また、教室の時間設定（1部開始/終了、2部開始/終了）も適切に反映されていない。本資料では、これらの問題を段階的に解決する改修計画を策定する。

## 現状分析

### 1. 教室形式の重複取得問題

**問題点**:

- フロントエンドで`tuitionItemRule`として会計マスタから教室形式を取得
- 日程マスタに既に「教室形式」列が存在するが未利用
- 13_WebApp_Views.html:1187で`getTuitionItemRule(master, classroom, '本講座')`を呼び出し、複雑な検索処理

**コード箇所**:

```javascript
// src/13_WebApp_Views.html:1187
const tuitionItemRule = getTuitionItemRule(master, classroom, '本講座');

// src/12_WebApp_Core.html:927-936
const getTuitionItemRule = (master, classroom, itemName) => {
  return master.find(item => item['種別'] === C.itemTypes.TUITION && item['項目名'] === itemName && item['対象教室'] && item['対象教室'].includes(classroom));
};
```

### 2. 教室時間設定の不一致

**問題点**:

- 日程マスタには「1部開始」「1部終了」「2部開始」「2部終了」の4列が存在
- フロントエンドは会計マスタの「講座開始」「講座終了」「休憩開始」「休憩終了」を使用
- 東京教室（1部制）と他教室（2部制）の区別が不適切

**該当コード**:

```javascript
// src/13_WebApp_Views.html:1235-1248 (日程マスタ参照の不完全な実装)
if (sourceData.firstStart && sourceData.firstEnd) {
  // 日程マスタの時間情報を優先使用
  const startParts = sourceData.firstStart.split(':');
  const endParts = sourceData.firstEnd.split(':');
} else {
  // フォールバック: 会計マスタから取得
  const startParts = tuitionItemRule['講座開始'].split(':');
  const endParts = tuitionItemRule['講座終了'].split(':');
}
```

### 3. データモデルの現状

**日程マスタの実際の構造** (DATA_MODEL.mdより):

```
| 列名     | 説明        | データ例     |
| -------- | ----------- | ------------ |
| 日付     | 開催日      | 2025-01-15   |
| 教室     | 教室名      | 東京教室     |
| 会場     | 会場情報    | 五反田会場   |
| 教室形式 | 授業形式    | 時間制       |
| 1部開始  | 1部開始時刻 | 10:00        |
| 1部終了  | 1部終了時刻 | 17:00        |
| 2部開始  | 2部開始時刻 | (空白or時刻) |
| 2部終了  | 2部終了時刻 | (空白or時刻) |
```

**会計マスタとの重複**:

- 会計マスタに「対象教室」「講座開始」「講座終了」が存在
- 日程マスタの情報が真の情報源であるべき

## 問題の影響

### 1. パフォーマンス面

- 不要な会計マスタ検索処理
- 複雑なフィルタリング・マッチング処理

### 2. データ整合性面

- 日程マスタと会計マスタの時間設定が乖離するリスク
- 教室形式の二重管理によるメンテナンス負荷

### 3. 機能面

- memo.mdに記載された時間制セッション関連バグの一因
- 2部制教室の時間設定表示エラー

## 段階的改修計画

### フェーズ1: データアクセス層の統合

**目的**: 日程マスタ情報を直接活用する仕組みの構築

**作業項目**:

1. **日程マスタデータ構造の統一**
   - バックエンドAPI(`getAllScheduledDates`)の戻り値に教室形式・時間情報を含める
   - フロントエンドの`selectedSlot`、`editingReservationDetails`に日程マスタデータを格納

2. **新しいヘルパー関数の作成**

   ```javascript
   // src/12_WebApp_Core.html に追加
   /**
    * 日程マスタから教室形式を取得
    * @param {object} scheduleData - 日程マスタのデータオブジェクト
    * @returns {string} 教室形式 ('時間制' | '回数制' | '材料制')
    */
   function getClassroomTypeFromSchedule(scheduleData) {
     return scheduleData.classroomType || scheduleData['教室形式'];
   }

   /**
    * 日程マスタから教室の開講時間情報を取得
    * @param {object} scheduleData - 日程マスタのデータオブジェクト
    * @returns {object} 時間情報 {firstStart, firstEnd, secondStart?, secondEnd?}
    */
   function getClassroomTimesFromSchedule(scheduleData) {
     return {
       firstStart: scheduleData.firstStart || scheduleData['1部開始'],
       firstEnd: scheduleData.firstEnd || scheduleData['1部終了'],
       secondStart: scheduleData.secondStart || scheduleData['2部開始'],
       secondEnd: scheduleData.secondEnd || scheduleData['2部終了'],
     };
   }
   ```

3. **バックエンドAPI拡張**
   - `05-3_Backend_AvailableSlots.js`で日程マスタ情報をslotsに含める
   - `05-2_Backend_Write.js`で予約編集時に日程マスタ情報を提供

### フェーズ2: フロントエンド画面の修正

**目的**: tuitionItemRule依存からの脱却

**作業項目**:

1. **予約画面の修正**
   - `src/13_WebApp_Views.html:1187` の`tuitionItemRule`取得を削除
   - 日程マスタベースの教室形式判定に変更

   ```javascript
   // 修正前
   const tuitionItemRule = getTuitionItemRule(master, classroom, '本講座');
   const isTimeBased = tuitionItemRule && tuitionItemRule['単位'] === C.units.THIRTY_MIN;

   // 修正後
   const classroomType = getClassroomTypeFromSchedule(sourceData);
   const isTimeBased = classroomType === '時間制';
   ```

2. **時間選択UIの修正**
   - `src/13_WebApp_Views.html:1231-1248`の時間取得ロジック統一
   - 会計マスタフォールバック処理を削除

   ```javascript
   // 修正前（複雑な分岐）
   if (sourceData.firstStart && sourceData.firstEnd) {
     // 日程マスタの時間情報を優先使用
   } else {
     // フォールバック: 会計マスタから取得
   }

   // 修正後（シンプルな統一処理）
   const times = getClassroomTimesFromSchedule(sourceData);
   if (!times.firstStart || !times.firstEnd) {
     return `<div class="error">この教室の時間設定が不正です</div>`;
   }
   ```

3. **会計画面の修正**
   - `src/13_WebApp_Views.html:1581-1587`の教室形式判定を統一
   - 時間制教室のUI生成で日程マスタデータを直接使用

### フェーズ3: 時間表示の統一

**目的**: 2部制・1部制教室の正確な時間表示

**作業項目**:

1. **開講時間表示の統一**
   - `src/13_WebApp_Views.html:1426-1451`の`_renderOpeningHoursHtml`関数を修正

   ```javascript
   const _renderOpeningHoursHtml = () => {
     const times = getClassroomTimesFromSchedule(sourceData);

     if (times.secondStart && times.secondEnd) {
       // 2部制の場合
       return `${times.firstStart} ~ ${times.firstEnd} , ${times.secondStart} ~ ${times.secondEnd}`;
     } else {
       // 1部制の場合
       return `${times.firstStart} ~ ${times.firstEnd}`;
     }
   };
   ```

2. **時間選択肢の生成修正**
   - `getTimeOptionsHtml`で日程マスタの時間範囲を使用
   - 東京教室（1部制）とその他（2部制）の区別を明確化

### フェーズ4: コード清理

**目的**: 不要になった処理の削除

**作業項目**:

1. **不要関数の削除**
   - `getTuitionItemRule`の使用箇所の洗い出しと置き換え
   - 会計処理以外での`tuitionItemRule`参照の削除

2. **定数の整理**
   - 時間関連の定数を日程マスタベースに統一
   - 教室形式判定用の新定数追加

## 想定される成果

### 1. パフォーマンス向上

- 会計マスタ検索処理の削減
- シンプルなデータアクセスパターン

### 2. データ整合性の向上

- 日程マスタを真の情報源とした一貫性
- 時間設定の重複管理解消

### 3. バグ修正

- memo.mdの時間制教室関連問題の解決
- 2部制教室の時間表示エラー修正

### 4. 保守性向上

- コードの複雑性削減
- データモデルの理解しやすさ向上

## 実装上の注意点

### 1. 後方互換性

- 段階的移行により既存機能を維持
- 各フェーズでのテスト実施

### 2. データ検証

- 日程マスタの教室形式データの整合性確認
- 移行前のデータクレンジング

### 3. エラーハンドリング

- 日程マスタデータ不正時のフォールバック処理
- ユーザーフレンドリーなエラーメッセージ

## 次のステップ

1. **フェーズ1から段階的に実装開始**
2. **各フェーズでのテスト環境での動作確認**
3. **本番環境での段階的デプロイ**

この改修により、日程マスタデータの真の活用と、フロントエンドの簡素化・高速化を実現する。
