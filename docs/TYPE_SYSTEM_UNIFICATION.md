# 型システム統一計画

**バージョン**: 1.0 **作成日**: 2025-10-03 **ステータス**: 計画中

---

## 📋 目次

1. [背景と問題点](#背景と問題点)
2. [現状分析](#現状分析)
3. [統一設計方針](#統一設計方針)
4. [実装計画](#実装計画)
5. [メリット・デメリット](#メリットデメリット)
6. [AI駆動開発における型管理](#ai駆動開発における型管理)
7. [今後の運用ガイドライン](#今後の運用ガイドライン)

---

## 背景と問題点

### 問題の概要

本プロジェクトにおいて、予約・ユーザー・会計関連のデータ型が**複数の異なる定義で重複**しており、以下の深刻な問題が発生しています：

- **型の重複**: 同じ概念を表す型が5種類以上存在
- **型安全性の崩壊**: `any`, `[key: string]: unknown` の乱用
- **保守性の低下**: 型定義が散在し、変更が困難
- **バグの温床**: プロパティ名の不一致やnull/undefined処理の不統一

### 発生原因

**AI駆動開発の典型的なパターン**:

1. **コンテキスト不足による重複作成**: AIは既存の型を見落として新規作成
2. **局所最適化**: 「この関数だけ動けば良い」という短期的な視点
3. **応急処置の積み重ね**: 型エラーを`any`で「とりあえず消す」
4. **命名の揺れ**: 同じ概念に対する異なる命名パターン

**人間開発でも類似の問題は発生するが**:

- 発生速度が遅い（数ヶ月〜年単位）
- コードレビューで気づく機会がある
- チーム間のコミュニケーション不足が主因

---

## 現状分析

### 1. 予約関連型の重複（5種類）

#### 重複する型定義

| 型名                   | 定義場所              | 用途                                 | 問題点                 |
| ---------------------- | --------------------- | ------------------------------------ | ---------------------- |
| `ReservationArrayData` | gas-environment.d.ts  | Sheets生データ（配列）               | プリミティブ型の配列   |
| `RawReservationObject` | gas-environment.d.ts  | Sheets生データ（オブジェクト化直後） | 全プロパティoptional   |
| `ReservationObject`    | gas-environment.d.ts  | バックエンド内部処理用               | 正規化済みだが限定的   |
| `Reservation`          | api-types.d.ts        | API通信用                            | シンプルすぎて情報不足 |
| `ReservationData`      | html-environment.d.ts | フロントエンド用                     | 動的プロパティ多数     |

#### コード例

```typescript
// api-types.d.ts
interface Reservation {
  reservationId: string;
  studentId: string;
  date: string | Date;
  classroom: string;
  startTime?: string;
  endTime?: string;
  status: string;
  firstLecture?: boolean;
}

// html-environment.d.ts
interface ReservationData {
  reservationId: string;
  classroom: string;
  date: string;
  venue?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  studentId?: string;
  // ... 20個以上のプロパティ
  [key: `material${string}`]: string | number | undefined;
  [key: `otherSales${string}`]: string | number | undefined;
}
```

#### 弊害

- 🔄 データの流れごとに頻繁な型変換が必要
- ⚠️ 型キャストの多用により型チェックが機能しない
- 🐛 プロパティ名の不一致（`message` vs `messageToTeacher`）
- 📈 同じデータを表す複数の型定義を維持する負担

---

### 2. ユーザー関連型の重複（5種類以上）

#### 重複する型定義

| 型名                      | 定義場所              | 用途                 | 問題点                   |
| ------------------------- | --------------------- | -------------------- | ------------------------ |
| `UserInfo`                | api-types.d.ts        | API通信用（最小限）  | プロパティが3つのみ      |
| `UserData`                | html-environment.d.ts | フロントエンド用     | 10個のプロパティ         |
| `UserProfileUpdate`       | api-types.d.ts        | 更新用（全optional） | 20個以上のプロパティ     |
| `UserDetailForEdit`       | api-types.d.ts        | 編集用（全required） | 必須/オプションが不統一  |
| `NewUserRegistration`     | api-types.d.ts        | 新規登録用           | 16個のプロパティ         |
| `UserProfileUpdateResult` | gas-environment.d.ts  | 更新結果用           | `[key: string]: unknown` |

#### コード例

```typescript
// api-types.d.ts
interface UserInfo {
  studentId: string;
  displayName: string;
  realName: string;
}

interface UserProfileUpdate {
  studentId?: string;
  displayName?: string;
  phone?: string;
  realName?: string;
  nickname?: string;
  email?: string;
  // ... 20個以上のプロパティ（全てoptional）
}

interface UserDetailForEdit {
  studentId: string;
  realName: string;
  nickname: string;
  phone: string;
  email: string;
  // ... 12個のプロパティ（全て必須）
}

// gas-environment.d.ts
interface UserProfileUpdateResult {
  updatedUser: {
    studentId: string;
    displayName: string;
    realName: string;
    phone: string;
    [key: string]: unknown; // 型安全性の崩壊
  };
}
```

#### 弊害

- 🔀 同じユーザーデータなのに5種類の型を使い分ける混乱
- ⚠️ 必須/オプションの不統一（`nickname?: string` vs `nickname: string`）
- 🚫 `[key: string]: unknown` による型安全性の完全喪失
- 📝 どの型を使うべきか判断に迷う

---

### 3. 会計関連型の重複（5種類以上）

#### 重複する型定義

| 型名                          | 定義場所              | 用途                 | 問題点                   |
| ----------------------------- | --------------------- | -------------------- | ------------------------ |
| `AccountingDetailsPayload`    | api-types.d.ts        | API送信用            | 構造が複雑               |
| `AccountingUserInput`         | api-types.d.ts        | ユーザー入力         | 明確な構造               |
| `AccountingDetails`           | api-types.d.ts        | 計算結果             | -                        |
| `AccountingCalculationResult` | accounting.d.ts       | 計算結果（重複）     | 完全に重複               |
| `AccountingFormData`          | accounting.d.ts       | フォーム用           | `breakTime: number`      |
| `AccountingFormData`          | html-environment.d.ts | フォーム用（重複）   | `breakTime: string`      |
| `AccountingPayload`           | accounting.d.ts       | 送信用               | `userInput: any`         |
| `AccountingPayload`           | gas-environment.d.ts  | 送信用（重複）       | `[key: string]: unknown` |
| `AccountingSubmissionPayload` | html-environment.d.ts | 送信用（さらに重複） | 詳細構造                 |

#### コード例

```typescript
// api-types.d.ts
interface AccountingDetails {
  tuition: {
    items: Array<{ name: string; price: number }>;
    subtotal: number;
  };
  sales: {
    items: Array<{ name: string; price: number }>;
    subtotal: number;
  };
  grandTotal: number;
  paymentMethod: string;
}

// accounting.d.ts - 完全に重複
interface AccountingCalculationResult {
  tuition: {
    items: Array<{ name: string; price: number }>;
    subtotal: number;
  };
  sales: {
    items: Array<{ name: string; price: number }>;
    subtotal: number;
  };
  grandTotal: number;
  paymentMethod: string;
}

// accounting.d.ts
interface AccountingFormData {
  breakTime?: number; // ← number
  // ...
}

// html-environment.d.ts - 同名だが異なる定義
interface AccountingFormData {
  breakTime?: string; // ← string
  // ...
  [key: string]: any; // 型安全性の崩壊
}

// accounting.d.ts
interface AccountingPayload {
  reservationId: string;
  classroom: string;
  studentId: string;
  userInput: any; // ← 型安全性ゼロ
  updateStatus?: boolean;
}

// gas-environment.d.ts - さらに別定義
interface AccountingPayload {
  studentId: string;
  reservationId?: string;
  classroom?: string;
  userInput?: Record<string, unknown>;
  [key: string]: unknown; // 危険
}
```

#### 弊害

- 🔁 **完全重複**: `AccountingDetails` ≒ `AccountingCalculationResult`
- ⚠️ **同名異型**: `AccountingFormData` が2箇所で異なる定義（`breakTime`の型が違う）
- 🚫 **型安全性の崩壊**: `userInput: any`, `[key: string]: unknown`
- 📍 **3重の重複**: `AccountingPayload` が3箇所で異なる定義

---

### 4. キャンセル処理型の重複（3種類）

```typescript
// api-types.d.ts
interface CancelReservationInfo {
  reservationId: string;
  classroom: string;
  studentId: string;
  cancelMessage?: string;
}

// gas-environment.d.ts
interface CancelInfo {
  studentId: string;
  [key: string]: unknown; // 極めて緩い型
}

// html-environment.d.ts
interface CancelReservationData extends ActionHandlerData {
  reservationId: string;
  classroom: string;
  date: string; // ← api-types.d.tsにはない
  studentId: string;
  cancelMessage?: string;
}
```

---

## 統一設計方針

### 設計哲学：ドメイン駆動設計 (DDD)

```
Core Domain Models (コアドメイン型)
  ↓ 継承・拡張
Operation-Specific DTOs (操作別データ転送型)
```

### 型の3層構造

```
[Layer 1] RawSheetData (配列)
    ↓ 変換1回のみ
[Layer 2] Core型 (統一オブジェクト) ← 全処理でこれを使用
    ↓ 必要に応じて
[Layer 3] DTO型 (操作別特化型)
```

### ディレクトリ構造

```
types/
├── core/                    # Core型定義（Layer 2）
│   ├── reservation-core.d.ts
│   ├── user-core.d.ts
│   ├── accounting-core.d.ts
│   └── index.d.ts
├── dto/                     # DTO型定義（Layer 3）
│   ├── reservation-dto.d.ts
│   ├── user-dto.d.ts
│   ├── accounting-dto.d.ts
│   └── index.d.ts
├── gas-environment.d.ts     # GAS環境型（Layer 1を含む）
├── html-environment.d.ts    # フロントエンド環境型
└── api-types.d.ts           # 既存API型（段階的に廃止）
```

---

## 統一型定義

### 1. 予約関連型

#### Core型

```typescript
/**
 * 予約データの統一コア型
 * - バックエンド・フロントエンド共通
 * - 全処理でこの型を使用する
 */
interface ReservationCore {
  // === 必須プロパティ ===
  reservationId: string;
  studentId: string;
  classroom: string;
  date: string; // YYYY-MM-DD
  status: string; // CONSTANTS.STATUSの値

  // === 基本オプション ===
  venue?: string;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm

  // === 予約オプション ===
  chiselRental?: boolean;
  firstLecture?: boolean;
  workInProgress?: string;
  materialInfo?: string;
  order?: string;
  messageToTeacher?: string;

  // === 会計関連 ===
  accountingDetails?: AccountingDetailsCore | null;
  discountApplied?: boolean | string;
  計算時間?: number;
  breakTime?: number;

  // === 動的プロパティ（material/otherSales系） ===
  [key: `material${string}`]: string | number | undefined;
  [key: `otherSales${string}`]: string | number | undefined;
}
```

#### DTO型

```typescript
/** Sheets生データ（変換前） */
type RawSheetRow = Array<string | Date | boolean | number | null>;

/** 予約作成リクエスト（IDなし） */
interface ReservationCreateDto extends Omit<ReservationCore, 'reservationId' | 'status'> {
  user: UserInfoDto;
}

/** 予約更新リクエスト */
interface ReservationUpdateDto extends Pick<ReservationCore, 'reservationId' | 'classroom' | 'studentId' | 'startTime' | 'endTime' | 'chiselRental' | 'firstLecture' | 'workInProgress' | 'materialInfo' | 'order' | 'messageToTeacher'> {}

/** 予約キャンセルリクエスト */
interface ReservationCancelDto {
  reservationId: string;
  classroom: string;
  studentId: string;
  date: string; // 検証用
  cancelMessage?: string;
}

/** API応答用（軽量版） */
type ReservationApiDto = Pick<ReservationCore, 'reservationId' | 'studentId' | 'classroom' | 'date' | 'status' | 'venue' | 'startTime' | 'endTime' | 'chiselRental' | 'firstLecture'>;
```

#### 変換関数

```typescript
/**
 * Sheets生データ → ReservationCore に変換（1箇所のみ）
 */
function convertRowToReservation(row: RawSheetRow, headerMap: HeaderMapType): ReservationCore {
  return {
    reservationId: row[headerMap['予約ID']] || '',
    studentId: row[headerMap['生徒ID']] || '',
    classroom: row[headerMap['教室']] || '',
    date: formatDate(row[headerMap['日付']]),
    status: row[headerMap['ステータス']] || '',
    venue: row[headerMap['会場']] || undefined,
    startTime: formatTime(row[headerMap['開始時刻']]),
    endTime: formatTime(row[headerMap['終了時刻']]),
    chiselRental: Boolean(row[headerMap['彫刻刀レンタル']]),
    firstLecture: Boolean(row[headerMap['初回講座']]),
    workInProgress: row[headerMap['制作メモ']] || undefined,
    materialInfo: row[headerMap['材料情報']] || undefined,
    order: row[headerMap['注文']] || undefined,
    messageToTeacher: row[headerMap['先生へのメッセージ']] || undefined,
    // ... その他のプロパティ
  };
}

/**
 * ReservationCore → Sheets行データに変換（書き込み時）
 */
function convertReservationToRow(reservation: ReservationCore, headerMap: HeaderMapType): RawSheetRow {
  const row: RawSheetRow = new Array(Object.keys(headerMap).length);
  row[headerMap['予約ID']] = reservation.reservationId;
  row[headerMap['生徒ID']] = reservation.studentId;
  row[headerMap['教室']] = reservation.classroom;
  row[headerMap['日付']] = reservation.date;
  row[headerMap['ステータス']] = reservation.status;
  // ... その他のマッピング
  return row;
}
```

---

### 2. ユーザー関連型

#### Core型

```typescript
/**
 * ユーザーデータの統一コア型
 */
interface UserCore {
  studentId: string;
  phone: string;
  realName: string;
  displayName: string;
  nickname?: string;
  email?: string;
  wantsEmail?: boolean;
  wantsScheduleNotification?: boolean;
  notificationDay?: number;
  notificationHour?: number;
  ageGroup?: string;
  gender?: string;
  dominantHand?: string;
  address?: string;
  experience?: string;
  pastWork?: string;
  futureParticipation?: string;
  futureCreations?: string;
}
```

#### DTO型

```typescript
/** 新規ユーザー登録リクエスト（IDなし） */
interface UserRegistrationDto extends Omit<UserCore, 'studentId' | 'displayName'> {
  phone: string; // 必須
  realName: string; // 必須
  trigger?: string; // 登録特有
  firstMessage?: string; // 登録特有
}

/** ユーザー情報更新リクエスト（部分更新） */
type UserUpdateDto = Partial<UserCore> & {
  studentId: string; // IDは必須
};

/** API通信用（最小限） */
interface UserInfoDto {
  studentId: string;
  displayName: string;
  realName: string;
}

/** プロフィール編集画面用（全フィールド表示） */
type UserProfileDto = UserCore;
```

---

### 3. 会計関連型

#### Core型

```typescript
/**
 * 会計詳細（計算結果）
 */
interface AccountingDetailsCore {
  tuition: {
    items: Array<{ name: string; price: number }>;
    subtotal: number;
  };
  sales: {
    items: Array<{ name: string; price: number }>;
    subtotal: number;
  };
  grandTotal: number;
  paymentMethod: string;
}

/**
 * 会計マスターアイテム
 */
interface AccountingMasterItemCore {
  種別: string;
  項目名: string;
  対象教室: string;
  単価: number;
  単位: string;
  備考?: string;
}
```

#### DTO型

```typescript
/**
 * 会計フォーム入力データ
 */
interface AccountingFormDto {
  paymentMethod: string;

  // 時間ベース授業料（該当する場合）
  timeBased?: {
    startTime: string;
    endTime: string;
    breakMinutes: number;
    discountApplied: boolean;
  };

  // 授業料項目（チェックボックス選択）
  tuitionItems?: string[];

  // 物販・材料費
  salesItems?: Array<{
    name: string;
    price?: number;
  }>;

  // 材料費（体積計算用）
  materials?: Array<{
    type: string;
    l?: number;
    w?: number;
    h?: number;
  }>;

  // 作業メモ
  workInProgress?: string;
}

/**
 * 会計詳細保存リクエスト
 */
interface AccountingSaveDto {
  reservationId: string;
  classroom: string;
  studentId: string;
  userInput: AccountingFormDto;
  updateStatus?: boolean; // ステータスを「完了」に変更するか
}
```

---

## 実装計画

### Phase 1: Core型定義の作成 ✅

**期間**: 1日

1. `types/core/` ディレクトリを新規作成
2. 以下のファイルを作成：
   - `reservation-core.d.ts` - 予約関連のCore型
   - `user-core.d.ts` - ユーザー関連のCore型
   - `accounting-core.d.ts` - 会計関連のCore型
   - `index.d.ts` - 統合エクスポート

**成果物**:

- 統一されたCore型定義
- 既存コードへの影響なし（並行稼働）

---

### Phase 2: DTO型定義の作成 🔄

**期間**: 1-2日

3. `types/dto/` ディレクトリを新規作成
4. 以下のファイルを作成：
   - `reservation-dto.d.ts` - 予約操作用DTO
   - `user-dto.d.ts` - ユーザー操作用DTO
   - `accounting-dto.d.ts` - 会計操作用DTO
   - `index.d.ts` - 統合エクスポート

**成果物**:

- 操作別に最適化されたDTO型定義
- API通信・フォーム入力・データ保存の明確な分離

---

### Phase 3: バックエンドの段階的移行 🔄

**期間**: 3-5日

5. **変換関数の実装** (`08_Utilities.js`)
   - `convertRowToReservation()`
   - `convertReservationToRow()`
   - `convertRowToUser()`
   - その他変換関数

6. **予約処理の移行** (`05-2_Backend_Write.js`)
   - 予約作成: `ReservationCreateDto` → `ReservationCore`
   - 予約更新: `ReservationUpdateDto` → `ReservationCore`
   - 予約キャンセル: `ReservationCancelDto` → `ReservationCore`

7. **ユーザー処理の移行** (`04_Backend_User.js`)
   - ユーザー登録: `UserRegistrationDto` → `UserCore`
   - プロフィール更新: `UserUpdateDto` → `UserCore`

8. **空き状況API** (`05-3_Backend_AvailableSlots.js`)
   - 予約一覧取得: `ReservationCore[]` → `ReservationApiDto[]`

9. **キャッシュシステム** (`07_CacheManager.js`)
   - キャッシュデータ型を `ReservationCore[]` に統一
   - 差分更新関数の型定義を更新

**成果物**:

- バックエンド全体が統一型を使用
- 型キャストの削減
- 型安全性の向上

---

### Phase 4: フロントエンドの段階的移行 🎨

**期間**: 3-5日

10. **状態管理の移行** (`12_WebApp_StateManager.js`)
    - `myReservations: ReservationCore[]`
    - `currentUser: UserCore`
    - `accountingReservation: ReservationCore | null`

11. **予約ハンドラーの移行** (`14_WebApp_Handlers_Reservation.js`)
    - 予約作成フォーム: `ReservationCreateDto`
    - 予約更新フォーム: `ReservationUpdateDto`
    - 予約キャンセル: `ReservationCancelDto`

12. **認証ハンドラーの移行** (`14_WebApp_Handlers_Auth.js`)
    - ユーザー登録: `UserRegistrationDto`
    - プロフィール編集: `UserUpdateDto`

13. **会計画面の移行** (`13_WebApp_Views_Accounting.js`)
    - フォーム入力: `AccountingFormDto`
    - 保存処理: `AccountingSaveDto`

**成果物**:

- フロントエンド全体が統一型を使用
- UIとロジックの型整合性確保

---

### Phase 5: 旧型定義のクリーンアップ 🧹

**期間**: 1-2日

14. **非推奨マーク**
    - 旧型定義に `@deprecated` コメント追加
    - 新しい型への移行ガイドをコメントに記載

15. **旧型定義の削除**
    - 移行完了後、旧型定義を削除
    - 未使用型のチェック: `npx ts-unused-exports`

16. **品質チェック**
    - 型チェック: `npm run check-types`
    - リント: `npm run lint`
    - テスト実行: `npm run dev:test`

17. **ドキュメント更新**
    - `DATA_MODEL.md` の型定義セクション更新
    - `TYPES_GUIDE.md` 新規作成（型使用ガイドライン）

**成果物**:

- クリーンな型システム
- 包括的なドキュメント

---

### マイルストーン

| Phase    | 期間       | 成果物             | 動作確認         |
| -------- | ---------- | ------------------ | ---------------- |
| Phase 1  | 1日        | Core型定義         | 型チェックのみ   |
| Phase 2  | 1-2日      | DTO型定義          | 型チェックのみ   |
| Phase 3  | 3-5日      | バックエンド移行   | GASテスト環境    |
| Phase 4  | 3-5日      | フロントエンド移行 | WebAppテスト     |
| Phase 5  | 1-2日      | クリーンアップ     | 包括的テスト     |
| **合計** | **9-15日** | **統一型システム** | **本番デプロイ** |

---

## メリット・デメリット

### ✅ メリット

#### 1. 型安全性の劇的向上

- `any`, `[key: string]: unknown` の完全排除
- TypeScriptの型推論が正常に機能
- コンパイル時のエラー検出率向上

#### 2. 開発体験の向上

- IDEの補完機能が正確に動作
- リファクタリング時の影響範囲が明確
- 型エラーで問題箇所が即座に分かる

#### 3. 保守性の改善

- 型定義が1箇所に集約
- 変更時の影響範囲が限定的
- ドキュメントとしての役割

#### 4. バグの削減

- プロパティ名の不一致がなくなる
- null/undefined処理の統一
- 型の不整合によるランタイムエラーの防止

#### 5. パフォーマンス向上

- 不要な型変換処理の削減
- データの流れが明確化
- キャッシュ戦略の最適化

#### 6. 自己文書化

- 型定義自体がAPIドキュメント
- コードの意図が明確
- 新規参加者のオンボーディング容易化

---

### ⚠️ デメリット・リスク

#### 1. 移行コスト

- **影響範囲**: 約20-30ファイル
- **所要時間**: 9-15日
- **テスト負荷**: 全機能の動作確認が必須

#### 2. 一時的な複雑度増加

- 移行期間中に新旧型が混在
- 開発者の混乱の可能性
- デバッグの難易度上昇

#### 3. 学習コスト

- 新しい型システムの理解が必要
- Core型とDTO型の使い分けルール
- 変換関数の使用方法

#### 4. 後戻りの困難さ

- 一度移行を開始すると中断が困難
- 段階的な移行計画が必須
- バックアップ戦略の重要性

---

### 🛡️ リスク軽減策

#### 1. 段階的移行

- Phase単位で完結させる
- 各Phase終了時に動作確認
- 問題発生時はロールバック

#### 2. 旧型の一時的維持

- `@deprecated` でマーク
- 一定期間は旧型も並行稼働
- 段階的な削除

#### 3. 包括的テスト

- 各Phase完了時に機能テスト
- テスト環境での十分な検証
- 本番デプロイ前の最終確認

#### 4. ドキュメント充実

- 型システム使用ガイド作成
- 移行手順の詳細記録
- トラブルシューティング

#### 5. バックアップ

- Git tagで各Phase完了時点を記録
- `git revert` 可能な状態維持
- テストブランチでの先行実施

---

## AI駆動開発における型管理

### AI駆動開発の特性

#### 型定義が混乱しやすい理由

1. **コンテキスト制約**
   - AIは過去の全コードを常に把握していない
   - 既存の型を見落として新規作成してしまう

2. **局所最適化**
   - 「この関数だけ動けば良い」という短期的視点
   - システム全体の一貫性を見失う

3. **応急処置の積み重ね**
   - 型エラーを`any`で「とりあえず消す」
   - 長期的な型安全性より短期的な動作を優先

4. **命名の揺れ**
   - 同じ概念に対する異なる命名パターン
   - `UserInfo` / `UserData` / `UserCore` の混在

#### 発生速度の比較

| 開発形態       | 混乱の発生速度             | 主な原因                           | 気づきやすさ           |
| -------------- | -------------------------- | ---------------------------------- | ---------------------- |
| **AI駆動**     | **非常に速い**（数週間）   | コンテキスト制約・局所最適化       | 気づきにくい           |
| **人間チーム** | 比較的緩やか（数ヶ月〜年） | 時間的制約・コミュニケーション不足 | コードレビューで気づく |

---

### 対策：型システム健全性の維持

#### 1. 定期的な「型システム健康診断」

**実施頻度**: 月1回または大きな機能追加後

```bash
# 型定義の重複を検出
echo "=== 予約関連型 ==="
grep -r "interface.*Reservation" types/ | wc -l
grep -r "type.*Reservation" types/ | wc -l

echo "=== ユーザー関連型 ==="
grep -r "interface.*User" types/ | wc -l
grep -r "type.*User" types/ | wc -l

echo "=== 会計関連型 ==="
grep -r "interface.*Accounting" types/ | wc -l
grep -r "type.*Accounting" types/ | wc -l

# 危険なパターンを検出
echo "=== 危険な型定義 ==="
grep -r ": any" types/
grep -r "\[key: string\]: unknown" types/
```

**閾値設定**:

- 同じ概念の型が**3つ以上**: 要整理
- `any` の使用箇所が**5箇所以上**: 要リファクタリング

---

#### 2. 型定義の「憲法」を作成

**ファイル**: `TYPES_GUIDE.md`

```markdown
# 型定義ガイドライン

## 命名規則

### Core型

- 形式: `XXXCore`
- 例: `ReservationCore`, `UserCore`, `AccountingDetailsCore`
- 用途: アプリケーション全体で共通使用

### DTO型

- 形式: `XXXDto` または `XXXXXXDto`
- 例: `ReservationCreateDto`, `UserUpdateDto`
- 用途: 特定の操作に特化

### 禁止事項

- `any` の使用（例外: サードパーティAPI連携時のみ）
- `[key: string]: unknown` の使用（特定の動的プロパティ以外）
- 同じ概念に対する複数の型定義

## 型の配置

- **Core型**: `types/core/`
- **DTO型**: `types/dto/`
- **環境固有型**: `types/gas-environment.d.ts`, `types/html-environment.d.ts`

## 新しい型を作る前の確認

1. `grep -r "interface XXX" types/` で既存型を検索
2. 既存の型で表現できる場合は再利用
3. 継承・拡張で対応できないか検討
4. 新規作成が必要な場合のみ作成

## コードレビューチェックリスト

- [ ] 重複する型定義がないか
- [ ] `any` や `unknown` を使用していないか
- [ ] 命名規則に従っているか
- [ ] 適切なディレクトリに配置されているか
```

---

#### 3. AIへの明示的な指示

**プロジェクト指示（`CLAUDE.md`）に追加**:

````markdown
## 型定義の絶対ルール

🚨 **新しい型を作る前に必ず確認**:

1. **既存型の検索**
   ```bash
   grep -r "interface XXX" types/
   grep -r "type XXX" types/
   ```
````

2. **再利用の検討**
   - 既存の型で表現できる場合は再利用
   - 継承・拡張で対応: `extends`, `Pick`, `Omit`, `Partial`

3. **命名規則の遵守**
   - Core型: `XXXCore`
   - DTO型: `XXXDto`

🚨 **禁止事項**:

- ❌ `any` の使用（例外: サードパーティAPI連携のみ）
- ❌ `[key: string]: unknown` の使用（特定の動的プロパティ以外）
- ❌ 同じ概念に対する複数の型定義
- ❌ 型の重複作成

🚨 **型作成のフロー**:

```
既存型を検索
  ↓
存在する？
  ├─ Yes → 再利用または継承
  └─ No  → 命名規則に従って新規作成
            ↓
         適切なディレクトリに配置
            ↓
         index.d.ts にエクスポート追加
```

````

---

#### 4. 型定義の「大掃除」を定期実行

**タイミング**:
- メジャー機能完成後
- データモデル変更後
- 3ヶ月ごと

**作業内容**:

1. **重複型の統合**
   ```bash
   # 重複検出
   grep -r "interface Reservation" types/ | sort
````

2. **`any` / `unknown` の排除**

   ```bash
   # 危険箇所の特定
   grep -rn ": any" src/
   grep -rn "\[key: string\]: unknown" src/
   ```

3. **未使用型の削除**

   ```bash
   # 未使用エクスポートの検出
   npx ts-unused-exports tsconfig.json
   ```

4. **ドキュメント更新**
   - `TYPES_GUIDE.md` の見直し
   - 型定義の変更履歴を記録

---

### AI駆動開発の利点

**型システム整理における強み**:

1. **高速リファクタリング**
   - 人間なら数日かかる作業を数時間で完了
   - 一貫性のある変更を一度に適用

2. **網羅的な影響範囲分析**
   - 全ファイルを瞬時にスキャン
   - 変更の影響を即座に検出

3. **型システムとの相性**
   - 正解が明確な領域ではAIは非常に強力
   - 型定義の重複・不整合を確実に検出

4. **ドキュメント生成**
   - 型定義から自動的にドキュメント作成
   - 使用例・パターンの提示

---

## 今後の運用ガイドライン

### 型定義の作成ルール

#### 1. 新しい型を作る前の確認手順

```bash
# Step 1: 既存型の検索
grep -r "interface MyNewType" types/
grep -r "type MyNewType" types/

# Step 2: 類似の型を探す
grep -r "interface.*Core" types/core/
grep -r "interface.*Dto" types/dto/

# Step 3: 再利用・継承の検討
# 既存型で表現できないか確認
```

#### 2. 型の命名規則

| 種類          | 命名パターン   | 例                      | 用途                 |
| ------------- | -------------- | ----------------------- | -------------------- |
| Core型        | `XXXCore`      | `ReservationCore`       | アプリ全体で共通使用 |
| DTO型（作成） | `XXXCreateDto` | `ReservationCreateDto`  | 作成リクエスト       |
| DTO型（更新） | `XXXUpdateDto` | `ReservationUpdateDto`  | 更新リクエスト       |
| DTO型（API）  | `XXXApiDto`    | `ReservationApiDto`     | API応答              |
| 列挙型        | `XXXEnum`      | `ReservationStatusEnum` | 定数セット           |

#### 3. 型の配置ルール

```
types/
├── core/           # Core型（共通使用）
├── dto/            # DTO型（操作別）
├── enums/          # 列挙型（将来的に追加）
└── legacy/         # 旧型定義（非推奨、段階的削除）
```

---

### 型安全性のチェックリスト

#### コードレビュー時の確認項目

- [ ] **重複チェック**: 類似の型定義が既に存在しないか
- [ ] **命名規則**: Core型は`XXXCore`, DTO型は`XXXDto`に従っているか
- [ ] **配置**: 適切なディレクトリに配置されているか
- [ ] **型安全性**: `any`, `unknown`を不適切に使用していないか
- [ ] **エクスポート**: `index.d.ts`にエクスポートが追加されているか
- [ ] **ドキュメント**: JSDocコメントが記載されているか

#### 自動チェック

```bash
# 型チェック
npm run check-types

# 未使用型の検出
npx ts-unused-exports tsconfig.json

# 危険なパターンの検出
grep -r ": any" src/
grep -r "\[key: string\]: unknown" src/
```

---

### 型システムのメンテナンス

#### 月次レビュー（推奨）

**第1週: 型定義の棚卸し**

```bash
# 重複型の検出
./scripts/find-duplicate-types.sh

# 未使用型の検出
npx ts-unused-exports tsconfig.json
```

**第2週: 危険箇所の特定**

```bash
# any/unknownの使用箇所
grep -rn ": any" src/ > any-usage.txt
grep -rn "\[key: string\]: unknown" src/ > unknown-usage.txt
```

**第3週: リファクタリング**

- 重複型の統合
- `any`/`unknown`の排除
- 未使用型の削除

**第4週: ドキュメント更新**

- `TYPES_GUIDE.md` の見直し
- 型定義の変更履歴を記録

---

#### 四半期レビュー（必須）

1. **型システム全体の見直し**
   - 新しい型カテゴリの必要性
   - 命名規則の見直し
   - ディレクトリ構造の最適化

2. **パフォーマンス分析**
   - 型チェック時間の測定
   - ビルド時間への影響
   - 最適化の余地

3. **教育・ドキュメント**
   - 型システム使用ガイドの更新
   - ベストプラクティス集の作成
   - チーム内の知識共有

---

### 緊急時の対応

#### 型エラーが大量発生した場合

1. **原因の特定**

   ```bash
   npm run check-types 2>&1 | tee type-errors.log
   ```

2. **影響範囲の分析**
   - エラーが集中しているファイル/型を特定
   - 最近の変更履歴を確認

3. **ロールバック判断**
   - エラー数が50件以上: ロールバックを検討
   - 特定の型変更が原因: その変更のみrevert

4. **段階的修正**
   - 優先度の高いファイルから修正
   - 各修正後に型チェック実行
   - 動作確認を並行実施

---

## 参考資料

### 関連ドキュメント

- [DATA_MODEL.md](DATA_MODEL.md) - データモデル設計書
- [JS_TO_HTML_ARCHITECTURE.md](JS_TO_HTML_ARCHITECTURE.md) - ビルドアーキテクチャ
- `TYPES_GUIDE.md` - 型定義ガイドライン（本統一後に作成）

### TypeScript公式ドキュメント

- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html) - `Pick`, `Omit`, `Partial`など
- [Type Inference](https://www.typescriptlang.org/docs/handbook/type-inference.html) - 型推論
- [Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html) - 高度な型操作

### ベストプラクティス

- [DDD (Domain-Driven Design)](https://martinfowler.com/bliki/DomainDrivenDesign.html) - ドメイン駆動設計
- [DTO Pattern](https://martinfowler.com/eaaCatalog/dataTransferObject.html) - データ転送オブジェクト
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) - TypeScript詳解

---

## 変更履歴

| バージョン | 日付       | 変更内容 | 作成者      |
| ---------- | ---------- | -------- | ----------- |
| 1.0        | 2025-10-03 | 初版作成 | Claude Code |

---

## まとめ

### 現状の問題

- **予約型**: 5種類の重複型が存在
- **ユーザー型**: 5種類以上の重複型が存在
- **会計型**: 5種類以上の重複型が存在
- **型安全性**: `any`, `[key: string]: unknown` の乱用

### 統一後のメリット

- ✅ 型安全性の劇的向上
- ✅ 開発体験の改善（IDE補完、リファクタリング容易性）
- ✅ 保守性の向上（型定義の集約、変更容易性）
- ✅ バグの削減（型の不整合によるエラーの防止）
- ✅ 自己文書化（型定義がAPIドキュメント）

### 実装期間

**合計: 9-15日**

- Phase 1-2: 型定義作成（2-3日）
- Phase 3: バックエンド移行（3-5日）
- Phase 4: フロントエンド移行（3-5日）
- Phase 5: クリーンアップ（1-2日）

### 推奨判断

**強く推奨** - 以下の理由から、今が最適なタイミング：

1. データモデル統合が完了している
2. 型の混乱が臨界点に達している
3. 長期的な利益（開発速度向上、バグ削減）が大きい
4. AI駆動開発により高速な実装が可能

---

## ✅ 実装完了ステータス

### Phase 1-2: 型定義の作成 ✅ (2025-10-03 完了)

- ✅ Core型定義（types/core/）
  - reservation-core.d.ts
  - user-core.d.ts
  - accounting-core.d.ts
- ✅ DTO型定義（types/dto/）
  - reservation-dto.d.ts
  - user-dto.d.ts
  - accounting-dto.d.ts

### Phase 3: バックエンドの段階的移行 ✅ (2025-10-03 完了)

- ✅ (1/4) 変換関数の実装（08_Utilities.js）
  - convertRowToReservation() / convertReservationToRow()
  - convertRowToUser() / convertUserToRow()
- ✅ (2/4) 予約処理の型統一（05-2_Backend_Write.js v3.0）
  - makeReservation() → ReservationCreateDto
  - updateReservationDetails() → ReservationUpdateDto
  - cancelReservation() → ReservationCancelDto
- ✅ (3/4) ユーザー処理の型統一（04_Backend_User.js v4.0）
  - registerNewUser() → UserRegistrationDto
  - updateUserProfile() → UserUpdateDto
- ✅ (4/4) キャッシュシステムの準備（07_CacheManager.js v6.0）
  - 型参照の追加、将来の ReservationCore[] 移行準備

### Phase 4: フロントエンドの段階的移行 ⏭️ (スキップ)

フロントエンドは既存の型定義を継続使用。必要に応じて段階的に移行可能。

### Phase 5: 旧型定義のクリーンアップ ✅ (2025-10-03 完了)

- ✅ @deprecated マークの追加（api-types.d.ts）
  - ReservationInfo → ReservationCore
  - CancelReservationInfo → ReservationCancelDto
  - NewUserRegistration → UserRegistrationDto
  - UserProfileUpdate → UserUpdateDto

### Phase 6: 定数名とシート名の統一 ✅ (2025-10-03 完了)

#### 背景：AI駆動開発での「あるある」問題の発生

型システム統一の実装中に、**AIが既存の定数を確認せずに新しい定数名を使用**する問題が発生。
変換関数実装時に既存の `CONSTANTS.HEADERS.ROSTER` 定数名を見ずに、新しい名前で実装してしまった。

**これはまさに「AI駆動開発あるある」の実例**:
- 既存コードの確認不足
- 局所的な実装による命名の揺れ
- 結果として定数名が増殖

#### 実施した修正

**1. CONSTANTS.HEADERS.ROSTER の定数名統一**

IDEの一括置換機能を使用して、使用箇所を統一：

| ❌ 旧名称（削除） | ✅ 新名称（統一後） | シート列名 | 意味 |
|:---|:---|:---|:---|
| `EMAIL_PREFERENCE` | `WANTS_RESERVATION_EMAIL` | `'予約メール希望'` | 予約時のメール送信希望 |
| `SCHEDULE_NOTIFICATION_PREFERENCE` | `WANTS_SCHEDULE_INFO` | `'日程連絡希望'` | 日程通知の受信希望 |
| `WOODCARVING_EXPERIENCE` | `EXPERIENCE` | `'木彫り経験'` | 木彫り経験レベル |
| `PAST_CREATIONS` | `PAST_WORK` | `'過去の制作物'` | 過去の作品 |
| `FUTURE_PARTICIPATION` | `ATTENDANCE_INTENTION` | `'想定参加頻度'` | 今後の参加頻度 |

**2. UserCore型のプロパティ整理**

重複・不要なプロパティを削除：

- ❌ 削除: `futureGoal` (対応するシート列がない重複プロパティ)
- ✅ 保持: `futureParticipation` (ATTENDANCE_INTENTIONに対応)
- ✅ 保持: `futureCreations` (FUTURE_CREATIONSに対応)

**3. シート名の簡潔化**

実際のGoogleスプレッドシートのシート名も同時に変更：

| 変更前 | 変更後 | 理由 |
|:---|:---|:---|
| `'統合予約シート'` | `'予約記録'` | システム名「よやく・きろく」と整合、簡潔 |
| `'アクティビティログ'` | `'ログ'` | 簡潔に |
| `'日程マスタ'` | `'日程'` | 日程は追加されるので「マスタ」は不適切 |

**4. CONSTANTS.HEADERS.RESERVATIONS の拡張**

不足していたフィールドを追加：

- ✅ 追加: `MATERIAL_INFO: '材料情報'`

#### 教訓：AI開発での定数管理ベストプラクティス

**問題**: AIが変換関数実装時に既存の定数名を確認せず、新しい名前を使用
**誤った解決**: 定数側に別名追加（例: `WANTS_EMAIL` と `EMAIL_PREFERENCE` 両方定義）
**正しい解決**: 使用箇所を**IDEの一括置換**で統一

**重要な原則**:
1. **定数の「別名」を増やすことは根本解決にならない**
2. **使用箇所を正しい名前に統一**することで、将来の混乱を防ぐ
3. **人間がIDEで一括置換**した方が、AIが個別修正するより効率的で確実

**命名の方針**:
- `WANTS_*` パターンでboolean的な意味を明確化
- 文脈（ROSTER/RESERVATIONS）で意味が通じるなら短く
- コード内で使いやすい名前 ≠ シート列名（ユーザー向け）

## 🎉 型システム統一プロジェクト完了

**実装期間**: 2025-10-03（1日） **最終コミット**: feature/type-system-unification ブランチ

### 達成された成果

1. **型の重複削減**: 予約5種類 → 1 Core + 4 DTO
2. **型安全性の向上**: any/unknown の削減、明示的な型定義
3. **バックエンド型統一**: 主要関数すべて統一型対応
4. **後方互換性維持**: 旧形式も引き続き動作
5. **明確な移行パス**: @deprecated による段階的移行サポート
6. **定数名の統一**: CONSTANTS.HEADERS の命名規則統一、シート名の簡潔化

---

**次のステップ（任意）**:

- フロントエンドの段階的な型移行
- 旧型定義の完全削除（十分な移行期間後）
