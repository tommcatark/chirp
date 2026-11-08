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
function avatarPair(seed) {
  const s = String(seed ?? "?");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PAIRS[h % AVATAR_PAIRS.length];
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
function formatCount(n) {
  const v = Number(n) || 0;
  return v >= 10000 ? `${(v / 10000).toFixed(1)}w` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

let items = [];
let offset = 0;
let total = 0;

init();

function init() {
  if (!loadToken()) {
    location.replace("/");
    return;
  }
  $("#bm-more").addEventListener("click", () => loadBookmarks(false));
  $("#bm-list").addEventListener("click", onListClick);
  loadBookmarks(true);
}

/* ============ 加载列表 ============ */
async function loadBookmarks(reset) {
  const loading = $("#bm-loading");
  if (reset) {
    offset = 0;
    loading.textContent = "正在加载…";
    loading.classList.remove("hidden");
    $("#bm-empty").classList.add("hidden");
  }
  $("#bm-more").classList.add("hidden");
  try {
    const r = await fetch(`${API_BASE}/api/bookmarks?offset=${reset ? 0 : offset}&limit=${PAGE_SIZE}`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/"); return; }
    if (r.status === 404) {
      // 后端尚未提供收藏接口时给出明确提示，而不是误报网络故障
      loading.textContent = "收藏功能暂未开放：后端尚未提供 /api/bookmarks 接口。";
      loading.classList.remove("hidden");
      return;
    }
    if (!r.ok) throw new Error();
    const data = await r.json();
    const list = data.items || [];
    total = typeof data.total === "number" ? data.total : list.length;
    offset = (reset ? 0 : offset) + list.length;
    items = reset ? list : items.concat(list);
    loading.classList.add("hidden");
    render();
    $("#bm-empty").classList.toggle("hidden", items.length > 0);
    $("#bm-more").classList.toggle("hidden", !data.hasMore);
  } catch {
    if (reset) loading.textContent = "收藏加载失败，请确认后端服务已启动后刷新重试。";
  }
}

function render() {
  $("#bm-list").innerHTML = items.map(cardHTML).join("");
  syncCount();
}

function cardHTML(p) {
  const [a, b] = avatarPair(p.userId);
  const name = p.authorName || "未知用户";
  return `
  <article class="chirp bm-item" data-id="${p.id}">
    <div class="avatar avatar-lg" style="--a:${a};--b:${b}">${escapeHTML(name.charAt(0))}</div>
    <div class="chirp-main">
      <p class="chirp-head">
        <strong>${escapeHTML(name)}</strong>
        <span class="handle">@${escapeHTML(p.authorHandle || "unknown")}</span>
        <span class="dot">·</span>
        <time>${timeAgo(Date.parse(p.createdAt) || Date.now())}</time>
        <button type="button" class="bm-remove" title="取消收藏">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4Z" /></svg>
          <span>取消收藏</span>
        </button>
      </p>
      <p class="chirp-content">${escapeHTML(p.content)}</p>
      <div class="chirp-foot">
        <span class="action-static">评论 ${p.comments ?? 0}</span>
        <span class="action-static">点赞 ${formatCount(p.likes)}</span>
      </div>
    </div>
  </article>`;
}

function syncCount() {
  const el = $("#bm-count");
  el.textContent = `${total} 条收藏`;
  el.classList.toggle("hidden", total === 0);
}

/* ============ 取消收藏 ============ */
async function onListClick(event) {
  const btn = event.target.closest(".bm-remove");
  if (!btn || btn.disabled) return;
  const id = Number(btn.closest(".bm-item")?.dataset.id);
  if (!id) return;

  btn.disabled = true;
  try {
    const r = await fetch(`${API_BASE}/api/posts/${id}/bookmark`, { method: "DELETE", headers: authHeaders() });
    if (r.status === 401) { location.replace("/"); return; }
    if (!r.ok) throw new Error();
    removeItem(id);
  } catch {
    btn.disabled = false;
    btn.querySelector("span").textContent = "取消失败，重试";
  }
}

function removeItem(id) {
  items = items.filter((p) => p.id !== id);
  total = Math.max(0, total - 1);
  const node = $(`.bm-item[data-id="${id}"]`);
  if (node) node.remove();
  $("#bm-empty").classList.toggle("hidden", items.length > 0);
  $("#bm-more").classList.toggle("hidden", items.length >= total);
  syncCount();
}
