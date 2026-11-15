/* 鸣 Chirp · 星空粒子层
   仅由 welcome.html 与 index.html 引入。
   三层视差星空：远景/中景/近景漂移、闪烁、流星和鼠标视差。
   默认开启动效；页脚「动效」按钮可关闭并记住选择。 */
(() => {
  const layer = document.getElementById("starfield");
  if (!layer) return;

  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const connection = navigator.connection;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || Boolean(connection && connection.saveData);
  const stored = localStorage.getItem("chirpStarMotionV2");

  let motionOn = stored !== "off";
  let parallaxRaf = null;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  const parallaxNodes = [];

  const definitions = [
    {
      name: "far",
      depth: 6,
      count: isMobile ? 14 : (lowPower ? 12 : 24),
      size: [0.8, 1.7],
      twinkle: [4.5, 8],
      duration: [70, 95],
      bright: 0.04
    },
    {
      name: "mid",
      depth: 14,
      count: isMobile ? 10 : (lowPower ? 10 : 20),
      size: [1.1, 2.6],
      twinkle: [3, 6],
      duration: [36, 52],
      bright: 0.1
    },
    {
      name: "near",
      depth: 28,
      count: isMobile ? 6 : (lowPower ? 8 : 14),
      size: [1.6, 3.8],
      twinkle: [2, 4.2],
      duration: [20, 30],
      bright: 0.24
    }
  ];

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function createStar(definition) {
    const star = document.createElement("span");
    star.className = "star-particle";
    star.style.setProperty("--x", `${random(0, 100).toFixed(2)}%`);
    star.style.setProperty("--y", `${random(0, 100).toFixed(2)}%`);
    star.style.setProperty("--size", `${random(definition.size[0], definition.size[1]).toFixed(2)}px`);
    star.style.setProperty("--tw", `${random(definition.twinkle[0], definition.twinkle[1]).toFixed(2)}s`);
    star.style.setProperty("--delay", `${(-Math.random() * 12).toFixed(2)}s`);

    const tint = Math.random();
    if (tint > 0.9) star.classList.add("is-blue");
    else if (tint > 0.8) star.classList.add("is-pink");
    if (Math.random() < definition.bright) star.classList.add("is-bright");

    return star;
  }

  function addShootingStars() {
    if (!motionOn) return;
    const count = isMobile ? 2 : 3;
    for (let i = 0; i < count; i += 1) {
      const shooting = document.createElement("span");
      shooting.className = "shooting-star";
      shooting.style.setProperty("--x", `${random(4, 64).toFixed(1)}%`);
      shooting.style.setProperty("--y", `${random(2, 30).toFixed(1)}%`);
      shooting.style.setProperty("--sd", `${random(7, 13).toFixed(1)}s`);
      shooting.style.setProperty("--delay", `${random(1.5, 8).toFixed(1)}s`);
      layer.appendChild(shooting);
    }
  }

  function updateToggle() {
    const button = document.getElementById("star-motion-toggle");
    if (!button) return;
    button.setAttribute("aria-pressed", String(motionOn));
    button.title = motionOn ? "关闭星空粒子动效" : "开启星空粒子动效";
    const label = button.querySelector(".star-motion-label");
    if (label) label.textContent = motionOn ? "动效 开" : "开启动效";
  }

  function applyParallax() {
    const depth = parallaxNodes.length ? Number(parallaxNodes[0].dataset.depth) : 1;
    parallaxNodes.forEach((node) => {
      const nodeDepth = Number(node.dataset.depth) || depth;
      node.style.transform = `translate3d(${(currentX * nodeDepth).toFixed(2)}px, ${(currentY * nodeDepth).toFixed(2)}px, 0)`;
    });
  }

  function tickParallax() {
    const ease = 0.075;
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;

    if (Math.abs(targetX - currentX) < 0.001 && Math.abs(targetY - currentY) < 0.001) {
      currentX = targetX;
      currentY = targetY;
      applyParallax();
      parallaxRaf = null;
      return;
    }

    applyParallax();
    parallaxRaf = window.requestAnimationFrame(tickParallax);
  }

  function startParallax() {
    if (parallaxRaf !== null) return;
    parallaxRaf = window.requestAnimationFrame(tickParallax);
  }

  function resetParallax() {
    targetX = 0;
    targetY = 0;
    currentX = 0;
    currentY = 0;
    parallaxNodes.forEach((node) => {
      node.style.transform = "translate3d(0, 0, 0)";
    });
    if (parallaxRaf !== null) {
      window.cancelAnimationFrame(parallaxRaf);
      parallaxRaf = null;
    }
  }

  function build() {
    layer.textContent = "";
    parallaxNodes.length = 0;

    definitions.forEach((definition) => {
      const parallax = document.createElement("div");
      parallax.className = "star-parallax";
      parallax.dataset.depth = String(definition.depth);

      const sky = document.createElement("div");
      sky.className = `star-layer star-layer-${definition.name}`;
      sky.style.setProperty("--dur", `${random(definition.duration[0], definition.duration[1]).toFixed(1)}s`);
      sky.style.setProperty("--delay", `${(-Math.random() * 20).toFixed(1)}s`);

      for (let i = 0; i < definition.count; i += 1) {
        sky.appendChild(createStar(definition));
      }

      parallax.appendChild(sky);
      layer.appendChild(parallax);
      parallaxNodes.push(parallax);
    });

    if (motionOn) addShootingStars();
    body.classList.toggle("star-motion-off", !motionOn);
    body.classList.toggle("star-motion-paused", false);
    updateToggle();

    const allowParallax = motionOn && !isMobile && !lowPower;
    if (allowParallax) {
      resetParallax();
    } else {
      parallaxNodes.forEach((node) => {
        node.style.transform = "translate3d(0, 0, 0)";
      });
    }
  }

  function setMotion(next) {
    motionOn = next;
    localStorage.setItem("chirpStarMotionV2", motionOn ? "on" : "off");
    build();
  }

  const toggle = document.getElementById("star-motion-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => setMotion(!motionOn));
  }

  window.addEventListener("pointermove", (event) => {
    if (!motionOn || isMobile || lowPower) return;
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    startParallax();
  }, { passive: true });

  window.addEventListener("pointerleave", () => {
    if (!motionOn || isMobile || lowPower) return;
    targetX = 0;
    targetY = 0;
    startParallax();
  });

  document.addEventListener("visibilitychange", () => {
    const hidden = document.hidden;
    layer.classList.toggle("is-paused", hidden);
    body.classList.toggle("star-motion-paused", hidden);
    if (hidden && parallaxRaf !== null) {
      window.cancelAnimationFrame(parallaxRaf);
      parallaxRaf = null;
    }
  });

  build();

  if (reduceMotion) {
    body.dataset.starMotionPreference = "reduced";
  }
})();
