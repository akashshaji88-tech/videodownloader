const fs = require("fs");
const path = require("path");

const YT_DLP_PATH = path.join(__dirname, "..", "yt-dlp-linux");

module.exports = (req, res) => {
  res.json({
    status: "ok",
    vercel: !!process.env.VERCEL,
    nodeVersion: process.version,
    time: new Date().toISOString(),
    binaryExists: fs.existsSync(YT_DLP_PATH),
    binaryPath: YT_DLP_PATH,
    dirname: __dirname,
    cwd: process.cwd()
  });
};
