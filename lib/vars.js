const path = require('path');

const PUBLIC_PATH = path.join(process.cwd(), './public');

const PUBLIC_APP_PATH = path.join(PUBLIC_PATH, 'app.js');

const PUBLIC_WEBPACK_RUNTIME_PATH = path.join(PUBLIC_PATH, 'webpack-runtime.js');

const UPLOAD_MANIFEST_PATH = path.join(process.cwd(), './upload.manifest.json');

module.exports = {
  PUBLIC_PATH,
  PUBLIC_APP_PATH,
  PUBLIC_WEBPACK_RUNTIME_PATH,
  UPLOAD_MANIFEST_PATH,
}