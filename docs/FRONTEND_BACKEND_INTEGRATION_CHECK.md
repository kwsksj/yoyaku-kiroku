# フロントエンド・バックエンド連携 整合性調査レポート

## 1. 調査目的

フロントエンド（FE）とバックエンド（BE）間のAPI連携において、データ形式やプロパティ名に不整合がないかを網羅的に調査し、現状の連携仕様を明確にすることを目的とする。

## 2. 調査対象

- **フロントエンド:** `14_WebApp_Handlers.html` における `google.script.run` を介したAPI呼び出し
- **バックエンド:**
  - `09_Backend_Endpoints.js` (統合APIエンドポイント)
  - `04_Backend_User.js` (ユーザー関連処理)
  - `05-2_Backend_Write.js` (書き込み・更新処理)

## 3. 総合評価

**結論として、現在実装されているAPI連携において、処理の失敗に直結するような致命的な不整合は見つからなかった。**

データ構造やプロパティ名はおおむね一致しており、正常に連携できる状態にある。ただし、今後の保守性や可読性向上の観点から、いくつかの改善点が確認された。詳細は下記「4. 個別API分析」を参照。

## 4. 個別API分析

### 4.1. ユーザー認証・登録

#### `getLoginData(phone)`

- **FE:** `normalizedPhone` (文字列) を送信。
- **BE:** `phone` (文字列) を受信。
- **評価:** `OK` - 正常に連携。

#### `registerNewUser(userInfo)`

- **FE:** `finalUserData` オブジェクトを送信。
  - プロパティ: `phone`, `realName`, `nickname`, `email`, `wantsEmail`, `ageGroup`, `gender`, `dominantHand`, `address`, `experience`, `pastWork`, `futureGoal`
- **BE:** `userInfo` オブジェクトを受信し、同名のプロパティをすべて参照。
- **評価:** `OK` - FEとBEのデータ構造は完全に一致。

#### `updateUserProfile(userInfo)`

- **FE:** `u` オブジェクト (`{...currentUser, realName, displayName, phone}`) を送信。
- **BE:** `userInfo` オブジェクトを受信。`studentId`, `realName`, `displayName`, `phone` を参照。
- **評価:** `OK`
- **備考:** BEでは `displayName` プロパティの値をシートの `nickname` 列に書き込んでいる。これは意図された動作だが、FEのプロパティ名とBEの保存先フィールド名が異なる点として記録。

#### `searchUsersWithoutPhone(filterText)`

- **FE:** `searchTerm` (文字列) を送信。
- **BE:** `filterText` (文字列) を受信。
- **評価:** `OK`
- **備考:** FEの変数名 (`searchTerm`) とBEの引数名 (`filterText`) が異なる。機能上の問題はない。

### 4.2. 予約操作

#### `makeReservationAndGetLatestData(reservationInfo)`

- **FE:** `p` オブジェクト (`{...selectedSlot, user, studentId, options}`) を送信。
  - `options`: `{chiselRental, firstLecture, startTime, endTime, ...}`
- **BE:** `reservationInfo` を受信し、内部の `makeReservation` 関数に渡す。
  - 参照プロパティ: `studentId`, `date`, `classroom`, `user.realName`, `options.chiselRental` など。
- **評価:** `OK`
- **備考:** FEは `p.studentId` と `p.user.studentId` の両方を持つ冗長なデータを送信している。BEは `p.studentId` を直接参照するため実害はない。

#### `cancelReservationAndGetLatestData(cancelInfo)`

- **FE:** `p` オブジェクト (`{...reservationData, studentId, cancelMessage}`) を送信。
- **BE:** `cancelInfo` を受信し、内部の `cancelReservation` 関数に渡す。
  - 参照プロパティ: `reservationId`, `studentId`, `cancelMessage`
- **評価:** `OK` - 必要なデータはすべて正しく連携されている。

#### `updateReservationDetailsAndGetLatestData(details)`

- **FE:** `p` オブジェクト (`{reservationId, studentId, chiselRental, ...}`) を送信。
- **BE:** `details` を受信し、内部の `updateReservationDetails` 関数に渡す。
  - 参照プロパティ: `reservationId`, `studentId` および更新対象の各プロパティ。
- **評価:** `OK` - FEとBEのデータ構造は一致。

#### `updateReservationMemoAndGetLatestData(reservationId, studentId, newMemo)`

- **FE:** 3つの文字列 (`reservationId`, `studentId`, `newMemo`) を送信。
- **BE:** エンドポイント側で `{reservationId, studentId, workInProgress: newMemo}` というオブジェクトを構築し、`updateReservationDetails` 関数を呼び出す。
- **評価:** `OK` - 正常に連携。

### 4.3. 会計処理

#### `saveAccountingDetails(payload)`

- **FE:** `payload` オブジェクト (`{reservationId, studentId, userInput}`) を送信。
  - `userInput`: `{paymentMethod, tuitionItems, salesItems, timeBased}`
- **BE:** `payload` オブジェクトを受信し、同名のプロパティをすべて参照。
- **評価:** `OK` - FEが構築するデータ構造とBEが期待する構造は完全に一致。

### 4.4. データ取得

#### `getBatchData(dataTypes, phone, studentId)`

- **FE:** 複数のパターンで呼び出し (例: `['initial', 'slots']`)。
- **BE:** `dataTypes` (配列), `phone` (文字列/null), `studentId` (文字列/null) を受信。
- **評価:** `OK` - 柔軟な引数に対応できており、正常に連携。

#### `getCacheVersions()`

- **FE:** 引数なし。
- **BE:** 引数なし。
- **評価:** `OK`

## 5. 改善提案 (修正は不要)

今回の調査では修正が必須な項目はなかったが、将来的な保守性向上のため、以下の点を提案する。

1. **APIエンドポイントの統一:**
   - 現在、`registerNewUser`, `updateUserProfile`, `saveAccountingDetails` は `09_Backend_Endpoints.js` を介さずに直接呼び出されている。
   - 可能であれば、これらの関数も `09_Backend_Endpoints.js` に集約し、FEからの呼び出し窓口を一本化することで、アーキテクチャの一貫性が向上する。

2. **データ構造のクリーンアップ:**
   - `makeReservation` 時に送信するデータなど、冗長なプロパティ（例: `studentId` の重複）を整理することで、データ構造がよりシンプルになる。

3. **命名規則の統一:**
   - `searchTerm` と `filterText` のような軽微な変数名・引数名の違いを統一すると、コードの可読性が向上する。

以上。
