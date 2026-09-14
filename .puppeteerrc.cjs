// Where puppeteer keeps the Chrome it downloads for exports.
//
// On Render's native Node runtime the default cache (~/.cache/puppeteer) is
// filled during the build but is not carried into the running service, so
// every export failed at once with "Could not find Chrome". There the browser
// is kept inside node_modules, which does ship with the service. Locally
// nothing changes, and the Docker image uses its system Chromium instead
// (PUPPETEER_EXECUTABLE_PATH).
const { join } = require("path");

module.exports = process.env.RENDER
  ? { cacheDirectory: join(__dirname, "node_modules", ".puppeteer_cache") }
  : {};
