import { useEffect } from "react";

/* 按路由设置 body class 与页面标题，卸载时还原 */
export function usePageClass(className, title) {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = className;
    if (title) document.title = title;
    return () => {
      document.body.className = previous;
    };
  }, [className, title]);
}
