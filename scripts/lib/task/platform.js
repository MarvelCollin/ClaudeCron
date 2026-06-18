const windows = require('../platforms/windows');
const macos = require('../platforms/macos');

function selectPlatform() {
  if (process.platform === 'win32') return windows;
  if (process.platform === 'darwin') return macos;
  throw new Error('Only Windows and macOS are supported.');
}

module.exports = {
  selectPlatform,
};
