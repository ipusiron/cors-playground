// SOP Lab: 同一オリジン iframe と sandbox iframe の対比 + postMessage

const frameSafe = document.getElementById('frameSafe');
const frameSandboxed = document.getElementById('frameSandboxed');
const safeResult = document.getElementById('safeResult');
const sandboxedResult = document.getElementById('sandboxedResult');

function renderExplanation(actionSection, config){
  let explanation = actionSection.querySelector('.result-explanation');
  if(!explanation){
    explanation = document.createElement('div');
    actionSection.appendChild(explanation);
  }
  explanation.className = `result-explanation${config.error ? ' error' : ''}`;
  explanation.replaceChildren();

  const heading = document.createElement('h5');
  heading.textContent = config.heading;
  explanation.appendChild(heading);

  config.paragraphs.forEach((parts)=>{
    const paragraph = document.createElement('p');
    parts.forEach((part)=>{
      const node = document.createElement(part.tag || 'span');
      node.textContent = part.text;
      paragraph.appendChild(node);
    });
    explanation.appendChild(paragraph);
  });
}

document.getElementById('btnReadSafe').addEventListener('click', ()=>{
  try{
    // 同一オリジンなので DOM へアクセスできる
    const title = frameSafe.contentDocument.title;
    safeResult.textContent = `✅ 成功: title="${title}" （理由：同一オリジンのため、アクセスが許可されました）`;
    safeResult.style.color = 'var(--success)';

    // 結果解説を追加（アクションセクションの末尾に）
    const actionSection = safeResult.closest('.experiment-action');
    renderExplanation(actionSection, {
      heading: '✓ なぜ成功したのか？',
      paragraphs: [
        [{ text: 'このiframeは' }, { tag: 'strong', text: '同一オリジン' }, { text: '（親ページと同じサイト）です。' }],
        [{ text: 'ブラウザーは同一オリジンのため、' }, { tag: 'code', text: 'contentDocument' }, { text: '（iframe内のDOM）へのアクセスを許可します。' }],
        [{ tag: 'strong', text: '重要：' }, { text: '異なるオリジンのiframeでは、このアクセスはブロックされます。' }],
      ],
    });
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
    renderExplanation(actionSection, {
      error: true,
      heading: '✓ なぜブロックされたのか？',
      paragraphs: [
        [{ text: 'このiframeには' }, { tag: 'code', text: 'sandbox' }, { text: '属性がありますが、' }, { tag: 'code', text: 'allow-same-origin' }, { text: 'がありません。' }],
        [{ text: 'そのため、' }, { tag: 'strong', text: '同じサイトでもクロスオリジン扱い' }, { text: 'になり、DOMアクセスがブロックされます。' }],
        [{ tag: 'strong', text: 'セキュリティ上の理由：' }, { text: 'sandboxは信頼できないコンテンツを隔離する仕組みです。' }],
        [{ tag: 'strong', text: 'エラーメッセージ：' }, { tag: 'code', text: e.message }],
      ],
    });
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
    const targetOrigin = location.origin === 'null' ? '*' : location.origin;
    frameSafe.contentWindow.postMessage({kind:'demo', msg}, targetOrigin);
  }else{
    frameSandboxed.contentWindow.postMessage({kind:'demo', msg}, '*');
  }
  appendPmLog(`Parent → ${target} iframe: "${msg}"`);
});

window.addEventListener('message', (ev)=>{
  const fromSafe = ev.source === frameSafe.contentWindow;
  const fromSandboxed = ev.source === frameSandboxed.contentWindow;
  const safeOrigin = location.origin;
  const validSafe = fromSafe && (safeOrigin === 'null' || ev.origin === safeOrigin);
  const validSandboxed = fromSandboxed && ev.origin === 'null';
  if(!validSafe && !validSandboxed){
    appendPmLog(`Rejected unexpected message from origin=${ev.origin || 'null'}`);
    return;
  }
  appendPmLog(`Received from origin=${ev.origin || 'null'}: ${JSON.stringify(ev.data)}`);
});

function appendPmLog(line){
  const t = new Date().toLocaleTimeString();
  pmLog.textContent += `[${t}] ${line}\n`;
  pmLog.scrollTop = pmLog.scrollHeight;
}
