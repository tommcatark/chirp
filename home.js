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
    liked: !!p.liked,
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
    // 规范 §1.5：列表接口为分页包装 {items,...}，兼容旧裸数组
    const items = Array.isArray(data) ? data : data.items || [];
    posts = items.map(normalizePost);
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
      handleAuthExpired();
      return null;
    }
    throw new Error(data.message || "发布失败，请稍后重试");
  }
  return normalizePost(data);
}

/* ============ 接口：评论（规范 §3.2.8-3.2.10） ============ */
function handleAuthExpired() {
  if (!authExpired) {
    authExpired = true;
    clearAuthAndRedirect();
  }
}

/* 将后端 CommentResponse 归一化为前端渲染结构 */
function normalizeComment(c) {
  return {
    id: c.id,
    userId: c.userId,
    author: { name: c.authorName, handle: c.authorHandle },
    createdAt: Date.parse(c.createdAt) || Date.now(),
    text: c.content,
    mine: !!c.mine
  };
}

async function fetchComments(postId) {
  const headers = { Accept: "application/json" };
  const token = loadToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/posts/${postId}/comments?offset=0&limit=50`, { headers });
  if (response.status === 401) {
    handleAuthExpired();
    return null;
  }
  if (!response.ok) throw new Error("评论加载失败，请稍后重试");
  const data = await response.json();
  const items = Array.isArray(data) ? data : data.items || [];
  return items.map(normalizeComment);
}

async function createComment(postId, content) {
  const token = loadToken();
  const response = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    // 评论者身份由 token 解析，请求体仅含内容
    body: JSON.stringify({ content })
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    handleAuthExpired();
    return null;
  }
  if (!response.ok) throw new Error(data.message || "评论失败，请稍后重试");
  return normalizeComment(data);
}

async function removeComment(commentId) {
  const token = loadToken();
  const response = await fetch(`${API_BASE}/api/comments/${commentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 401) {
    handleAuthExpired();
    return false;
  }
  if (!response.ok) throw new Error("删除失败，请稍后重试");
  return true;
}

/* ============ 评论面板 ============ */
function commentHTML(c) {
  return `
    <div class="comment" data-cid="${c.id}">
      ${avatarHTML(c.userId, c.author.name, "avatar-sm")}
      <div class="comment-main">
        <p class="comment-head">
          <strong>${escapeHTML(c.author.name)}</strong>
          <span class="handle">@${escapeHTML(c.author.handle)}</span>
          <span class="dot">·</span>
          <time>${timeAgo(c.createdAt)}</time>
        </p>
        <p class="comment-content">${escapeHTML(c.text)}</p>
      </div>
      ${c.mine ? `<button type="button" class="comment-delete" title="删除这条评论">删除</button>` : ""}
    </div>`;
}

/* 渲染评论列表（空态/内容态），并同步面板缓存标记 */
function renderCommentList(panel, list) {
  const listEl = panel.querySelector(".comment-list");
  listEl.innerHTML = list.length
    ? list.map(commentHTML).join("")
    : `<p class="comment-empty">还没有评论，来抢沙发。</p>`;
}

/* 展开时懒加载评论，收起时保留已加载内容（再次展开不重复请求） */
async function toggleCommentPanel(chirp, post) {
  const panel = chirp.querySelector(".comment-panel");
  const willShow = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !willShow);
  if (!willShow || panel.dataset.loaded === "1") return;

  const listEl = panel.querySelector(".comment-list");
  listEl.innerHTML = `<p class="comment-empty">评论加载中…</p>`;
  try {
    const items = await fetchComments(post.id);
    if (items === null) return; // 401 已触发跳转
    renderCommentList(panel, items);
    panel.dataset.loaded = "1";
  } catch (error) {
    // 保留未加载状态，收起再展开即可重试
    listEl.innerHTML = `<p class="comment-empty comment-error">${escapeHTML(error.message)}</p>`;
  }
}

/* 帖子卡片上的评论计数与 posts 数组联动 */
function updateCommentCount(post, delta) {
  post.comments = Math.max(0, (post.comments || 0) + delta);
  const node = document.querySelector(`.chirp[data-id="${post.id}"] .action-comment span`);
  if (node) node.textContent = formatCount(post.comments);
}

/* 发表评论：成功后追加到列表并联动计数 */
async function submitComment(form) {
  const chirp = form.closest(".chirp");
  const post = posts.find((p) => p.id === Number(chirp.dataset.id));
  if (!post) return;
  const input = form.querySelector(".comment-input");
  const sendBtn = form.querySelector(".comment-send");
  const content = input.value.trim();
  if (!content) return;

  sendBtn.disabled = true;
  sendBtn.textContent = "发送中…";
  try {
    const created = await createComment(post.id, content);
    if (!created) return; // 401 已触发跳转
    const listEl = form.closest(".comment-panel").querySelector(".comment-list");
    const empty = listEl.querySelector(".comment-empty");
    if (empty) empty.remove();
    listEl.insertAdjacentHTML("beforeend", commentHTML(created));
    form.closest(".comment-panel").dataset.loaded = "1";
    input.value = "";
    updateCommentCount(post, 1);
  } catch (error) {
    alert(error.message);
  } finally {
    sendBtn.textContent = "发送";
    sendBtn.disabled = input.value.trim().length === 0;
  }
}

/* 删除自己的评论：确认后调接口，从列表移除并联动计数 */
async function deleteOwnComment(button, chirp, post) {
  const commentNode = button.closest(".comment");
  const commentId = Number(commentNode.dataset.cid);
  if (!post || !commentId) return;
  if (!window.confirm("确定删除这条评论吗？")) return;

  button.disabled = true;
  try {
    const removed = await removeComment(commentId);
    if (!removed) return; // 401 已触发跳转
    commentNode.remove();
    updateCommentCount(post, -1);
    const listEl = chirp.querySelector(".comment-list");
    if (!listEl.querySelector(".comment")) {
      listEl.innerHTML = `<p class="comment-empty">还没有评论，来抢沙发。</p>`;
    }
  } catch (error) {
    button.disabled = false;
    alert(error.message);
  }
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
        <div class="comment-panel hidden">
          <div class="comment-list"></div>
          <form class="comment-form">
            ${avatarHTML(me.id || me.email, me.name, "avatar-sm")}
            <input type="text" class="comment-input" maxlength="500" placeholder="发表你的评论…" autocomplete="off">
            <button type="submit" class="comment-send" disabled>发送</button>
          </form>
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
    const chirp = event.target.closest(".chirp");
    if (!chirp) return;
    const post = posts.find((p) => p.id === Number(chirp.dataset.id));

    // 删除自己的评论
    const deleteBtn = event.target.closest(".comment-delete");
    if (deleteBtn) {
      deleteOwnComment(deleteBtn, chirp, post);
      return;
    }

    const button = event.target.closest(".action");
    if (!button || !post) return;
    const count = button.querySelector("span");

    if (button.classList.contains("action-comment")) {
      toggleCommentPanel(chirp, post);
    } else if (button.classList.contains("action-like")) {
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

  // 评论输入：有内容才能发送
  $("#feed").addEventListener("input", (event) => {
    if (!event.target.classList.contains("comment-input")) return;
    const form = event.target.closest(".comment-form");
    form.querySelector(".comment-send").disabled = event.target.value.trim().length === 0;
  });

  // 评论提交（表单代理到 #feed，动态卡片无需重复绑定）
  $("#feed").addEventListener("submit", (event) => {
    const form = event.target.closest(".comment-form");
    if (!form) return;
    event.preventDefault();
    submitComment(form);
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
