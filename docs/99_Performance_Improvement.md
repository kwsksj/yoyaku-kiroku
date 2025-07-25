# WebApp「きぼりの よやく・きろく」速度改善策まとめ

## 1. 通信回数・データ量の削減

- 初期化・画面遷移時は `getInitialWebApp_Data` で必要なデータを一括取得。
- 予約・キャンセル・編集時は差分のみ返却し、全データ再取得を避ける。
- サマリーや履歴など、画面表示に必須でないデータは非同期取得。

## 2. キャッシュ列の活用

- 生徒名簿の「よやくキャッシュ」「きろくキャッシュ」列を活用し、毎回シート全体をスキャンしない。
- 予約・キャンセル・編集時は `_updateFutureBookingsCacheIncrementally` で差分のみキャッシュ更新。
- バッチ処理（メニューから実行）で全キャッシュを一括更新可能。

## 3. サマリーシートの利用

- 予約枠情報はサマリーシートから取得し、各予約シートの全スキャンを回避。
- サマリー更新は予約・キャンセル時のみ部分更新。

## 4. フロントエンドの工夫

- 画面遷移時に必要なデータのみ取得し、不要な再取得を避ける。
- 予約・キャンセル後は、必要な部分だけ再描画。

## 5. バックエンド関数の最適化

- 予約IDや生徒IDで直接行を特定する `findRowIndexByValue` を活用し、検索範囲を最小化。
- シート全体のスキャンはバッチ処理時のみ実施。

## 6. バッチ処理の分離

- 重い処理（全キャッシュ更新・履歴生成）はメニューから手動実行に限定。
- 通常のWebApp操作時は差分更新のみ。

---

### 参考: 実装済みの主な改善ポイント

- `getInitialWebApp_Data` … 初期データ一括取得
- `_updateFutureBookingsCacheIncrementally` … 差分キャッシュ更新
- サマリーシート … 予約枠情報の高速取得
- バッチ処理 … キャッシュ・履歴の一括生成

---

## まとめ

- 「初期化時・画面遷移時はバッチ取得」「予約・編集時は差分更新」「キャッシュ列・サマリーシートを活用」「不要な再取得を避ける」ことで、通信回数・データ量を減らし、WebAppの体感速度を大幅に改善できます。
