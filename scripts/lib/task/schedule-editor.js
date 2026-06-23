const fs = require('fs');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { scheduleSummary } = require('../config');
const { clearConsole, color, theme } = require('./ui');

function askLine(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function editorCommand(file) {
  if (process.env.VISUAL) return { command: process.env.VISUAL, args: [file] };
  if (process.env.EDITOR) return { command: process.env.EDITOR, args: [file] };
  if (process.platform === 'win32') return { command: 'notepad.exe', args: [file] };
  if (process.platform === 'darwin') return { command: 'open', args: ['-W', '-t', file] };
  return { command: 'vi', args: [file] };
}

function openEditor(file) {
  const editor = editorCommand(file);
  const result = spawnSync(editor.command, editor.args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${editor.command} failed with exit code ${result.status}.`);
}

async function configureSchedule(context, platform, install, reloadContext) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Configure Schedule requires an interactive terminal.');
  clearConsole();
  console.log(color(theme.title, 'Configure Schedule'));
  console.log('');
  console.log(`Config: ${context.configPath}`);
  console.log(`Current: ${scheduleSummary(context.config)}`);
  console.log('');
  console.log('Opening the config JSON. Save and close the editor to continue.');
  console.log('');

  const previousConfig = fs.readFileSync(context.configPath, 'utf8');
  try {
    openEditor(context.configPath);
    reloadContext();
  } catch (err) {
    fs.writeFileSync(context.configPath, previousConfig, 'utf8');
    reloadContext();
    throw err;
  }

  console.log('');
  console.log(`Saved: ${context.configPath}`);
  console.log(`New schedule: ${scheduleSummary(context.config)}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const apply = (await askLine(rl, 'Apply background schedule now? [Y/n]: ')).trim().toLowerCase();
    if (apply !== 'n' && apply !== 'no') {
      install();
      platform.enable(context);
      console.log('Background schedule updated.');
    }
  } finally {
    rl.close();
  }
}

module.exports = {
  configureSchedule,
};
