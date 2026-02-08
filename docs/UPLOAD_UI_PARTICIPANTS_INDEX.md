# 画像アップロードUI向け「参加者候補インデックス」仕様（AI向け）

## 目的

- 作品写真アップロードUI（静的サイト）で、写真の EXIF 撮影日（`YYYY-MM-DD`）から「当日の参加者候補（生徒）」「教室/会場候補」を**即応**で提示する。
- ブラウザからスプレッドシート/GAS/Notionへ直接問い合わせしない（遅い・トークン秘匿不可・CORS/認証の運用が重い）ため、事前生成された JSON を取得して参照する。

## データ取得方針（重要）

- UIは `participants_index.json` を **HTTP(S) で取得**して使う。
- UIコード内にトークン等の秘匿情報は持たない。
- 認証は Cloudflare Access（ブラウザログイン）で行う前提（推奨）。

## エンドポイント（UIが叩くのはGETのみ）

- `GET /participants-index`
  - レスポンス: `application/json`
  - 失敗例:
    - 401/403: Cloudflare Access 未認証
    - 404: 未生成/未配置
    - 5xx: Worker側エラー

推奨運用:

- 静的UI自体も Cloudflare Access 配下に置く（同一サイト化）
  - Access の Cookie が「ファーストパーティ」になり、`fetch` が安定しやすい（ブラウザの 3rd-party cookie 制限回避）。

## JSON仕様（確定）

### 例

```json
{
  "generated_at": "2026-02-04T12:34:56+09:00",
  "timezone": "Asia/Tokyo",
  "source": {
    "reservations_cache_version": 1738640000000
  },
  "dates": {
    "2026-02-02": [
      {
        "lesson_id": "LESSON_UUID",
        "classroom": "東京教室",
        "venue": "浅草橋",
        "participants": [
          { "student_id": "user_xxx", "display_name": "けい" },
          { "student_id": "user_yyy", "display_name": "大山勝子" }
        ]
      }
    ]
  }
}
```

### 型（TypeScript）

```ts
export type ParticipantsIndex = {
  generated_at: string;
  timezone: string; // "Asia/Tokyo"
  source: { reservations_cache_version: number | null };
  dates: Record<string /* YYYY-MM-DD */, ParticipantsIndexGroup[]>;
};

export type ParticipantsIndexGroup = {
  lesson_id: string; // 空文字の可能性あり（UIは表示に依存しないこと）
  classroom: string;
  venue: string;
  participants: ParticipantsIndexParticipant[];
};

export type ParticipantsIndexParticipant = {
  student_id: string;
  display_name: string;
};
```

### 並び順（UIが前提にしてよい）

- `groups` は `classroom -> venue -> lesson_id` でソート済み
- `participants` は `display_name -> student_id` でソート済み
- `participants` は `student_id` で重複排除済み（同一生徒が複数予約にいても1回だけ出る）

### データ範囲（UI設計に影響）

- `dates` に含まれるのは **過去730日〜未来60日** のみ
  - 範囲外/一致なしの場合は「候補なし（手動入力）」へフォールバックする

## UI処理フロー（必須要件）

1. 起動時（またはアップロード画面表示時）に `GET /participants-index` を **1回だけ fetch** してメモリに保持
2. ユーザーが画像を選択
3. EXIFから撮影日を抽出して `YYYY-MM-DD` を得る（無い場合は手動日付入力へ）
4. `index.dates[ymd]` を参照
5. 候補UIを表示
   - groups が 0件: 「候補なし」+ 手動入力
   - groups が 1件: その `participants` を候補表示
   - groups が 複数件: まず「教室/会場（必要ならレッスン）」を選ばせ、その `participants` を候補表示

## EXIF日付の扱い（推奨）

- EXIFはカメラのローカル時刻でタイムゾーン情報が無いことが多い
  - 原則「撮影日（ローカル想定）」として `YYYY-MM-DD` を作る
- EXIFが無い場合のフォールバック
  - `file.lastModified` から日付推定（精度低）または手動入力を必須にする

### `YYYY-MM-DD` を作る例（Asia/Tokyo固定にしたい場合）

```js
function toYmdInTokyo(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}
```

## fetch実装の注意

- 同一オリジン運用（推奨）の場合:

```js
const res = await fetch('/participants-index', { cache: 'no-store' });
```

- 別オリジン + Access の Cookie が必要な運用の場合（構成次第で必要）:

```js
const res = await fetch('https://<worker-domain>/participants-index', {
  credentials: 'include',
});
```

注記:

- Access を別オリジンに置くと Cookie が「サードパーティ扱い」になり、ブラウザによって失敗しうるため、同一サイト化が推奨。

## エラー時UX（最低限）

- 取得失敗: 「候補取得に失敗」+ リトライボタン + 手動入力
- 403/401: 「認証が必要」表示（UI自体を Access 配下にするなら通常起きにくい）
- JSONパース失敗: 同上（手動入力へ）

## 個人情報の扱い

- JSONは `student_id` と `display_name` のみ（それ以外は含めない想定）
- UI側で長期永続（`localStorage` 等）しないのが安全（必要なら短期キャッシュのみ）

## 生成・更新の仕組み（参考：UI側は意識不要）

- `participants_index.json` はGASが「予約キャッシュ/生徒キャッシュ」から生成し、Cloudflare WorkerへPOSTしてR2に保存する運用。
- UIは常に `GET /participants-index` で取得する（頻度は 1セッション1回で十分）。
