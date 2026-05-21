let currentURL = "";

// Session handling on page load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) {
      window.location.href = "login.html";
      return;
    }
    const data = await res.json();
    setupUserHeader(data.username);
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.href = "login.html";
  }
});

function setupUserHeader(username) {
  const userBar = document.getElementById("userBar");
  const currentUsername = document.getElementById("currentUsername");
  const userAvatar = document.getElementById("userAvatar");

  if (userBar && currentUsername && userAvatar) {
    currentUsername.textContent = username;
    userAvatar.textContent = username.charAt(0).toUpperCase();
    userBar.classList.remove("hidden");
  }
}

async function handleLogout() {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      window.location.href = "login.html";
    } else {
      alert("Sign out failed");
    }
  } catch (err) {
    alert("Connection error during sign out");
  }
}

async function fetchInfo() {
  currentURL = document.getElementById("urlInput").value.trim();
  if (!currentURL) return setStatus("Please enter a URL.");

  setStatus("⏳ Fetching video info...");
  document.getElementById("fetchBtn").disabled = true;

  // Hide components from previous fetches if any
  document.getElementById("videoInfo").classList.add("hidden");
  document.getElementById("formatSection").classList.add("hidden");
  document.getElementById("progressSection").classList.add("hidden");

  try {
    const res = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentURL }),
    });

    if (res.status === 401) {
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    if (data.error) return setStatus("❌ " + data.error);

    document.getElementById("thumbnail").src = data.thumbnail;
    document.getElementById("videoTitle").textContent = data.title;
    document.getElementById("videoDuration").textContent = "⏱ " + data.duration;
    document.getElementById("videoUploader").textContent = "👤 " + data.uploader;
    document.getElementById("videoInfo").classList.remove("hidden");

    const select = document.getElementById("formatSelect");
    select.innerHTML = "";
    data.formats.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.format_id;
      opt.textContent = `${f.resolution}  •  ${f.ext.toUpperCase()}  •  ${f.filesize}`;
      select.appendChild(opt);
    });

    document.getElementById("formatSection").classList.remove("hidden");
    setStatus("");
  } catch (err) {
    setStatus("❌ Network error. Is the server running?");
  } finally {
    document.getElementById("fetchBtn").disabled = false;
  }
}

async function downloadVideo() {
  const format_id = document.getElementById("formatSelect").value;
  const downloadBtn = document.getElementById("downloadBtn");
  
  downloadBtn.disabled = true;
  setStatus("⏳ Preparing download...");
  
  const progressSection = document.getElementById("progressSection");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  
  progressSection.classList.remove("hidden");
  progressFill.style.width = "10%";
  progressText.textContent = "Starting download...";

  try {
    // Simulate initial progress steps
    setTimeout(() => { progressFill.style.width = "40%"; progressText.textContent = "Downloading from YouTube..."; }, 500);
    setTimeout(() => { progressFill.style.width = "75%"; progressText.textContent = "Merging and processing..."; }, 1500);

    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentURL, format_id }),
    });

    if (res.status === 401) {
      window.location.href = "login.html";
      return;
    }

    if (!res.ok) {
      const err = await res.json();
      progressSection.classList.add("hidden");
      return setStatus("❌ " + err.error);
    }

    progressFill.style.width = "90%";
    progressText.textContent = "Receiving file...";

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filename = disposition.split("filename=")[1]?.replace(/"/g, "") || "video.mp4";

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();

    progressFill.style.width = "100%";
    progressText.textContent = "Complete!";
    setStatus("✅ Download complete!");
  } catch (err) {
    progressSection.classList.add("hidden");
    setStatus("❌ Download failed.");
  } finally {
    downloadBtn.disabled = false;
  }
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}