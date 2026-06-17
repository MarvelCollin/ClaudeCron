const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const defaultConfigPath = path.join(root, 'claudecron.config.json');

function fromRoot(...parts) {
  return path.join(root, ...parts);
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

module.exports = {
  root,
  defaultConfigPath,
  fromRoot,
  resolveFromRoot,
};
