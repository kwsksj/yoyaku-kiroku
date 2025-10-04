/**
 * =================================================================
 * 【ファイル名】: types/dto/accounting-dto.d.ts
 * 【役割】: 会計操作用DTO型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="../core/index.d.ts" />

/**
 * 会計フォーム入力DTO
 *
 * 会計画面でのユーザー入力を表現
 * バックエンドの計算処理で使用
 *
 * @example
 * ```typescript
 * const formDto: AccountingFormDto = {
 *   paymentMethod: 'cash',
 *   timeBased: {
 *     startTime: '13:00',
 *     endTime: '16:00',
 *     breakMinutes: 30,
 *     discountApplied: false,
 *   },
 *   tuitionItems: ['初回講座'],
 *   salesItems: [
 *     { name: 'ひのき材', price: 500 },
 *   ],
 *   workInProgress: '仏像制作中',
 * };
 * ```
 */
interface AccountingFormDto {
  /** 支払い方法（必須） */
  paymentMethod: string;

  /** 時間ベース授業料（該当する場合） */
  timeBased?: {
    /** 開始時刻 */
    startTime: string;
    /** 終了時刻 */
    endTime: string;
    /** 休憩時間（分） */
    breakMinutes: number;
    /** 割引適用フラグ */
    discountApplied: boolean;
  };

  /** 授業料項目（チェックボックス選択） */
  tuitionItems?: string[];

  /** 物販・材料費項目 */
  salesItems?: Array<{
    /** 項目名 */
    name: string;
    /** 金額（オプション、体積計算の場合は計算後に設定） */
    price?: number;
  }>;

  /** 材料費（体積計算用） */
  materials?: Array<{
    /** 材料種類 */
    type: string;
    /** 長さ（cm） */
    l?: number;
    /** 幅（cm） */
    w?: number;
    /** 高さ（cm） */
    h?: number;
  }>;

  /** 制作メモ */
  workInProgress?: string;
}

/**
 * 会計詳細保存リクエストDTO
 *
 * 会計情報を保存する際にバックエンドへ送信するデータ
 *
 * @example
 * ```typescript
 * const saveDto: AccountingSaveDto = {
 *   reservationId: 'R-20251003-001',
 *   classroom: '東京教室',
 *   studentId: 'S-001',
 *   userInput: formDto,
 *   updateStatus: true,
 * };
 * ```
 */
interface AccountingSaveDto {
  /** 予約ID */
  reservationId: string;

  /** 教室名 */
  classroom: string;

  /** 生徒ID */
  studentId: string;

  /** ユーザー入力データ */
  userInput: AccountingFormDto;

  /** ステータス更新フラグ（true: ステータスを「完了」に変更） */
  updateStatus?: boolean;
}

