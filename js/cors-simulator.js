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

// ========================================
// CORS 仕様定数
// ========================================

/**
 * セーフメソッド（Simple Request 条件の一部）
 *
 * @const {Set<string>}
 *
 * @spec
 * - Fetch Standard で定義されたセーフメソッド
 * - これ以外のメソッドはプリフライトが必要
 *
 * @performance
 * - Set を使用: O(1) の高速ルックアップ
 * - 配列の includes() よりも効率的
 */
const SAFE_METHODS = new Set(['GET','HEAD','POST']);

/**
 * セーフリストヘッダー
 *
 * @const {Set<string>}
 *
 * @spec
 * - Fetch仕様の「CORS-safelisted request-header」
 * - これらのヘッダーはプリフライトをトリガーしない
 * - 大文字小文字を区別しない（正規化して比較）
 *
 * @note
 * - 完全なリストではなく、代表的なものを含む
 * - 教育目的のため、主要なもののみ実装
 */
const SAFE_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-language',
  'content-type', // ただし特定の値のみセーフ（SAFE_CONTENT_TYPES参照）
  'range'
]);

/**
 * セーフリスト Content-Type
 *
 * @const {Set<string>}
 *
 * @spec
 * - Content-Type ヘッダーの値がこれらの場合のみセーフ
 * - application/json は含まれない（プリフライトが必要）
 *
 * @educational_note
 * - 多くの開発者が見落とすポイント
 * - JSON通信ではほぼ確実にプリフライトが発生する
 */
const SAFE_CONTENT_TYPES = new Set([
  'text/plain',
  'application/x-www-form-urlencoded',
  'multipart/form-data'
]);

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

// ========================================
// コアアルゴリズム
// ========================================

/**
 * シンプルリクエスト判定
 *
 * @param {string} method - HTTPメソッド
 * @param {string} contentType - Content-Type ヘッダーの値
 * @param {string[]} headers - カスタムヘッダー名の配列
 * @returns {boolean} - シンプルリクエストならtrue
 *
 * @algorithm
 * Simple Request の条件（すべて満たす必要あり）:
 * 1. メソッドが GET/HEAD/POST のいずれか
 * 2. Content-Type がセーフリストに含まれる（指定されている場合）
 * 3. すべてのカスタムヘッダーがセーフリストに含まれる
 *
 * @early_return
 * - 条件を満たさない場合は即座に false を返す
 * - パフォーマンス最適化と可読性向上
 *
 * @spec_reference
 * Fetch Standard § 5.3 CORS protocol
 */
function isSimpleRequest(method, contentType, headers){
  // 条件1: メソッドチェック
  if(!SAFE_METHODS.has(method)) return false;

  // 条件2: Content-Typeチェック（指定されている場合のみ）
  if(contentType && !SAFE_CONTENT_TYPES.has(contentType)) return false;

  // 条件3: カスタムヘッダーチェック
  for(const h of headers){
    if(!SAFE_HEADERS.has(norm(h))) return false;
  }

  return true; // すべての条件を満たす
}

/**
 * プリフライト要否判定
 *
 * @param {string} method - HTTPメソッド
 * @param {string} contentType - Content-Type ヘッダーの値
 * @param {string[]} headers - カスタムヘッダー名の配列
 * @returns {boolean} - プリフライトが必要ならtrue
 *
 * @algorithm
 * - シンプルリクエストでない場合、プリフライトが必要
 * - 否定演算子により論理を反転
 *
 * @educational_note
 * - 「プリフライトが必要」≒「シンプルリクエストでない」
 * - 実装をシンプルに保つための設計判断
 */
function needsPreflight(method, contentType, headers){
  return !isSimpleRequest(method, contentType, headers);
}

/**
 * 最終可否判定（CORS ヘッダーチェック）
 *
 * @param {string} origin - リクエスト元のオリジン
 * @param {boolean} cred - withCredentials フラグ
 * @param {string} method - HTTPメソッド
 * @param {string[]} reqHeaders - リクエストヘッダー配列
 * @param {string} respACAO - Access-Control-Allow-Origin
 * @param {string} respACAC - Access-Control-Allow-Credentials
 * @param {string} respACAM - Access-Control-Allow-Methods
 * @param {string} respACAH - Access-Control-Allow-Headers
 * @returns {{ok: boolean, explain: string[]}} - 判定結果と理由
 *
 * @description
 * サーバーが返すCORSヘッダーから、ブラウザーがリクエストを許可するかを判定
 *
 * @algorithm
 * 1. ACAO (Access-Control-Allow-Origin) チェック
 *    - withCredentials=true の場合: ワイルドカード(*) 不可、オリジン完全一致必須
 *    - withCredentials=false の場合: * またはオリジン一致でOK
 *
 * 2. ACAC (Access-Control-Allow-Credentials) チェック
 *    - withCredentials=true の場合: ACAC: true 必須
 *
 * 3. ACAM (Access-Control-Allow-Methods) チェック
 *    - 非セーフメソッドの場合: メソッドが許可リストに含まれているか確認
 *
 * 4. ACAH (Access-Control-Allow-Headers) チェック
 *    - 非セーフヘッダーがある場合: すべて許可リストに含まれているか確認
 *
 * @returns
 * ok: 最終判定（true=ALLOW, false=BLOCK）
 * explain: 判定理由の配列（教育的フィードバック用）
 *
 * @educational_design
 * - 各チェックで詳細な理由を explain 配列に追加
 * - ユーザーが「なぜブロックされたのか」を理解できる
 */
function finalDecision(origin, cred, method, reqHeaders, respACAO, respACAC, respACAM, respACAH){
  const explain = [];
  let ok = true;

  // ========== ACAO チェック ==========
  const allowAll = respACAO === '*';
  const allowExact = respACAO === origin;

  if(cred){
    // withCredentials=true の場合の厳しい制約
    if(allowAll){
      ok = false;
      explain.push('NG: withCredentials=true のとき ACAO:* は使用不可。具体的オリジンを返す必要。');
    }else if(!allowExact){
      ok = false;
      explain.push(`NG: withCredentials=true のとき ACAO は発信元(${origin}) と一致が必要。今は "${respACAO||'(未指定)'}"`);
    }else{
      explain.push('OK: ACAO は発信元と一致。');
    }
  }else{
    // withCredentials=false の場合
    if(!(allowAll || allowExact)){
      ok = false;
      explain.push(`NG: ACAO が発信元(${origin}) を許可していない（今は "${respACAO||'(未指定)'}"）。`);
    }else{
      explain.push('OK: ACAO が発信元を許可。');
    }
  }

  // ========== ACAC チェック ==========
  if(cred){
    if(respACAC !== 'true'){
      ok = false;
      explain.push('NG: withCredentials=true だが ACAC:true ではない。');
    }else{
      explain.push('OK: ACAC:true。');
    }
  }else{
    if(respACAC === 'true'){
      // 警告（エラーではない）
      explain.push('注意: 資格情報なしだがサーバーは ACAC:true を返している（害はないが意味は薄い）。');
    }
  }

  // ========== ACAM (メソッド) チェック ==========
  const m = method.toUpperCase();
  if(!SAFE_METHODS.has(m)){
    // 非セーフメソッド: ACAM で許可されているか確認
    const allowed = parseHeaderList(respACAM).map(x=>x.toUpperCase());
    if(allowed.length === 0 || !(allowed.includes(m) || (!cred && allowed.includes('*')))){
      ok = false;
      explain.push(`NG: メソッド ${m} は ACAM で許可されていない。`);
    }else{
      explain.push(`OK: メソッド ${m} は ACAM で許可。`);
    }
  }

  // ========== ACAH (ヘッダー) チェック ==========
  // 非セーフヘッダーをフィルタリング
  const nonSafeReqHeaders = reqHeaders
    .map(norm)
    .filter(h=>!SAFE_HEADERS.has(h));

  if(nonSafeReqHeaders.length>0){
    // 許可されたヘッダー（サーバーレスポンス）
    const allowedH = parseHeaderList(respACAH).map(norm);

    // 差分検出: リクエストヘッダーのうち、許可リストにないものを抽出
    const missing = nonSafeReqHeaders.filter(h=>{
      if(allowedH.includes(h)) return false;
      return !(h !== 'authorization' && !cred && allowedH.includes('*'));
    });

    if(missing.length){
      ok = false;
      explain.push(`NG: 非セーフリストヘッダ [${missing.join(', ')}] が ACAH で許可されていない。`);
    }else{
      explain.push('OK: 非セーフヘッダは ACAH で許可されている。');
    }
  }

  return {ok, explain};
}

function formatCoreNote(note){
  const values = note.values || {};
  const messages = {
    acaoWildcardCredentials: 'NG: 資格情報付きリクエストでは ACAO:* を使用できない。',
    acaoExactRequired: `NG: ACAO は発信元(${values.origin})との完全一致が必要。現在は "${values.actual}"。`,
    acaoExactOk: 'OK: ACAO は発信元と一致。',
    acacRequired: 'NG: 資格情報付きだが ACAC:true ではない。',
    acacOk: 'OK: ACAC:true。',
    acaoOk: 'OK: ACAO が発信元を許可。',
    acaoDenied: `NG: ACAO が発信元(${values.origin})を許可していない。現在は "${values.actual}"。`,
    methodDenied: `NG: メソッド ${values.method} は ACAM で許可されていない。`,
    methodAllowed: `OK: メソッド ${values.method} は ACAM で許可。`,
    headersDenied: `NG: リクエストヘッダー [${values.headers}] が ACAH で許可されていない。`,
    headersAllowed: 'OK: 非セーフリストヘッダーは ACAH で許可。',
  };
  return messages[note.key] || note.key;
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
  add(`1) Simple Request 判定 → ${simple ? 'YES' : 'NO'}`, simple ? 'ok' : 'warn');
  add(`2) プリフライト要否 → ${preflight ? 'YES (OPTIONS 実施)' : 'NO'}`, preflight ? 'warn' : 'ok');
  add(`3) 最終可否 → ${decisionOk ? 'ALLOW' : 'BLOCK'}`, decisionOk ? 'ok' : 'ng');

  // 詳細解説の表示
  const exp = Q('simExplain');
  exp.textContent = notes.join('\n'); // 改行で結合
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
  notes.push(`Simple Request 条件: method=${method} ct=${ct||'(未)'} headers=[${headers.join(', ')}] → ${simple?'満たす':'満たさない'}`);

  if(preflight){
    notes.push('プリフライト必要: 非セーフ条件が含まれるため OPTIONS で事前照会が行われる。');
  }else{
    notes.push('プリフライト不要: Simple Request 条件を満たす。');
  }

  notes.push(''); // 空行
  notes.push(...explain); // 詳細解説を追加

  // ===== UIレンダリング =====
  renderFlow({simple, preflight, decisionOk, notes});
}

// ========================================
// イベントリスナー
// ========================================

// 「判定する」ボタン
Q('btnSimulate').addEventListener('click', doSimulate);

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
});
