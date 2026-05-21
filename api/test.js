const YTDlpWrapModule = require("yt-dlp-wrap");
const YTDlpWrap = YTDlpWrapModule.default || YTDlpWrapModule;

let indexLoaded = false;
let indexError = null;
let indexExportType = null;

try {
  const index = require("./index.js");
  indexLoaded = true;
  indexExportType = typeof index;
} catch (err) {
  indexError = {
    message: err.message,
    stack: err.stack
  };
}

module.exports = (req, res) => {
  res.json({
    status: "ok",
    vercel: !!process.env.VERCEL,
    nodeVersion: process.version,
    time: new Date().toISOString(),
    indexLoaded,
    indexExportType,
    indexError
  });
};
