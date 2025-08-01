#!/bin/bash

# GASテスト実行用スクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "🧪 GAS環境でのテスト実行スクリプト"
echo "=================================="

# 関数定義
setup_test_environment() {
    echo "📋 テスト環境をセットアップ中..."

    # 新しい整理されたディレクトリ構造からファイルをコピー
    cp "$PROJECT_ROOT/src/gas-tests/core/test-functions-legacy.js" "$PROJECT_ROOT/src/test_functions.js"
    cp "$PROJECT_ROOT/src/gas-tests/core/test-performance.js" "$PROJECT_ROOT/src/load_test_functions.js"
    cp "$PROJECT_ROOT/src/gas-tests/features/test-name-population.js" "$PROJECT_ROOT/src/test_name_auto_population.js"
    cp "$PROJECT_ROOT/src/gas-tests/webapp/performance-test.html" "$PROJECT_ROOT/src/test_performance_webapp.html"

    echo "✅ テストファイルをsrc/にコピー完了"
}

cleanup_test_environment() {
    echo "🧹 テスト環境をクリーンアップ中..."

    # src/からテストファイルを削除
    rm -f "$PROJECT_ROOT/src/test_functions.js"
    rm -f "$PROJECT_ROOT/src/load_test_functions.js"
    rm -f "$PROJECT_ROOT/src/test_name_auto_population.js"
    rm -f "$PROJECT_ROOT/src/test_performance_webapp.html"

    echo "✅ テストファイルを削除完了"
}

push_to_gas() {
    echo "🚀 GASにプッシュ中..."
    cd "$PROJECT_ROOT"
    clasp push
    echo "✅ GASへのプッシュ完了"
}

# メイン処理
case "${1:-}" in
    "setup")
        setup_test_environment
        push_to_gas
        echo ""
        echo "🎯 テスト環境が準備完了しました！"
        echo "   GASエディタでテスト関数を実行してください。"
        echo "   完了後は './gas-test.sh cleanup' を実行してください。"
        ;;
    "cleanup")
        cleanup_test_environment
        push_to_gas
        echo ""
        echo "🎯 テスト環境をクリーンアップしました！"
        ;;
    "status")
        echo "📊 現在のテストファイル状況:"
        echo ""
        if [ -f "$PROJECT_ROOT/src/test_functions.js" ]; then
            echo "🟢 テストファイルがsrc/に存在（テスト環境）"
        else
            echo "🔴 テストファイルがsrc/に存在しない（本番環境）"
        fi
        ;;
    *)
        echo "使用方法:"
        echo "  ./gas-test.sh setup   - テスト環境をセットアップ"
        echo "  ./gas-test.sh cleanup - テスト環境をクリーンアップ"
        echo "  ./gas-test.sh status  - 現在の状況を確認"
        exit 1
        ;;
esac
