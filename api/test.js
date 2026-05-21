const app = require("./index.js");

module.exports = (req, res) => {
  try {
    // Do NOT override req.url, just forward the request as is
    app(req, res);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
      stack: err.stack
    });
  }
};
