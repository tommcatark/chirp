/* 鸣 Chirp · 列表入场动效
   仅对信息流/通知/会话列表做一次淡入上浮；分页或重绘的新节点同样生效。
   只改 opacity/translate，不触发布局；reduced-motion 与低端设备直接跳过。 */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(hover: none)").matches;
  const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
  const lowCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4 && coarsePointer;

  if (reduceMotion || lowMemory || lowCpu) {
    document.documentElement.classList.add("lite-motion");
    return;
  }
  if (!("IntersectionObserver" in window)) return;

  const root = document.documentElement;
  root.classList.add("has-motion");

  const REVEAL_SELECTOR = ".chirp, .notif-item, .conv-item";
  const MAX_DELAY = 180;
  const STEP_DELAY = 45;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add("is-revealed");
      observer.unobserve(el);
      window.setTimeout(() => {
        el.classList.remove("motion-item", "is-revealed");
        el.style.removeProperty("--reveal-delay");
      }, 900);
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });

  const queue = [];
  let scheduled = false;

  function flush() {
    scheduled = false;
    queue.splice(0, 12).forEach((el, index) => {
      el.style.setProperty("--reveal-delay", `${Math.min(index * STEP_DELAY, MAX_DELAY)}ms`);
      observer.observe(el);
    });
    if (queue.length) schedule();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(flush);
  }

  function collect(node) {
    if (!(node instanceof Element)) return;
    const found = [];
    if (node.matches(REVEAL_SELECTOR)) found.push(node);
    node.querySelectorAll(REVEAL_SELECTOR).forEach((el) => found.push(el));
    found.forEach((el) => {
      if (el.dataset.revealReady === "1") return;
      el.dataset.revealReady = "1";
      el.classList.add("motion-item");
      queue.push(el);
    });
    if (found.length) schedule();
  }

  document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
    el.dataset.revealReady = "1";
    el.classList.add("motion-item");
    queue.push(el);
  });
  if (queue.length) schedule();

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => collect(node));
    });
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
})();
