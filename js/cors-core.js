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
    finalDecision,
    inspectTarget,
    isSafelistedHeader,
    mimeEssence,
    needsPreflight,
    parseHeaderLines,
    unsafeRequestHeaderNames,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.CorsCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
