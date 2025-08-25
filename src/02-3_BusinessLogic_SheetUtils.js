/**
 * =================================================================
 * 【ファイル名】: 02-3_BusinessLogic_SheetUtils.gs
 * 【バージョン】: 2.0
 * 【役割】: 予約シートや名簿シートを操作するための、より汎用的な
 * ヘルパー関数群を集約します。
 * - シートのソート、再採番、罫線描画
 * - データの自動入力や同期
 * 【v2.0での変更点】:
 * - フェーズ1リファクタリング: 統一定数ファイル（00_Constants.js）から定数を参照
 * - 旧定数（TOKYO_CLASSROOM_NAME等）を統一定数（CONSTANTS.CLASSROOMS.TOKYO等）に移行
 * 【v1.5での変更点】:
 * - NF-12: 指定された生徒IDの将来の予約情報を集約し、名簿シートのキャッシュを更新する
 * _updateFutureBookingsCache() 関数を新設。
 * =================================================================
 */

/**
 * メニューからアクティブシートの罫線を手動で再描画する。
 */
function manuallyFormatActiveSheet() {
  const sheet = getActiveSpreadsheet().getActiveSheet();
  formatSheetWithBordersSafely(sheet);
}
