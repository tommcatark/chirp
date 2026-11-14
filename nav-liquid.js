/* 鸣 Chirp · 左侧导航液态玻璃滑块
   原生 DOM 实现：点击 / 拖拽 / 触摸滑动时，共享玻璃层平滑覆盖到目标图标。
   不改变各页面原有跳转地址与业务逻辑。 */
(() => {
  const navList = document.querySelector(".observatory .nav-list");
  const liquid = document.getElementById("nav-liquid");
  if (!navList || !liquid) return;

  const items = Array.from(navList.querySelectorAll(".nav-item"));
  if (!items.length) return;

  navList.classList.add("has-liquid");

  let active = navList.querySelector(".nav-item.active") || items[0];
  let dragging = false;
  let moved = false;
  let dragTarget = active;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;
  let suppressTimer = 0;
  let navTimer = 0;
  let resizeTimer = 0;

  const NAV_DELAY = 360;

  function setLiquid(item, instant) {
    if (!item) return;
    const listRect = navList.getBoundingClientRect();
    const rect = item.getBoundingClientRect();

    if (instant) liquid.style.transition = "none";

    liquid.style.setProperty("--liquid-x", `${(rect.left - listRect.left).toFixed(2)}px`);
    liquid.style.setProperty("--liquid-y", `${(rect.top - listRect.top).toFixed(2)}px`);
    liquid.style.setProperty("--liquid-w", `${rect.width.toFixed(2)}px`);
    liquid.style.setProperty("--liquid-h", `${rect.height.toFixed(2)}px`);

    if (instant) {
      void liquid.offsetWidth;
      liquid.style.transition = "";
    }
  }

  function setActive(item, move) {
    if (!item) return;
    if (active !== item) {
      active.classList.remove("active");
      active.removeAttribute("aria-current");
      active = item;
      active.classList.add("active");
      active.setAttribute("aria-current", "page");
    }
    if (move) setLiquid(active, false);
  }

  function navigate(item) {
    if (!item) return;

    const view = item.dataset.view;
    if (view) {
      document.dispatchEvent(new CustomEvent("chirp:view", { detail: { view } }));
      return;
    }

    const href = item.getAttribute("href");
    if (!href || href.startsWith("#")) return;

    const next = new URL(href, window.location.href);
    if (next.pathname === window.location.pathname && !next.hash) return;
    window.location.href = href;
  }

  function scheduleNavigation(item) {
    window.clearTimeout(navTimer);
    const delay = item.dataset.view ? 200 : NAV_DELAY;
    navTimer = window.setTimeout(() => navigate(item), delay);
  }

  function select(item, withNavigation) {
    if (!item) return;
    setActive(item, true);
    if (withNavigation) scheduleNavigation(item);
  }

  function nearestItem(x, y) {
    let best = null;
    let bestDistance = Infinity;

    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    });

    return best;
  }

  setLiquid(active, true);
  window.requestAnimationFrame(() => navList.classList.add("is-ready"));

  navList.addEventListener("click", (event) => {
    const item = event.target.closest(".nav-item");
    if (!item || !navList.contains(item)) return;

    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      window.clearTimeout(suppressTimer);
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    const href = item.getAttribute("href");
    if (!href || href.startsWith("#")) {
      event.preventDefault();
      select(item, false);
      return;
    }

    event.preventDefault();
    select(item, true);
  }, true);

  navList.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const item = event.target.closest(".nav-item");
    if (!item || !navList.contains(item)) return;

    dragging = true;
    moved = false;
    dragTarget = item;
    startX = event.clientX;
    startY = event.clientY;

    select(item, false);

    if (navList.setPointerCapture) {
      try {
        navList.setPointerCapture(event.pointerId);
      } catch {
        /* 某些浏览器不支持捕获，忽略 */
      }
    }
  });

  navList.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    if (!moved) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) < 6) return;
      moved = true;
      navList.classList.add("is-dragging");
    }

    const target = nearestItem(event.clientX, event.clientY);
    if (target && target !== dragTarget) {
      dragTarget = target;
      setActive(target, true);
    }
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    navList.classList.remove("is-dragging");

    const target = dragTarget || active;
    if (target) {
      suppressClick = true;
      window.clearTimeout(suppressTimer);
      suppressTimer = window.setTimeout(() => {
        suppressClick = false;
      }, 520);
      select(target, true);
    }

    moved = false;
  }

  navList.addEventListener("pointerup", endDrag);
  navList.addEventListener("pointercancel", () => {
    dragging = false;
    moved = false;
    navList.classList.remove("is-dragging");
  });

  navList.addEventListener("dragstart", (event) => event.preventDefault());

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => setLiquid(active, true), 120);
  });

  window.addEventListener("load", () => setLiquid(active, true));
})();
