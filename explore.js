/* 鸣 Chirp · 探索页：搜索（帖子/用户）+ 趋势话题 + 活跃作者 + 最新鸣响 */
const API_BASE = "http://localhost:8080";
const $ = (s, r = document) => r.querySelector(s);

const AVATAR_PAIRS = [
  ["#fcd34d", "#f472b6"], ["#6ee7b7", "#38bdf8"], ["#c4b5fd", "#f0abfc"],
  ["#fca5a5", "#fcd34d"], ["#7dd3fc", "#818cf8"], ["#34d399", "#0e9f6e"]
];

function loadToken() {
  return localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
}
function loadUser() {
  const raw = localStorage.getItem("chirpUser") || sessionStorage.getItem("chirpUser");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function authHeaders() {
  const token = loadToken();
  return token ? { Accept: "application/json", Authorization: `Bearer ${token}` } : { Accept: "application/json" };
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

let searchType = "post";
let searchKeyword = "";

init();

function init() {
  bindSearch();
  bindTabs();
  bindFollowButtons();
  bindAvatarClicks();
  loadTrends();
  loadLatest();
}

/* 头像点击 → 跳转用户主页 */
function bindAvatarClicks() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-uid]");
    if (!el) return;
    if (e.target.closest("button, a, input, textarea, select, .follow-btn")) return;
    const uid = Number(el.dataset.uid);
    if (!uid) return;
    e.stopPropagation();
    location.href = `/profile.html?id=${uid}`;
  }, true);
}

/* ============ 搜索 ============ */
function bindSearch() {
  const input = $("#explore-search");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      applyKeyword(input.value.trim());
    }, 300);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    clearTimeout(timer);
    applyKeyword(input.value.trim());
  });
}

function applyKeyword(keyword) {
  searchKeyword = keyword;
  if (!keyword) {
    $("#search-view").classList.add("hidden");
    $("#explore-view").classList.remove("hidden");
    return;
  }
  $("#explore-view").classList.add("hidden");
  $("#search-view").classList.remove("hidden");
  runSearch();
}

function bindTabs() {
  document.querySelectorAll(".explore-tabs .feed-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.type === searchType) return;
      searchType = tab.dataset.type;
      document.querySelectorAll(".explore-tabs .feed-tab").forEach((t) => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on);
      });
      if (searchKeyword) runSearch();
    });
  });
}

async function runSearch() {
  const loading = $("#search-loading");
  loading.textContent = "正在搜索…";
  loading.classList.remove("hidden");
  $("#search-empty").classList.add("hidden");
  $("#search-results").innerHTML = "";
  try {
    const r = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(searchKeyword)}&type=${searchType}&limit=30`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    const items = data.items || [];
    loading.classList.add("hidden");
    $("#search-empty").classList.toggle("hidden", items.length > 0);
    $("#search-results").innerHTML = searchType === "post"
      ? items.map(postCardHTML).join("")
      : `<ul class="suggest-list explore-user-list">${items.map(userCardHTML).join("")}</ul>`;
  } catch {
    loading.textContent = "搜索失败，请确认后端服务已启动后重试。";
  }
}

/* ============ 默认视图：趋势 / 活跃作者 / 最新鸣响 ============ */
async function loadTrends() {
  try {
    const r = await fetch(`${API_BASE}/api/hashtags/trending?limit=10`, { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const data = await r.json();
    const list = Array.isArray(data) ? data : [];
    $("#explore-trends").innerHTML = list.map((t) => `
      <li><a href="/topic.html?tag=${encodeURIComponent(t.tag)}"><strong>#${escapeHTML(t.tag)}</strong><span>${t.postCount} 条鸣响</span></a></li>`).join("");
    $("#trends-empty").classList.toggle("hidden", list.length > 0);
  } catch {
    const el = $("#trends-empty");
    el.textContent = "趋势加载失败，请确认后端服务已启动。";
    el.classList.remove("hidden");
  }
}

async function loadLatest() {
  const loading = $("#posts-loading");
  try {
    const r = await fetch(`${API_BASE}/api/posts?scope=latest&limit=30`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    const items = data.items || [];
    loading.classList.add("hidden");
    $("#explore-posts-empty").classList.toggle("hidden", items.length > 0);
    $("#explore-posts").innerHTML = items.map(postCardHTML).join("");
    renderActiveAuthors(items);
  } catch {
    loading.textContent = "加载失败，请确认后端服务已启动后刷新重试。";
  }
}

/* 从最新帖子聚合作者（排除自己，取前 6 个），再逐个取详情拿到关注状态与粉丝数 */
async function renderActiveAuthors(postItems) {
  const me = loadUser();
  const seen = new Map();
  for (const p of postItems) {
    if (p.userId && !seen.has(p.userId)) {
      seen.set(p.userId, { id: p.userId, name: p.authorName, handle: p.authorHandle });
    }
  }
  const authors = [...seen.values()].filter((a) => a.id !== me?.id).slice(0, 6);
  if (!authors.length) {
    $("#users-empty").classList.remove("hidden");
    return;
  }
  const details = await Promise.all(authors.map((a) =>
    fetch(`${API_BASE}/api/users/${a.id}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  ));
  const users = details.filter((u) => u && !u.me);
  $("#explore-users").innerHTML = users.map(userCardHTML).join("");
  $("#users-empty").classList.toggle("hidden", users.length > 0);
}

/* ============ 卡片渲染 ============ */
function postCardHTML(p) {
  const [a, b] = avatarPair(p.userId);
  return `
  <article class="chirp" data-id="${p.id}">
    <div class="avatar avatar-lg" data-uid="${p.userId}" style="--a:${a};--b:${b}">${escapeHTML((p.authorName || "?").charAt(0))}</div>
    <div class="chirp-main">
      <p class="chirp-head">
        <strong>${escapeHTML(p.authorName)}</strong>
        <span class="handle">@${escapeHTML(p.authorHandle)}</span>
        <span class="dot">·</span>
        <time>${timeAgo(Date.parse(p.createdAt) || Date.now())}</time>
      </p>
      <p class="chirp-content">${escapeHTML(p.content)}</p>
      <div class="chirp-foot">
        <span class="action-static">评论 ${p.comments ?? 0}</span>
        <span class="action-static">点赞 ${p.likes ?? 0}</span>
      </div>
    </div>
  </article>`;
}

function userCardHTML(u) {
  const [a, b] = avatarPair(u.id);
  return `
  <li data-id="${u.id}">
    <div class="avatar" data-uid="${u.id}" style="--a:${a};--b:${b}">${escapeHTML((u.name || "?").charAt(0))}</div>
    <div class="suggest-meta">
      <strong>${escapeHTML(u.name)}</strong>
      <span>@${escapeHTML(u.handle)} · ${u.followerCount ?? 0} 位关注者</span>
      ${u.bio ? `<span class="explore-user-bio">${escapeHTML(u.bio)}</span>` : ""}
    </div>
    <button type="button" class="follow-btn ${u.followedByMe ? "is-following" : ""}">${u.followedByMe ? "已关注" : "关注"}</button>
  </li>`;
}

/* ============ 关注 / 取关（事件代理，推荐区与搜索区共用） ============ */
function bindFollowButtons() {
  document.addEventListener("click", async (event) => {
    const btn = event.target.closest(".follow-btn");
    if (!btn || btn.disabled) return;
    const userId = Number(btn.closest("[data-id]")?.dataset.id);
    if (!userId) return;
    if (!loadToken()) { location.replace("/"); return; }

    const following = btn.classList.contains("is-following");
    btn.disabled = true;
    try {
      const r = await fetch(`${API_BASE}/api/users/${userId}/follow`, {
        method: following ? "DELETE" : "POST",
        headers: authHeaders()
      });
      if (r.status === 401) { location.replace("/"); return; }
      if (!r.ok) throw new Error();
      // 同步本页所有同一作者的按钮（推荐区与搜索区可能同时出现）
      document.querySelectorAll(`[data-id="${userId}"] .follow-btn`).forEach((b) => {
        b.classList.toggle("is-following", !following);
        b.textContent = !following ? "已关注" : "关注";
        b.disabled = false;
      });
    } catch {
      btn.disabled = false;
    }
  });
}
