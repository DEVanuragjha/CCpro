// ============================================================
//  pages/login.js — Auth page logic
// ============================================================

import { signIn, signUp, getCurrentUser } from "./firebase.js";

// ── Load Supabase CDN before anything else ─────────────────
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
script.onload = async () => {
  // Redirect to dashboard if already logged in
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "dashboard.html";
  }
};
document.head.appendChild(script);

// ── Tab switching ──────────────────────────────────────────
window.switchTab = function (tab) {
  document.getElementById("loginForm").classList.toggle("active",  tab === "login");
  document.getElementById("signupForm").classList.toggle("active", tab === "signup");
  document.getElementById("loginTab").classList.toggle("active",   tab === "login");
  document.getElementById("signupTab").classList.toggle("active",  tab === "signup");
};

// ── Toast helper ───────────────────────────────────────────
function showToast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 4000);
}

// ── Set button loading state ───────────────────────────────
function setLoading(btnId, loading) {
  const btn     = document.getElementById(btnId);
  const text    = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled  = loading;
  text.classList.toggle("hidden",   loading);
  spinner.classList.toggle("hidden", !loading);
}

// ── Login ──────────────────────────────────────────────────
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  setLoading("loginBtn", true);
  try {
    await signIn(email, password);
    showToast("Welcome back!", "success");
    setTimeout(() => (window.location.href = "dashboard.html"), 800);
  } catch (err) {
    showToast(err.message || "Login failed", "error");
    setLoading("loginBtn", false);
  }
});

// ── Sign up ────────────────────────────────────────────────
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name     = document.getElementById("signupName").value.trim();
  const email    = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  if (password.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  setLoading("signupBtn", true);
  try {
    await signUp(email, password, name);
    showToast("Account created! Check your email to confirm.", "success");
    // Switch to login tab after short delay
    setTimeout(() => {
      switchTab("login");
      setLoading("signupBtn", false);
    }, 1500);
  } catch (err) {
    showToast(err.message || "Sign up failed", "error");
    setLoading("signupBtn", false);
  }
});
