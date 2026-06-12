const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { chromium } = require('playwright-core');

const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

const KNOWN_BROWSERS = {
  Chrome: path.join(local, 'Google', 'Chrome', 'User Data'),
  Edge: path.join(local, 'Microsoft', 'Edge', 'User Data'),
  Brave: path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data'),
};

function regQuery(keyPath, valueName) {
  try {
    const args = valueName ? `/v ${valueName}` : '/ve';
    const out = execSync(`reg query "${keyPath}" ${args}`, {
      encoding: 'utf8',
      windowsHide: true,
    });
    return out;
  } catch {
    return null;
  }
}

function defaultProgId() {
  const key = String.raw`HKEY_CURRENT_USER\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice`;
  const out = regQuery(key, 'ProgId');
  if (!out) return null;
  const m = out.match(/ProgId\s+REG_SZ\s+(\S+)/);
  return m ? m[1] : null;
}

function exeFromProgId(progId) {
  const key = `HKEY_CLASSES_ROOT\\${progId}\\shell\\open\\command`;
  const out = regQuery(key);
  if (!out) return null;
  const m = out.match(/"([^"]+\.exe)"/i);
  return m && fs.existsSync(m[1]) ? m[1] : null;
}

function nameFromProgId(progId) {
  if (!progId) return null;
  const id = progId.toLowerCase();
  if (id.startsWith('msedge')) return 'Edge';
  if (id.startsWith('chrome')) return 'Chrome';
  if (id.startsWith('brave')) return 'Brave';
  return null;
}

function detectBrowser() {
  const progId = defaultProgId();
  const name = nameFromProgId(progId);
  const exe = progId ? exeFromProgId(progId) : null;
  const profile = name ? KNOWN_BROWSERS[name] : null;
  if (exe && name && profile) return { name, exe, profile };
  return null;
}

function readDebugPort(profileDir) {
  try {
    const raw = fs.readFileSync(path.join(profileDir, 'DevToolsActivePort'), 'utf8').trim();
    const port = parseInt(raw.split('\n')[0], 10);
    return port > 0 ? port : null;
  } catch {
    return null;
  }
}

async function waitForDebugPort(profileDir, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const port = readDebugPort(profileDir);
    if (port) return port;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

function launchWithDebug(browser) {
  const portFile = path.join(browser.profile, 'DevToolsActivePort');
  try { fs.unlinkSync(portFile); } catch {}
  const child = spawn(browser.exe, [
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + browser.profile,
  ], { detached: true, stdio: 'ignore' });
  child.unref();
}

async function getConnection(browser) {
  let port = readDebugPort(browser.profile);
  if (port) {
    try {
      return await chromium.connectOverCDP('http://127.0.0.1:' + port);
    } catch {}
  }

  launchWithDebug(browser);
  port = await waitForDebugPort(browser.profile);
  if (!port) {
    throw new Error(
      browser.name + ' is already running. Close it first so ClaudeCron can connect, then it will retry automatically.'
    );
  }
  return chromium.connectOverCDP('http://127.0.0.1:' + port);
}

async function visible(locator, timeout = 1500) {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function selectModel(page, model) {
  const name = model || 'Haiku';
  const pattern = new RegExp(name, 'i');
  if (await visible(page.getByText(pattern).first())) return;
  const selector = page.locator('button').filter({ hasText: /Claude|Sonnet|Opus|Haiku|model/i }).first();
  if (await visible(selector, 5000)) {
    await selector.click();
    const target = page.getByText(pattern).first();
    if (await visible(target, 8000)) {
      await target.click();
      await page.waitForTimeout(700);
      return;
    }
  }
  throw new Error('Model ' + name + ' not found. Make sure you are logged in and have access.');
}

async function findComposer(page) {
  const candidates = [
    page.locator('div[contenteditable="true"]').last(),
    page.locator('textarea').last(),
    page.getByRole('textbox').last(),
  ];
  for (const candidate of candidates) {
    if (await visible(candidate, 7000)) return candidate;
  }
  throw new Error('Composer not found. Log into claude.ai in your browser first.');
}

async function writeMessage(composer, message) {
  await composer.click();
  await composer.fill(message).catch(async () => {
    await composer.press('Control+A');
    await composer.press('Backspace');
    await composer.type(message);
  });
}

async function sendMessage(page) {
  const send = page.getByRole('button', { name: /send/i }).last();
  if (await visible(send, 3000)) {
    await send.click();
    return;
  }
  await page.keyboard.press('Enter');
}

async function runClaudeMessage({ message, model }) {
  const detected = detectBrowser();
  if (!detected) {
    throw new Error('No supported default browser found. Set Chrome, Edge, or Brave as your default browser.');
  }

  const browser = await getConnection(detected);
  const context = browser.contexts()[0];
  const page = await context.newPage();
  try {
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await selectModel(page, model);
    const composer = await findComposer(page);
    await writeMessage(composer, message);
    await sendMessage(page);
    await page.waitForTimeout(5000);
  } finally {
    await page.close().catch(() => {});
    browser.disconnect();
  }
}

module.exports = { detectBrowser, runClaudeMessage };
