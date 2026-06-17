const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright-core');

const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

const KNOWN_EXE_PATHS = {
  Chrome: [
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ],
  Edge: [
    path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ],
  Brave: [
    path.join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(process.env.PROGRAMFILES || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  ],
};

function findExe(name) {
  for (const p of (KNOWN_EXE_PATHS[name] || [])) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function detectDefault() {
  try {
    const key = String.raw`HKEY_CURRENT_USER\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice`;
    const out = execSync(`reg query "${key}" /v ProgId`, { encoding: 'utf8', windowsHide: true });
    const m = out.match(/ProgId\s+REG_SZ\s+(\S+)/);
    if (!m) return null;
    const id = m[1].toLowerCase();
    if (id.startsWith('msedge')) return 'Edge';
    if (id.startsWith('chrome')) return 'Chrome';
    if (id.startsWith('brave')) return 'Brave';
  } catch {}
  return null;
}

function listBrowsers() {
  return Object.keys(KNOWN_EXE_PATHS).filter(name => findExe(name));
}

function resolveBrowser(browserName) {
  const name = (browserName && browserName !== 'Default') ? browserName : detectDefault();
  if (!name) throw new Error('No supported browser found. Set Chrome, Edge, or Brave as default.');
  const exe = findExe(name);
  if (!exe) throw new Error(name + ' is not installed.');
  return { name, exe };
}

let profileDir = null;
let activeContext = null;
let activeExe = null;

function setProfileDir(dir) {
  profileDir = dir;
  fs.mkdirSync(dir, { recursive: true });
}

async function ensureContext(exe) {
  if (activeContext) {
    try {
      if (activeExe === exe) {
        activeContext.pages();
        return activeContext;
      }
      await activeContext.close().catch(() => {});
    } catch {}
    activeContext = null;
    activeExe = null;
  }
  activeContext = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    executablePath: exe,
    args: ['--no-first-run', '--no-default-browser-check'],
    viewport: null,
  });
  activeExe = exe;
  activeContext.on('close', () => {
    activeContext = null;
    activeExe = null;
  });
  return activeContext;
}

async function visible(locator, timeout = 1500) {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function selectModel(page, model) {
  const name = model || 'Haiku';
  const pattern = new RegExp(name, 'i');

  await page.waitForTimeout(2500);

  if (await visible(page.getByText(pattern).first(), 3000)) return;

  const openers = [
    page.locator('button').filter({ hasText: /Sonnet|Opus|Haiku|Fable/i }).first(),
    page.locator('[role="button"]').filter({ hasText: /Sonnet|Opus|Haiku|Fable/i }).first(),
    page.locator('button').filter({ hasText: /model/i }).first(),
    page.locator('[data-testid*="model"]').first(),
  ];

  for (const opener of openers) {
    if (!(await visible(opener, 2000))) continue;
    await opener.click();
    await page.waitForTimeout(600);

    const target = page.getByText(pattern).first();
    if (await visible(target, 4000)) {
      await target.click();
      await page.waitForTimeout(700);
      return;
    }

    const more = page.getByText(/more model/i).first();
    if (await visible(more, 1500)) {
      await more.click();
      await page.waitForTimeout(500);
      const target2 = page.getByText(pattern).first();
      if (await visible(target2, 4000)) {
        await target2.click();
        await page.waitForTimeout(700);
        return;
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
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
  return null;
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

async function openClaudeLogin(browserName) {
  const { exe } = resolveBrowser(browserName);
  const context = await ensureContext(exe);
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://claude.ai', { waitUntil: 'domcontentloaded', timeout: 30_000 });
}

async function runClaudeMessage({ message, model, browserName }) {
  const { exe } = resolveBrowser(browserName);
  const context = await ensureContext(exe);
  const page = await context.newPage();
  let keepOpen = false;
  try {
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await selectModel(page, model);
    const composer = await findComposer(page);
    if (!composer) {
      keepOpen = true;
      throw new Error('Not logged in. Run "npm run login" first, then try again.');
    }
    await writeMessage(composer, message);
    await sendMessage(page);
    await page.waitForTimeout(5000);
  } finally {
    if (!keepOpen) {
      for (const p of context.pages()) {
        await p.close().catch(() => {});
      }
    }
  }
}

async function closeAutomation() {
  if (!activeContext) return;
  const context = activeContext;
  activeContext = null;
  activeExe = null;
  await context.close();
}

module.exports = {
  setProfileDir, detectDefault, listBrowsers,
  openClaudeLogin, runClaudeMessage, closeAutomation,
};
