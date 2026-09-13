const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Admin test server did not start.');
}

test('admin session can read operations views without exposing secrets', { timeout: 20000 }, async t => {
  const port = await freePort();
  const dataFile = path.join(os.tmpdir(), `phantom-admin-test-${process.pid}-${Date.now()}.json`);
  fs.copyFileSync(path.resolve(__dirname, '..', 'data', 'phantom-cards.json'), dataFile);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), PHANTOM_DATA_FILE: dataFile, ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'test-admin-password' },
    stdio: 'ignore',
  });
  t.after(() => { server.kill(); fs.rmSync(dataFile, { force: true }); });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl);
  let cookie = '';
  const request = async (pathname, options = {}) => {
    const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(options.headers || {}) } });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { response, data: await response.json().catch(() => ({})) };
  };
  const unauthenticated = await request('/api/admin/summary');
  assert.equal(unauthenticated.response.status, 401);
  const login = await request('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@example.com', password: 'test-admin-password' }) });
  assert.equal(login.response.status, 200);
  assert.equal(login.data.admin.role, 'owner');
  const summary = await request('/api/admin/summary');
  assert.equal(summary.response.status, 200);
  assert.ok(summary.data.metrics.users > 0);
  const users = await request('/api/admin/users?pageSize=2');
  assert.equal(users.response.status, 200);
  assert.equal(users.data.items.length, 2);
  assert.equal(users.data.items[0].passwordHash, undefined);
  assert.equal(users.data.items[0].pinHash, undefined);
  const transactions = await request('/api/admin/transactions?pageSize=2');
  assert.equal(transactions.response.status, 200);
  assert.equal(transactions.data.items[0].related.code, undefined);
  const page = await fetch(`${baseUrl}/admin`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PHANTOM CARDS ADMIN/);
});
