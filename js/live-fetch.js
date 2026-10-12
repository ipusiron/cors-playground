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
const liveText = CorsText.t;

const LIVE_ALLOWED_ORIGINS = [
  'https://httpbin.org',
  'https://raw.githubusercontent.com',
  'https://example.com',
];
let lastConnectSrcViolation = null;

window.addEventListener('securitypolicyviolation', (event)=>{
  if(event.effectiveDirective === 'connect-src'){
    lastConnectSrcViolation = {
      blockedURI: event.blockedURI,
      at: Date.now(),
    };
  }
});

function appendLive(line, obj){
  const t = new Date().toLocaleTimeString();
  live.log.textContent += `[${t}] ${line}${obj? ' ' + JSON.stringify(obj, null, 2): ''}\n`;
  live.log.scrollTop = live.log.scrollHeight;
}

async function runFetch(){
  const url = live.url.value.trim();
  if(!url){ appendLive(liveText('liveNeedUrl')); return; }

  const target = CorsCore.inspectTarget(url, location.href, LIVE_ALLOWED_ORIGINS);
  if(!target.ok){
    if(target.reason === 'invalidUrl'){
      appendLive(liveText('liveInvalidUrl'));
    }else if(target.reason === 'unsupportedScheme'){
      appendLive(liveText('liveScheme'), { protocol: target.protocol });
    }else{
      appendLive(liveText('liveCspPrecheck'), {
        origin: target.origin,
        allowed_origins: LIVE_ALLOWED_ORIGINS,
      });
    }
    return;
  }

  const parsed = CorsCore.parseHeaderLines(live.headers.value);
  if(parsed.errors.length){
    appendLive(liveText('liveHeaderFormat'), { errors: parsed.errors });
    return;
  }

  const requestHeaderEntries = parsed.headers.slice();
  if(live.ct.value){
    const existing = requestHeaderEntries.findIndex((entry)=>entry.name.toLowerCase() === 'content-type');
    if(existing >= 0) requestHeaderEntries.splice(existing, 1);
    requestHeaderEntries.push({ name: 'Content-Type', value: live.ct.value });
  }
  const headers = {};
  requestHeaderEntries.forEach((entry)=>{ headers[entry.name] = entry.value; });

  try {
    new Headers(headers);
  } catch(e) {
    appendLive(liveText('liveHeaderRejected'), { error: String(e) });
    return;
  }

  const method = live.method.value.toUpperCase();
  const ct = live.ct.value;
  const cred = live.cred.value; // omit | same-origin | include

  const options = {
    method,
    headers,
    credentials: cred,
  };
  const hasBody = ['POST','PUT','PATCH','DELETE'].includes(method);
  if(hasBody && live.body.value.trim()){
    options.body = live.body.value;
  }

  const preflightEst = CorsCore.needsPreflight(method, requestHeaderEntries);
  appendLive(liveText('liveRequest'), { url, ...options, preflight_estimated: preflightEst });
  lastConnectSrcViolation = null;

  try{
    const res = await fetch(url, options);
    const text = await res.text();
    const headersObj = {};
    res.headers.forEach((v,k)=>headersObj[k] = v);

    appendLive(liveText('liveResponse', { status: res.status }), { headers: headersObj });

    // CORSでブロックされるケースでは、ここに到達せず TypeError 例外になる
    appendLive(liveText('liveBody'), text.slice(0, 400));

    // 成功時の解説
    appendLive('', {});
    appendLive(liveText('liveSuccessHeading'), {});
    appendLive(liveText('liveSuccessReason'), {});
    appendLive(liveText('liveCheckHeaders'), {
      'Access-Control-Allow-Origin': headersObj['access-control-allow-origin'] || liveText('unspecified'),
      'Access-Control-Allow-Credentials': headersObj['access-control-allow-credentials'] || liveText('unspecified')
    });
    if(preflightEst){
      appendLive(liveText('livePreflightPossible'), {});
    }
  }catch(err){
    const cspBlocked = lastConnectSrcViolation
      && Date.now() - lastConnectSrcViolation.at < 2000;
    appendLive(liveText('liveFailed'), { error: String(err) });
    appendLive('', {});
    appendLive(liveText('liveFailureHeading'), {});
    if(cspBlocked){
      appendLive(liveText('liveCspDetected'), lastConnectSrcViolation);
    }else{
      appendLive(liveText('liveIndeterminate'), {});
      appendLive(liveText('liveCandidates'), {});
    }
    appendLive('', {});
    appendLive(liveText('liveDetails'), {});
    appendLive(liveText('liveDevtools'), {});
    appendLive(liveText('liveStatus'), {});
    appendLive(liveText('liveOptions'), {});
    appendLive('', {});
    if(cspBlocked){
      appendLive(liveText('liveCspNotSent'), {});
    }else if(preflightEst){
      appendLive(liveText('livePreflightOnly'), {});
    }else{
      appendLive(liveText('liveSimpleMaybeSent'), {});
    }
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
