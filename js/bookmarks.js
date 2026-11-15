/* 鸣 Chirp · 收藏页：收藏列表（GET /api/bookmarks）+ 取消收藏（DELETE /api/posts/{id}/bookmark） */
const API_BASE = "http://localhost:8080";
const $ = (s, r = document) => r.querySelector(s);
const PAGE_SIZE = 20;

const AVATAR_PAIRS = [
  ["#fcd34d", "#f472b6"], ["#6ee7b7", "#38bdf8"], ["#c4b5fd", "#f0abfc"],
  ["#fca5a5", "#fcd34d"], ["#7dd3fc", "#818cf8"], ["#34d399", "#0e9f6e"]
];

function loadToken() {
  return localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
}
function authHeaders(extra = {}) {
  return { Accept: "application/json", Authorization: `Bearer ${loadToken()}`, ...extra };
}
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hashSeed(seed) {
  const s = String(seed ?? "?");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

let offset = 0;
let hasMore = false;
let total = 0;

init();

function init() {
  if (!loadToken()) {
    location.replace("/pages/index.html");
    return;
  }
  $("#bm-more").addEventListener("click", () => loadBookmarks(false));
  $("#bm-list").addEventListener("click", onListClick);
  loadBookmarks(true);
}

/* ============ 加载列表 ============ */
async function loadBookmarks(reset) {
  if (reset) {
    offset = 0;
    $("#bm-loading").classList.remove("hidden");
    $("#bm-empty").classList.add("hidden");
  }
  const moreBtn = $("#bm-more");
  moreBtn.classList.add("hidden");
  try {
    const r = await fetch(`${API_BASE}/api/bookmarks?offset=${reset ? 0 : offset}&limit=${PAGE_SIZE}`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/pages/index.html"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    const items = data.items || [];
    total = data.total ?? 0;
    hasMore = !!data.hasMore;
    offset = (reset ? 0 : offset) + items.length;

    if (reset) {
      $("#bm-loading").classList.add("hidden");
      $("#bm-list").innerHTML = items.map(itemHTML).join("");
      $("#bm-empty").classList.toggle("hidden", items.length > 0);
    } else {
      $("#bm-list").insertAdjacentHTML("beforeend", items.map(itemHTML).join(""));
    }
    syncCountUI();
    moreBtn.classList.toggle("hidden", !hasMore);
  } catch {
    if (reset) {
      $("#bm-loading").textContent = "收藏加载失败，请确认后端服务已启动后刷新重试。";
    }
  }
}

function itemHTML(p) {
  const name = p.authorName || "未知用户";
  const handle = p.authorHandle || "unknown";
  const initial = escapeHTML(String(name).charAt(0));
  return `
  <article class="chirp bm-item" data-id="${p.id}">
    <div class="avatar" data-av="${hashSeed(p.userId) % AVATAR_PAIRS.length}">${initial}</div>
    <div class="chirp-main">
      <p class="chirp-head">
        <strong>${escapeHTML(name)}</strong>
        <span class="handle">@${escapeHTML(handle)}</span>
        <span class="dot">·</span>
        <time>${timeAgo(Date.parse(p.createdAt) || Date.now())}</time>
      </p>
      <p class="chirp-content">${escapeHTML(p.content)}</p>
      <div class="chirp-foot">
        <button type="button" class="action action-bookmark on" title="取消收藏">
          <svg viewBox="0 0 24 24" width="17" height="17"><path d="M6 3h12v18l-6-4-6 4Z" /></svg>
          <span>已收藏</span>
        </button>
      </div>
    </div>
  </article>`;
}

function syncCountUI() {
  const badge = $("#bm-count");
  badge.textContent = `${total} 条`;
  badge.classList.toggle("hidden", total === 0);
}

/* ============ 取消收藏 ============ */
async function onListClick(event) {
  const btn = event.target.closest(".action-bookmark");
  if (!btn || btn.disabled) return;
  const card = btn.closest(".bm-item");
  const id = Number(card?.dataset.id);
  if (!card || !id) return;

  btn.disabled = true;
  card.classList.add("is-removing");
  try {
    const r = await fetch(`${API_BASE}/api/posts/${id}/bookmark`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (r.status === 401) { location.replace("/pages/index.html"); return; }
    if (!r.ok) throw new Error();
    card.remove();
    total = Math.max(0, total - 1);
    offset = Math.max(0, offset - 1);
    syncCountUI();
    if (!$("#bm-list").children.length && !hasMore) {
      $("#bm-empty").classList.remove("hidden");
    }
  } catch {
    card.classList.remove("is-removing");
    btn.disabled = false;
  }
}
