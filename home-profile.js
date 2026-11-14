/* 鸣 Chirp · 首页内嵌个人主页
   左侧导航保持不动，只切换舞台中间内容；
   仍使用原生 fetch 与现有 /api/users/me、/api/users/{id}/posts 接口。 */
(() => {
  const API_BASE = "http://localhost:8080";
  const $ = (selector, root = document) => root.querySelector(selector);
  const homeView = $("#view-home");
  const profileView = $("#view-profile");

  if (!homeView || !profileView) return;

  const views = { home: homeView, profile: profileView };
  let profile = null;

  const AVATAR_PAIRS = [
    ["#fcd34d", "#f472b6"], ["#6ee7b7", "#38bdf8"], ["#c4b5fd", "#f0abfc"],
    ["#fca5a5", "#fcd34d"], ["#7dd3fc", "#818cf8"], ["#34d399", "#0e9f6e"]
  ];

  function loadToken() {
    return localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
  }

  function loadUser() {
    const raw = localStorage.getItem("chirpUser") || sessionStorage.getItem("chirpUser");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function authHeaders(extra = {}) {
    return { Accept: "application/json", Authorization: `Bearer ${loadToken()}`, ...extra };
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function avatarVariant(seed) {
    const text = String(seed ?? "?");
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash % AVATAR_PAIRS.length;
  }

  function formatDate(ts) {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return "刚刚";
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
    return formatDate(ts);
  }

  function setView(name) {
    const target = views[name];
    if (!target) return;

    Object.entries(views).forEach(([key, element]) => {
      const active = key === name;
      element.classList.toggle("hidden", !active);
      element.setAttribute("aria-hidden", String(!active));
    });

    document.title = name === "profile" ? "个人主页 · 鸣 Chirp" : "鸣 Chirp · 首页";
    window.scrollTo(0, 0);

    if (name === "profile") {
      loadProfile().then((ok) => {
        if (ok) loadMyPosts();
      });
    }
  }

  document.addEventListener("chirp:view", (event) => {
    setView(event.detail?.view);
  });

  function renderProfile() {
    const avatar = $("#pf-avatar");
    if (avatar) {
      avatar.textContent = (profile.name || "?").trim().charAt(0);
      avatar.dataset.av = String(avatarVariant(profile.id));
    }
    $("#pf-name").textContent = profile.name;
    $("#pf-handle").textContent = `@${profile.handle}`;
    $("#pf-bio").textContent = profile.bio || "这个人还没有留下简介。";
    $("#pf-joined").textContent = profile.createdAt
      ? `${new Date(Date.parse(profile.createdAt)).toLocaleDateString("zh-CN")} 加入`
      : "";
    $("#st-posts").textContent = profile.postCount ?? 0;
    $("#st-following").textContent = profile.followingCount ?? 0;
    $("#st-followers").textContent = profile.followerCount ?? 0;
  }

  async function loadProfile() {
    try {
      const response = await fetch(`${API_BASE}/api/users/me`, { headers: authHeaders() });
      if (response.status === 401) {
        location.replace("/index.html");
        return false;
      }
      if (!response.ok) throw new Error();
      profile = await response.json();
      renderProfile();
      return true;
    } catch {
      $("#pf-name").textContent = "资料加载失败";
      $("#pf-bio").textContent = "请确认后端服务已启动后刷新重试。";
      return false;
    }
  }

  async function loadMyPosts() {
    if (!profile) return;
    $("#posts-loading").textContent = "正在加载…";
    $("#posts-loading").classList.remove("hidden");
    try {
      const response = await fetch(`${API_BASE}/api/users/${profile.id}/posts`, { headers: authHeaders() });
      if (response.status === 401) {
        location.replace("/index.html");
        return;
      }
      if (!response.ok) throw new Error();
      const data = await response.json();
      const items = data.items || [];
      $("#posts-loading").classList.add("hidden");
      $("#posts-empty").classList.toggle("hidden", items.length > 0);
      $("#my-posts").innerHTML = items.map((post) => `
        <article class="chirp" data-id="${post.id}">
          <div class="avatar avatar-lg" data-av="${avatarVariant(post.userId)}">${escapeHTML((post.authorName || "?").charAt(0))}</div>
          <div class="chirp-main">
            <p class="chirp-head">
              <strong>${escapeHTML(post.authorName)}</strong>
              <span class="handle">@${escapeHTML(post.authorHandle)}</span>
              <span class="dot">·</span>
              <time>${timeAgo(Date.parse(post.createdAt) || Date.now())}</time>
              <button type="button" class="post-delete" title="删除这条鸣响" aria-label="删除这条鸣响">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6"/></svg>
              </button>
            </p>
            <p class="chirp-content">${escapeHTML(post.content)}</p>
            <div class="chirp-foot">
              <span class="action-static">评论 ${post.comments ?? 0}</span>
              <span class="action-static">点赞 ${post.likes ?? 0}</span>
            </div>
          </div>
        </article>`).join("");
    } catch {
      $("#posts-loading").textContent = "帖子加载失败，请稍后刷新重试。";
    }
  }

  function bindPostDelete() {
    $("#my-posts").addEventListener("click", async (event) => {
      const button = event.target.closest(".post-delete");
      if (!button) return;
      const node = button.closest(".chirp");
      const postId = Number(node?.dataset.id);
      if (!postId) return;
      if (!window.confirm("确定删除这条鸣响吗？删除后不可恢复，其评论和点赞也会一并删除。")) return;

      button.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/api/posts/${postId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${loadToken()}` }
        });
        if (response.status === 401) {
          location.replace("/index.html");
          return;
        }
        if (!response.ok && response.status !== 204) {
          button.disabled = false;
          alert(response.status === 403 ? "只能删除自己的鸣响" : "删除失败，请稍后重试");
          return;
        }
        node.remove();
        profile.postCount = Math.max(0, (profile.postCount ?? 1) - 1);
        $("#st-posts").textContent = profile.postCount;
        $("#posts-empty").classList.toggle("hidden", $("#my-posts").children.length > 0);
      } catch {
        button.disabled = false;
        alert("删除失败，请稍后重试");
      }
    });
  }

  function bindEditForm() {
    const card = $("#edit-card");
    const form = $("#edit-form");
    const status = $("#edit-status");
    const saveButton = $("#edit-save");

    $("#edit-btn").addEventListener("click", () => {
      if (!profile) return;
      $("#edit-name").value = profile.name || "";
      $("#edit-bio").value = profile.bio || "";
      $("#edit-avatar").value = profile.avatarUrl || "";
      status.textContent = "";
      card.classList.remove("hidden");
      saveButton.disabled = false;
      $("#edit-name").focus();
    });

    $("#edit-cancel").addEventListener("click", () => card.classList.add("hidden"));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = $("#edit-name").value.trim();
      const bio = $("#edit-bio").value.trim();
      const avatarUrl = $("#edit-avatar").value.trim();
      if (name.length < 2) {
        status.textContent = "昵称至少需要 2 个字符。";
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = "保存中…";
      try {
        const response = await fetch(`${API_BASE}/api/users/me`, {
          method: "PUT",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ name, bio, avatarUrl })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          location.replace("/index.html");
          return;
        }
        if (!response.ok) throw new Error(data.message || "保存失败，请稍后重试");

        profile = data;
        const user = loadUser();
        if (user) {
          user.name = profile.name;
          const store = localStorage.getItem("chirpUser") ? localStorage : sessionStorage;
          store.setItem("chirpUser", JSON.stringify(user));
        }
        const meName = $("#me-name");
        const meAvatar = $("#me-avatar");
        if (meName) meName.textContent = profile.name;
        if (meAvatar) meAvatar.textContent = (profile.name || "我").trim().charAt(0);

        renderProfile();
        status.textContent = "已保存。";
        setTimeout(() => card.classList.add("hidden"), 600);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        saveButton.textContent = "保存";
        saveButton.disabled = false;
      }
    });
  }

  if (!loadToken() || !loadUser()) {
    location.replace("/index.html");
    return;
  }

  bindPostDelete();
  bindEditForm();
})();
