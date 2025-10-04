/**
 * =================================================================
 * 【ファイル名】: types/index.d.ts
 * 【役割】: プロジェクト全体の統合型定義エントリポイント
 * 【目的】: 分散した型定義を統合し、開発体験とAI支援を最適化
 * =================================================================
 */

/// <reference types="google-apps-script" />

// 基盤型定義
/// <reference path="./constants.d.ts" />
/// <reference path="./gas-environment.d.ts" />

// 統一型システム（型システム再設計完了）
/// <reference path="./core/index.d.ts" />
/// <reference path="./dto/index.d.ts" />
/// <reference path="./view/index.d.ts" />
