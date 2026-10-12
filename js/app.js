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
 * - イベントデリゲーションは不要（現在は4タブ）
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

  // localStorageが拒否される環境でも、デフォルトのlightで動作を続ける
  let stored = 'light';
  try {
    stored = localStorage.getItem(key) || 'light';
  } catch (error) {
    stored = 'light';
  }
  apply(stored);

  // テーマ切替ボタンのクリックイベント
  btn.addEventListener('click', ()=>{
    // 現在のテーマを判定し、逆のテーマに切り替え
    const next = root.classList.contains('dark') ? 'light' : 'dark';
    try {
      localStorage.setItem(key, next);
    } catch (error) {
      // 保存できなくても、現在のページではテーマを切り替える
    }
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
 * data-help-target属性を持つbuttonから呼び出す。
 */
function toggleHelp(id, button){
  const panel = document.getElementById(id);
  if(panel){
    panel.classList.toggle('visible');
    button.setAttribute('aria-expanded', String(panel.classList.contains('visible')));
  }
}

document.querySelectorAll('[data-help-target]').forEach((button)=>{
  button.addEventListener('click', ()=>toggleHelp(button.dataset.helpTarget, button));
});

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
 * data-accordion-target属性を持つbuttonから呼び出す。
 */
function toggleAccordion(contentId, button){
  const content = document.getElementById(contentId);
  if(content){
    // closest()でもっとも近い親の.accordion-card要素を検索
    const card = content.closest('.accordion-card');
    if(card){
      card.classList.toggle('open');
      button.setAttribute('aria-expanded', String(card.classList.contains('open')));
    }
  }
}

document.querySelectorAll('[data-accordion-target]').forEach((button)=>{
  button.addEventListener('click', ()=>toggleAccordion(button.dataset.accordionTarget, button));
});

(function renderCurrentUrls(){
  const pageUrl = location.href.split('#', 1)[0];
  const values = {
    parentUrl1: pageUrl,
    parentUrl2: pageUrl,
    childUrl1: new URL('labs/iframe-safe.html', pageUrl).href,
    childUrl2: new URL('labs/iframe-sandboxed.html', pageUrl).href,
  };
  Object.entries(values).forEach(([id, value])=>{
    const element = document.getElementById(id);
    if(element) element.textContent = value;
  });
})();
