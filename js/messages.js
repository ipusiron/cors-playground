(function initMessages(globalScope){
  'use strict';
  const messages = {
    ja: {
      acaoWildcardCredentials: 'NG: 資格情報付きリクエストでは ACAO:* を使用できない。',
      acaoExactRequired: 'NG: ACAO は発信元({origin})との完全一致が必要。現在は "{actual}"。',
      acaoExactOk: 'OK: ACAO は発信元と一致。', acacRequired: 'NG: 資格情報付きだが ACAC:true ではない。', acacOk: 'OK: ACAC:true。',
      acaoOk: 'OK: ACAO が発信元を許可。', acaoDenied: 'NG: ACAO が発信元({origin})を許可していない。現在は "{actual}"。',
      methodDenied: 'NG: メソッド {method} は ACAM で許可されていない。', methodAllowed: 'OK: メソッド {method} は ACAM で許可。',
      headersDenied: 'NG: リクエストヘッダー [{headers}] が ACAH で許可されていない。', headersAllowed: 'OK: 非セーフリストヘッダーは ACAH で許可。',
      simSimple: '1) Simple Request 判定 → {result}', simPreflight: '2) プリフライト要否 → {result}', simDecision: '3) 最終可否 → {result}',
      simCondition: 'Simple Request 条件: method={method} ct={contentType} headers=[{headers}] → {result}',
      simConditionYes: '満たす', simConditionNo: '満たさない', simPreflightYes: 'YES (OPTIONS 実施)',
      simPreflightNeeded: 'プリフライト必要: 非セーフ条件が含まれるため OPTIONS で事前照会が行われる。',
      simPreflightNotNeeded: 'プリフライト不要: Simple Request 条件を満たす。', unspecified: '(未指定)',
      exposeReadable: 'JavaScriptから読める', exposeUnreadable: 'JavaScriptから読めない', exposeNone: '該当なし',
      exposeInvalidResponse: '無効なレスポンスヘッダー名: {headers}', exposeInvalidAceh: 'ACEHの構文が無効です: {headers}',
      cacheFirstStored: '0秒: プリフライトを実行し、許可情報を最大{seconds}秒保存するモデルです。', cacheNotRequired: '{seconds}秒: この要求はプリフライト不要です。',
      cacheHit: '{seconds}秒: 同じ照合条件のため、キャッシュを利用してOPTIONSを省略するモデルです。', cacheExpired: '{seconds}秒: 保存期間外のため、もう一度プリフライトするモデルです。',
      cacheChanged: '{seconds}秒: 照合条件が変わったため、保存期間内でももう一度プリフライトするモデルです。',
      shareCopied: '共有リンクをコピーしました。', shareCopyFailed: '共有リンクをコピーできませんでした。', shareCleared: 'URLから共有条件を消しました。',
      shareLoaded: '共有された条件を読み込み、判定しました。', shareInvalid: '共有リンクが無効なため、条件を読み込みませんでした。',
      liveNeedUrl: 'NG: URL を入力してください', liveInvalidUrl: 'NG: 無効なURL形式です', liveScheme: 'NG: http/https以外のスキームは使用できません',
      liveCspPrecheck: '⛔ このツールのCSPが通信前にブロックします。CORS拒否ではありません', liveHeaderFormat: 'NG: 追加ヘッダーの形式を確認してください',
      liveHeaderRejected: 'NG: ブラウザーが受け付けないヘッダーです', liveRequest: 'Request ->', liveResponse: '✅ Response <- status={status}', liveBody: '📄 Body (first 400 chars)',
      liveSuccessHeading: '━━━ 📚 解説：なぜ成功したのか？ ━━━', liveSuccessReason: '✓ サーバーが適切なCORSヘッダーを返したため、ブラウザーがレスポンスの読み取りを許可しました',
      liveCheckHeaders: '✓ 確認すべきヘッダー:', livePreflightPossible: '⚠️ プリフライトが発生した可能性があります。DevTools NetworkタブでOPTIONSリクエストを確認してください',
      liveFailed: '❌ Fetchに失敗しました', liveFailureHeading: '━━━ 📚 解説：なぜ失敗したのか？ ━━━', liveCspDetected: '⛔ CSPのconnect-srcによるブロックを検出しました。CORS拒否ではありません',
      liveIndeterminate: 'Fetch APIのTypeErrorだけでは、CORS拒否・通信断・DNS・TLSなどを断定できません', liveCandidates: '候補: CORSヘッダー不足、資格情報とACAO:*の不整合、プリフライト拒否、ネットワーク障害',
      liveDetails: '🔍 詳細確認方法:', liveDevtools: '→ DevTools（F12）のNetworkタブを確認', liveStatus: '→ Statusが「(failed)」や「(CORS error)」か確認', liveOptions: '→ OPTIONSがあれば、そのレスポンスヘッダーを確認',
      liveCspNotSent: '💡 CSPで止まったため、ネットワークリクエストは送信されていません', livePreflightOnly: '💡 プリフライトが拒否された場合、OPTIONSは届いても本リクエストは送信されません',
      liveSimpleMaybeSent: '💡 シンプルリクエストは送信後にレスポンス読取が拒否された可能性があります。ただし通信障害との区別にはDevToolsが必要です',
      sopSafeResult: '✅ 成功: title="{title}"（同一オリジンのためアクセス可能）', sopError: '❌ エラー: {error}', sopSandboxResult: '❌ sandboxによりDOMアクセスがブロックされました',
      sopUnexpectedAccess: '取得: "{title}"（環境の挙動をDevToolsで確認してください）', sopSuccessHeading: '✓ なぜ成功したのか？', sopBlockedHeading: '✓ なぜブロックされたのか？',
      sopSameOrigin1: 'このiframeは同一オリジン（親ページと同じサイト）です。', sopSameOrigin2: '同一オリジンのため、contentDocument（iframe内のDOM）へアクセスできます。', sopSameOrigin3: '異なるオリジンのiframeでは、このアクセスはブロックされます。',
      sopSandbox1: 'sandbox属性にallow-same-originがないため、固有の不透明オリジンになります。', sopSandbox2: '同じサイトのファイルでも、親ページからのDOMアクセスはブロックされます。', sopSandbox3: 'sandboxは信頼できないコンテンツを隔離する仕組みです。', sopErrorMessage: 'エラーメッセージ: {error}',
      pmSent: 'Parent → {target} iframe: "{message}"', pmRejected: '想定外のメッセージを拒否: origin={origin}', pmReceived: '受信: origin={origin}: {data}', empty: '(empty)',
    },
    en: {
      acaoWildcardCredentials: 'BLOCK: ACAO:* cannot be used with credentials.', acaoExactRequired: 'BLOCK: ACAO must exactly match the requesting origin ({origin}); current value: "{actual}".',
      acaoExactOk: 'OK: ACAO exactly matches the requesting origin.', acacRequired: 'BLOCK: A credentialed request requires ACAC:true.', acacOk: 'OK: ACAC:true.',
      acaoOk: 'OK: ACAO allows the requesting origin.', acaoDenied: 'BLOCK: ACAO does not allow {origin}; current value: "{actual}".',
      methodDenied: 'BLOCK: ACAM does not allow {method}.', methodAllowed: 'OK: ACAM allows {method}.', headersDenied: 'BLOCK: ACAH does not allow [{headers}].', headersAllowed: 'OK: ACAH allows the non-safelisted headers.',
      simSimple: '1) Simple request → {result}', simPreflight: '2) Preflight required → {result}', simDecision: '3) Final decision → {result}',
      simCondition: 'Simple request conditions: method={method} content-type={contentType} headers=[{headers}] → {result}', simConditionYes: 'met', simConditionNo: 'not met', simPreflightYes: 'YES (OPTIONS)',
      simPreflightNeeded: 'Preflight required: an OPTIONS check runs before the actual request.', simPreflightNotNeeded: 'No preflight: the request meets the CORS-safelisted conditions.', unspecified: '(none)',
      exposeReadable: 'Readable by JavaScript', exposeUnreadable: 'Not readable by JavaScript', exposeNone: 'None',
      exposeInvalidResponse: 'Invalid response header names: {headers}', exposeInvalidAceh: 'Invalid ACEH syntax: {headers}',
      cacheFirstStored: '0 s: The model sends preflight and stores the permission for up to {seconds} s.', cacheNotRequired: '{seconds} s: This request does not require preflight.',
      cacheHit: '{seconds} s: Matching conditions let the model reuse the cache and omit OPTIONS.', cacheExpired: '{seconds} s: The stored period has ended, so the model sends preflight again.',
      cacheChanged: '{seconds} s: Match conditions changed, so the model sends preflight again even before expiry.',
      shareCopied: 'Copied the share link.', shareCopyFailed: 'Could not copy the share link.', shareCleared: 'Removed shared data from the URL.',
      shareLoaded: 'Loaded and evaluated the shared conditions.', shareInvalid: 'The share link is invalid, so no conditions were loaded.',
      liveNeedUrl: 'ERROR: Enter a URL.', liveInvalidUrl: 'ERROR: Invalid URL.', liveScheme: 'ERROR: Only http and https URLs are allowed.',
      liveCspPrecheck: '⛔ This page\'s CSP blocks the connection before fetch. This is not a CORS rejection.', liveHeaderFormat: 'ERROR: Check the additional-header format.', liveHeaderRejected: 'ERROR: The browser rejected a header.',
      liveRequest: 'Request ->', liveResponse: '✅ Response <- status={status}', liveBody: '📄 Body (first 400 chars)', liveSuccessHeading: '━━━ Why it succeeded ━━━',
      liveSuccessReason: '✓ The server returned CORS headers that allowed JavaScript to read the response.', liveCheckHeaders: '✓ Relevant response headers:', livePreflightPossible: '⚠️ This request may have used a preflight. Confirm the OPTIONS request in DevTools Network.',
      liveFailed: '❌ Fetch failed', liveFailureHeading: '━━━ Why did it fail? ━━━', liveCspDetected: '⛔ A connect-src CSP violation was detected. This is not a CORS rejection.',
      liveIndeterminate: 'A Fetch API TypeError cannot distinguish CORS rejection from network, DNS, or TLS failures.', liveCandidates: 'Possible causes: missing CORS headers, credentials with ACAO:*, preflight rejection, or a network failure.',
      liveDetails: '🔍 How to investigate:', liveDevtools: '→ Open the DevTools Network panel.', liveStatus: '→ Check for “(failed)” or “CORS error”.', liveOptions: '→ If OPTIONS appears, inspect its response headers.',
      liveCspNotSent: '💡 CSP stopped the operation before a network request was sent.', livePreflightOnly: '💡 If preflight was rejected, OPTIONS may have arrived but the actual request was not sent.',
      liveSimpleMaybeSent: '💡 A simple request may have been sent before response access was rejected. Use DevTools to distinguish that from a network failure.',
      sopSafeResult: '✅ Success: title="{title}" (same-origin DOM access is allowed)', sopError: '❌ Error: {error}', sopSandboxResult: '❌ The sandbox blocked DOM access.', sopUnexpectedAccess: 'Read title: "{title}" (inspect this environment in DevTools)',
      sopSuccessHeading: '✓ Why did it succeed?', sopBlockedHeading: '✓ Why was it blocked?', sopSameOrigin1: 'This iframe has the same origin as its parent.', sopSameOrigin2: 'Same-origin access allows reading contentDocument.', sopSameOrigin3: 'A cross-origin iframe would block this DOM access.',
      sopSandbox1: 'Without allow-same-origin, sandbox gives the iframe a unique opaque origin.', sopSandbox2: 'The parent cannot read its DOM even when the file comes from the same site.', sopSandbox3: 'sandbox isolates content that is not fully trusted.', sopErrorMessage: 'Error message: {error}',
      pmSent: 'Parent → {target} iframe: "{message}"', pmRejected: 'Rejected unexpected message: origin={origin}', pmReceived: 'Received: origin={origin}: {data}', empty: '(empty)',
    },
  };
  const language = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ja';
  function t(key, values){
    let output = (messages[language] && messages[language][key]) || messages.ja[key] || key;
    Object.entries(values || {}).forEach(([name, value])=>{ output = output.replaceAll(`{${name}}`, String(value)); });
    return output;
  }
  const api = { language, t, catalog: messages };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.CorsText = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
