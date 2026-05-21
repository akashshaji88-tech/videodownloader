const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

module.exports = async (req, res) => {
  const reports = {};
  
  const YT_DLP_PATH = path.join(process.cwd(), "yt-dlp-linux");
  reports.YT_DLP_PATH = YT_DLP_PATH;
  reports.exists = fs.existsSync(YT_DLP_PATH);
  
  if (reports.exists) {
    try {
      const stats = fs.statSync(YT_DLP_PATH);
      reports.size = stats.size;
      reports.mode = stats.mode.toString(8);
    } catch (e) {
      reports.statError = e.message;
    }
    
    // Test execution of yt-dlp-linux
    await new Promise((resolve) => {
      exec(`"${YT_DLP_PATH}" --version`, (error, stdout, stderr) => {
        reports.execResult = {
          error: error ? error.message : null,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        };
        resolve();
      });
    });
  }

  // Also check if python is installed on the system
  await new Promise((resolve) => {
    exec("python3 --version || python --version", (error, stdout, stderr) => {
      reports.pythonResult = {
        error: error ? error.message : null,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
      resolve();
    });
  });

  res.status(200).json(reports);
};

