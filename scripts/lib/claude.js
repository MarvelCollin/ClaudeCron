const { spawnSync } = require('child_process');

function resolveClaudeCommand() {
  if (process.platform !== 'win32') return 'claude';
  const result = spawnSync('where.exe', ['claude'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('claude command was not found.');
  const commands = result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return commands.find(command => command.toLowerCase().endsWith('.cmd')) || commands[0];
}

module.exports = {
  resolveClaudeCommand,
};
