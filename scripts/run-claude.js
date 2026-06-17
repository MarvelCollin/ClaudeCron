const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function loadConfig() {
  const configPath = path.resolve(argValue('--config') || path.join(root, 'claudecron.config.json'));
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.prompt || typeof config.prompt !== 'string') throw new Error('prompt is required.');
  if (config.model !== 'haiku') throw new Error('model must be haiku.');
  if (!config.logFile || typeof config.logFile !== 'string') throw new Error('logFile is required.');
  return { config, configPath };
}

function logPathFor(config) {
  return path.isAbsolute(config.logFile) ? config.logFile : path.join(root, config.logFile);
}

function appendLog(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, text, 'utf8');
}

function resolveClaudeCommand() {
  if (process.platform !== 'win32') return 'claude';
  const result = spawnSync('where.exe', ['claude'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('claude command was not found.');
  const commands = result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return commands.find(command => command.toLowerCase().endsWith('.cmd')) || commands[0];
}

function main() {
  const { config } = loadConfig();
  const logPath = logPathFor(config);
  appendLog(logPath, `[${new Date().toISOString()}] start\n`);
  const result = spawnSync(resolveClaudeCommand(), ['-p', config.prompt, '--model', config.model], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.stdout) appendLog(logPath, result.stdout);
  if (result.stderr) appendLog(logPath, result.stderr);
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  appendLog(logPath, `[${new Date().toISOString()}] exit ${exitCode}\n`);
  process.exitCode = exitCode;
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
