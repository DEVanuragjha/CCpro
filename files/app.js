// ============================================================
//  app.js — Dashboard application logic
//  Uses Supabase Auth + Storage + PostgreSQL (Firestore API)
// ============================================================

import { getSupabase, signOut, getCurrentUser, onAuthChange, STORAGE_BUCKET } from "./firebase.js";

// ── Load Supabase CDN ──────────────────────────────────────
const sdkScript = document.createElement("script");
sdkScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
sdkScript.onload = () => initApp();
document.head.appendChild(sdkScript);

// ── App state ──────────────────────────────────────────────
let currentUser  = null;
let allFiles     = [];         // all non-trashed files for current user
let trashedFiles = [];         // soft-deleted files
let currentView  = "grid";    // "grid" | "list"
let shareTarget  = null;       // file object being shared

// ── Entry point ────────────────────────────────────────────
async function initApp() {
  // Auth guard — redirect to login if not signed in
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  populateProfileUI();
  await loadFiles();
  bindEvents();
}

// ── Populate top-bar profile info ──────────────────────────
function populateProfileUI() {
  const meta  = currentUser.user_metadata || {};
  const name  = meta.full_name || currentUser.email.split("@")[0];
  const email = currentUser.email;
  const initial = name.charAt(0).toUpperCase();

  document.getElementById("userAvatar").textContent = initial;
  document.getElementById("profileName").textContent  = name;
  document.getElementById("profileEmail").textContent = email;
  document.getElementById("welcomeName").textContent  = name.split(" ")[0];
}

// ── Logout ─────────────────────────────────────────────────
window.logout = async function () {
  await signOut();
  window.location.href = "index.html";
};

// ── Load files from Supabase ───────────────────────────────
async function loadFiles() {
  const sb = getSupabase();

  // Fetch metadata from "files" table
  const { data, error } = await sb
    .from("files")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading files:", error);
    showToast("Could not load files", "error");
    return;
  }

  allFiles     = (data || []).filter(f => !f.trashed);
  trashedFiles = (data || []).filter(f =>  f.trashed);

  renderAll();
  updateStats();
}

// ── Render helpers ─────────────────────────────────────────
function renderAll() {
  renderFileGrid("recentFiles",   allFiles.slice(0, 8), { showEmpty: true, emptyId: "recentEmpty" });
  renderFileGrid("myFilesGrid",   allFiles,             { showEmpty: true, emptyId: "myFilesEmpty" });
  renderFileGrid("sharedFilesGrid", allFiles.filter(f => f.is_public), {});
  renderFileGrid("trashFilesGrid",  trashedFiles, { trash: true, emptyId: "trashEmpty" });

  // Show / hide empty trash button
  document.getElementById("emptyTrashBtn").style.display =
    trashedFiles.length ? "block" : "none";
}

/**
 * Renders an array of file objects into a grid container.
 * @param {string}  containerId
 * @param {Array}   files
 * @param {Object}  opts  – { showEmpty, emptyId, trash }
 */
function renderFileGrid(containerId, files, { showEmpty = false, emptyId, trash = false } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Remove existing file cards (keep .empty-state element)
  container.querySelectorAll(".file-card").forEach(el => el.remove());

  const emptyEl = emptyId ? document.getElementById(emptyId) : container.querySelector(".empty-state");

  if (files.length === 0) {
    if (emptyEl) emptyEl.style.display = "";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  files.forEach(file => {
    const card = buildFileCard(file, trash);
    container.appendChild(card);
  });
}

// ── Build a file card DOM element ──────────────────────────
function buildFileCard(file, isTrash = false) {
  const card = document.createElement("div");
  card.className = "file-card";
  card.dataset.id = file.id;

  const typeInfo = getFileTypeInfo(file.name, file.type);
  const sizeStr  = formatSize(file.size);
  const dateStr  = formatDate(file.created_at);

  if (file.is_public) {
    card.innerHTML += `<div class="shared-badge">Shared</div>`;
  }

  if (currentView === "list") {
    card.innerHTML += `
      <div class="file-card-icon ${typeInfo.cls}">${typeInfo.icon}</div>
      <div class="file-card-body">
        <div class="file-card-name" title="${file.name}">${file.name}</div>
        <div class="file-card-meta">${sizeStr} · ${dateStr}</div>
      </div>
    `;
  } else {
    card.innerHTML += `
      <div class="file-card-icon ${typeInfo.cls}">${typeInfo.icon}</div>
      <div class="file-card-name" title="${file.name}">${file.name}</div>
      <div class="file-card-meta">${sizeStr} · ${dateStr}</div>
    `;
  }

  // Action buttons
  const actions = document.createElement("div");
  actions.className = "file-card-actions";

  if (isTrash) {
    // Restore + delete permanently
    actions.innerHTML = `
      <button class="btn-icon" title="Restore" onclick="restoreFile('${file.id}')">
        ${iconRestore()}
      </button>
      <button class="btn-icon" title="Delete permanently" style="color:var(--danger)" onclick="permanentDelete('${file.id}','${escAttr(file.storage_path)}')">
        ${iconTrash()}
      </button>
    `;
  } else {
    // Download + share + delete
    actions.innerHTML = `
      <button class="btn-icon" title="Download" onclick="downloadFile('${escAttr(file.storage_path)}','${escAttr(file.name)}')">
        ${iconDownload()}
      </button>
      <button class="btn-icon" title="Share" onclick="openShareModal('${file.id}')">
        ${iconShare()}
      </button>
      <button class="btn-icon" title="Move to trash" style="color:var(--danger)" onclick="trashFile('${file.id}')">
        ${iconTrash()}
      </button>
    `;
  }

  card.appendChild(actions);
  return card;
}

// ── Stats update ───────────────────────────────────────────
function updateStats() {
  const totalSize = allFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const sharedCnt = allFiles.filter(f => f.is_public).length;

  document.getElementById("statTotalFiles").textContent = allFiles.length;
  document.getElementById("statStorage").textContent    = formatSize(totalSize);
  document.getElementById("statShared").textContent     = sharedCnt;
  document.getElementById("statTrashed").textContent    = trashedFiles.length;
  document.getElementById("storageUsed").textContent    = `${formatSize(totalSize)} / ∞`;

  // Fake usage bar (just for visual) — cap at 90% for demo
  const pct = Math.min(totalSize / (1024 * 1024 * 500) * 100, 90);
  document.getElementById("storageFill").style.width = pct + "%";
}

// ── Sidebar section switching ──────────────────────────────
window.switchSection = function (name, el) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById(`section-${name}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  el.classList.add("active");

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) closeSidebar();
};

// ── Sidebar toggle (mobile) ────────────────────────────────
window.toggleSidebar = function () {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("open");

  // Overlay
  let overlay = document.querySelector(".sidebar-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle("show", sidebar.classList.contains("open"));
};

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  const overlay = document.querySelector(".sidebar-overlay");
  if (overlay) overlay.classList.remove("show");
}

// ── Profile dropdown ───────────────────────────────────────
window.toggleProfileDropdown = function () {
  document.getElementById("profileDropdown").classList.toggle("open");
};
document.addEventListener("click", e => {
  if (!e.target.closest(".profile-menu")) {
    document.getElementById("profileDropdown")?.classList.remove("open");
  }
});

// ── View toggle (grid / list) ──────────────────────────────
window.setView = function (view) {
  currentView = view;
  document.getElementById("gridViewBtn").classList.toggle("active", view === "grid");
  document.getElementById("listViewBtn").classList.toggle("active", view === "list");

  const grid = document.getElementById("myFilesGrid");
  grid.classList.toggle("list-view", view === "list");

  // Re-render so card layout rebuilds
  renderFileGrid("myFilesGrid", allFiles, { showEmpty: true, emptyId: "myFilesEmpty" });
};

// ── Theme toggle ───────────────────────────────────────────
window.toggleTheme = function () {
  document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
};
// Restore saved theme
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-mode");
}

// ── Search ─────────────────────────────────────────────────
window.searchFiles = function (query) {
  const q = query.toLowerCase().trim();
  const filtered = q ? allFiles.filter(f => f.name.toLowerCase().includes(q)) : allFiles;
  renderFileGrid("myFilesGrid", filtered, { showEmpty: true, emptyId: "myFilesEmpty" });

  // Activate My Files section
  switchSection("myfiles", document.querySelector('[data-section="myfiles"]'));
};

// ── Upload ─────────────────────────────────────────────────
function bindEvents() {
  const modal        = document.getElementById("uploadModal");
  const dropZone     = document.getElementById("dropZone");
  const fileInput    = document.getElementById("fileInput");
  const uploadBtns   = [
    document.getElementById("sidebarUploadBtn"),
    document.getElementById("uploadTrigger"),
  ];

  uploadBtns.forEach(btn => btn?.addEventListener("click", () => modal.classList.add("open")));

  // Close modal when clicking overlay background
  modal.addEventListener("click", e => { if (e.target === modal) closeUploadModal(); });

  // Drag & Drop
  dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    handleFiles(Array.from(e.dataTransfer.files));
  });

  // Click to browse
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFiles(Array.from(fileInput.files)));
}

window.closeUploadModal = function () {
  document.getElementById("uploadModal").classList.remove("open");
  document.getElementById("uploadQueue").innerHTML = "";
  document.getElementById("fileInput").value = "";
};

/**
 * Handles an array of File objects — shows progress, uploads each.
 */
async function handleFiles(files) {
  if (!files.length) return;
  const queue = document.getElementById("uploadQueue");

  for (const file of files) {
    const itemId  = `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const itemEl  = createQueueItem(itemId, file.name);
    queue.appendChild(itemEl);

    try {
      await uploadFile(file, itemId);
    } catch (err) {
      setQueueItemStatus(itemId, "error", "Failed");
      showToast(`Failed to upload ${file.name}: ${err.message}`, "error");
    }
  }

  // Refresh file list after a short wait
  setTimeout(async () => {
    await loadFiles();
    closeUploadModal();
    showToast("Upload complete!", "success");
  }, 800);
}

/**
 * Uploads a single file to Supabase Storage and stores metadata in DB.
 */
async function uploadFile(file, queueId) {
  const sb        = getSupabase();
  const ext       = file.name.split(".").pop();
  const safeId    = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Upload to Storage
  const { data: storageData, error: storageError } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(safeId, file, {
      cacheControl: "3600",
      upsert: false,
      onUploadProgress: (progress) => {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        setQueueProgress(queueId, pct);
      },
    });

  if (storageError) throw storageError;

  setQueueProgress(queueId, 100, "done");
  setQueueItemStatus(queueId, "done", "Uploaded");

  // Store metadata in Postgres
  const { error: dbError } = await sb.from("files").insert({
    user_id:      currentUser.id,
    name:         file.name,
    size:         file.size,
    type:         file.type || "application/octet-stream",
    storage_path: safeId,
    is_public:    false,
    trashed:      false,
  });

  if (dbError) throw dbError;
}

// ── Download ───────────────────────────────────────────────
window.downloadFile = async function (storagePath, fileName) {
  const sb = getSupabase();
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error) { showToast("Download failed", "error"); return; }

  const url  = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url; link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

// ── Trash file (soft delete) ───────────────────────────────
window.trashFile = async function (fileId) {
  const sb = getSupabase();
  const { error } = await sb.from("files").update({ trashed: true }).eq("id", fileId);
  if (error) { showToast("Could not delete file", "error"); return; }
  showToast("Moved to trash", "info");
  await loadFiles();
};

// ── Restore from trash ─────────────────────────────────────
window.restoreFile = async function (fileId) {
  const sb = getSupabase();
  const { error } = await sb.from("files").update({ trashed: false }).eq("id", fileId);
  if (error) { showToast("Could not restore file", "error"); return; }
  showToast("File restored", "success");
  await loadFiles();
};

// ── Permanent delete ───────────────────────────────────────
window.permanentDelete = async function (fileId, storagePath) {
  if (!confirm("Permanently delete this file? This cannot be undone.")) return;
  const sb = getSupabase();

  // Delete from storage
  await sb.storage.from(STORAGE_BUCKET).remove([storagePath]);

  // Delete metadata
  await sb.from("files").delete().eq("id", fileId);
  showToast("File permanently deleted", "error");
  await loadFiles();
};

// ── Empty trash ────────────────────────────────────────────
window.emptyTrash = async function () {
  if (!confirm(`Permanently delete all ${trashedFiles.length} trashed file(s)?`)) return;
  const sb = getSupabase();

  const paths = trashedFiles.map(f => f.storage_path);
  if (paths.length) await sb.storage.from(STORAGE_BUCKET).remove(paths);

  const ids = trashedFiles.map(f => f.id);
  await sb.from("files").delete().in("id", ids);

  showToast("Trash emptied", "info");
  await loadFiles();
};

// ── Share modal ────────────────────────────────────────────
window.openShareModal = async function (fileId) {
  shareTarget = allFiles.find(f => f.id === fileId);
  if (!shareTarget) return;

  const modal     = document.getElementById("shareModal");
  const typeInfo  = getFileTypeInfo(shareTarget.name, shareTarget.type);

  document.getElementById("shareFileIcon").textContent = typeInfo.icon;
  document.getElementById("shareFileName").textContent = shareTarget.name;
  document.getElementById("shareFileSize").textContent = formatSize(shareTarget.size);

  const toggle = document.getElementById("publicToggle");
  toggle.checked = shareTarget.is_public;

  const linkBox = document.getElementById("linkBox");
  linkBox.classList.toggle("active", shareTarget.is_public);

  if (shareTarget.is_public) {
    document.getElementById("shareLink").value = getPublicUrl(shareTarget.storage_path);
  }

  modal.classList.add("open");
};

window.togglePublicAccess = async function (isPublic) {
  if (!shareTarget) return;
  const sb = getSupabase();

  const { error } = await sb.from("files")
    .update({ is_public: isPublic })
    .eq("id", shareTarget.id);

  if (error) { showToast("Could not update sharing", "error"); return; }

  shareTarget.is_public = isPublic;

  const linkBox = document.getElementById("linkBox");
  linkBox.classList.toggle("active", isPublic);

  if (isPublic) {
    document.getElementById("shareLink").value = getPublicUrl(shareTarget.storage_path);
    showToast("File is now public", "success");
  } else {
    showToast("File is now private", "info");
  }

  // Update local state so badge shows correctly
  const idx = allFiles.findIndex(f => f.id === shareTarget.id);
  if (idx > -1) allFiles[idx].is_public = isPublic;
  renderAll();
};

window.copyShareLink = function () {
  const link = document.getElementById("shareLink").value;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById("copyBtn");
    btn.classList.add("copied");
    btn.querySelector("svg").remove();
    btn.textContent = "✓ Copied!";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  });
};

// ── Get public URL for a storage path ─────────────────────
function getPublicUrl(storagePath) {
  const sb = getSupabase();
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || "";
}

// ── Queue UI helpers ───────────────────────────────────────
function createQueueItem(id, name) {
  const el = document.createElement("div");
  el.id = id; el.className = "queue-item";
  el.innerHTML = `
    <div class="queue-item-header">
      <div class="queue-item-name">${name}</div>
      <div class="queue-item-status" id="${id}-status">Uploading…</div>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="${id}-fill"></div></div>
  `;
  return el;
}

function setQueueProgress(id, pct, state = "") {
  const fill = document.getElementById(`${id}-fill`);
  if (!fill) return;
  fill.style.width = pct + "%";
  if (state) fill.classList.add(state);
}

function setQueueItemStatus(id, state, label) {
  const el = document.getElementById(`${id}-status`);
  if (!el) return;
  el.textContent = label;
  el.style.color = state === "done" ? "var(--success)" : state === "error" ? "var(--danger)" : "";
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const el = document.getElementById("dashToast");
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 4000);
}

// ── Utility: file type icons & colours ────────────────────
function getFileTypeInfo(name, mime = "") {
  const ext = name.split(".").pop().toLowerCase();

  const maps = {
    pdf:  { cls: "type-pdf",   icon: "📄" },
    png:  { cls: "type-image", icon: "🖼️" },
    jpg:  { cls: "type-image", icon: "🖼️" },
    jpeg: { cls: "type-image", icon: "🖼️" },
    gif:  { cls: "type-image", icon: "🖼️" },
    webp: { cls: "type-image", icon: "🖼️" },
    svg:  { cls: "type-image", icon: "🖼️" },
    mp4:  { cls: "type-video", icon: "🎬" },
    mov:  { cls: "type-video", icon: "🎬" },
    avi:  { cls: "type-video", icon: "🎬" },
    mkv:  { cls: "type-video", icon: "🎬" },
    mp3:  { cls: "type-audio", icon: "🎵" },
    wav:  { cls: "type-audio", icon: "🎵" },
    ogg:  { cls: "type-audio", icon: "🎵" },
    zip:  { cls: "type-zip",   icon: "🗜️" },
    rar:  { cls: "type-zip",   icon: "🗜️" },
    "7z": { cls: "type-zip",   icon: "🗜️" },
    doc:  { cls: "type-doc",   icon: "📝" },
    docx: { cls: "type-doc",   icon: "📝" },
    txt:  { cls: "type-doc",   icon: "📝" },
    md:   { cls: "type-doc",   icon: "📝" },
    xls:  { cls: "type-sheet", icon: "📊" },
    xlsx: { cls: "type-sheet", icon: "📊" },
    csv:  { cls: "type-sheet", icon: "📊" },
    ppt:  { cls: "type-doc",   icon: "📊" },
    pptx: { cls: "type-doc",   icon: "📊" },
  };

  return maps[ext] || { cls: "type-file", icon: "📁" };
}

// ── Utility: format file size ──────────────────────────────
function formatSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── Utility: format date ───────────────────────────────────
function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Utility: escape HTML attribute value ──────────────────
function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

// ── SVG icon helpers ───────────────────────────────────────
const iconDownload = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const iconShare    = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
const iconTrash    = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const iconRestore  = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>`;
