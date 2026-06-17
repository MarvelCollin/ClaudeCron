const os = require('os');
const path = require('path');
const { setProfileDir, openClaudeLogin, runClaudeMessage, closeAutomation } = require('./automation');

const browserName = process.env.CLAUDECRON_BROWSER || 'Default';
const model = process.env.CLAUDECRON_MODEL || 'Haiku';
const message = process.env.CLAUDECRON_MESSAGE || 'hi';
const profileRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

setProfileDir(path.join(profileRoot, 'ClaudeCron', 'automation-profile'));

async function main() {
  const command = process.argv[2] || 'run';

  if (command === 'login') {
    await openClaudeLogin(browserName);
    return;
  }

  if (command !== 'run') {
    throw new Error('Usage: node src/cli.js [run|login]');
  }

  await runClaudeMessage({ message, model, browserName });
  await closeAutomation();
}

main().catch(async err => {
  await closeAutomation();
  console.error(err.message);
  process.exitCode = 1;
});
