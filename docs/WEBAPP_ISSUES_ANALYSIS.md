# WebApp問題調査レポート

## 概要

WebAppで発生している問題について調査しました。以下のような問題が報告されており、それぞれの原因と対策を以下にまとめます。

## 問題リスト

### 1. プロフィール編集問題

#### 問題詳細

- 更新ボタンを押すと「サーバーエラーが発生しました。対象ユーザーの行番号情報がキャッシュに見つかりません。」エラー
- ボタンが隙間がなく並んで左寄せになっている

#### プロフィール編集の原因分析

**エラーの原因**:

- `04_Backend_User.js:354-364`で`getCachedStudentById()`を使用してユーザー情報を取得
- `getCachedStudentById()`は`08_Utilities.js:554-559`で定義されているが、`rowIndex`情報を返さない
- `updateUserProfile()`関数では`targetStudent.rowIndex`を期待しているが、実際のキャッシュデータには`rowIndex`が含まれていない

**ボタンレイアウトの問題**:

- CSS関連の問題でボタンが適切に配置されていない可能性

#### プロフィール編集の対策

1. `getCachedStudentById()`に`rowIndex`情報を追加する
2. または`updateUserProfile()`で`rowIndex`を別途取得する処理を追加
3. ボタンのCSSスタイリングを修正

### 2. ダッシュボード問題

#### 問題詳細

- 「+ あたらしく よやく する」ボタンが反応なし→おそらくdiv要素でハンドラーが対応していない
- 「きろく」が1件も表示されない

#### ダッシュボードの原因分析

**新規予約ボタンの問題**:

- `13_WebApp_Views.html:777-778`で`newAction: 'goToClassroomSelection'`が設定されている
- `14_WebApp_Handlers.html:975-989`に`goToClassroomSelection`ハンドラーが定義されている
- ただし、ボタンの実際の要素がdivかbuttonかによってクリックイベントが適切に処理されない可能性

**きろく表示問題**:

- `13_WebApp_Views.html:756,783-784`で「きろく」表示ロジックが定義されている
- **根本原因発見**: データ参照の矛盾
  - `COMPLETED`データは`myHistory`（履歴）に含まれる（`04_Backend_User.js:84`）
  - しかし、フロントエンドでは`sortedBookings`（予約）から`COMPLETED`を検索している
  - 正しくは`sortedHistory`から検索するべき

#### ダッシュボードの対策

1. 「+ あたらしく よやく する」ボタンが適切なbutton要素になっているか確認
2. イベントハンドラーが正しく設定されているか確認
3. **最重要**: `13_WebApp_Views.html:783`の「きろく」フィルタリングを`sortedBookings`から`sortedHistory`に変更

### 3. ログイン画面問題

#### 問題詳細

- 特殊コマンドを入力していないのに特殊コマンド画面になる
- 特殊コマンドの場合のみgetUserSearchView
- ユーザーが見つからない場合はgetRegistrationStep2View

#### ログイン画面の原因分析

- `04_Backend_User.js:108-116`で特殊コマンドチェックが実行される
- `commandRecognized: 'all'`が返されると、ログインフローが特殊コマンド処理に移行
- PropertiesServiceの`SPECIAL_NO_PHONE_LOGIN_COMMAND`設定が影響している可能性

#### ログイン画面の対策

1. PropertiesServiceの特殊コマンド設定を確認
2. ログイン処理フローを見直し、通常のログインと特殊コマンドの分岐を明確化

### 4. 新規予約問題

#### 問題詳細

- 教室のボタンが隙間なく左寄せになっている
- 教室を選択すると「予約枠の取得に失敗しました。時間をおいて再度お試しください。」

#### 新規予約の原因分析

**ボタンレイアウト問題**:

- `13_WebApp_Views.html:831-838`で教室ボタンが生成される
- CSSクラス設定に問題がある可能性

**予約枠取得エラー**:

- `14_WebApp_Handlers.html:1016-1026`の`selectClassroom`ハンドラーで処理される
- `updateSlotsAndGoToBooking`→`fetchLatestSlotsData`の流れでエラーが発生
- `05-3_Backend_AvailableSlots.js`の`getAvailableSlots()`関数でエラーが発生している可能性

#### 新規予約の対策

1. 教室選択ボタンのCSS修正
2. `getAvailableSlots()`のエラーハンドリングとログを確認
3. キャッシュデータの整合性確認

## 重要な発見：「きろく」表示ロジックの設計問題

**データフローの矛盾が判明**：

### データ分類（バックエンド）

- `myBookings`: 未来 + CONFIRMED, WAITLISTED（予約中の状態）
- `myHistory`: COMPLETED（完了済み記録）

### 表示ロジック（フロントエンド）

- **現在の実装**: `sortedBookings`から`STATUS.COMPLETED`を検索
- **問題**: `COMPLETED`記録は`myHistory`に含まれる
- **修正案**: `sortedHistory`から`STATUS.COMPLETED`を検索するべき

この設計矛盾により、`STATUS.COMPLETED`の記録が正しく設定されていても「きろく」として表示されません。

## 追加で発見された設計問題

### 1. 会計画面でのデータ検索不整合

**問題箇所**: `13_WebApp_Views.html:1360-1366`

```javascript
const booking = state.computed.sortedBookings.find(
  b => b.reservationId === reservation.reservationId,
);
if (booking.status === STATUS.COMPLETED && ...)  // ← COMPLETED記録はsortedBookingsにない！
```

**影響**: 会計済み記録の表示・編集機能が正常動作しない可能性

### 2. 会計処理開始時の予約検索エラー

**問題箇所**: `14_WebApp_Handlers.html:796-836`

```javascript
const reservation = stateManager.getState().myBookings.find(booking => booking.reservationId === reservationId);
if (reservation) {
  /* 会計処理 */
} else {
  showInfo('予約情報が見つかりませんでした。');
} // ← COMPLETED記録でエラー表示
```

**影響**:

- COMPLETED状態の記録に対して会計処理を開始すると「予約情報が見つかりませんでした」エラー
- 会計修正機能が完全に機能停止

### 3. スケジュール表示での予約状態判定エラー

**問題箇所**: `13_WebApp_Views.html:933-942`

```javascript
const booking = stateManager.getState().computed.sortedBookings.find(b => b.date === sl.date && b.classroom === sl.classroom);
```

**影響**: COMPLETED記録のスロットが「予約可能」として表示される可能性（二重予約リスク）

### 4. バックエンド開発者の認識

**重要**: `05-2_Backend_Write.js:829`のコメントで、開発者は既にこの問題を認識済み：

```javascript
// 会計が完了した予約は「未来の予約」ではなく「過去の記録」となるため
```

**正しい分類**:

- **よやく** (`myBookings`): 未来 + CONFIRMED, WAITLISTED
- **きろく** (`myHistory`): COMPLETED

しかし、フロントエンドでの適切な修正が未実装。

## UI改善提案

### 戻るボタンの改善

- 現状：各画面で戻るボタンの遷移先がハードコーディングされている
- 提案：ページ遷移履歴を保持し、動的に戻り先を決定する仕組みを実装

### ダッシュボード表記の改善

- 現状：「ダッシュボード」という表記
- 提案：「ホームへもどる」など、よりユーザーフレンドリーな表記に変更

## 対策優先度

### 緊急対応（機能完全停止）

1. **プロフィール編集のエラー修正**（rowIndex不足）
2. **新規予約の予約枠取得エラー修正**
3. **「きろく」表示ロジック修正**（`sortedBookings`→`sortedHistory`）
4. **会計処理の検索エラー修正**（`myBookings`→`history`での検索追加）
5. **会計画面での記録検索エラー修正**（同上）

### 高優先度（セキュリティ・データ整合性）

1. **スケジュール表示での二重予約リスク修正**（COMPLETED記録の状態表示）
2. ログイン画面の特殊コマンド誤判定

### 低優先度

1. ボタンレイアウトの修正
2. UI表記の改善

## 技術的な注意点

- キャッシュシステム（CacheService）とデータ整合性の問題が多く見られる
- ヘッダーマッピングの処理で`rowIndex`情報が不足
- **データフロー設計の矛盾**：バックエンドのデータ分類とフロントエンド表示ロジックの不整合
- エラーハンドリングが不十分でユーザーへのフィードバックが不適切
- CSS/レイアウトの問題が複数箇所で発生

## 推奨対応方針

### 緊急修正（即座に対応）

1. **「きろく」表示修正**: `13_WebApp_Views.html:783` `sortedBookings`→`sortedHistory`
2. **会計画面修正**: `13_WebApp_Views.html:1360` `sortedBookings`→`history`での検索に変更
3. **会計ハンドラー修正**: `14_WebApp_Handlers.html:798` `myBookings`に加えて`history`からも検索

### システム設計改善

4. **統一検索関数の実装**: 予約・記録ID検索を`myBookings + history`で統一的に処理する関数を作成
5. **データ整合性の確保**: キャッシュデータ構造を見直し、必要な情報（rowIndexなど）を含める
6. **エラーハンドリングの強化**: より具体的なエラーメッセージとログ出力

### 品質向上

7. **UI/UXの統一**: ボタンレイアウトと表記の統一
8. **テストの強化**: よやく→きろく のステータス遷移を含む全機能の動作確認
9. **設計ドキュメント更新**: データフロー図とステータス遷移図の作成
