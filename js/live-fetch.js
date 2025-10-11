// Live Fetch Lab: 実際に fetch を投げ、成功/失敗と推定プリフライト有無をログする

const live = {
  url: document.getElementById('liveUrl'),
  method: document.getElementById('liveMethod'),
  ct: document.getElementById('liveCT'),
  cred: document.getElementById('liveCred'),
  headers: document.getElementById('liveHeaders'),
  body: document.getElementById('liveBody'),
  log: document.getElementById('liveLog'),
};

function appendLive(line, obj){
  const t = new Date().toLocaleTimeString();
  live.log.textContent += `[${t}] ${line}${obj? ' ' + JSON.stringify(obj, null, 2): ''}\n`;
  live.log.scrollTop = live.log.scrollHeight;
}

function parseHeaders(text){
  const out = {};
  (text || '').split('\n').forEach(line=>{
    const m = line.match(/^\s*([^:]+)\s*:\s*(.+)\s*$/);
    if(m){ out[m[1].trim()] = m[2].trim(); }
  });
  return out;
}

function willPreflight(method, ct, headers){
  // 同一オリジンかどうかはこのツールではチェックしない（CORS想定）
  const SAFE_METHODS = new Set(['GET','HEAD','POST']);
  const SAFE_HEADERS = new Set(['accept','accept-language','content-language','content-type']);
  const SAFE_CT = new Set(['text/plain','application/x-www-form-urlencoded','multipart/form-data']);

  if(!SAFE_METHODS.has(method)) return true;
  if(ct && !SAFE_CT.has(ct)) return true;

  for(const k of Object.keys(headers)){
    if(!SAFE_HEADERS.has(k.toLowerCase())) return true;
  }
  return false;
}

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

  const method = live.method.value.toUpperCase();
  const ct = live.ct.value;
  const cred = live.cred.value; // omit | same-origin | include
  const headers = parseHeaders(live.headers.value);
  if(ct) headers['Content-Type'] = ct;

  const options = {
    method,
    headers,
    credentials: cred,
  };
  const hasBody = ['POST','PUT','PATCH','DELETE'].includes(method);
  if(hasBody && live.body.value.trim()){
    options.body = live.body.value;
  }

  const preflightEst = willPreflight(method, ct, headers);
  appendLive('Request ->', { url, ...options, preflight_estimated: preflightEst });

  try{
    const res = await fetch(url, options);
    const text = await res.text();
    const headersObj = {};
    res.headers.forEach((v,k)=>headersObj[k] = v);

    appendLive(`✅ Response <- status=${res.status}`, { headers: headersObj });

    // CORSでブロックされるケースでは、ここに到達せず TypeError 例外になる
    appendLive('📄 Body (first 400 chars)', text.slice(0, 400));

    // 成功時の解説
    appendLive('', {});
    appendLive('━━━ 📚 解説：なぜ成功したのか？ ━━━', {});
    appendLive('✓ サーバーが適切なCORSヘッダーを返したため、ブラウザーがレスポンスの読み取りを許可しました', {});
    appendLive('✓ 確認すべきヘッダー:', {
      'Access-Control-Allow-Origin': headersObj['access-control-allow-origin'] || '(未設定)',
      'Access-Control-Allow-Credentials': headersObj['access-control-allow-credentials'] || '(未設定)'
    });
    if(preflightEst){
      appendLive('⚠️ このリクエストはPreflightが発生した可能性があります。DevTools NetworkタブでOPTIONSリクエストを確認してください', {});
    }
  }catch(err){
    // CORS ブロックなどで TypeError: Failed to fetch となる
    appendLive('❌ Fetch Error (ブラウザーがブロック)', { error: String(err) });
    appendLive('', {});
    appendLive('━━━ 📚 解説：なぜ失敗したのか？ ━━━', {});
    appendLive('✗ CORSエラーの可能性が高いです。以下を確認してください:', {});
    appendLive('1. サーバーがAccess-Control-Allow-Originヘッダーを返していない', {});
    appendLive('2. withCredentials=trueなのに、サーバーがAccess-Control-Allow-Origin: *を返している', {});
    appendLive('3. Preflightリクエスト（OPTIONS）で、サーバーが適切なヘッダーを返していない', {});
    appendLive('', {});
    appendLive('🔍 詳細確認方法:', {});
    appendLive('→ DevTools（F12）を開いて、Networkタブを確認', {});
    appendLive('→ リクエストのStatusが「(failed)」や「(CORS error)」になっているか確認', {});
    appendLive('→ OPTIONSメソッドのリクエストがあれば、そのレスポンスヘッダーを確認', {});
    appendLive('', {});
    appendLive('💡 重要：リクエスト自体はサーバーに届いています！サーバーのログには記録があるはずです', {});
  }
}

document.getElementById('btnLiveGo').addEventListener('click', runFetch);
document.getElementById('btnLiveClear').addEventListener('click', ()=> live.log.textContent='');

// プリセット
document.getElementById('btnLivePresetOK').addEventListener('click', ()=>{
  live.url.value = 'https://raw.githubusercontent.com/ipusiron/cors-playground/main/README.md';
  live.method.value = 'GET';
  live.ct.value = '';
  live.cred.value = 'omit';
  live.headers.value = '';
  live.body.value = '';
});

document.getElementById('btnLivePresetNG').addEventListener('click', ()=>{
  live.url.value = 'https://example.com/';
  live.method.value = 'GET';
  live.ct.value = '';
  live.cred.value = 'include'; // 資格情報付き + 多くのサイトは ACAO:* で失敗
  live.headers.value = 'Authorization: Bearer demo-token';
  live.body.value = '';
});

document.getElementById('btnLivePresetHttpbin').addEventListener('click', ()=>{
  // httpbin で任意の ACA* を付与して挙動確認
  live.url.value = 'https://httpbin.org/response-headers?Access-Control-Allow-Origin=*'
    + '&Access-Control-Allow-Methods=GET,POST,PUT,PATCH,DELETE'
    + '&Access-Control-Allow-Headers=Authorization,Content-Type';
  live.method.value = 'GET';
  live.ct.value = '';
  live.cred.value = 'omit';
  live.headers.value = 'X-Requested-With: cors-playground';
  live.body.value = '';
});
