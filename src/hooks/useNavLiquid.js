import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_DELAY = 360;

/* 左侧导航液态滑块：点击 / 拖拽时共享玻璃层平滑移动，再执行路由跳转 */
export function useNavLiquid(navRef) {
  const navigate = useNavigate();
  const location = useLocation();
  const stateRef = useRef({});

  const setLiquid = useCallback(
    (item, instant) => {
      const nav = navRef.current;
      const liquid = nav && nav.querySelector(".nav-liquid");
      if (!nav || !liquid || !item) return;
      const listRect = nav.getBoundingClientRect();
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
    },
    [navRef]
  );

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const items = () => Array.from(nav.querySelectorAll(".nav-item"));
    const active = items().find((item) => item.getAttribute("aria-current") === "page") || items()[0];
    nav.classList.add("has-liquid");
    setLiquid(active, true);
    const raf = window.requestAnimationFrame(() => nav.classList.add("is-ready"));

    const resizeObserver = new ResizeObserver(() => {
      const current =
        items().find((item) => item.getAttribute("aria-current") === "page") || items()[0];
      setLiquid(current, true);
    });
    resizeObserver.observe(nav);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      nav.classList.remove("has-liquid", "is-ready", "is-dragging");
    };
  }, [navRef, location.pathname, setLiquid]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const state = stateRef.current;
    state.dragging = false;
    state.moved = false;
    state.dragTarget = null;
    state.suppressClick = false;
    state.timer = 0;
    state.suppressTimer = 0;

    const items = () => Array.from(nav.querySelectorAll(".nav-item"));

    const nearestItem = (x, y) => {
      let best = null;
      let bestDistance = Infinity;
      items().forEach((item) => {
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
    };

    const go = (item) => {
      const href = item && item.getAttribute("href");
      if (href) navigate(href);
    };

    const schedule = (item) => {
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => go(item), NAV_DELAY);
    };

    const onClick = (event) => {
      const item = event.target.closest(".nav-item");
      if (!item || !nav.contains(item)) return;
      if (state.suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        state.suppressClick = false;
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      setLiquid(item, false);
      schedule(item);
    };

    const onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const item = event.target.closest(".nav-item");
      if (!item || !nav.contains(item)) return;
      state.dragging = true;
      state.moved = false;
      state.dragTarget = item;
      state.startX = event.clientX;
      state.startY = event.clientY;
      setLiquid(item, false);
    };

    const onPointerMove = (event) => {
      if (!state.dragging) return;
      if (!state.moved) {
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (Math.hypot(dx, dy) < 6) return;
        state.moved = true;
        nav.classList.add("is-dragging");
      }
      const target = nearestItem(event.clientX, event.clientY);
      if (target && target !== state.dragTarget) {
        state.dragTarget = target;
        setLiquid(target, false);
      }
    };

    const onPointerUp = () => {
      if (!state.dragging) return;
      state.dragging = false;
      nav.classList.remove("is-dragging");
      const target = state.dragTarget;
      if (state.moved && target) {
        state.suppressClick = true;
        window.clearTimeout(state.suppressTimer);
        state.suppressTimer = window.setTimeout(() => {
          state.suppressClick = false;
        }, 520);
        schedule(target);
      }
      state.moved = false;
    };

    const onDragStart = (event) => event.preventDefault();

    nav.addEventListener("click", onClick, true);
    nav.addEventListener("pointerdown", onPointerDown);
    nav.addEventListener("pointermove", onPointerMove);
    nav.addEventListener("pointerup", onPointerUp);
    nav.addEventListener("pointercancel", onPointerUp);
    nav.addEventListener("dragstart", onDragStart);

    return () => {
      window.clearTimeout(state.timer);
      window.clearTimeout(state.suppressTimer);
      nav.removeEventListener("click", onClick, true);
      nav.removeEventListener("pointerdown", onPointerDown);
      nav.removeEventListener("pointermove", onPointerMove);
      nav.removeEventListener("pointerup", onPointerUp);
      nav.removeEventListener("pointercancel", onPointerUp);
      nav.removeEventListener("dragstart", onDragStart);
    };
  }, [navRef, navigate, setLiquid]);
}
