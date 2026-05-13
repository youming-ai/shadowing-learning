"use client";

import { useTheme } from "~/components/layout/contexts/ThemeContext";

// 导航栏主题切换按钮（只显示图标）
export function ThemeToggleIcon() {
  const { theme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === "system") {
      return "desktop_windows";
    }
    if (theme === "high-contrast") {
      return "contrast";
    }
    return theme === "dark" ? "dark_mode" : "light_mode";
  };

  return (
    <button type="button" onClick={toggleTheme} className="nav-button" title="切换主题">
      <span className="material-symbols-outlined text-3xl">{getIcon()}</span>
      <span className="sr-only">切换主题</span>
    </button>
  );
}
