const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

function braveCandidates() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return [
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    path.join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
  ];
}

function findBrave() {
  const brave = braveCandidates().find(file => fs.existsSync(file));
  if (!brave) throw new Error('Brave tidak ditemukan. Install Brave atau pastikan path default Windows tersedia.');
  return brave;
}

function openClaudeLogin(userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const child = spawn(findBrave(), [`--user-data-dir=${userDataDir}`, 'https://claude.ai'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
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
    page.getByRole('textbox').last()
  ];
  for (const candidate of candidates) {
    if (await visible(candidate, 7000)) return candidate;
  }
  throw new Error('Composer Claude tidak ditemukan. Login dulu lewat tombol Open Claude Login.');
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

async function runClaudeMessage({ userDataDir, message, model }) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: findBrave(),
    headless: false,
    viewport: null,
    args: ['--start-maximized']
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' });
    await selectModel(page, model);
    const composer = await findComposer(page);
    await writeMessage(composer, message);
    await sendMessage(page);
    await page.waitForTimeout(5000);
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = {
  openClaudeLogin,
  runClaudeMessage
};
