// Smoke test: simulates the Cloudflare Pages runtime for gdi-pages/_worker.js
// Mocks Google API endpoints; verifies the worker boots and handles core routes.
// NOTE: credentials now come from env (secrets), so tests inject FAKE_ENV.

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (/oauth2\/v[24]\/token/.test(u) && opts.method === 'POST') {
    return jsonResponse({ access_token: 'fake-access-token', expires_in: 3600 });
  }
  if (u.includes('/drive/v3/files/root')) {
    return jsonResponse({ id: 'root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', parents: [] });
  }
  if (u.includes('/drive/v3/files')) {
    if (u.includes('alt=media')) return new Response('fake-file-bytes', { status: 200 });
    if (u.includes('/export')) return new Response('fake-export', { status: 200 });
    return jsonResponse({ files: [] });
  }
  return new Response('unexpected fetch: ' + u, { status: 500 });
};

const mod = await import('./gdi-pages/_worker.js');
const workerFetch = mod.default.fetch;

// Fake secrets as Cloudflare would provide them via env
const FAKE_ENV = {
  CLIENT_ID: 'fake-client-id',
  CLIENT_SECRET: 'fake-client-secret',
  REFRESH_TOKEN: 'fake-refresh-token',
};

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

// T1: no cookie + enable_login=true  -> should get the login page (401)
let res = await workerFetch(new Request('https://demo.pages.dev/'), FAKE_ENV, {});
let body = await res.text();
check('T1 login gate (401 + login page)', res.status === 401 && body.includes('Sign in to continue'), 'status=' + res.status);

// T2: POST /login with wrong password -> JSON ok:false
res = await workerFetch(new Request('https://demo.pages.dev/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'username=admin&password=wrongpass'
}), FAKE_ENV, {});
body = await res.text();
check('T2 wrong creds rejected', res.status === 200 && body.includes('"ok":false'), body.slice(0, 80));

// T3: POST /login with correct creds -> ok:true + session cookie
res = await workerFetch(new Request('https://demo.pages.dev/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'username=admin&password=admin123'
}), FAKE_ENV, {});
body = await res.text();
const cookie = res.headers.get('set-cookie')?.split(';')[0] || '';
check('T3 login success + cookie set', res.status === 200 && body.includes('"ok":true') && cookie.startsWith('session='), cookie.slice(0, 40) + '...');

// T4: with session cookie, GET / -> homepage (gds init with mocked Drive API)
res = await workerFetch(new Request('https://demo.pages.dev/', { headers: { cookie } }), FAKE_ENV, {});
body = await res.text();
check('T4 homepage served', res.status === 200 && body.includes('gdi-drives-grid') && body.includes('GDI Test'), 'status=' + res.status);

// T5: folder page /0:/
res = await workerFetch(new Request('https://demo.pages.dev/0:/', { headers: { cookie } }), FAKE_ENV, {});
body = await res.text();
check('T5 folder page served', res.status === 200 && body.includes('window.current_drive_order = 0'), 'status=' + res.status);

// T6: /sw.js proxy
res = await workerFetch(new Request('https://demo.pages.dev/sw.js', { headers: { cookie } }), FAKE_ENV, {});
check('T6 sw.js proxy', res.status === 200 && (res.headers.get('content-type') || '').includes('javascript'), 'status=' + res.status);

// T7: /download.aspx with garbage params -> 400 Invalid Request (no Google call)
res = await workerFetch(new Request('https://demo.pages.dev/download.aspx?file=zzz&expiry=zzz', { headers: { cookie } }), FAKE_ENV, {});
body = await res.text();
check('T7 download.aspx garbage rejected', res.status === 400 && body.includes('Invalid Request'), 'status=' + res.status);

// T8: unknown path redirects to /0:/
res = await workerFetch(new Request('https://demo.pages.dev/some/random/path', { headers: { cookie } }), FAKE_ENV, {});
check('T8 unknown path -> redirect', res.status === 302 && res.headers.get('location') === 'https://demo.pages.dev/0:/', 'loc=' + res.headers.get('location'));

// T9: KV/D1 binding injection + secrets together
res = await workerFetch(new Request('https://demo.pages.dev/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'username=admin&password=admin123'
}), { ...FAKE_ENV, ENV: { get: async () => null, put: async () => {} }, DB: null }, {});
check('T9 env bindings (KV/DB/creds) no-crash', res.status === 200, 'status=' + res.status);

// T10: 404 page for a real file that Drive says doesn't exist (mocked empty listing)
res = await workerFetch(new Request('https://demo.pages.dev/0:/nope.txt', { headers: { cookie } }), FAKE_ENV, {});
check('T10 missing file -> 404 page', res.status === 404, 'status=' + res.status);

// T11: no secrets at all -> clear "credentials not configured" error page (no silent 500)
const mod2 = await import('./gdi-pages/_worker.js?t11');
res = await mod2.default.fetch(new Request('https://demo.pages.dev/', { headers: { cookie } }), {}, {});
body = await res.text();
check('T11 missing secrets -> readable error page', res.status === 500 && body.includes('Google credentials are not configured'), 'status=' + res.status);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
