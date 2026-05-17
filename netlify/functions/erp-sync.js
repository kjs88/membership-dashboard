const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const DEFAULT_BASE_URL = 'https://work.hectonproject.com';
const DEFAULT_ORDER_PATH = '/logis/blc0030/0lo00001';
const DEFAULT_ORDER_MENU_CODE = 'BLC0030';
const DEFAULT_SHIP_PATH = '/logis/blf0050/0lo00001';
const DEFAULT_SHIP_MENU_CODE = 'BLF0050';
const DEFAULT_ROW_COUNT = 5000;
const DEFAULT_ITEM_GROUPS = ['TM00', 'TP00'];
const DEFAULT_TRADE_GROUPS = ['V10002', 'V10003', 'V10004', 'V10005'];

function json(statusCode, body) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  };
}

function joinUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
}

function splitCsv(value, fallback) {
  if (!value) return fallback;
  const parts = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

function readJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return { raw: text };
  }
}

function readEventJson(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (_) {
    return {};
  }
}

function readJsonEnv(name) {
  const value = process.env[name];
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    throw new Error(`${name} 환경변수의 JSON 형식이 올바르지 않습니다.`);
  }
}

function getKstYear() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date());
}

function getRequestYear(requestBody) {
  const raw = requestBody.year || process.env.AMARANS_API_YEAR || getKstYear();
  const year = String(raw).replace(/\D/g, '').slice(0, 4);
  return year || getKstYear();
}

function makeTransactionId() {
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, 32);
}

function readScopedEnv(kind, name) {
  const prefix = kind ? `AMARANS_API_${String(kind).toUpperCase()}_` : 'AMARANS_API_';
  return process.env[`${prefix}${name}`] || process.env[`AMARANS_API_${name}`] || '';
}

function buildBasePayload() {
  return {
    readType: 'data',
    pagingDirection: 'scrollToBottom',
    rowCountPerPage: DEFAULT_ROW_COUNT,
    initialPageSize: DEFAULT_ROW_COUNT,
    markPreventRead: false,
    currentPage: 0,
    startRowIndex: 0,
    currentRowCount: DEFAULT_ROW_COUNT,
    divCds: [],
    deptCds: [],
    empCds: [],
  };
}

function buildOrderPayload(year) {
  return {
    ...buildBasePayload(),
    from: `${year}0101`,
    to: `${year}1231`,
    isTotalSelectTr: '0',
    trCds: [],
    soFgs: [],
    isTotalSelectItem: '0',
    itemCds: [],
    itemgrpCds: splitCsv(process.env.AMARANS_API_ITEM_GROUPS, DEFAULT_ITEM_GROUPS),
    lCds: [],
    mCds: [],
    sCds: [],
    lotFgs: [],
    acctFgs: [],
    odrFgs: [],
    expireYns: [],
    shipCds: [],
    tradeGrps: splitCsv(process.env.AMARANS_API_TRADE_GROUPS, DEFAULT_TRADE_GROUPS),
    exchCds: [],
    plnCdFg: '2',
    plnCds: [],
    plnsCds: [],
    areaCds: [],
    areaGrps: [],
    mgmtCds: [],
    pjtCds: [],
    pjtgrpCds: [],
    vatFgs: [],
    nbFg: '0',
    nb: '',
    remarkDcFg: '0',
    remarkDc: '',
    fromDueDt: '',
    toDueDt: '',
    fromShipreqDt: '',
    toShipreqDt: '',
    mgmNm: '',
    whCds: [],
    userColListSq1: [],
    userColListSq2: [],
    userColModuleCd: '',
    userColMenuCd: '',
    userColPageCd: '',
  };
}

function buildShipPayload(year) {
  return {
    ...buildBasePayload(),
    isuDtFrom: `${year}0101`,
    isuDtTo: `${year}1231`,
    isuNbFg: '0',
    isuNb: '',
    remarkDcFg: '0',
    remarkDc: '',
    soQtFg: '0',
    negNumYn: '0',
    itemCds: [],
    itemCdExcludes: [],
    itemgrpCds: splitCsv(process.env.AMARANS_API_ITEM_GROUPS, DEFAULT_ITEM_GROUPS),
    lCds: [],
    mCds: [],
    sCds: [],
    lotFgs: [],
    acctFgs: [],
    odrFgs: [],
    trCds: [],
    trCdExcludes: [],
    shipCds: [],
    tradeGrps: splitCsv(process.env.AMARANS_API_TRADE_GROUPS, DEFAULT_TRADE_GROUPS),
    soFgs: [],
    mapFgs: [],
    exchCds: [],
    plnCdFg: '2',
    plnCds: [],
    plnsCds: [],
    areaCds: [],
    areaGrps: [],
    mgmtCds: [],
    pjtCds: [],
    pjtgrpCds: [],
    vatFgs: [],
    whCds: [],
    lcCds: [],
    shipFgs: [],
    userColListSq1: [],
    userColListSq2: [],
    userColModuleCd: '',
    userColMenuCd: '',
    userColPageCd: '',
  };
}

function buildPayload(kind, year) {
  const envName = kind === 'order' ? 'AMARANS_API_ORDER_BODY_JSON' : 'AMARANS_API_SHIP_BODY_JSON';
  return readJsonEnv(envName) || (kind === 'ship' ? buildShipPayload(year) : buildOrderPayload(year));
}

function setHeader(headers, name, value) {
  if (value) headers[name] = value;
}

function buildAmaransHeaders({ baseUrl, menuCode, kind }) {
  const token = readScopedEnv(kind, 'TOKEN') || readScopedEnv(kind, 'BEARER_TOKEN');
  const authHeader = readScopedEnv(kind, 'AUTH_HEADER') || 'authorization';
  const authScheme = readScopedEnv(kind, 'AUTH_SCHEME') || 'Bearer';
  const headers = {
    accept: '*/*',
    'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    encrypt: 'false',
    'menu-code': menuCode,
    origin: baseUrl,
    referer: `${baseUrl.replace(/\/+$/, '')}/`,
    timestamp: readScopedEnv(kind, 'TIMESTAMP') || `${Math.floor(Date.now() / 1000)}`,
    'transaction-id': readScopedEnv(kind, 'TRANSACTION_ID') || makeTransactionId(),
    'use-multilang': 'false',
  };

  if (token) {
    const hasScheme = /^\S+\s+/.test(token);
    headers[authHeader] = hasScheme || !authScheme ? token : `${authScheme} ${token}`;
  }

  setHeader(headers, 'cookie', readScopedEnv(kind, 'COOKIE'));
  setHeader(headers, 'wehago-sign', readScopedEnv(kind, 'WEHAGO_SIGN'));

  const scopedExtraHeaders = readJsonEnv(`AMARANS_API_${String(kind).toUpperCase()}_EXTRA_HEADERS_JSON`);
  const extraHeaders = scopedExtraHeaders || readJsonEnv('AMARANS_API_EXTRA_HEADERS_JSON');
  if (extraHeaders && typeof extraHeaders === 'object' && !Array.isArray(extraHeaders)) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      if (value !== undefined && value !== null) headers[name] = String(value);
    }
  }

  return headers;
}

function hasCredentials(kind) {
  return Boolean(
    readScopedEnv(kind, 'TOKEN') ||
    readScopedEnv(kind, 'BEARER_TOKEN') ||
    readScopedEnv(kind, 'COOKIE')
  );
}

function extractRows(payload) {
  const seen = new Set();
  const preferredKeys = [
    'rows',
    'items',
    'list',
    'gridData',
    'headerGrid',
    'detailGrid',
    'data',
    'result',
    'body',
  ];

  function visit(node) {
    if (Array.isArray(node)) {
      return node.some((item) => item && typeof item === 'object') ? node : [];
    }
    if (!node || typeof node !== 'object' || seen.has(node)) return [];
    seen.add(node);

    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const nested = visit(node[key]);
        if (nested.length) return nested;
      }
    }

    for (const value of Object.values(node)) {
      const nested = visit(value);
      if (nested.length) return nested;
    }

    return [];
  }

  return visit(payload);
}

async function fetchAmaransRows({ baseUrl, path, menuCode, kind, payload }) {
  const response = await fetch(joinUrl(baseUrl, path), {
    method: 'POST',
    headers: buildAmaransHeaders({ baseUrl, menuCode, kind }),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const responsePayload = readJson(text);
  if (!response.ok) {
    throw new Error(responsePayload.message || responsePayload.error || `Amarans API request failed (${response.status})`);
  }
  return extractRows(responsePayload);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed', message: 'POST만 지원합니다.' });
  }

  const requestBody = readEventJson(event);
  const basis = requestBody.basis || 'both';
  const year = getRequestYear(requestBody);
  const baseUrl = process.env.AMARANS_API_BASE_URL || DEFAULT_BASE_URL;
  const orderPath = process.env.AMARANS_API_ORDER_PATH || DEFAULT_ORDER_PATH;
  const shipPath = process.env.AMARANS_API_SHIP_PATH || DEFAULT_SHIP_PATH;
  const orderMenuCode = process.env.AMARANS_API_ORDER_MENU_CODE || DEFAULT_ORDER_MENU_CODE;
  const shipMenuCode = process.env.AMARANS_API_SHIP_MENU_CODE || DEFAULT_SHIP_MENU_CODE;
  const needsOrder = basis === 'both' || basis === 'order';
  const needsShip = basis === 'both' || basis === 'ship';
  const hasRequiredCredentials = (!needsOrder || hasCredentials('order')) && (!needsShip || hasCredentials('ship'));

  if (!hasRequiredCredentials) {
    return json(501, {
      error: 'amarans_api_not_configured',
      message: '주문현황/출고현황 API 기본값은 반영되었습니다. 인증값은 Netlify 환경변수로 설정해야 합니다.',
      requiredEnv: [
        'AMARANS_API_TOKEN 또는 AMARANS_API_COOKIE',
        '또는 AMARANS_API_ORDER_TOKEN/AMARANS_API_SHIP_TOKEN',
      ],
      optionalEnv: [
        'AMARANS_API_ORDER_PATH',
        'AMARANS_API_ORDER_MENU_CODE',
        'AMARANS_API_SHIP_PATH',
        'AMARANS_API_SHIP_MENU_CODE',
        'AMARANS_API_ORDER_BODY_JSON',
        'AMARANS_API_SHIP_BODY_JSON',
        'AMARANS_API_WEHAGO_SIGN',
        'AMARANS_API_ORDER_WEHAGO_SIGN',
        'AMARANS_API_SHIP_WEHAGO_SIGN',
        'AMARANS_API_TIMESTAMP',
        'AMARANS_API_ORDER_TIMESTAMP',
        'AMARANS_API_SHIP_TIMESTAMP',
        'AMARANS_API_TRANSACTION_ID',
        'AMARANS_API_ORDER_TRANSACTION_ID',
        'AMARANS_API_SHIP_TRANSACTION_ID',
        'AMARANS_API_EXTRA_HEADERS_JSON',
        'AMARANS_API_ORDER_EXTRA_HEADERS_JSON',
        'AMARANS_API_SHIP_EXTRA_HEADERS_JSON',
      ],
    });
  }

  try {
    const [orderRows, shipRows] = await Promise.all([
      needsOrder
        ? fetchAmaransRows({
            baseUrl,
            path: orderPath,
            menuCode: orderMenuCode,
            kind: 'order',
            payload: buildPayload('order', year),
          })
        : Promise.resolve([]),
      needsShip
        ? fetchAmaransRows({
            baseUrl,
            path: shipPath,
            menuCode: shipMenuCode,
            kind: 'ship',
            payload: buildPayload('ship', year),
          })
        : Promise.resolve([]),
    ]);

    return json(200, {
      source: 'amarans-api',
      syncedAt: new Date().toISOString(),
      year,
      order: orderRows,
      ship: shipRows,
    });
  } catch (err) {
    return json(502, {
      error: 'amarans_api_request_failed',
      message: err.message,
    });
  }
};
