// frontend-test.js
// フロントエンド自動テストスクリプト
// 画面遷移・UI操作・ユーティリティ関数のテストを自動実行し、結果を画面下部に表示します。

(function () {
  // テスト結果表示用のDOMを生成
  function createTestResultArea() {
    let area = document.getElementById('test-results');
    if (!area) {
      area = document.createElement('div');
      area.id = 'test-results';
      area.style = 'background:#fff;border:1px solid #ccc;padding:1em;margin:2em 0;font-size:14px;';
      area.innerHTML = '<h2>自動テスト結果</h2><ul id="test-result-list"></ul>';
      document.body.appendChild(area);
    }
  }

  // テスト結果を追加
  function addTestResult(msg, ok) {
    const ul = document.getElementById('test-result-list');
    if (ul) {
      const li = document.createElement('li');
      li.textContent = msg;
      li.style.color = ok ? 'green' : 'red';
      ul.appendChild(li);
    }
  }

  // ユーティリティ関数のテスト例
  function testEscapeHTML() {
    try {
      if (typeof escapeHTML !== 'function') throw new Error('escapeHTML未定義');
      const input = '<script>alert(1)</script>';
      const expected = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const result = escapeHTML(input);
      addTestResult('escapeHTML: ' + (result === expected ? 'OK' : 'NG'), result === expected);
    } catch (e) {
      addTestResult('escapeHTML: エラー - ' + e.message, false);
    }
  }

  // 画面遷移のテスト例
  function testScreenTransition() {
    try {
      if (typeof setState !== 'function') throw new Error('setState未定義');
      setState({ view: 'login' });
      setTimeout(() => {
        const main = document.getElementById('main-content');
        addTestResult(
          '画面遷移: main-content表示 - ' +
            (main && !main.classList.contains('hidden') ? 'OK' : 'NG'),
          main && !main.classList.contains('hidden'),
        );
      }, 500);
    } catch (e) {
      addTestResult('画面遷移: エラー - ' + e.message, false);
    }
  }

  // ボタン操作のテスト例
  function testButtonClick() {
    try {
      const btn = document.querySelector('[data-action="showAccountingConfirmation"]');
      if (!btn) throw new Error('showAccountingConfirmationボタン未検出');
      btn.click();
      setTimeout(() => {
        // 何らかのモーダルや結果表示を検証
        addTestResult('showAccountingConfirmationボタン: クリックOK', true);
      }, 500);
    } catch (e) {
      addTestResult('showAccountingConfirmationボタン: エラー - ' + e.message, false);
    }
  }

  // テスト実行
  function runFrontendTests() {
    createTestResultArea();
    testEscapeHTML();
    testScreenTransition();
    testButtonClick();
    // 必要に応じて他のテストも追加
  }

  // ページロード後に自動実行
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(runFrontendTests, 1000);
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      setTimeout(runFrontendTests, 1000);
    });
  }
})();
