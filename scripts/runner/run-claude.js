const { spawnSync } = require('child_process');
const { root } = require('../lib/paths');
const { loadConfig } = require('../lib/config');
const { appendLog } = require('../lib/log');
const { claudeCommand } = require('../lib/claude');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const context = loadConfig(argValue('--config') || undefined);
  let exitCode = 1;
  appendLog(context.logPath, `[${new Date().toISOString()}] start\n`);
  try {
    const invocation = claudeCommand(context.config.prompt, context.config.model);
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.stdout) appendLog(context.logPath, result.stdout);
    if (result.stderr) appendLog(context.logPath, result.stderr);
    exitCode = typeof result.status === 'number' ? result.status : 1;
  } catch (err) {
    appendLog(context.logPath, `${err.message}\n`);
    console.error(err.message);
  } finally {
    appendLog(context.logPath, `[${new Date().toISOString()}] exit ${exitCode}\n`);
    process.exitCode = exitCode;
  }
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
