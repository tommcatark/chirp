/* ============ 登录守卫与当前用户 ============ */
function loadCurrentUser() {
  const raw = localStorage.getItem("chirpUser") || sessionStorage.getItem("chirpUser");
  if (!raw) {
    window.location.replace("/");
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("chirpUser");
    sessionStorage.removeItem("chirpUser");
    window.location.replace("/");
    return null;
  }
}

const me = loadCurrentUser();

const now = Date.now();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/* 示例数据：待后端帖子接口上线后可直接替换为接口数据 */
const authors = {
  linmo:   { name: "林默", handle: "linmo", colors: ["#fcd34d", "#f472b6"] },
  night:   { name: "夜航船", handle: "nightboat", colors: ["#6ee7b7", "#38bdf8"] },
  momo:    { name: "Momo", handle: "momo", colors: ["#c4b5fd", "#f0abfc"] },
  qing:    { name: "声声慢", handle: "slowecho", colors: ["#fca5a5", "#fcd34d"] },
  bei:     { name: "北风", handle: "northwind", colors: ["#7dd3fc", "#818cf8"] }
};

let posts = [
  { id: 1, author: authors.night, createdAt: now - 17 * MIN, text: "好想法不该只停留在脑海里，说出来就是第一步。今天也要认真发声。", likes: 2300, reposts: 812, comments: 95, tag: "#思考碎片" },
  { id: 2, author: authors.momo, createdAt: now - HOUR, text: "今天的日落值得一条头条 ✦ 你们那边的天空是什么颜色？", likes: 894, reposts: 203, comments: 41, tag: "#日常" },
  { id: 3, author: authors.linmo, createdAt: now - 2 * HOUR, text: "刚在鸣上发了第一条，有人听见吗？🌙 愿每一个安静的灵魂都能找到共鸣。", likes: 128, reposts: 46, comments: 12, tag: "#第一声" },
  { id: 4, author: authors.qing, createdAt: now - 3 * HOUR, text: "读书摘记：「声音看不见形状，却能在人心里留下轮廓。」—— 今天读到的最温柔的一句。", likes: 562, reposts: 174, comments: 23, tag: "#读书笔记" },
  { id: 5, author: authors.bei, createdAt: now - 5 * HOUR, text: "晨跑五公里，风灌进耳朵的声音，像世界在给我鼓掌。早安，各位。", likes: 433, reposts: 58, comments: 19, tag: "#运动打卡" },
  { id: 6, author: authors.night, createdAt: now - 8 * HOUR, text: "产品小记：下一版会加上「回声」功能——你的共鸣会被原作者听见。敬请期待。", likes: 1102, reposts: 356, comments: 88, tag: "#产品更新" }
];

/* 默认已关注的人（关注流据此筛选） */
const followed = new Set(["nightboat"]);

const trends = [
  { tag: "#秋日鸣响", posts: "12.4k 条鸣响" },
  { tag: "#产品更新", posts: "8,931 条鸣响" },
  { tag: "#读书笔记", posts: "5,207 条鸣响" },
  { tag: "#第一声", posts: "3,118 条鸣响" },
  { tag: "#今晚的月亮", posts: "2,406 条鸣响" }
];

const suggestions = [authors.linmo, authors.qing, authors.bei];

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

function avatarHTML(author, extraClass = "") {
  const [a, b] = author.colors;
  return `<div class="avatar ${extraClass}" style="--a:${a};--b:${b}">${escapeHTML(initialOf(author.name))}</div>`;
}

/* ============ 初始化 ============ */
function init() {
  $("#me-name").textContent = me.name;
  $("#me-email").textContent = `@${me.email.split("@")[0]}`;
  const myInitial = initialOf(me.name);
  $("#me-avatar").textContent = myInitial;
  $("#composer-avatar").textContent = myInitial;

  renderTrends();
  renderSuggestions();
  renderFeed();
  bindEvents();
}

/* ============ 信息流 ============ */
function visiblePosts() {
  let list = posts;
  if (activeTab === "following") list = list.filter((p) => followed.has(p.author.handle));
  if (keyword) {
    const q = keyword.toLowerCase();
    list = list.filter((p) => p.text.toLowerCase().includes(q) || p.author.name.toLowerCase().includes(q) || (p.tag || "").toLowerCase().includes(q));
  }
  return list;
}

function postHTML(post) {
  return `
    <article class="chirp" data-id="${post.id}">
      ${avatarHTML(post.author)}
      <div class="chirp-main">
        <p class="chirp-head">
          <strong>${escapeHTML(post.author.name)}</strong>
          <span class="handle">@${escapeHTML(post.author.handle)}</span>
          <span class="dot">·</span>
          <time>${timeAgo(post.createdAt)}</time>
          ${post.tag ? `<a class="chirp-tag" href="#explore">${escapeHTML(post.tag)}</a>` : ""}
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

function renderFeed(prependId = null) {
  const feed = $("#feed");
  const list = visiblePosts();
  feed.innerHTML = list.map(postHTML).join("");
  $("#empty-following").classList.toggle("hidden", list.length !== 0);
  $("#feed").classList.toggle("hidden", list.length === 0);
  if (prependId) {
    const node = feed.querySelector(`[data-id="${prependId}"]`);
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
      ${avatarHTML(s)}
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

  function syncComposer() {
    const len = input.value.trim().length;
    counter.textContent = 280 - input.value.length;
    counter.classList.toggle("over", input.value.length > 260);
    postBtn.disabled = len === 0 || input.value.length > 280;
  }

  input.addEventListener("input", syncComposer);
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") postBtn.click();
  });
  $("#compose-cta").addEventListener("click", () => input.focus());

  postBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text || text.length > 280) return;
    const myAuthor = { name: me.name, handle: me.email.split("@")[0], colors: ["#34d399", "#0e9f6e"] };
    const post = { id: Date.now(), author: myAuthor, createdAt: Date.now(), text, likes: 0, reposts: 0, comments: 0, tag: null };
    posts.unshift(post);
    input.value = "";
    syncComposer();
    activeTab = "all";
    document.querySelectorAll(".feed-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "all"));
    renderFeed(post.id);
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
    localStorage.removeItem("chirpUser");
    sessionStorage.removeItem("chirpUser");
    window.location.replace("/");
  });
}

if (me) init();
