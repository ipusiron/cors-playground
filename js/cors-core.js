(function initCorsCore(globalScope) {
  'use strict';

  const SAFE_METHODS = new Set(['GET', 'HEAD', 'POST']);
  const SAFE_CONTENT_TYPES = new Set([
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ]);
  const LANGUAGE_VALUE = /^[0-9A-Za-z *,\-.;=]*$/;
  const SINGLE_RANGE_VALUE = /^bytes=[0-9]+-[0-9]*$/;
  const CORS_UNSAFE_VALUE = /[\u0000-\u0008\u000A-\u001F\u007F()<>?@\[\]{}:"]/;
  const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
  const SAFE_RESPONSE_HEADERS = new Set([
    'cache-control',
    'content-language',
    'content-length',
    'content-type',
    'expires',
    'last-modified',
    'pragma',
  ]);
  const FORBIDDEN_RESPONSE_HEADERS = new Set(['set-cookie', 'set-cookie2']);
  const SHARE_PREFIX = 'cors=v1.';
  const SHARE_FIELDS = Object.freeze({
    method: { key: 'm', type: 'enum', values: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] },
    contentType: { key: 'ct', type: 'enum', values: ['', 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/json', 'application/xml'] },
    requestHeaders: { key: 'rh', type: 'string', max: 512 },
    credentials: { key: 'cr', type: 'boolean' },
    acao: { key: 'ao', type: 'string', max: 256 },
    acac: { key: 'ac', type: 'enum', values: ['', 'true', 'false'] },
    acam: { key: 'am', type: 'string', max: 512 },
    acah: { key: 'ah', type: 'string', max: 512 },
    aceh: { key: 'eh', type: 'string', max: 512 },
    responseHeaders: { key: 'sh', type: 'string', max: 512 },
    maxAge: { key: 'ma', type: 'integer', min: 0, max: 86400 },
    secondRequestAfter: { key: 'sd', type: 'integer', min: 0, max: 86400 },
  });

  function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  }

  function valueByteLength(value) {
    const text = String(value || '');
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
  }

  function mimeEssence(value) {
    return String(value || '').split(';', 1)[0].trim().toLowerCase();
  }

  function isSafelistedHeader(name, value) {
    const normalizedName = normalizeName(name);
    const normalizedValue = String(value || '');
    if (valueByteLength(normalizedValue) > 128) return false;

    if (normalizedName === 'accept') {
      return !CORS_UNSAFE_VALUE.test(normalizedValue);
    }
    if (normalizedName === 'accept-language' || normalizedName === 'content-language') {
      return LANGUAGE_VALUE.test(normalizedValue);
    }
    if (normalizedName === 'content-type') {
      return !CORS_UNSAFE_VALUE.test(normalizedValue)
        && SAFE_CONTENT_TYPES.has(mimeEssence(normalizedValue));
    }
    if (normalizedName === 'range') {
      return SINGLE_RANGE_VALUE.test(normalizedValue);
    }
    return false;
  }

  function unsafeRequestHeaderNames(headers) {
    const entries = Array.isArray(headers) ? headers : [];
    const unsafe = [];
    const potentiallySafe = [];
    let safelistValueSize = 0;

    entries.forEach((entry) => {
      const name = normalizeName(entry && entry.name);
      const value = String((entry && entry.value) || '');
      if (!name) return;
      if (isSafelistedHeader(name, value)) {
        potentiallySafe.push(name);
        safelistValueSize += valueByteLength(value);
      } else {
        unsafe.push(name);
      }
    });

    if (safelistValueSize > 1024) unsafe.push(...potentiallySafe);
    return [...new Set(unsafe)].sort();
  }

  function needsPreflight(method, headers) {
    return !SAFE_METHODS.has(String(method || '').toUpperCase())
      || unsafeRequestHeaderNames(headers).length > 0;
  }

  function parseList(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseHeaderNameList(value) {
    const names = [];
    const invalid = [];
    const seen = new Set();
    parseList(value).forEach((name) => {
      const normalized = normalizeName(name);
      if (!HEADER_NAME.test(name)) {
        invalid.push(name);
      } else if (!seen.has(normalized)) {
        seen.add(normalized);
        names.push(name);
      }
    });
    return { names, invalid };
  }

  function responseHeaderExposure(config) {
    const credentials = Boolean(config && config.credentials);
    const responseParsed = parseHeaderNameList(config && config.responseHeaders);
    const exposeParsed = parseHeaderNameList(config && config.exposeHeaders);
    const exposed = exposeParsed.invalid.length
      ? new Set()
      : new Set(exposeParsed.names.map(normalizeName));
    const wildcard = !credentials && exposed.has('*');
    const readable = [];
    const unreadable = [];

    responseParsed.names.forEach((name) => {
      const normalized = normalizeName(name);
      if (FORBIDDEN_RESPONSE_HEADERS.has(normalized)) {
        unreadable.push({ name, reason: 'forbidden' });
      } else if (SAFE_RESPONSE_HEADERS.has(normalized)) {
        readable.push({ name, reason: 'safelisted' });
      } else if (wildcard || exposed.has(normalized)) {
        readable.push({ name, reason: wildcard ? 'wildcard' : 'explicit' });
      } else {
        unreadable.push({ name, reason: credentials && exposed.has('*') ? 'credentialWildcardLiteral' : 'notExposed' });
      }
    });

    return {
      readable,
      unreadable,
      invalidResponseHeaders: responseParsed.invalid,
      invalidExposeHeaders: exposeParsed.invalid,
      wildcard,
    };
  }

  function clampInteger(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isInteger(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function modelPreflightCache(config) {
    const preflightRequired = Boolean(config && config.preflightRequired);
    const maxAgeDefaulted = config == null || config.maxAge === '' || config.maxAge == null;
    const maxAge = clampInteger(maxAgeDefaulted ? 5 : config.maxAge, 5, 0, 86400);
    const secondRequestAfter = clampInteger(config && config.secondRequestAfter, 0, 0, 86400);
    const sameRequest = config == null || config.sameRequest !== false;
    const reused = preflightRequired && sameRequest && maxAge > 0 && secondRequestAfter < maxAge;
    const secondReason = !preflightRequired
      ? 'notRequired'
      : (!sameRequest ? 'conditionsChanged' : (reused ? 'cacheHit' : 'expired'));
    return {
      maxAge,
      maxAgeDefaulted,
      secondRequestAfter,
      reused,
      events: [
        { at: 0, reason: preflightRequired ? 'preflightStored' : 'notRequired' },
        { at: secondRequestAfter, reason: secondReason },
      ],
    };
  }

  function normalizeScenario(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('invalidScenario');
    }
    const output = {};
    for (const [name, rule] of Object.entries(SHARE_FIELDS)) {
      const value = input[name];
      if (value === undefined) throw new TypeError(`missing:${name}`);
      if (rule.type === 'boolean') {
        if (typeof value !== 'boolean') throw new TypeError(`invalid:${name}`);
        output[name] = value;
      } else if (rule.type === 'integer') {
        if (!Number.isInteger(value) || value < rule.min || value > rule.max) throw new TypeError(`invalid:${name}`);
        output[name] = value;
      } else {
        if (typeof value !== 'string' || value.length > (rule.max || 256) || /[\u0000-\u001F\u007F]/.test(value)) {
          throw new TypeError(`invalid:${name}`);
        }
        if (rule.type === 'enum' && !rule.values.includes(value)) throw new TypeError(`invalid:${name}`);
        output[name] = value;
      }
    }
    return output;
  }

  function bytesToBase64Url(bytes) {
    let base64;
    if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(bytes).toString('base64');
    } else {
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      base64 = btoa(binary);
    }
    return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  }

  function base64UrlToBytes(value) {
    if (!/^[0-9A-Za-z_-]+$/.test(value) || value.length > 4096) throw new TypeError('invalidEncoding');
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
    if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(padded, 'base64'));
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function encodeScenario(input) {
    const scenario = normalizeScenario(input);
    const compact = {};
    Object.entries(SHARE_FIELDS).forEach(([name, rule]) => { compact[rule.key] = scenario[name]; });
    const bytes = new TextEncoder().encode(JSON.stringify(compact));
    const fragment = SHARE_PREFIX + bytesToBase64Url(bytes);
    if (fragment.length > 4096) throw new TypeError('scenarioTooLarge');
    return fragment;
  }

  function decodeScenario(fragment) {
    const raw = String(fragment || '').replace(/^#/u, '');
    if (!raw.startsWith(SHARE_PREFIX) || raw.length > 4096) throw new TypeError('invalidFragment');
    const bytes = base64UrlToBytes(raw.slice(SHARE_PREFIX.length));
    let compact;
    try {
      compact = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
      throw new TypeError('invalidPayload');
    }
    if (!compact || typeof compact !== 'object' || Array.isArray(compact)) throw new TypeError('invalidPayload');
    const allowedKeys = new Set(Object.values(SHARE_FIELDS).map((rule) => rule.key));
    if (Object.keys(compact).some((key) => !allowedKeys.has(key))) throw new TypeError('unknownField');
    const expanded = {};
    Object.entries(SHARE_FIELDS).forEach(([name, rule]) => { expanded[name] = compact[rule.key]; });
    return normalizeScenario(expanded);
  }

  function finalDecision(config) {
    const origin = String(config.origin || '');
    const credentials = Boolean(config.credentials);
    const method = String(config.method || 'GET').toUpperCase();
    const requestHeaders = Array.isArray(config.requestHeaders) ? config.requestHeaders : [];
    const response = config.response || {};
    const acao = String(response.acao || '').trim();
    const acac = String(response.acac || '').trim();
    const acam = parseList(response.acam).map((item) => item.toUpperCase());
    const acah = parseList(response.acah).map(normalizeName);
    const notes = [];
    let ok = true;

    if (credentials) {
      if (acao === '*') {
        ok = false;
        notes.push({ key: 'acaoWildcardCredentials' });
      } else if (acao !== origin) {
        ok = false;
        notes.push({ key: 'acaoExactRequired', values: { origin, actual: acao || '(none)' } });
      } else {
        notes.push({ key: 'acaoExactOk' });
      }
      if (acac !== 'true') {
        ok = false;
        notes.push({ key: 'acacRequired' });
      } else {
        notes.push({ key: 'acacOk' });
      }
    } else if (acao === '*' || acao === origin) {
      notes.push({ key: 'acaoOk' });
    } else {
      ok = false;
      notes.push({ key: 'acaoDenied', values: { origin, actual: acao || '(none)' } });
    }

    if (!SAFE_METHODS.has(method)) {
      const methodAllowed = acam.includes(method) || (!credentials && acam.includes('*'));
      if (!methodAllowed) {
        ok = false;
        notes.push({ key: 'methodDenied', values: { method } });
      } else {
        notes.push({ key: 'methodAllowed', values: { method } });
      }
    }

    const unsafeNames = unsafeRequestHeaderNames(requestHeaders);
    if (unsafeNames.length) {
      const missing = unsafeNames.filter((name) => {
        if (acah.includes(name)) return false;
        return !(name !== 'authorization' && !credentials && acah.includes('*'));
      });
      if (missing.length) {
        ok = false;
        notes.push({ key: 'headersDenied', values: { headers: missing.join(', ') } });
      } else {
        notes.push({ key: 'headersAllowed' });
      }
    }

    return { ok, notes, preflight: needsPreflight(method, requestHeaders) };
  }

  function responseCorsLines(response, statusLine) {
    const headers = response || {};
    const lines = [{ name: '', value: statusLine }];
    [
      ['Access-Control-Allow-Origin', 'acao'],
      ['Access-Control-Allow-Credentials', 'acac'],
      ['Access-Control-Allow-Methods', 'acam'],
      ['Access-Control-Allow-Headers', 'acah'],
      ['Access-Control-Expose-Headers', 'aceh'],
    ].forEach(([name, key]) => {
      const value = String(headers[key] || '').trim();
      if (value) lines.push({ name, value });
    });
    return lines;
  }

  function buildCorsExchange(config) {
    const origin = String(config && config.origin || 'https://client.example');
    const method = String(config && config.method || 'GET').toUpperCase();
    const requestHeaders = Array.isArray(config && config.requestHeaders) ? config.requestHeaders : [];
    const response = config && config.response || {};
    const credentials = Boolean(config && config.credentials);
    const decision = finalDecision({ origin, method, requestHeaders, response, credentials });
    const unsafeNames = unsafeRequestHeaderNames(requestHeaders);
    const actualRequestLines = [
      { name: '', value: `${method} /resource HTTP/1.1` },
      { name: 'Origin', value: origin },
      ...requestHeaders
        .filter((entry) => normalizeName(entry && entry.name))
        .map((entry) => ({
          name: String(entry.name).trim(),
          value: String(entry.value || '') || null,
        })),
    ];
    const stages = [];

    if (decision.preflight) {
      const preflightLines = [
        { name: '', value: 'OPTIONS /resource HTTP/1.1' },
        { name: 'Origin', value: origin },
        { name: 'Access-Control-Request-Method', value: method },
      ];
      if (unsafeNames.length) {
        preflightLines.push({ name: 'Access-Control-Request-Headers', value: unsafeNames.join(', ') });
      }
      stages.push({ key: 'preflightRequest', status: 'sent', lines: preflightLines });
      stages.push({
        key: 'preflightResponse',
        status: decision.ok ? 'allowed' : 'blocked',
        lines: responseCorsLines(response, 'HTTP/1.1 204 No Content'),
      });
      if (!decision.ok) {
        stages.push({ key: 'actualRequest', status: 'notSent', lines: actualRequestLines });
        return { decision, stages, outcome: 'stoppedBeforeActual' };
      }
    }

    stages.push({ key: 'actualRequest', status: 'sent', lines: actualRequestLines });
    stages.push({
      key: 'actualResponse',
      status: 'received',
      lines: responseCorsLines(response, 'HTTP/1.1 200 OK'),
    });
    stages.push({ key: 'javascriptAccess', status: decision.ok ? 'allowed' : 'blocked', lines: [] });
    return { decision, stages, outcome: decision.ok ? 'readable' : 'unreadableAfterResponse' };
  }

  function parseHeaderLines(text) {
    const headers = [];
    const errors = [];
    String(text || '').split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      const colon = line.indexOf(':');
      if (colon <= 0) {
        errors.push({ line: index + 1, key: 'invalidHeaderLine' });
        return;
      }
      const name = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
        errors.push({ line: index + 1, key: 'invalidHeaderName' });
        return;
      }
      headers.push({ name, value });
    });
    return { headers, errors };
  }

  function inspectTarget(rawUrl, pageUrl, allowedOrigins) {
    let target;
    let page;
    try {
      target = new URL(String(rawUrl || ''));
      page = new URL(String(pageUrl || ''));
    } catch (error) {
      return { ok: false, reason: 'invalidUrl' };
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return { ok: false, reason: 'unsupportedScheme', protocol: target.protocol };
    }
    const allowed = new Set(Array.isArray(allowedOrigins) ? allowedOrigins : []);
    const sameOrigin = target.origin === page.origin;
    if (!sameOrigin && !allowed.has(target.origin)) {
      return { ok: false, reason: 'cspNotAllowed', origin: target.origin };
    }
    return { ok: true, target, sameOrigin };
  }

  const api = {
    SAFE_METHODS,
    SAFE_CONTENT_TYPES,
    SAFE_RESPONSE_HEADERS,
    buildCorsExchange,
    decodeScenario,
    encodeScenario,
    finalDecision,
    inspectTarget,
    isSafelistedHeader,
    mimeEssence,
    needsPreflight,
    modelPreflightCache,
    normalizeScenario,
    parseHeaderLines,
    parseHeaderNameList,
    responseHeaderExposure,
    unsafeRequestHeaderNames,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.CorsCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
