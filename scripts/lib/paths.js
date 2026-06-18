const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const configTemplatePath = path.join(root, 'claudecron.config.json');

function userDataDir(platform = process.platform) {
  if (platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ClaudeCron');
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'ClaudeCron');
  return path.join(os.homedir(), '.config', 'claudecron');
}

const defaultConfigPath = path.join(userDataDir(), 'claudecron.config.json');

function fromRoot(...parts) {
  return path.join(root, ...parts);
}

function resolveFromConfig(value, configPath) {
  return path.isAbsolute(value) ? value : path.join(path.dirname(configPath), value);
}

module.exports = {
  root,
  configTemplatePath,
  defaultConfigPath,
  fromRoot,
  resolveFromConfig,
  userDataDir,
};
