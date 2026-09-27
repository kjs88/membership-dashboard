const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const options = { headless: true };
  if (process.platform === 'win32') options.channel = 'chrome';
  const browser = await chromium.launch(options);
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const data = { users: [{ id: 'admin', name: 'Security Test', color: '#009e6a' }], entries: [], clients: [], notices: [], revisits: [], targets: {} };
    // No requests, credentials, test records, or writes ever reach the live database.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      if (url.hostname === 'membership-7aef2-default-rtdb.firebaseio.com') {
        const body = url.pathname === '/data/users.json' ? data.users : url.pathname === '/data.json' ? data : null;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      return route.abort();
    });
    await context.addInitScript(() => {
      sessionStorage.setItem('sj-current-user', JSON.stringify({ id: 'admin', expiresAt: Date.now() + 60000 }));
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('[showPage:render]')) errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser?.id === 'admin' && document.getElementById('app-screen').style.display === 'block');

    for (const [nav, active] of [
      ['nav-sales', 'sales'], ['nav-stats-office', 'stats'], ['nav-stats-dist', 'stats'],
      ['nav-products', 'products'], ['nav-cost', 'cost'], ['nav-compare', 'compare'],
      ['nav-deep', 'deep'], ['nav-dash', 'dash'], ['nav-field', 'field'], ['nav-input', 'input'],
      ['nav-weekly', 'weekly'], ['nav-mo-plan', 'mo-plan'], ['nav-mo-settle', 'mo-settle'],
      ['nav-grade', 'grade'], ['nav-clients', 'clients'], ['nav-users', 'users'], ['nav-targets', 'targets'], ['nav-project', 'project'],
    ]) {
      await page.locator('#' + nav).click();
      assert.equal(await page.locator('#page-' + active).evaluate(el => el.classList.contains('active')), true, nav);
    }

    const attackResult = await page.evaluate(() => {
      window.__attackExecuted = false;
      const target = document.createElement('div');
      document.body.appendChild(target);
      const attack = '<img src=x onerror="window.__attackExecuted=true"><svg onload="window.__attackExecuted=true"></svg><iframe srcdoc="bad"></iframe><script>window.__attackExecuted=true</script>';
      uiSetHtml(target, attack);
      const result = { dangerousNodes: target.querySelectorAll('script,iframe,[onerror],[onload]').length };
      let received;
      const value = `');window.__attackExecuted=true;//<img src=x>`;
      uiSetHtml(target, `<button ${uiAction('click', function (event, args) { received = args[0]; }, [value])}>test</button>`);
      target.querySelector('button').click();
      result.argumentPreserved = received === value;
      uiSetHtml(target, '<button data-ui-action-click="forged" data-ui-static-click="s1">fake</button>');
      result.forgedActions = target.querySelectorAll('[data-ui-action-click],[data-ui-static-click]').length;
      const row = document.createElement('tr');
      uiSetHtml(row, '<td>one</td><td>two</td>');
      result.tableCells = row.cells.length;
      const svg = '<svg viewBox="0 0 10 10"><polyline points="0,0 10,10" stroke="red"/></svg>';
      uiSetHtml(target, svg);
      result.svgPreserved = !!target.querySelector('svg polyline');
      result.executed = window.__attackExecuted;
      target.remove();
      return result;
    });
    assert.deepEqual(attackResult, { dangerousNodes: 0, argumentPreserved: true, forgedActions: 0, tableCells: 2, svgPreserved: true, executed: false });
    // Check CSP independently of the sanitizer by deliberately bypassing our HTML helper.
    await page.evaluate(() => {
      const element = document.createElement('button');
      element.setAttribute('onclick', 'window.__attackExecuted=true');
      document.body.appendChild(element);
      element.click();
      element.remove();
    });
    assert.equal(await page.evaluate(() => window.__attackExecuted), false, 'CSP did not block an injected handler');

    await page.locator('#nav-project').click();
    const frame = page.frames().find(item => item.url().includes('project-tracker.html'));
    assert.ok(frame, 'Project iframe not loaded');
    await frame.getByRole('button', { name: '+ 태스크', exact: true }).click();
    assert.equal(await frame.locator('#taskMask').evaluate(el => el.classList.contains('on')), true);
    await page.locator('#nav-input').click();
    await page.locator('.dly-cell:not(.other-month)').first().click();
    assert.notEqual(await page.locator('#dly-input-view').evaluate(el => el.style.display), 'none');
    assert.deepEqual(errors, [], 'Browser errors');
    fs.mkdirSync(path.join(root, 'security-test-results'), { recursive: true });
    await page.locator('#dly-input-view').getByRole('button', { name: /캘린더로/ }).click();
    await page.locator('#nav-sales').click();
    await page.screenshot({ path: path.join(root, 'security-test-results', 'desktop.png'), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, 'security-test-results', 'mobile.png'), fullPage: false });
    console.log('PASS: 18 screens, project/daily actions, DOM injection, CSP execution blocking, safe callback arguments, table/SVG rendering');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
