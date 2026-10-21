import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Lang } from "../i18n/strings";
import { ThemeToggle } from "./ThemeToggle";

interface SiteHeaderProps {
  lang: Lang;
  onToggleLang?: () => void;
  /** Links shown after the language switch, e.g. "Home" or "Profile". */
  children?: ReactNode;
}

/** Logo, theme and language switch shared by the student-facing pages. */
export function SiteHeader({ lang, onToggleLang, children }: SiteHeaderProps) {
  const kz = lang === "kz";
  return (
    <header className="v2-header">
      <div className="site-header__brand">
        <Link to="/" className="site-header__logo">
          Талапкер
        </Link>
        <ThemeToggle />
      </div>
      <nav className="v2-nav">
        {onToggleLang && (
          <button
            type="button"
            className="v2-nav__lang"
            onClick={onToggleLang}
            aria-label={kz ? "Тілді ауыстыру" : "Сменить язык"}
          >
            {kz ? "Рус" : "Қаз"}
          </button>
        )}
        {children}
      </nav>
    </header>
  );
}
