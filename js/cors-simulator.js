/**
 * CORS Decision Simulator - CORS判定エンジン
 * ブラウザーのCORS判定ロジックをシミュレートし、教育的フィードバックを提供
 *
 * @file cors-simulator.js
 * @description
 * - シンプルリクエスト判定アルゴリズム
 * - プリフライト要否判定
 * - 最終可否判定（CORS ヘッダーチェック）
 * - 教育的な解説文の自動生成
 *
 * @algorithm_reference
 * - Fetch Standard: https://fetch.spec.whatwg.org/#cors-protocol
 * - MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 */

// ========================================
// ユーティリティ関数
// ========================================

/**
 * DOM要素を取得する短縮ヘルパー
 * @param {string} id - 要素ID
 * @returns {HTMLElement}
 *
 * @note
 * - 繰り返し呼ばれるためシンプルな関数名（Q）を使用
 * - パフォーマンス: getElementById() は高速（O(1)ハッシュマップ）
 */
const Q = (id)=>document.getElementById(id);
const simText = CorsText.t;

// ========================================
// パーシング関数
// ========================================

/**
 * カンマ区切り文字列をヘッダー名配列に変換
 *
 * @param {string} str - カンマ区切り文字列（例: "Authorization, X-Custom"）
 * @returns {string[]} - トリムされた配列
 *
 * @example
 * parseHeaderList("Authorization, X-Custom")
 * // => ["Authorization", "X-Custom"]
 *
 * @edge_cases
 * - 空文字列 → []
 * - 空白のみの要素 → filter(Boolean) で除外
 */
function parseHeaderList(str){
  if(!str) return [];
  return str.split(',').map(s=>s.trim()).filter(Boolean);
}

/**
 * ヘッダー名を正規化（小文字化）
 *
 * @param {string} name - ヘッダー名
 * @returns {string} - 小文字化されたヘッダー名
 *
 * @rationale
 * - HTTPヘッダー名は大文字小文字を区別しない（RFC 7230）
 * - 比較のために正規化が必要
 */
function norm(name){ return (name||'').toLowerCase(); }

function boundedInteger(id, fallback){
  const input = Q(id);
  const value = Number(input.value);
  const min = Number(input.min || 0);
  const max = Number(input.max || 86400);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function collectScenario(){
  return CorsCore.normalizeScenario({
    method: Q('simMethod').value,
    contentType: Q('simContentType').value,
    requestHeaders: Q('simHeaders').value,
    credentials: Q('simCred').checked,
    acao: Q('simACAO').value,
    acac: Q('simACAC').value,
    acam: Q('simACAM').value,
    acah: Q('simACAH').value,
    aceh: Q('simACEH').value,
    responseHeaders: Q('simResponseHeaders').value,
    maxAge: boundedInteger('simMaxAge', 5),
    secondRequestAfter: boundedInteger('simSecondAfter', 0),
  });
}

function applyScenario(scenario){
  const safe = CorsCore.normalizeScenario(scenario);
  Q('simMethod').value = safe.method;
  Q('simContentType').value = safe.contentType;
  Q('simHeaders').value = safe.requestHeaders;
  Q('simCred').checked = safe.credentials;
  Q('simACAO').value = safe.acao;
  Q('simACAC').value = safe.acac;
  Q('simACAM').value = safe.acam;
  Q('simACAH').value = safe.acah;
  Q('simACEH').value = safe.aceh;
  Q('simResponseHeaders').value = safe.responseHeaders;
  Q('simMaxAge').value = String(safe.maxAge);
  Q('simSecondAfter').value = String(safe.secondRequestAfter);
}

/**
 * 共通コアのメッセージキーを現在の言語へ変換する。
 * @param {{key: string, values?: Object}} note
 * @returns {string}
 */
function formatCoreNote(note){
  return simText(note.key, note.values);
}

// ========================================
// UI レンダリング
// ========================================

/**
 * フローチャート形式で判定結果を表示
 *
 * @param {Object} result - 判定結果オブジェクト
 * @param {boolean} result.simple - シンプルリクエストか
 * @param {boolean} result.preflight - プリフライトが必要か
 * @param {boolean} result.decisionOk - 最終可否
 * @param {string[]} result.notes - 解説テキスト配列
 *
 * @ui_design
 * - 3段階のフロー: Simple判定 → Preflight要否 → 最終可否
 * - 色分け: ok=緑, warn=黄, ng=赤
 * - ユーザーが視覚的に理解しやすい
 *
 * @dom_manipulation
 * - replaceChildren()でクリア
 * - createElement + appendChild による動的生成
 * - textContent でXSS防止
 */
function renderFlow({simple, preflight, decisionOk, notes}){
  const flow = Q('simFlow');
  flow.replaceChildren(); // 既存の内容をクリア

  /**
   * ノード要素を追加するヘルパー
   * @param {string} text - 表示テキスト
   * @param {string} cls - CSSクラス（ok/warn/ng）
   */
  const add = (text, cls)=>{
    const div = document.createElement('div');
    div.className = `node ${cls||''}`;
    div.textContent = text; // XSS防止: textContent を使用
    flow.appendChild(div);
  };

  // 3段階のフローをレンダリング
  add(simText('simSimple', { result: simple ? 'YES' : 'NO' }), simple ? 'ok' : 'warn');
  add(simText('simPreflight', { result: preflight ? simText('simPreflightYes') : 'NO' }), preflight ? 'warn' : 'ok');
  add(simText('simDecision', { result: decisionOk ? 'ALLOW' : 'BLOCK' }), decisionOk ? 'ok' : 'ng');

  // 詳細解説の表示
  const exp = Q('simExplain');
  exp.textContent = notes.join('\n'); // 改行で結合
}

function appendHeaderResult(container, heading, entries, className){
  const group = document.createElement('div');
  group.className = `header-result-group ${className || ''}`.trim();
  const title = document.createElement('strong');
  title.textContent = heading;
  const text = document.createElement('p');
  text.textContent = entries.length ? entries.map((entry)=>entry.name || entry).join(', ') : simText('exposeNone');
  group.append(title, text);
  container.appendChild(group);
}

function renderExchange(config){
  const exchange = CorsCore.buildCorsExchange(config);
  const container = Q('simExchange');
  const statusKeys = {
    sent: 'exchangeSent', received: 'exchangeReceived', allowed: 'exchangeAllowed',
    blocked: 'exchangeBlocked', notSent: 'exchangeNotSent',
  };
  const titleKeys = {
    preflightRequest: 'exchangePreflightRequest', preflightResponse: 'exchangePreflightResponse',
    actualRequest: 'exchangeActualRequest', actualResponse: 'exchangeActualResponse',
    javascriptAccess: 'exchangeJavascriptAccess',
  };
  container.replaceChildren();
  exchange.stages.forEach((stage, index)=>{
    const item = document.createElement('li');
    item.className = `exchange-step ${stage.status === 'notSent' ? 'not-sent' : stage.status}`;
    const number = document.createElement('span');
    number.className = 'exchange-step-number';
    number.textContent = String(index + 1);
    const body = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = simText(titleKeys[stage.key]);
    const status = document.createElement('p');
    status.className = 'exchange-step-status';
    status.textContent = simText(statusKeys[stage.status]);
    body.append(heading, status);
    if(stage.lines.length){
      const code = document.createElement('pre');
      code.textContent = stage.lines.map((line)=>{
        if(!line.name) return line.value;
        return `${line.name}: ${line.value == null ? simText('exchangeValueNotModeled') : line.value}`;
      }).join('\n');
      body.appendChild(code);
    }
    item.append(number, body);
    container.appendChild(item);
  });
  const outcomeKeys = {
    readable: 'exchangeReadable', stoppedBeforeActual: 'exchangeStopped', unreadableAfterResponse: 'exchangeUnreadable',
  };
  Q('simExchangeOutcome').textContent = simText(outcomeKeys[exchange.outcome]);
}

function renderAdvanced(preflight, credentials){
  const exposure = CorsCore.responseHeaderExposure({
    credentials,
    responseHeaders: Q('simResponseHeaders').value,
    exposeHeaders: Q('simACEH').value,
  });
  const exposureOutput = Q('simExposeResult');
  exposureOutput.replaceChildren();
  appendHeaderResult(exposureOutput, simText('exposeReadable'), exposure.readable, 'readable');
  appendHeaderResult(exposureOutput, simText('exposeUnreadable'), exposure.unreadable, 'unreadable');
  if(exposure.invalidResponseHeaders.length){
    appendHeaderResult(exposureOutput, simText('exposeInvalidResponse', {
      headers: exposure.invalidResponseHeaders.join(', '),
    }), [], 'error');
  }
  if(exposure.invalidExposeHeaders.length){
    appendHeaderResult(exposureOutput, simText('exposeInvalidAceh', {
      headers: exposure.invalidExposeHeaders.join(', '),
    }), [], 'error');
  }

  const cache = CorsCore.modelPreflightCache({
    preflightRequired: preflight,
    maxAge: Q('simMaxAge').value,
    secondRequestAfter: Number(Q('simSecondAfter').value),
    sameRequest: Q('simSameRequest').checked,
  });
  const timeline = Q('simCacheTimeline');
  timeline.replaceChildren();
  const keys = {
    preflightStored: 'cacheFirstStored',
    notRequired: 'cacheNotRequired',
    cacheHit: 'cacheHit',
    expired: 'cacheExpired',
    conditionsChanged: 'cacheChanged',
  };
  cache.events.forEach((event, index)=>{
    const item = document.createElement('li');
    item.dataset.step = String(index + 1);
    item.textContent = simText(keys[event.reason], {
      seconds: event.reason === 'preflightStored' ? cache.maxAge : event.at,
    });
    timeline.appendChild(item);
  });
}

// ========================================
// メイン処理
// ========================================

/**
 * シミュレーション実行
 *
 * @description
 * - フォームから入力値を取得
 * - 各判定関数を呼び出し
 * - 結果をUIに表示
 *
 * @flow
 * 1. 入力値取得・正規化
 * 2. Simple Request 判定
 * 3. Preflight 要否判定
 * 4. 最終可否判定（CORS ヘッダーチェック）
 * 5. 解説文生成
 * 6. UIレンダリング
 */
function doSimulate(){
  // ===== 入力値取得 =====
  const method = Q('simMethod').value.toUpperCase();
  const ct = Q('simContentType').value;
  const headers = parseHeaderList(Q('simHeaders').value).map(norm);
  const requestHeaders = headers.map((name)=>({ name, value: '' }));
  if(ct) requestHeaders.push({ name: 'Content-Type', value: ct });
  const cred = Q('simCred').checked;

  // 現在のページのオリジン（シミュレーション用）
  const origin = location.origin;

  // サーバーレスポンスヘッダー（ユーザー入力）
  const ACAO = Q('simACAO').value.trim();
  const ACAC = Q('simACAC').value;
  const ACAM = Q('simACAM').value;
  const ACAH = Q('simACAH').value;

  // ===== 判定実行 =====
  const preflight = CorsCore.needsPreflight(method, requestHeaders);
  const simple = !preflight;
  const decision = CorsCore.finalDecision({
    origin,
    credentials: cred,
    method,
    requestHeaders,
    response: { acao: ACAO, acac: ACAC, acam: ACAM, acah: ACAH },
  });
  const decisionOk = decision.ok;
  const explain = decision.notes.map(formatCoreNote);

  // ===== 解説文生成 =====
  const notes = [];
  notes.push(simText('simCondition', {
    method,
    contentType: ct || simText('unspecified'),
    headers: headers.join(', '),
    result: simple ? simText('simConditionYes') : simText('simConditionNo'),
  }));

  if(preflight){
    notes.push(simText('simPreflightNeeded'));
  }else{
    notes.push(simText('simPreflightNotNeeded'));
  }

  notes.push(''); // 空行
  notes.push(...explain); // 詳細解説を追加

  // ===== UIレンダリング =====
  renderFlow({simple, preflight, decisionOk, notes});
  renderExchange({
    origin, credentials: cred, method, requestHeaders,
    response: { acao: ACAO, acac: ACAC, acam: ACAM, acah: ACAH, aceh: Q('simACEH').value },
  });
  renderAdvanced(preflight, cred);
}

// ========================================
// イベントリスナー
// ========================================

// 「判定する」ボタン
Q('btnSimulate').addEventListener('click', doSimulate);

Q('btnSimShare').addEventListener('click', async ()=>{
  const status = Q('simShareStatus');
  try {
    const url = new URL(location.href);
    url.hash = CorsCore.encodeScenario(collectScenario());
    await navigator.clipboard.writeText(url.href);
    history.replaceState(null, '', url.href);
    status.textContent = simText('shareCopied');
  } catch(error) {
    status.textContent = simText('shareCopyFailed');
  }
});

Q('btnSimClearShare').addEventListener('click', ()=>{
  const url = new URL(location.href);
  url.hash = '';
  history.replaceState(null, '', url.href);
  Q('simShareStatus').textContent = simText('shareCleared');
});

[
  'simMethod', 'simContentType', 'simHeaders', 'simCred', 'simACAO', 'simACAC',
  'simACAM', 'simACAH', 'simACEH', 'simResponseHeaders', 'simMaxAge',
  'simSecondAfter', 'simSameRequest',
].forEach((id)=>{
  Q(id).addEventListener('input', doSimulate);
  Q(id).addEventListener('change', doSimulate);
});

// ========== プリセットボタン ==========

/**
 * プリセット: Simple Request
 *
 * @preset_purpose
 * - もっともシンプルなCORS成功例
 * - プリフライトなしで直接リクエスト
 * - 学習の出発点
 */
Q('btnSimPresetSimple').addEventListener('click', ()=>{
  Q('simMethod').value = 'GET';
  Q('simContentType').value = 'text/plain';
  Q('simHeaders').value = '';
  Q('simCred').checked = false;

  Q('simACAO').value = location.origin;
  Q('simACAC').value = '';
  Q('simACAM').value = 'GET, POST';
  Q('simACAH').value = '';
  Q('simACEH').value = '';
  Q('simResponseHeaders').value = 'Content-Type, X-Trace-Id, Set-Cookie';
  doSimulate();
});

/**
 * プリセット: JSON Request (Preflight発生)
 *
 * @preset_purpose
 * - application/json は非セーフなContent-Type
 * - プリフライトが発生するパターン
 * - 実務でもっとも一般的なケース
 */
Q('btnSimPresetJSON').addEventListener('click', ()=>{
  Q('simMethod').value = 'POST';
  Q('simContentType').value = 'application/json';
  Q('simHeaders').value = '';
  Q('simCred').checked = false;

  Q('simACAO').value = location.origin;
  Q('simACAC').value = '';
  Q('simACAM').value = 'GET, POST, PUT';
  Q('simACAH').value = 'content-type';
  Q('simACEH').value = 'X-Trace-Id';
  Q('simResponseHeaders').value = 'Content-Type, X-Trace-Id';
  doSimulate();
});

/**
 * プリセット: Authorization Header + Credentials
 *
 * @preset_purpose
 * - Authorization ヘッダーは非セーフ
 * - withCredentials=true の制約を学習
 * - ワイルドカード(*) が使えないことを体験
 */
Q('btnSimPresetAuth').addEventListener('click', ()=>{
  Q('simMethod').value = 'GET';
  Q('simContentType').value = '';
  Q('simHeaders').value = 'Authorization';
  Q('simCred').checked = true;

  Q('simACAO').value = location.origin; // credentials時は * 非可
  Q('simACAC').value = 'true';
  Q('simACAM').value = 'GET, POST';
  Q('simACAH').value = 'authorization';
  Q('simACEH').value = '*';
  Q('simResponseHeaders').value = 'Content-Type, X-Trace-Id, Set-Cookie';
  doSimulate();
});

globalThis.CorsSimulatorState = { collectScenario, applyScenario, doSimulate };

const pendingScenario = globalThis.CorsPendingSessionState && globalThis.CorsPendingSessionState.scenario;
if(pendingScenario){
  try { applyScenario(pendingScenario); } catch(error) { /* ignore invalid session data */ }
}

if(location.hash.startsWith('#cors=')){
  try {
    applyScenario(CorsCore.decodeScenario(location.hash));
    const simulatorTab = document.querySelector('[data-tab="tab-simulator"]');
    if(simulatorTab) simulatorTab.click();
    Q('simShareStatus').textContent = simText('shareLoaded');
  } catch(error) {
    Q('simShareStatus').textContent = simText('shareInvalid');
  }
}

doSimulate();
