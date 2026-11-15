import { useEffect } from "react";

const REVEAL_SELECTOR = ".chirp, .notif-item, .conv-item";
const MAX_DELAY = 180;
const STEP_DELAY = 45;

/* 列表入场动效：低端设备或 reduced-motion 时只加 lite-motion，不建立观察器 */
export function useRevealMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(hover: none)").matches;
    const lowMemory =
      typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
    const lowCpu =
      typeof navigator.hardwareConcurrency === "number" &&
      navigator.hardwareConcurrency <= 4 &&
      coarsePointer;

    if (reduceMotion || lowMemory || lowCpu || !("IntersectionObserver" in window)) {
      root.classList.add("lite-motion");
      return () => root.classList.remove("lite-motion");
    }

    root.classList.add("has-motion");
    const observer = new IntersectionObserver(
      (entries) => {
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
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );

    const queue = [];
    let scheduled = false;
    let timer = 0;

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(flush);
    };

    const flush = () => {
      scheduled = false;
      queue.splice(0, 12).forEach((el, index) => {
        el.style.setProperty("--reveal-delay", `${Math.min(index * STEP_DELAY, MAX_DELAY)}ms`);
        observer.observe(el);
      });
      if (queue.length) schedule();
    };

    const collect = (node) => {
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
    };

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

    return () => {
      window.clearTimeout(timer);
      mutationObserver.disconnect();
      observer.disconnect();
      root.classList.remove("has-motion");
    };
  }, []);
}
