// SOP Lab: 同一オリジン iframe と sandbox iframe の対比 + postMessage

const frameSafe = document.getElementById('frameSafe');
const frameSandboxed = document.getElementById('frameSandboxed');
const safeResult = document.getElementById('safeResult');
const sandboxedResult = document.getElementById('sandboxedResult');
const sopText = CorsText.t;

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
    safeResult.textContent = sopText('sopSafeResult', { title });
    safeResult.style.color = 'var(--success)';

    // 結果解説を追加（アクションセクションの末尾に）
    const actionSection = safeResult.closest('.experiment-action');
    renderExplanation(actionSection, {
      heading: sopText('sopSuccessHeading'),
      paragraphs: [
        [{ text: sopText('sopSameOrigin1') }],
        [{ text: sopText('sopSameOrigin2') }],
        [{ text: sopText('sopSameOrigin3') }],
      ],
    });
  }catch(e){
    safeResult.textContent = sopText('sopError', { error: String(e) });
    safeResult.style.color = 'var(--error)';
  }
});

document.getElementById('btnReadSandboxed').addEventListener('click', ()=>{
  try{
    // sandbox（allow-same-origin を付けていない）なのでクロス扱い → 例外
    const title = frameSandboxed.contentDocument.title; // ここで例外になるはず
    sandboxedResult.textContent = sopText('sopUnexpectedAccess', { title });
    sandboxedResult.style.color = 'var(--warn)';
  }catch(e){
    sandboxedResult.textContent = sopText('sopSandboxResult');
    sandboxedResult.style.color = 'var(--error)';

    // 結果解説を追加（アクションセクションの末尾に）
    const actionSection = sandboxedResult.closest('.experiment-action');
    renderExplanation(actionSection, {
      error: true,
      heading: sopText('sopBlockedHeading'),
      paragraphs: [
        [{ text: sopText('sopSandbox1') }],
        [{ text: sopText('sopSandbox2') }],
        [{ text: sopText('sopSandbox3') }],
        [{ text: sopText('sopErrorMessage', { error: e.message }) }],
      ],
    });
  }
});

// postMessage デモ
const pmLog = document.getElementById('pmLog');
const pmTargetSelect = document.getElementById('pmTarget');
const pmMessageInput = document.getElementById('pmMessage');
document.getElementById('btnPostMessage').addEventListener('click', ()=>{
  const msg = pmMessageInput.value || sopText('empty');
  const target = pmTargetSelect.value;
  if(target === 'safe'){
    const targetOrigin = location.origin === 'null' ? '*' : location.origin;
    frameSafe.contentWindow.postMessage({kind:'demo', msg}, targetOrigin);
  }else{
    frameSandboxed.contentWindow.postMessage({kind:'demo', msg}, '*');
  }
  appendPmLog(sopText('pmSent', { target, message: msg }));
});

window.addEventListener('message', (ev)=>{
  const fromSafe = ev.source === frameSafe.contentWindow;
  const fromSandboxed = ev.source === frameSandboxed.contentWindow;
  const safeOrigin = location.origin;
  const validSafe = fromSafe && (safeOrigin === 'null' || ev.origin === safeOrigin);
  const validSandboxed = fromSandboxed && ev.origin === 'null';
  if(!validSafe && !validSandboxed){
    appendPmLog(sopText('pmRejected', { origin: ev.origin || 'null' }));
    return;
  }
  appendPmLog(sopText('pmReceived', { origin: ev.origin || 'null', data: JSON.stringify(ev.data) }));
});

function appendPmLog(line){
  const t = new Date().toLocaleTimeString();
  pmLog.textContent += `[${t}] ${line}\n`;
  pmLog.scrollTop = pmLog.scrollHeight;
}
