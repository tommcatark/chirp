/*
 * 星空粒子层（迁移自 js/starfield.js）
 * 三层视差星空、闪烁、流星、鼠标视差与设备性能降级；
 * 动效开关持久化在 localStorage（chirpStarMotionV2）。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

const STORAGE_KEY = "chirpStarMotionV2";
const StarMotionContext = createContext(null);

function random(min, max) {
  return min + Math.random() * (max - min);
}

function createStar(definition, index) {
  const classes = ["star-particle"];
  const tint = Math.random();
  if (tint > 0.9) classes.push("is-blue");
  else if (tint > 0.8) classes.push("is-pink");
  if (Math.random() < definition.bright) classes.push("is-bright");

  return {
    key: `${definition.name}-${index}`,
    className: classes.join(" "),
    style: {
      "--x": `${random(0, 100).toFixed(2)}%`,
      "--y": `${random(0, 100).toFixed(2)}%`,
      "--size": `${random(definition.size[0], definition.size[1]).toFixed(2)}px`,
      "--tw": `${random(definition.twinkle[0], definition.twinkle[1]).toFixed(2)}s`,
      "--delay": `${(-Math.random() * 12).toFixed(2)}s`
    }
  };
}

function buildLayers({ isMobile, lowPower }) {
  const definitions = [
    {
      name: "far",
      depth: 6,
      count: isMobile ? 14 : lowPower ? 12 : 24,
      size: [0.8, 1.7],
      twinkle: [4.5, 8],
      duration: [70, 95],
      bright: 0.04
    },
    {
      name: "mid",
      depth: 14,
      count: isMobile ? 10 : lowPower ? 10 : 20,
      size: [1.1, 2.6],
      twinkle: [3, 6],
      duration: [36, 52],
      bright: 0.1
    },
    {
      name: "near",
      depth: 28,
      count: isMobile ? 6 : lowPower ? 8 : 14,
      size: [1.6, 3.8],
      twinkle: [2, 4.2],
      duration: [20, 30],
      bright: 0.24
    }
  ];

  return definitions.map((definition) => ({
    name: definition.name,
    depth: definition.depth,
    duration: `${random(definition.duration[0], definition.duration[1]).toFixed(1)}s`,
    delay: `${(-Math.random() * 20).toFixed(1)}s`,
    stars: Array.from({ length: definition.count }, (_, index) =>
      createStar(definition, index)
    )
  }));
}

function buildShootingStars(isMobile) {
  const count = isMobile ? 2 : 3;
  return Array.from({ length: count }, (_, index) => ({
    key: `shooting-${index}`,
    style: {
      "--x": `${random(4, 64).toFixed(1)}%`,
      "--y": `${random(2, 30).toFixed(1)}%`,
      "--sd": `${random(7, 13).toFixed(1)}s`,
      "--delay": `${random(1.5, 8).toFixed(1)}s`
    }
  }));
}

function readStoredMotion() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function readDeviceProfile() {
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const connection = navigator.connection;
  const lowPower =
    (navigator.hardwareConcurrency || 8) <= 4 || Boolean(connection && connection.saveData);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { isMobile, lowPower, reduceMotion };
}

export default function Starfield({ className = "", children }) {
  const [motionOn, setMotionOn] = useState(readStoredMotion);
  const layerRef = useRef(null);
  const device = useMemo(readDeviceProfile, []);
  const layers = useMemo(() => buildLayers(device), [device]);
  const shootingStars = useMemo(
    () => (motionOn ? buildShootingStars(device.isMobile) : []),
    [device.isMobile, motionOn]
  );

  const toggleMotion = useCallback(() => {
    setMotionOn((prev) => !prev);
  }, []);

  const contextValue = useMemo(
    () => ({ motionOn, toggleMotion }),
    [motionOn, toggleMotion]
  );

  /* 页面 usePageClass 会整体重写 body.className，因此延后一帧再挂载动效类 */
  useEffect(() => {
    const body = document.body;
    if (device.reduceMotion) body.dataset.starMotionPreference = "reduced";

    const raf = window.requestAnimationFrame(() => {
      body.classList.toggle("star-motion-off", !motionOn);
      body.classList.toggle("star-motion-paused", false);
    });

    try {
      localStorage.setItem(STORAGE_KEY, motionOn ? "on" : "off");
    } catch {
      /* 隐私模式下写入失败时仅本次会话生效 */
    }

    return () => {
      window.cancelAnimationFrame(raf);
      body.classList.remove("star-motion-off");
      body.classList.remove("star-motion-paused");
      delete body.dataset.starMotionPreference;
    };
  }, [motionOn, device.reduceMotion]);

  /* 鼠标视差 + 页面可见性暂停 */
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;

    const nodes = Array.from(layer.querySelectorAll(".star-parallax"));
    const allowParallax = motionOn && !device.isMobile && !device.lowPower;
    let raf = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const applyParallax = () => {
      nodes.forEach((node) => {
        const depth = Number(node.dataset.depth) || 1;
        node.style.transform = `translate3d(${(currentX * depth).toFixed(2)}px, ${(
          currentY * depth
        ).toFixed(2)}px, 0)`;
      });
    };

    const resetParallax = () => {
      nodes.forEach((node) => {
        node.style.transform = "translate3d(0, 0, 0)";
      });
    };

    resetParallax();

    const tickParallax = () => {
      const ease = 0.075;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;

      if (Math.abs(targetX - currentX) < 0.001 && Math.abs(targetY - currentY) < 0.001) {
        currentX = targetX;
        currentY = targetY;
        applyParallax();
        raf = null;
        return;
      }

      applyParallax();
      raf = window.requestAnimationFrame(tickParallax);
    };

    const startParallax = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(tickParallax);
    };

    const handlePointerMove = (event) => {
      if (!allowParallax) return;
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      startParallax();
    };

    const handlePointerLeave = () => {
      if (!allowParallax) return;
      targetX = 0;
      targetY = 0;
      startParallax();
    };

    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      layer.classList.toggle("is-paused", hidden);
      document.body.classList.toggle("star-motion-paused", hidden);
      if (hidden && raf !== null) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (raf !== null) window.cancelAnimationFrame(raf);
      layer.classList.remove("is-paused");
      document.body.classList.remove("star-motion-paused");
      resetParallax();
    };
  }, [device.isMobile, device.lowPower, layers, motionOn]);

  return (
    <StarMotionContext.Provider value={contextValue}>
      <div
        className={className ? `starfield ${className}` : "starfield"}
        id="starfield"
        aria-hidden="true"
        ref={layerRef}
      >
        {layers.map((layer) => (
          <div className="star-parallax" data-depth={layer.depth} key={layer.name}>
            <div
              className={`star-layer star-layer-${layer.name}`}
              style={{ "--dur": layer.duration, "--delay": layer.delay }}
            >
              {layer.stars.map((star) => (
                <span key={star.key} className={star.className} style={star.style} />
              ))}
            </div>
          </div>
        ))}
        {shootingStars.map((star) => (
          <span key={star.key} className="shooting-star" style={star.style} />
        ))}
      </div>
      {children}
    </StarMotionContext.Provider>
  );
}

export function StarMotionToggle() {
  const context = useContext(StarMotionContext);
  if (!context) return null;
  const { motionOn, toggleMotion } = context;

  return (
    <button
      className="star-motion-toggle"
      id="star-motion-toggle"
      type="button"
      aria-pressed={motionOn}
      title={motionOn ? "关闭星空粒子动效" : "开启星空粒子动效"}
      onClick={toggleMotion}
    >
      <span className="star-motion-dot" aria-hidden="true">
        ✦
      </span>
      <span className="star-motion-label">{motionOn ? "动效 开" : "开启动效"}</span>
    </button>
  );
}
