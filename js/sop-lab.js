// SOP Lab: 同一オリジン iframe と sandbox iframe の対比 + postMessage

const frameSafe = document.getElementById('frameSafe');
const frameSandboxed = document.getElementById('frameSandboxed');
const safeResult = document.getElementById('safeResult');
const sandboxedResult = document.getElementById('sandboxedResult');

document.getElementById('btnReadSafe').addEventListener('click', ()=>{
  try{
    // 同一オリジンなので DOM へアクセスできる
    const title = frameSafe.contentDocument.title;
    safeResult.textContent = `✅ 成功: title="${title}" （理由：同一オリジンのため、アクセスが許可されました）`;
    safeResult.style.color = 'var(--success)';

    // 結果解説を追加（アクションセクションの末尾に）
    const actionSection = safeResult.closest('.experiment-action');
    let explanation = actionSection.querySelector('.result-explanation');
    if(!explanation){
      explanation = document.createElement('div');
      explanation.className = 'result-explanation';
      actionSection.appendChild(explanation);
    }
    explanation.innerHTML = `
      <h5>✓ なぜ成功したのか？</h5>
      <p>このiframeは<strong>同一オリジン</strong>（親ページと同じサイト）です。</p>
      <p>ブラウザーは「同じオリジン同士なら安全」と判断し、<code>contentDocument</code>（iframe内のDOM）へのアクセスを許可します。</p>
      <p><strong>重要：</strong> もしこれが異なるドメインのiframeだったら、このアクセスはブロックされます。</p>
    `;
  }catch(e){
    safeResult.textContent = `❌ エラー: ${e}`;
    safeResult.style.color = 'var(--error)';
  }
});

document.getElementById('btnReadSandboxed').addEventListener('click', ()=>{
  try{
    // sandbox（allow-same-origin を付けていない）なのでクロス扱い → 例外
    const title = frameSandboxed.contentDocument.title; // ここで例外になるはず
    sandboxedResult.textContent = `取得: "${title}"（※環境によりブロックされるはず）`;
    sandboxedResult.style.color = 'var(--warn)';
  }catch(e){
    sandboxedResult.textContent = `❌ ブロックされました （理由：sandbox属性によりクロスオリジン扱いになったため）`;
    sandboxedResult.style.color = 'var(--error)';

    // 結果解説を追加（アクションセクションの末尾に）
    const actionSection = sandboxedResult.closest('.experiment-action');
    let explanation = actionSection.querySelector('.result-explanation');
    if(!explanation){
      explanation = document.createElement('div');
      explanation.className = 'result-explanation error';
      actionSection.appendChild(explanation);
    }
    explanation.innerHTML = `
      <h5>✓ なぜブロックされたのか？</h5>
      <p>このiframeには<code>sandbox</code>属性が付いていますが、<code>allow-same-origin</code>が含まれていません。</p>
      <p>そのため、<strong>同じサイトのページでも「クロスオリジン扱い」</strong>になり、DOMアクセスがブロックされます。</p>
      <p><strong>セキュリティ上の理由：</strong> sandboxは信頼できないコンテンツを隔離するための仕組みです。意図的に制限をかけています。</p>
      <p><strong>エラーメッセージ：</strong> <code>${e.message}</code></p>
    `;
  }
});

// postMessage デモ
const pmLog = document.getElementById('pmLog');
const pmTargetSelect = document.getElementById('pmTarget');
const pmMessageInput = document.getElementById('pmMessage');
document.getElementById('btnPostMessage').addEventListener('click', ()=>{
  const msg = pmMessageInput.value || '(empty)';
  const target = pmTargetSelect.value;
  if(target === 'safe'){
    frameSafe.contentWindow.postMessage({kind:'demo', msg}, '*');
  }else{
    frameSandboxed.contentWindow.postMessage({kind:'demo', msg}, '*');
  }
  appendPmLog(`Parent → ${target} iframe: "${msg}"`);
});

window.addEventListener('message', (ev)=>{
  // sandbox iframe の origin は 'null' になる（allow-same-origin を付けなければ）
  const origin = ev.origin || 'null';
  appendPmLog(`Received from origin=${origin}: ${JSON.stringify(ev.data)}`);
});

function appendPmLog(line){
  const t = new Date().toLocaleTimeString();
  pmLog.textContent += `[${t}] ${line}\n`;
  pmLog.scrollTop = pmLog.scrollHeight;
}
