/*
 * app.js — Shared API utility for all pages
 * Provides: API calls, auth token handling, toast notifications
 */

const API = "http://127.0.0.1:8000/api/v1";

// ─── Token Helpers ────────────────────────────────────────
const Auth = {
  save:   (token) => localStorage.setItem("token", token),
  get:    ()      => localStorage.getItem("token"),
  clear:  ()      => localStorage.removeItem("token"),
  headers: ()     => ({ "Content-Type": "application/json", "Authorization": `Bearer ${Auth.get()}` }),
};

// ─── Toast Notifications ──────────────────────────────────
function toast(msg, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Generic API fetch ──────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: Auth.headers(),
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

// ─── Redirect if not logged in ────────────────────────────
function requireAuth() {
  if (!Auth.get()) {
    window.location.href = "index.html";
  }
}

// ─── Logout ───────────────────────────────────────────────
function logout() {
  Auth.clear();
  window.location.href = "index.html";
}
