const express = require("express");
const YTDlpWrap = require("yt-dlp-wrap").default;
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;
const DOWNLOAD_FOLDER = path.join(__dirname, "downloads");
const USERS_FILE = path.join(__dirname, "data", "users.json");
const LOGINS_FILE = path.join(__dirname, "data", "logins.json");
const CONFIG_FILE = path.join(__dirname, "config.json");

// Ensure data folder exists
const DATA_FOLDER = path.join(__dirname, "data");
if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER);
}

// Load config
let adminPassword = "admin2026";
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (config.adminPassword) {
      adminPassword = config.adminPassword;
    }
  } catch (err) {
    console.error("Failed to read config:", err);
  }
} else {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ adminPassword }, null, 2));
}

app.use(express.json());
app.use(express.static("public"));

if (!fs.existsSync(DOWNLOAD_FOLDER)) {
  fs.mkdirSync(DOWNLOAD_FOLDER);
}

const ytDlp = new YTDlpWrap("./yt-dlp");

// In-memory sessions storage (token -> { username, isAdmin })
const activeSessions = new Map();

// Helper: Parse cookie from request headers
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, ...valueParts] = cookie.split("=");
    acc[key.trim()] = valueParts.join("=");
    return acc;
  }, {});
  return cookies[name] || null;
}

// Helper: Hash password with PBKDF2
function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString("hex");
  }
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return { salt, hash };
}

// Helpers: Load/Save JSON DB
function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (err) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadLogins() {
  try {
    if (!fs.existsSync(LOGINS_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOGINS_FILE, "utf8"));
  } catch (err) {
    return [];
  }
}

function saveLogins(logins) {
  fs.writeFileSync(LOGINS_FILE, JSON.stringify(logins, null, 2));
}

function addLoginLog(username, ip, status) {
  const logs = loadLogins();
  logs.push({
    id: uuidv4(),
    username,
    timestamp: new Date().toISOString(),
    ip,
    status
  });
  saveLogins(logs);
}

// Middlewares
function authenticate(req, res, next) {
  const token = getCookie(req, "session_token");
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  req.session = activeSessions.get(token);
  next();
}

function adminAuthenticate(req, res, next) {
  const token = getCookie(req, "admin_token");
  if (!token || !activeSessions.has(token) || !activeSessions.get(token).isAdmin) {
    return res.status(401).json({ error: "Unauthorized. Admin access required." });
  }
  req.session = activeSessions.get(token);
  next();
}

// Auth API Endpoints
app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const users = loadUsers();
  if (users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const { salt, hash } = hashPassword(password);
  const newUser = {
    id: uuidv4(),
    username: cleanUsername,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);

  res.json({ success: true, message: "User registered successfully" });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const cleanUsername = username.trim();
  const users = loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());

  if (!user) {
    addLoginLog(cleanUsername, ip, "failed");
    return res.status(400).json({ error: "Invalid username or password" });
  }

  const { hash } = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    addLoginLog(user.username, ip, "failed");
    return res.status(400).json({ error: "Invalid username or password" });
  }

  // Success
  addLoginLog(user.username, ip, "success");
  const token = uuidv4();
  activeSessions.set(token, { username: user.username, isAdmin: false });

  res.cookie("session_token", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 24 hours
  res.json({ success: true, username: user.username });
});

app.post("/api/auth/logout", (req, res) => {
  const token = getCookie(req, "session_token");
  if (token) {
    activeSessions.delete(token);
  }
  res.clearCookie("session_token");
  res.json({ success: true });
});

app.get("/api/auth/me", (req, res) => {
  const token = getCookie(req, "session_token");
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const session = activeSessions.get(token);
  res.json({ username: session.username });
});

// Admin API Endpoints
app.post("/api/admin/verify", (req, res) => {
  const { password } = req.body;
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password !== adminPassword) {
    addLoginLog("admin", ip, "admin_failed");
    return res.status(401).json({ error: "Invalid security password" });
  }

  addLoginLog("admin", ip, "admin_success");
  const token = uuidv4();
  activeSessions.set(token, { username: "admin", isAdmin: true });

  res.cookie("admin_token", token, { httpOnly: true, maxAge: 2 * 60 * 60 * 1000 }); // 2 hours
  res.json({ success: true });
});

app.get("/api/admin/logs", adminAuthenticate, (req, res) => {
  const users = loadUsers().map((u) => ({ username: u.username, createdAt: u.createdAt }));
  const logins = loadLogins();
  res.json({ users, logins });
});

app.post("/api/admin/clear-logs", adminAuthenticate, (req, res) => {
  saveLogins([]);
  res.json({ success: true });
});

app.post("/api/admin/logout", (req, res) => {
  const token = getCookie(req, "admin_token");
  if (token) {
    activeSessions.delete(token);
  }
  res.clearCookie("admin_token");
  res.json({ success: true });
});

// Protected Downloader APIs
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/info", authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    const metadata = await ytDlp.getVideoInfo(url);
    const formats = metadata.formats
      .filter((f) => f.vcodec !== "none" && f.resolution)
      .map((f) => ({
        format_id: f.format_id,
        resolution: f.resolution,
        ext: f.ext,
        filesize: f.filesize
          ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB`
          : "Unknown",
      }));

    const seen = new Set();
    const uniqueFormats = formats
      .reverse()
      .filter((f) => {
        if (seen.has(f.resolution)) return false;
        seen.add(f.resolution);
        return true;
      })
      .slice(0, 6);

    res.json({
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: formatDuration(metadata.duration),
      uploader: metadata.uploader,
      formats: uniqueFormats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch video info" });
  }
});

app.post("/api/download", authenticate, async (req, res) => {
  const { url, format_id } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  const filename = `${uuidv4()}.mp4`;
  const filepath = path.join(DOWNLOAD_FOLDER, filename);

  try {
    const metadata = await ytDlp.getVideoInfo(url);
    const title = metadata.title.replace(/[^a-z0-9 \-_]/gi, "_");

    await ytDlp.execPromise([
      url,
      "-f", format_id || "bestvideo+bestaudio/best",
      "--merge-output-format", "mp4",
      "-o", filepath,
      "--no-playlist",
    ]);

    res.download(filepath, `${title}.mp4`, (err) => {
      fs.unlink(filepath, () => {});
      if (err) console.error("Send error:", err);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});

function formatDuration(seconds) {
  if (!seconds) return "Unknown";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});