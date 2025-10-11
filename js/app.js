/**
 * CORS Playground - アプリケーション制御
 * タブ切替、テーマ切替、アコーディオン機能を管理
 *
 * @file app.js
 * @description
 * - 依存関係ゼロのVanilla JavaScript実装
 * - IIFE（即時実行関数）によるスコープ分離
 * - localStorageによるテーマ設定の永続化
 */

// ========================================
// タブ切替システム
// ========================================

/**
 * タブ切替機能の初期化
 *
 * @description
 * - data-tab属性に基づいてタブボタンとパネルを自動連携
 * - 拡張性：新しいタブを追加してもコード変更不要
 *
 * @algorithm
 * 1. すべてのタブボタン(.tab-btn)とパネル(.tab-panel)を取得
 * 2. 各ボタンにクリックイベントを設定
 * 3. クリック時：すべてのactive状態をクリア → 選択されたタブのみactive
 *
 * @performance
 * - イベントデリゲーションは不要（ボタン数が少ない：3個）
 * - 直接バインドの方がシンプルで読みやすい
 */
(function initTabs(){
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      // すべてのタブとパネルからactive状態を削除
      tabs.forEach(b=>b.classList.remove('active'));
      panels.forEach(p=>p.classList.remove('active'));

      // クリックされたタブをアクティブに
      btn.classList.add('active');

      // data-tab属性から対応するパネルのIDを取得
      const id = btn.dataset.tab;
      document.getElementById(id).classList.add('active');
    });
  });
})();

// ========================================
// テーマ切替システム
// ========================================

/**
 * ダークモード/ライトモード切替機能
 *
 * @description
 * - ユーザーの選択をlocalStorageに保存
 * - ページリロード時に前回の設定を復元
 * - CSS変数(:root.dark)と連携してテーマを切り替え
 *
 * @storage
 * Key: 'corspg-theme'
 * Value: 'light' | 'dark'
 *
 * @design_decision
 * - システムのprefers-color-schemeは使わず、ユーザーの明示的な選択を優先
 * - 教育ツールとして、意図的にテーマを切り替えられることが重要
 */
(function initTheme(){
  const key = 'corspg-theme';
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');

  /**
   * テーマを適用する
   * @param {string} mode - 'light' または 'dark'
   */
  function apply(mode){
    if(mode === 'dark'){
      root.classList.add('dark');
      btn.textContent = '☀️'; // ダークモード時は太陽アイコン（ライトモードへ切替を示唆）
    }else{
      root.classList.remove('dark');
      btn.textContent = '🌙'; // ライトモード時は月アイコン（ダークモードへ切替を示唆）
    }
  }

  // localStorageから前回の設定を読み込み（デフォルトはlight）
  const stored = localStorage.getItem(key) || 'light';
  apply(stored);

  // テーマ切替ボタンのクリックイベント
  btn.addEventListener('click', ()=>{
    // 現在のテーマを判定し、逆のテーマに切り替え
    const next = root.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem(key, next);
    apply(next);
  });
})();

// ========================================
// ヘルプパネル制御
// ========================================

/**
 * ヘルプパネルの表示/非表示を切り替え
 *
 * @param {string} id - パネル要素のID
 *
 * @usage
 * HTML: <button onclick="toggleHelp('helpPanel1')">ヘルプ表示</button>
 *
 * @note
 * - グローバルスコープに配置（onclickから呼び出すため）
 * - 冪等性：複数回呼び出しても問題なし（.toggle()を使用）
 */
function toggleHelp(id){
  const panel = document.getElementById(id);
  if(panel){
    panel.classList.toggle('visible');
  }
}

// ========================================
// アコーディオン制御
// ========================================

/**
 * アコーディオンの開閉を切り替え
 *
 * @param {string} contentId - アコーディオンコンテンツ要素のID
 *
 * @algorithm
 * 1. コンテンツ要素を取得
 * 2. 親の.accordion-card要素を検索
 * 3. .openクラスをトグル（CSS transitionが自動適用）
 *
 * @css_integration
 * - .accordion-card.open { ... } でスタイルが適用される
 * - max-height transitionによる滑らかなアニメーション
 *
 * @usage
 * HTML: <div class="accordion-header" onclick="toggleAccordion('content1')">
 */
function toggleAccordion(contentId){
  const content = document.getElementById(contentId);
  if(content){
    // closest()でもっとも近い親の.accordion-card要素を検索
    const card = content.closest('.accordion-card');
    if(card){
      card.classList.toggle('open');
    }
  }
}
