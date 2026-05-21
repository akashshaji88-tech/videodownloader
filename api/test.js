const YTDlpWrapModule = require("yt-dlp-wrap");
const YTDlpWrap = YTDlpWrapModule.default || YTDlpWrapModule;

module.exports = (req, res) => {
  res.json({
    status: "ok",
    vercel: !!process.env.VERCEL,
    nodeVersion: process.version,
    time: new Date().toISOString(),
    ytDlpModuleLoaded: !!YTDlpWrapModule,
    ytDlpType: typeof YTDlpWrap
  });
};
