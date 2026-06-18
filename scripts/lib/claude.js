const { spawnSync } = require('child_process');

function windowsClaudeScript() {
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    '(Get-Command claude -ErrorAction Stop).Source',
  ], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'claude command was not found.').trim());
  return result.stdout.trim();
}

function claudeCommand(prompt, model) {
  if (process.platform !== 'win32') {
    return { command: 'claude', args: ['-p', prompt, '--model', model] };
  }
  const script = windowsClaudeScript();
  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-p',
      prompt,
      '--model',
      model,
    ],
  };
}

module.exports = {
  claudeCommand,
};
