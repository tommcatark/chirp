/* 鸣 Chirp · welcome 首屏：入场跳过、CTA 光圈过渡、已登录直达首页。
   本页不发任何后端请求；token 判断只存在于本文件。 */
(() => {
  const token = localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
  if (token) {
    window.location.replace("/home.html");
    return;
  }

  const body = document.body;
  const enter = document.getElementById("enter-btn");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 点击任意处跳过入场动画；CTA 自身由下面的处理器接管 */
  document.addEventListener("click", (event) => {
    if (enter && enter.contains(event.target)) return;
    body.classList.add("is-settled");
  }, { once: true, capture: true });

  if (!enter) return;

  enter.addEventListener("click", () => {
    if (body.classList.contains("is-leaving")) return;
    body.classList.add("is-settled");

    const rect = enter.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = reduceMotion ? "enter-ripple is-reduced" : "enter-ripple";
    ripple.style.left = `${rect.left + rect.width / 2}px`;
    ripple.style.top = `${rect.top + rect.height / 2}px`;
    body.appendChild(ripple);
    body.classList.add("is-leaving");

    window.setTimeout(() => {
      window.location.href = "/index.html";
    }, reduceMotion ? 180 : 560);
  });
})();
