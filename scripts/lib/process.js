const { spawnSync } = require('child_process');
const { root } = require('./paths');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `${command} failed with exit code ${result.status}`).trim();
    throw new Error(message);
  }
  return result.stdout || '';
}

function runInherited(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}.`);
}

module.exports = {
  run,
  runInherited,
};
