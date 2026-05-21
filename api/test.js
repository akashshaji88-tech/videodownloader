const app = require("./index.js");

module.exports = (req, res) => {
  try {
    // Override url to test the /api/auth/me endpoint
    req.url = "/api/auth/me";
    
    app(req, res);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
      stack: err.stack
    });
  }
};
