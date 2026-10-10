/* ============ 全局配置 ============ */
const API_BASE = "http://localhost:8080";
const MAX_POST_LENGTH = 280;

/* ============ 登录守卫与当前用户 ============ */
function clearAuthAndRedirect() {
  localStorage.removeItem("chirpUser");
  sessionStorage.removeItem("chirpUser");
  localStorage.removeItem("chirpToken");
  sessionStorage.removeItem("chirpToken");
  window.location.replace("/");
}

function loadCurrentUser() {
  const raw = localStorage.getItem("chirpUser") || sessionStorage.getItem("chirpUser");
  const token = localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
  // 旧版本登录态没有 JWT，需重新登录获取令牌
  if (!raw || !token) {
    clearAuthAndRedirect();
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    clearAuthAndRedirect();
    return null;
  }
}

function loadToken() {
  return localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
}

const me = loadCurrentUser();
/* 鉴权失败时统一的 401 跳转标记，避免并发请求重复跳转 */
let authExpired = false;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/* 信息流数据：来自后端 GET /api/posts（数据库持久化） */
let posts = [];
/* 关注关系仅保存在本地（关注接口尚未上线，不跨会话/设备同步） */
const followed = new Set();

/* 热门话题为静态运营内容（暂无后端接口） */
const trends = [
  { tag: "#秋日鸣响", posts: "12.4k 条鸣响" },
  { tag: "#产品更新", posts: "8,931 条鸣响" },
  { tag: "#读书笔记", posts: "5,207 条鸣响" },
  { tag: "#第一声", posts: "3,118 条鸣响" },
  { tag: "#今晚的月亮", posts: "2,406 条鸣响" }
];

/* 推荐关注：handle 与数据库种子用户邮箱前缀一致，关注流可直接联动 */
const suggestions = [
  { name: "张三", handle: "zhangsan" },
  { name: "李四", handle: "lisi" },
  { name: "王五", handle: "wangwu" }
];

const AVATAR_PAIRS = [
  ["#fcd34d", "#f472b6"], ["#6ee7b7", "#38bdf8"], ["#c4b5fd", "#f0abfc"],
  ["#fca5a5", "#fcd34d"], ["#7dd3fc", "#818cf8"], ["#34d399", "#0e9f6e"]
];

let activeTab = "all";
let keyword = "";

/* ============ 工具函数 ============ */
function $(selector, root = document) {
  return root.querySelector(selector);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function initialOf(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function hashSeed(value) {
  let hash = 0;
  for (let i = 0; i < String(value).length; i++) hash = (hash * 31 + String(value).charCodeAt(i)) >>> 0;
  return hash;
}

function colorsFor(seed) {
  return AVATAR_PAIRS[hashSeed(seed) % AVATAR_PAIRS.length];
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < MIN) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} 分钟`;
  if (diff < 24 * HOUR) return `${Math.floor(diff / HOUR)} 小时`;
  return `${Math.floor(diff / (24 * HOUR))} 天`;
}

function formatCount(n) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}w` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function avatarHTML(seed, name, extraClass = "") {
  const [a, b] = colorsFor(seed);
  return `<div class="avatar ${extraClass}" style="--a:${a};--b:${b}">${escapeHTML(initialOf(name))}</div>`;
}

/* 将后端 PostResponse 归一化为前端渲染结构 */
function normalizePost(p) {
  return {
    id: p.id,
    userId: p.userId,
    author: { name: p.authorName, handle: p.authorHandle },
    createdAt: Date.parse(p.createdAt) || Date.now(),
    text: p.content,
    likes: p.likes || 0,
    reposts: p.reposts || 0,
    comments: p.comments || 0,
    liked: false,
    reposted: false
  };
}

/* ============ 初始化 ============ */
if (me) init();

function init() {
  $("#me-name").textContent = me.name;
  $("#me-email").textContent = `@${me.email.split("@")[0]}`;
  const myInitial = initialOf(me.name);
  $("#me-avatar").textContent = myInitial;
  $("#composer-avatar").textContent = myInitial;
  const [a, b] = colorsFor(me.id || me.email);
  $("#me-avatar").style.setProperty("--a", a);
  $("#me-avatar").style.setProperty("--b", b);
  $("#composer-avatar").style.setProperty("--a", a);
  $("#composer-avatar").style.setProperty("--b", b);

  renderTrends();
  renderSuggestions();
  bindEvents();
  loadFeed();
}

/* ============ 接口：时间流 ============ */
async function loadFeed() {
  $("#feed-loading").classList.remove("hidden");
  $("#feed-error").classList.add("hidden");
  try {
    const response = await fetch(`${API_BASE}/api/posts`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    posts = (Array.isArray(data) ? data : []).map(normalizePost);
    $("#feed-loading").classList.add("hidden");
    $("#feed-error").classList.add("hidden");
    renderFeed();
  } catch {
    posts = [];
    $("#feed-loading").classList.add("hidden");
    $("#feed").classList.add("hidden");
    $("#empty-following").classList.add("hidden");
    $("#feed-error").classList.remove("hidden");
  }
}

/* ============ 接口：发帖 ============ */
async function createPost(content) {
  const token = loadToken();
  const response = await fetch(`${API_BASE}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    // 身份由 JWT 承载，请求体不再包含 userId，杜绝冒充发帖
    body: JSON.stringify({ content })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 令牌缺失/过期/无效（网关或认证服务返回 401）：清理并回到登录页
    if (response.status === 401) {
      if (!authExpired) {
        authExpired = true;
        clearAuthAndRedirect();
      }
      return null;
    }
    throw new Error(data.message || "发布失败，请稍后重试");
  }
  return normalizePost(data);
}

/* ============ 信息流渲染 ============ */
function visiblePosts() {
  let list = posts;
  if (activeTab === "following") list = list.filter((p) => followed.has(p.author.handle));
  if (keyword) {
    const q = keyword.toLowerCase();
    list = list.filter((p) => p.text.toLowerCase().includes(q) || p.author.name.toLowerCase().includes(q) || p.author.handle.toLowerCase().includes(q));
  }
  return list;
}

function postHTML(post) {
  return `
    <article class="chirp" data-id="${post.id}">
      ${avatarHTML(post.userId, post.author.name)}
      <div class="chirp-main">
        <p class="chirp-head">
          <strong>${escapeHTML(post.author.name)}</strong>
          <span class="handle">@${escapeHTML(post.author.handle)}</span>
          <span class="dot">·</span>
          <time>${timeAgo(post.createdAt)}</time>
        </p>
        <p class="chirp-content">${escapeHTML(post.text)}</p>
        <div class="chirp-foot">
          <button type="button" class="action action-comment" title="评论">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l.9-4.4A8 8 0 1 1 21 12Z" /></svg>
            <span>${formatCount(post.comments)}</span>
          </button>
          <button type="button" class="action action-repost ${post.reposted ? "on" : ""}" title="转发">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></svg>
            <span>${formatCount(post.reposts)}</span>
          </button>
          <button type="button" class="action action-like ${post.liked ? "on" : ""}" title="喜欢">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 21s-7.5-4.6-9.7-9C.8 8.7 2.4 5 5.8 5c2 0 3.3 1.1 4.2 2.4C10.9 6.1 12.2 5 14.2 5 17.6 5 19.2 8.7 21.7 12c-2.2 4.4-9.7 9-9.7 9Z" /></svg>
            <span>${formatCount(post.likes)}</span>
          </button>
          <button type="button" class="action action-share" title="分享">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M8 7l4-4 4 4" /></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function renderFeed(highlightId = null) {
  const feed = $("#feed");
  const list = visiblePosts();
  feed.classList.remove("hidden");
  feed.innerHTML = list.map(postHTML).join("");
  const noData = posts.length === 0 && !keyword;
  const emptyBox = $("#empty-following");
  if (activeTab === "following" && list.length === 0 && !keyword) {
    emptyBox.querySelector("h2").textContent = "关注流还是静的";
    emptyBox.querySelector("p").textContent = "去右侧「你可能感兴趣的人」关注一些声音，这里就会热闹起来。";
    emptyBox.classList.remove("hidden");
    feed.classList.add("hidden");
  } else if (noData) {
    // 数据库中还没有任何帖子：发一条即可打破空白
    emptyBox.querySelector("h2").textContent = "还没有任何鸣响";
    emptyBox.querySelector("p").textContent = "在上方发布框写下你的第一声，让时间流动起来。";
    emptyBox.classList.remove("hidden");
    feed.classList.add("hidden");
  } else {
    emptyBox.classList.add("hidden");
  }
  if (highlightId) {
    const node = feed.querySelector(`[data-id="${highlightId}"]`);
    if (node) {
      node.classList.add("just-posted");
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/* ============ 右侧栏 ============ */
function renderTrends() {
  $("#trend-list").innerHTML = trends.map((t) => `
    <li><a href="#explore"><strong>${escapeHTML(t.tag)}</strong><span>${escapeHTML(t.posts)}</span></a></li>`).join("");
}

function renderSuggestions() {
  $("#suggest-list").innerHTML = suggestions.map((s) => `
    <li data-handle="${escapeHTML(s.handle)}">
      ${avatarHTML(s.handle, s.name)}
      <div class="suggest-meta">
        <strong>${escapeHTML(s.name)}</strong>
        <span>@${escapeHTML(s.handle)}</span>
      </div>
      <button type="button" class="follow-btn ${followed.has(s.handle) ? "is-following" : ""}">
        ${followed.has(s.handle) ? "已关注" : "关注"}
      </button>
    </li>`).join("");
}

/* ============ 事件绑定 ============ */
function bindEvents() {
  const input = $("#composer-input");
  const counter = $("#char-count");
  const postBtn = $("#post-btn");
  const composerStatus = $("#composer-status");

  function syncComposer() {
    const len = input.value.trim().length;
    counter.textContent = MAX_POST_LENGTH - input.value.length;
    counter.classList.toggle("over", input.value.length > 260);
    postBtn.disabled = len === 0 || input.value.length > MAX_POST_LENGTH || postBtn.dataset.busy === "1";
  }

  function setComposerError(message) {
    composerStatus.textContent = message;
    composerStatus.classList.toggle("error", Boolean(message));
  }

  input.addEventListener("input", () => { syncComposer(); if (composerStatus.textContent) setComposerError(""); });
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !postBtn.disabled) postBtn.click();
  });
  $("#compose-cta").addEventListener("click", () => input.focus());
  $("#retry-btn").addEventListener("click", loadFeed);

  postBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text || text.length > MAX_POST_LENGTH) return;

    postBtn.dataset.busy = "1";
    syncComposer();
    postBtn.textContent = "发布中…";
    setComposerError("");
    try {
      const created = await createPost(text);
      if (!created) return; // 401 已触发跳转
      posts.unshift(created);
      input.value = "";
      activeTab = "all";
      document.querySelectorAll(".feed-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "all"));
      renderFeed(created.id);
    } catch (error) {
      setComposerError(error.message);
    } finally {
      postBtn.dataset.busy = "";
      postBtn.textContent = "发布";
      syncComposer();
    }
  });

  document.querySelectorAll(".feed-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll(".feed-tab").forEach((t) => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on);
      });
      renderFeed();
    });
  });

  $("#feed").addEventListener("click", (event) => {
    const button = event.target.closest(".action");
    if (!button) return;
    const chirp = button.closest(".chirp");
    const post = posts.find((p) => p.id === Number(chirp.dataset.id));
    if (!post) return;
    const count = button.querySelector("span");

    if (button.classList.contains("action-like")) {
      post.liked = !post.liked;
      post.likes += post.liked ? 1 : -1;
      button.classList.toggle("on", post.liked);
      count.textContent = formatCount(post.likes);
    } else if (button.classList.contains("action-repost")) {
      post.reposted = !post.reposted;
      post.reposts += post.reposted ? 1 : -1;
      button.classList.toggle("on", post.reposted);
      count.textContent = formatCount(post.reposts);
    }
  });

  $("#suggest-list").addEventListener("click", (event) => {
    const btn = event.target.closest(".follow-btn");
    if (!btn) return;
    const li = btn.closest("li");
    const handle = li.dataset.handle;
    const isFollowing = followed.has(handle);
    if (isFollowing) followed.delete(handle);
    else followed.add(handle);
    btn.classList.toggle("is-following", !isFollowing);
    btn.textContent = isFollowing ? "关注" : "已关注";
    if (activeTab === "following") renderFeed();
  });

  let searchTimer = null;
  $("#search-input").addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      keyword = event.target.value.trim();
      renderFeed();
    }, 180);
  });

  $("#logout-btn").addEventListener("click", () => {
    clearAuthAndRedirect();
  });
}
