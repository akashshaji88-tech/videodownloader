module.exports = (req, res) => {
  res.json({
    status: "ok",
    vercel: !!process.env.VERCEL,
    nodeVersion: process.version,
    time: new Date().toISOString()
  });
};
