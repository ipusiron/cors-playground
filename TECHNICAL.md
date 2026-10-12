# CORS Playground - 技術仕様書（開発者向け）

このドキュメントでは、CORS Playgroundの実装における技巧的な部分、コアなロジック、設計の工夫について解説します。

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [CORS判定アルゴリズム](#2-cors判定アルゴリズム)
3. [セキュリティ実装](#3-セキュリティ実装)
4. [SOP Lab: sandbox属性の活用](#4-sop-lab-sandbox属性の活用)
5. [教育的フィードバックシステム](#5-教育的フィードバックシステム)
6. [CSS設計とテーマシステム](#6-css設計とテーマシステム)
7. [パフォーマンス最適化](#7-パフォーマンス最適化)

---

## 1. アーキテクチャ概要

### 1.1 ファイル構成

```
cors-playground/
├─ index.html / index.en.html # 日英の画面
├─ css/
│  └─ style.css           # CSS変数ベースのテーマシステム
├─ js/
│  ├─ cors-core.js        # DOM非依存のCORS判定コア
│  ├─ messages.js         # 動的文言の日英辞書
│  ├─ language-init.js    # 初期言語の決定
│  ├─ app.js              # タブ・テーマ・開閉制御
│  ├─ cors-simulator.js   # 判定画面
│  ├─ live-fetch.js       # 実リクエスト実験機能
│  └─ sop-lab.js          # SOP実験（iframe + postMessage）
├─ labs/                  # 日英のiframe文書
│  └─ iframe-lab.js       # iframe側のpostMessage処理
└─ test/                  # node:test
```

### 1.2 設計方針

- **依存関係ゼロ**: 外部ライブラリを使用せず、Vanilla JavaScriptで実装
- **教育優先**: コードの可読性と教育的価値を最優先
- **セキュリティ意識**: XSS対策、CSP、URL検証を標準実装
- **GitHub Pages互換**: 静的ホスティング環境での動作を前提

---

## 2. CORS判定アルゴリズム

### 2.1 シンプルリクエスト判定

**ファイル**: `js/cors-core.js`

#### アルゴリズム概要

```javascript
function needsPreflight(method, headers) {
  return !SAFE_METHODS.has(String(method || '').toUpperCase())
    || unsafeRequestHeaderNames(headers).length > 0;
}
```

`headers`は名前だけでなく値を持つ配列です。Content-Typeのmedia type essence、1値128バイト、セーフリスト値の合計1,024バイト、単一Rangeを検査します。

#### 技術的ポイント

1. **Set データ構造の活用**
   ```javascript
   const SAFE_METHODS = new Set(['GET','HEAD','POST']);
   ```
   - O(1)のルックアップ性能
   - 重複を自動排除

2. **早期リターン（Early Return）パターン**
   - 条件を満たさない場合は即座に `false` を返す
   - 不要な処理を実行しない

3. **大文字小文字の正規化と値検査**
   ```javascript
   function norm(name){ return (name||'').toLowerCase(); }
   ```
   - ヘッダー名の比較を大文字小文字非依存にする
   - 名前が同じでも値が仕様条件を外れればプリフライト対象にする

### 2.2 最終可否判定ロジック

**もっとも複雑なアルゴリズム**: `finalDecision()`

#### 判定フロー

```
1. ACAO（Access-Control-Allow-Origin）チェック
   ├─ withCredentials=true の場合
   │  ├─ ワイルドカード(*) → NG
   │  ├─ オリジン不一致 → NG
   │  └─ オリジン一致 → OK
   └─ withCredentials=false の場合
      ├─ ワイルドカード(*) → OK
      ├─ オリジン一致 → OK
      └─ その他 → NG

2. ACAC（Access-Control-Allow-Credentials）チェック
   ├─ withCredentials=true の場合
   │  ├─ ACAC:true → OK
   │  └─ その他 → NG
   └─ withCredentials=false の場合
      └─ （チェックなし、警告のみ）

3. ACAM（Access-Control-Allow-Methods）チェック
   └─ 非セーフメソッドの場合
      ├─ メソッドが許可リストに含まれる → OK
      ├─ 資格情報なしで * → OK
      └─ その他 → NG

4. ACAH（Access-Control-Allow-Headers）チェック
   └─ 非セーフヘッダーが存在する場合
      ├─ すべてのヘッダーが許可リストに含まれる → OK
      ├─ 資格情報なしで * → OK（Authorizationは明示が必要）
      └─ 一部でも含まれない → NG（不足ヘッダーをリスト化）
```

#### 実装の工夫

**1. 教育的なエラーメッセージ生成**

```javascript
const explain = [];
let ok = true;

if(cred){
  if(allowAll){
    ok = false;
    explain.push('NG: withCredentials=true のとき ACAO:* は使用不可。具体的オリジンを返す必要。');
  }
  // ...
}
```

- 判定結果（`ok`）とその理由（`explain`配列）を同時に生成
- ユーザーが「なぜブロックされたのか」を理解できる

**2. 複合条件の分解**

```javascript
const allowAll = respACAO === '*';
const allowExact = respACAO === origin;
```

- 複雑な条件を意味のある変数名に分解
- コードの可読性向上

**3. 不足ヘッダーの特定**

```javascript
const nonSafeReqHeaders = unsafeRequestHeaderNames(requestHeaders);

if(nonSafeReqHeaders.length>0){
  const allowedH = parseHeaderList(respACAH).map(norm);
  const missing = nonSafeReqHeaders.filter(name => !allowedH.includes(name));
  if(missing.length){
    ok = false;
    explain.push(`NG: 非セーフリストヘッダー [${missing.join(', ')}] が ACAH で許可されていない。`);
  }
}
```

- 判定関数はDOMを参照せず、引数だけから結果を返す
- **差分検出**: リクエストヘッダーと許可ヘッダーの差分を計算

### 2.3 レスポンスヘッダー公開判定

`responseHeaderExposure()`は、レスポンスに存在するヘッダー名を、JavaScriptから読めるものと読めないものへ分けます。`Cache-Control`、`Content-Language`、`Content-Length`、`Content-Type`、`Expires`、`Last-Modified`、`Pragma`はCORS safelisted response-headerとして扱います。

ACEHの`*`は資格情報なしの場合だけワイルドカードです。資格情報付きでは文字どおり`*`という名前だけに一致します。`Set-Cookie`と`Set-Cookie2`はforbidden response-header nameのため、明示的に列挙しても公開しません。ACEHの構文が無効な場合は、セーフリスト以外を公開しません。

### 2.4 HTTP通信フロー、2種類のキャッシュ、Cookie条件

`buildCorsExchange()`は、判定コアの結果から教育用のHTTP通信フローを組み立てます。シンプルリクエストでは本リクエストを送った後にレスポンスの読取可否を判定します。プリフライトが拒否された場合はOPTIONS応答で止まり、本リクエストを送信しません。画面側で判定を作り直さず、`finalDecision()`と同じ結果を表示に使います。

`modelPreflightCache()`は、Max-Ageと2回目の要求時刻を使い、同じ照合条件を仮定した2イベントの時間軸を返します。Fetch標準のキャッシュキーにはnetwork partition key、origin、URL、credentials、method、header nameが関係します。実装による上限や期限前の削除があるため、この関数はOPTIONSの実測結果を表しません。

`assessVaryOrigin()`は、オリジンごとにACAOを変えるキャッシュ可能なHTTPレスポンスについて`Vary: Origin`を確認します。これは通常のHTTPレスポンスキャッシュの評価であり、`Access-Control-Max-Age`によるプリフライトキャッシュとは別です。CDN、プロキシー、ブラウザーの実キャッシュを観測しません。

`explainCredentialConditions()`は、Fetchのcredentials設定、CORS応答、same-site/cross-site、CookieのSameSite・Secure、第三者Cookie方針を別々に示します。CORS許可はJavaScriptによるレスポンス読取の条件であり、Cookie送信の証明ではありません。Domain、Path、有効期限、保存状態など、画面が検査しない条件も結果に残します。

### 2.5 共有状態

共有リンクは`#cors=v1.<base64url(JSON)>`形式です。`normalizeScenario()`が許可キー、型、列挙値、長さ、数値範囲を検査し、未知キーを拒否します。共有と言語切替の一時保存は同じ安全なシナリオだけを使用し、Live FetchとpostMessageの値・本文・ログを含めません。動的な復元結果は既存の描画関数を呼び直して生成します。

---

## 3. セキュリティ実装

### 3.1 URL検証（ライブFetch機能）

**ファイル**: `js/live-fetch.js`

#### ホワイトリスト方式の採用

```javascript
async function runFetch(){
  const url = live.url.value.trim();
  if(!url){ appendLive('NG: URL を入力してください'); return; }

  // セキュリティチェック: 安全でないスキームを拒否
  try {
    const urlObj = new URL(url);
    const allowedSchemes = ['http:', 'https:'];
    if(!allowedSchemes.includes(urlObj.protocol)){
      appendLive('NG: セキュリティ上の理由により、http/https 以外のスキームは使用できません', {
        protocol: urlObj.protocol,
        allowed: allowedSchemes
      });
      return;
    }
  } catch(e) {
    appendLive('NG: 無効なURL形式です', { error: String(e) });
    return;
  }
  // ...
}
```

#### 技術的ポイント

1. **URLオブジェクトによるパース**
   - ブラウザー標準の`URL`コンストラクタを使用
   - 無効なURL形式は自動的に例外が発生

2. **ブラックリストではなくホワイトリスト**
   - 許可するスキーム（`http:`, `https:`）を明示
   - `file:`, `javascript:`, `data:` などの危険なスキームを自動ブロック

3. **教育的フィードバック**
   - ブロックされた場合も、理由とプロトコル情報を表示
   - ユーザーが「なぜダメなのか」を理解できる

### 3.2 XSS対策

#### textContent vs innerHTML

```javascript
// 安全: textContent を使用
function appendLive(line, obj){
  const t = new Date().toLocaleTimeString();
  live.log.textContent += `[${t}] ${line}${obj? ' ' + JSON.stringify(obj, null, 2): ''}\n`;
  live.log.scrollTop = live.log.scrollHeight;
}
```

- **原則**: ユーザー入力は `textContent` で挿入
- 動的な説明は`createElement()`、既存表示の消去は`replaceChildren()`を使用

#### JSON.stringify によるエスケープ

```javascript
JSON.stringify(obj, null, 2)
```

- オブジェクトを安全に文字列化
- XSS攻撃の余地を排除

### 3.3 Content Security Policy (CSP)

**ファイル**: `index.html`

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://httpbin.org https://raw.githubusercontent.com https://example.com;
  img-src 'self' data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
" />
```

#### 設計判断

1. **インラインスクリプトの不使用**
   - イベントは外部JSから`addEventListener()`で登録
   - `script-src`に`'unsafe-inline'`を含めない

2. **connect-src のホワイトリスト**
   - 実験に必要な外部オリジンのみ許可
   - 予期しない外部接続を防止

3. **`frame-ancestors` の不在**
   - `<meta>`タグ経由のCSPでは効果がないため削除
   - HTTPレスポンスヘッダーでのみ有効

4. **HTTPレスポンスヘッダー専用項目**
   - `X-Content-Type-Options`、`Permissions-Policy`、`X-Frame-Options`はmeta要素で代用しない
   - GitHub Pagesのリポジトリーから設定できないため、未設定であることを文書に明記

---

## 4. SOP Lab: sandbox属性の活用

**ファイル**: `js/sop-lab.js`

### 4.1 トリッキーな sandbox 属性

```html
<!-- 同一オリジンだがsandboxによりクロスオリジン扱い -->
<iframe id="frameSandboxed"
        src="labs/iframe-sandboxed.html"
        sandbox="allow-scripts">
</iframe>
```

#### 動作原理

- `sandbox` 属性に `allow-same-origin` が**含まれない**場合、
  - 同一オリジンのページでも「クロスオリジン扱い」になる
  - `origin` が `"null"` になる
  - DOMアクセスがブロックされる

#### 教育的価値

この挙動は、学習者にとって非常に興味深いポイント：
- 「同じサイトなのにアクセスできない」という体験
- セキュリティコンテキストの重要性を実感

### 4.2 動的な解説生成

```javascript
document.getElementById('btnReadSandboxed').addEventListener('click', ()=>{
  try{
    const title = frameSandboxed.contentDocument.title; // 例外が発生
    sandboxedResult.textContent = `取得: "${title}"`;
  }catch(e){
    sandboxedResult.textContent = `❌ ブロックされました`;

    renderExplanation(actionSection, {
      heading: sopText('sopBlockedHeading'),
      paragraphs: [[{ text: sopText('sopSandbox1') }]],
    });
  }
});
```

#### 技術的ポイント

1. **冪等性の保証**
   ```javascript
   if(!explanation){
     explanation = document.createElement('div');
     // ...
   }
   ```
   - すでに解説が存在する場合は再利用
   - 複数回クリックしても重複しない

2. **コンテキスト依存のスタイリング**
   ```javascript
   explanation.className = 'result-explanation error';
   ```
   - 成功時と失敗時で異なるクラスを適用

3. **実際のエラーメッセージの表示**
   ```javascript
   <code>${e.message}</code>
   ```
   - ブラウザーが返す実際のエラーを表示
   - 環境による違いを学習できる

### 4.3 postMessage による安全な通信

```javascript
// 親ページから iframe へメッセージ送信
frameSandboxed.contentWindow.postMessage({kind:'demo', msg}, '*');

// メッセージ受信
window.addEventListener('message', (ev)=>{
  const origin = ev.origin || 'null'; // sandbox iframe は origin='null'
  appendPmLog(`Received from origin=${origin}: ${JSON.stringify(ev.data)}`);
});
```

#### 設計判断

1. **targetOrigin に `*` を使用**
   - 教育ツールとしての利便性を優先
   - 実プロダクトでは具体的なオリジンを指定すべき

2. **`ev.origin` のフォールバック**
   ```javascript
   const origin = ev.origin || 'null';
   ```
   - sandbox iframe は `origin='null'` になる場合がある

---

## 5. 教育的フィードバックシステム

### 5.1 段階的な情報開示

#### Live Fetch の成功時フィードバック

```javascript
appendLive(`✅ Response <- status=${res.status}`, { headers: headersObj });
appendLive('📄 Body (first 400 chars)', text.slice(0, 400));
appendLive('', {});
appendLive('━━━ 📚 解説：なぜ成功したのか？ ━━━', {});
appendLive('✓ サーバーが適切なCORSヘッダーを返したため、ブラウザーがレスポンスの読み取りを許可しました', {});
```

#### 失敗時フィードバック

```javascript
const cspBlocked = lastConnectSrcViolation
  && Date.now() - lastConnectSrcViolation.at < 2000;
appendLive(liveText('liveFailed'), { error: String(err) });
appendLive(cspBlocked ? liveText('liveCspDetected') : liveText('liveIndeterminate'), {});
```

許可リスト外のURLは`inspectTarget()`で通信前に停止します。`securitypolicyviolation`も監視します。それ以外の`TypeError`はCORS、DNS、TLS、オフラインなどを区別できないため、断定しません。

### 5.2 プリフライト推定アルゴリズム

```javascript
const preflightEst = CorsCore.needsPreflight(method, requestHeaderEntries);
```

#### 活用方法

```javascript
appendLive('Request ->', { url, ...options, preflight_estimated: preflightEst });
```

- 実行前にプリフライトが発生するか推定
- ユーザーに事前情報を提供

---

## 6. CSS設計とテーマシステム

### 6.1 CSS変数によるテーマ管理

**ファイル**: `css/style.css`

```css
:root {
  /* Color Palette */
  --bg: #0a0e1a;
  --fg: #e4e8f0;
  --accent: #3b82f6;
  --card: #13182b;
  --success: #10b981;
  --warn: #f59e0b;
  --error: #ef4444;
  --muted: #94a3b8;
  --border: #1e293b;

  /* Spacing */
  --gap: 16px;
  --radius: 12px;

  /* Typography */
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'Courier New', monospace;
}
```

#### 利点

1. **一元管理**
   - 色やスペーシングを変数で管理
   - メンテナンス性向上

2. **ダークテーマの実装**
   - 全体的なダークカラースキーム
   - 目に優しいコントラスト

3. **再利用性**
   ```css
   .card {
     background: var(--card);
     border: 1px solid var(--border);
     border-radius: var(--radius);
   }
   ```

### 6.2 アコーディオンUIの実装

```css
.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.accordion-content.open {
  max-height: 5000px; /* 十分大きな値 */
}
```

#### 技術的ポイント

1. **max-height トランジション**
   - `height: auto` はアニメーション不可
   - `max-height` で代用（十分大きな値を設定）

2. **cubic-bezier イージング**
   ```css
   cubic-bezier(0.4, 0, 0.2, 1)
   ```
   - Material Design のイージング曲線
   - 滑らかな開閉アニメーション

3. **JavaScript による制御**
   ```javascript
   accordion.addEventListener('click', ()=>{
     const content = accordion.nextElementSibling;
     content.classList.toggle('open');
   });
   ```

### 6.3 レスポンシブデザイン

```css
.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap);
}

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
```

#### モバイル対応

- **Grid Layout** による柔軟なレイアウト
- **メディアクエリ** でモバイル時は1カラム表示

---

## 7. パフォーマンス最適化

### 7.1 DOM操作の最小化

#### 悪い例（非効率）

```javascript
// 毎回DOM検索を実行
document.getElementById('log').textContent += line1 + '\n';
document.getElementById('log').textContent += line2 + '\n';
document.getElementById('log').textContent += line3 + '\n';
```

#### 良い例（効率的）

```javascript
// 要素を事前に取得
const live = {
  log: document.getElementById('liveLog'),
  // ...
};

function appendLive(line){
  live.log.textContent += line + '\n';
  live.log.scrollTop = live.log.scrollHeight; // 自動スクロール
}
```

### 7.2 イベントデリゲーション（必要に応じて）

現在の実装では、プリセットボタンが少数（3個）のため直接バインド：

```javascript
Q('btnSimPresetSimple').addEventListener('click', ...);
Q('btnSimPresetJSON').addEventListener('click', ...);
Q('btnSimPresetAuth').addEventListener('click', ...);
```

**将来の拡張時の推奨**:
```javascript
// 親要素に1つのリスナーを設定
document.querySelector('.preset-buttons').addEventListener('click', (e)=>{
  if(e.target.matches('[data-preset]')){
    const preset = e.target.dataset.preset;
    applyPreset(preset);
  }
});
```

### 7.3 依存関係ゼロによる高速ロード

- **外部ライブラリなし**: HTTP リクエスト数の削減
- **単一HTML**: ファーストペイントの高速化
- **インラインCSS不使用**: キャッシュ効率向上

---

## 8. 拡張のためのガイドライン

### 8.1 新しいプリセットの追加

**手順**:

1. HTMLに実験ステップを追加
2. プリセットボタンのイベントリスナーを追加
   ```javascript
   Q('btnSimPresetNewPattern').addEventListener('click', ()=>{
     Q('simMethod').value = 'PUT';
     Q('simContentType').value = 'application/json';
     // ...
   });
   ```

### 8.2 新しいタブの追加

**手順**:

1. `index.html` にタブボタンとパネルを追加
   ```html
   <button class="tab-btn" data-tab="new-tab">新機能</button>
   <section id="tab-new" class="tab-panel">...</section>
   ```

2. `js/app.js` で自動的に認識される（既存のタブ切替ロジックが適用）

### 8.3 セキュリティチェックリスト

新機能追加時の確認項目：

- [ ] ユーザー入力を `textContent` で挿入しているか？
- [ ] 外部URLへの接続は `connect-src` に追加されているか？
- [ ] URL検証ロジックを通しているか？
- [ ] エラーメッセージに機密情報が含まれていないか？

---

## 9. デバッグとテスト

### 9.1 ブラウザー互換性

**推奨テスト環境**:
- Chrome/Edge (最新版)
- Firefox (最新版)
- Safari (最新版)

**既知の互換性問題**:
- `sandbox` 属性の挙動がブラウザーにより微妙に異なる
- `origin='null'` の扱いが環境依存

### 9.2 デバッグ用のコンソール出力

開発時に有用なデバッグコード（本番では削除推奨）:

```javascript
function doSimulate(){
  const method = Q('simMethod').value.toUpperCase();
  const ct = Q('simContentType').value;
  const headers = parseHeaderList(Q('simHeaders').value).map(norm);

  // デバッグ出力
  console.log('[DEBUG] Simulate:', { method, ct, headers });

  // ...
}
```

---

## 10. ライセンスと貢献

### 10.1 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照

### 10.2 貢献ガイドライン

Pull Request を送る前に：

1. **コードスタイル**:
   - インデント: 2スペース
   - セミコロン: 使用
   - 変数名: キャメルケース

2. **コミットメッセージ**:
   ```
   feat: 新機能を追加
   fix: バグ修正
   docs: ドキュメント更新
   style: コードスタイル修正（動作変更なし）
   refactor: リファクタリング
   ```

3. **テスト**:
   - 主要ブラウザーで動作確認
   - 既存機能の動作に影響がないか確認

---

## まとめ

CORS Playgroundは、教育目的に特化した設計思想のもと、以下の技術的特徴を持っています：

✅ **純粋なVanilla JavaScript**: 依存関係ゼロで高速・軽量
✅ **教育的フィードバック**: 詳細な解説とエラーメッセージ
✅ **セキュリティ意識**: XSS対策、CSP、URL検証を標準実装
✅ **拡張性**: モジュール化された構造で新機能追加が容易
✅ **アクセシビリティ**: セマンティックHTML、ARIA属性の適切な使用

このドキュメントが、CORS Playgroundの理解と拡張の助けになれば幸いです。

**質問・提案**: [GitHub Issues](https://github.com/ipusiron/cors-playground/issues)
