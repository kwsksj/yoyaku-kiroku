# コードクリーンアップ計画書

## 1. 目的

この計画書は、`COMPREHENSIVE_REFACTORING_PLAN.md` にて定義された大規模なリファクタリングが完了した後に実施する、コードの品質向上を目的としたタスクを定義する。

主に、処理の共通化とヘルパー関数の導入により、コードの重複を削減し、可読性と保守性をさらに高めることを目指す。

## 2. タスクリスト

### タスク1: 共通処理のヘルパー関数化

**背景**: キャッシュからのデータ取得や、特定の条件でのデータフィルタリングは、アプリケーションの様々な箇所で繰り返し行われる。これらのロジックを共通のヘルパー関数として切り出すことで、コードの見通しが良くなり、将来の仕様変更にも強くなる。

#### 1.1. 特定の予約情報を取得するヘルパー関数の作成

- **関数名案**: `getCachedReservationsFor(date, classroom)`
- **役割**: `getCachedData(CACHE_KEYS.ALL_RESERVATIONS)` を呼び出し、取得した全予約データの中から、指定された `日付` と `教室` に合致する予約のみをフィルタリングして返す。
- **メリット**: 定員チェックなどで必要となる「特定日の予約を取得する」というロジックを、この関数に集約できる。

#### 1.2. 特定の生徒情報を取得するヘルパー関数の作成

- **関数名案**: `getCachedStudentById(studentId)`
- **役割**: `getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC)` を呼び出し、`cache.students[studentId]` のようにして特定の生徒オブジェクトを返す。
- **メリット**: 生徒IDから情報を取得する、という意図が明確になり、コードが読みやすくなる。

### タスク2: 既存コードへのヘルパー関数適用

**背景**: 上記で作成した新しいヘルパー関数を、実際のコードに適用していく。

- **手順**:
  1. プロジェクト全体で `getCachedData(CACHE_KEYS.ALL_RESERVATIONS)` を呼び出している箇所を検索する。
  2. その後の処理が、日付や教室でフィルタリングするロジックであれば、新しい `getCachedReservationsFor()` ヘルパー関数に置き換える。
  3. 同様に、`getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC)` を呼び出して特定の生徒情報を取得している箇所を、`getCachedStudentById()` に置き換える。

## 3. 具体的な実行計画

### 3.1. フェーズ1: ヘルパー関数の実装（08_Utilities.js）

以下の関数を `src/08_Utilities.js` に追加する。

#### 3.1.1. 予約フィルタリング関数

```javascript
/**
 * 特定日・教室の予約データを取得する
 * @param {string} date - 検索対象の日付（yyyy-MM-dd形式）
 * @param {string} classroom - 教室名
 * @param {string} status - ステータス（省略可、デフォルトは確定済み予約のみ）
 * @returns {Array} 条件に合致する予約配列
 */
function getCachedReservationsFor(date, classroom, status = CONSTANTS.STATUS.CONFIRMED) {
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  if (!reservationsCache?.reservations) return [];

  const { reservations, headerMap } = reservationsCache;
  const dateColIdx = headerMap[CONSTANTS.HEADERS.DATE];
  const classroomColIdx = headerMap[CONSTANTS.HEADERS.CLASSROOM];
  const statusColIdx = headerMap[CONSTANTS.HEADERS.STATUS];

  return reservations.filter(r => {
    const row = r.data;
    return row[dateColIdx] === date && row[classroomColIdx] === classroom && (!status || row[statusColIdx] === status);
  });
}
```

#### 3.1.2. 生徒情報取得関数

```javascript
/**
 * 生徒IDから生徒情報を取得する
 * @param {string} studentId - 生徒ID
 * @returns {Object|null} 生徒オブジェクト、見つからない場合はnull
 */
function getCachedStudentById(studentId) {
  const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
  if (!studentsCache?.students) return null;

  return studentsCache.students[studentId] || null;
}
```

#### 3.1.3. 予約データ変換の共通化

```javascript
/**
 * 予約配列データを統一的にオブジェクト配列に変換する
 * @param {Array} reservations - 予約配列データ
 * @param {Object} headerMap - ヘッダーマップ
 * @returns {Array} 変換済み予約オブジェクト配列
 */
function convertReservationsToObjects(reservations, headerMap) {
  return reservations
    .map(reservation => {
      if (Array.isArray(reservation)) {
        return transformReservationArrayToObjectWithHeaders(reservation, headerMap);
      }
      return reservation;
    })
    .filter(reservation => reservation !== null);
}
```

### 3.2. フェーズ2: 既存コードの置き換え

以下の箇所を特定の順序で修正する：

#### 3.2.1. 定員チェック処理の統一 (`05-2_Backend_Write.js:15`)

**修正箇所**: `checkCapacityFull()` 関数

- **Before**: 手動でフィルタリング（行40-48）
- **After**: `getCachedReservationsFor(date, classroom)` を使用

#### 3.2.2. 空きスロット計算の統一 (`05-3_Backend_AvailableSlots.js:23, 281`)

**修正箇所**: `getAvailableSlots()`, `getUserReservations()` 関数

- **Before**: 個別の変換・フィルタリングロジック
- **After**: `convertReservationsToObjects()` と条件別フィルタリング

#### 3.2.3. ユーザー情報取得の統一 (`04_Backend_User.js:186, 338`)

**修正箇所**: `getUsersWithoutPhoneNumber()`, `updateUserProfile()` 関数

- **Before**: `Object.values(studentsCache.students)` や直接アクセス
- **After**: `getCachedStudentById()` の活用

## 4. 実コード分析で発見した追加改善点

### 4.1. タスク3: データ変換処理の重複排除

**発見した問題**:

- `transformReservationArrayToObjectWithHeaders()` が複数箇所で個別に呼び出されている
- 配列→オブジェクト変換のロジックが散在している

**対象箇所**:

- `src/05-3_Backend_AvailableSlots.js:32, 296`
- 同様の変換処理が他にも存在する可能性

**解決策**: 上記3.1.3の `convertReservationsToObjects()` で統一する

### 4.2. タスク4: ヘッダーマップアクセスの標準化

**発見した問題**:

- ヘッダーマップへのアクセス方法が統一されていない
- `headerMap.get()` と `headerMap[key]` が混在

**対象箇所**:

- `src/05-2_Backend_Write.js:34-38` - Mapオブジェクトに変換してからアクセス
- `src/08_Utilities.js:378-384` - 型判定してからアクセス

**解決策**: ヘッダーアクセス用のユーティリティ関数を追加

```javascript
/**
 * ヘッダーマップから安全にインデックスを取得する
 * @param {Map|Object} headerMap - ヘッダーマップ
 * @param {string} headerName - ヘッダー名
 * @returns {number|undefined} 列インデックス
 */
function getHeaderIndex(headerMap, headerName) {
  if (headerMap?.get && typeof headerMap.get === 'function') {
    return headerMap.get(headerName); // Mapオブジェクトの場合
  }
  return headerMap?.[headerName]; // 通常のオブジェクトの場合
}
```

### 4.3. タスク5: 個人データ抽出の最適化

**発見した問題**:

- `extractPersonalDataFromCache()` が引数で受け取ったキャッシュデータを使わず、内部で再度キャッシュアクセスしている
- `getUserReservations()` 内で重複する変換処理が実行されている

**対象箇所**:

- `src/04_Backend_User.js:57` - `extractPersonalDataFromCache()` 関数
- `src/05-3_Backend_AvailableSlots.js:279` - `getUserReservations()` 関数

**解決策**: `extractPersonalDataFromCache()` を修正して効率化

```javascript
function extractPersonalDataFromCache(studentId, cacheData) {
  try {
    const { allReservationsCache } = cacheData;
    const convertedReservations = convertReservationsToObjects(allReservationsCache.reservations, allReservationsCache.headerMap);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const studentReservations = convertedReservations.filter(r => r.studentId === studentId);

    const myBookings = studentReservations.filter(r => new Date(r.date) >= today && r.status === CONSTANTS.STATUS.CONFIRMED);
    const myHistory = studentReservations.filter(r => new Date(r.date) < today || r.status !== CONSTANTS.STATUS.CONFIRMED);

    return { myBookings, myHistory };
  } catch (error) {
    Logger.log(`extractPersonalDataFromCacheエラー: ${error.message}`);
    return { myBookings: [], myHistory: [] };
  }
}
```

## 5. 実施タイミング

本計画書のタスクは、`COMPREHENSIVE_REFACTORING_PLAN.md` に記載されたフェーズ1〜3の**すべてが完了した後**に着手することを推奨する。

現在、該当するリファクタリングは完了済みであることを確認済み。

### 実施順序

1. **フェーズ1** - ヘルパー関数実装（影響範囲：なし）
2. **フェーズ2** - 既存コード置き換え（影響範囲：中、テスト必須）
3. **追加改善** - データ変換・ヘッダーアクセス統一（影響範囲：小）

---

**作成日**: 2025-08-29  
**更新日**: 2025-08-29
