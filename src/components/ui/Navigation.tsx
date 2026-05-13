import { Link, useLocation } from "@tanstack/react-router";
import { useI18n } from "~/components/layout/contexts/I18nContext";
import { ROUTES } from "~/lib/config/routes";
import LanguageToggle from "./LanguageToggle";
import { ThemeToggleIcon } from "./ThemeToggle";

export default function Navigation() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  const navLinks = [
    {
      id: "home",
      labelKey: "nav.home" as const,
      icon: "home",
      href: ROUTES.HOME,
    },
    {
      id: "settings",
      labelKey: "nav.settings" as const,
      icon: "settings",
      href: ROUTES.SETTINGS,
    },
    {
      id: "account",
      labelKey: "nav.account" as const,
      icon: "account_circle",
      href: ROUTES.ACCOUNT,
    },
  ] as const;

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="nav-container">
        {navLinks.map((item) => {
          const isActive =
            pathname === item.href.replace(/#.*/, "") ||
            (item.href.startsWith("/") && pathname.startsWith("/player") && item.href === "/");

          return (
            <Link
              key={item.id}
              to={item.href}
              className={`nav-button ${isActive ? "active" : ""}`}
              aria-label={t(item.labelKey)}
              aria-current={isActive ? "page" : undefined}
              title={t(item.labelKey)}
            >
              <span className="material-symbols-outlined text-3xl">{item.icon}</span>
            </Link>
          );
        })}

        {/*控制按钮组*/}
        <div className="flex items-center gap-2">
          {/*语言切换按钮*/}
          <LanguageToggle />
          {/*主题切换按钮*/}
          <ThemeToggleIcon />
        </div>
      </div>
    </nav>
  );
}
