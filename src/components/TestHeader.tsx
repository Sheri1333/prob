import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";

interface TestHeaderProps {
  section: string;
  lang: Lang;
  onToggleLang: () => void;
  onMenuClick: () => void;
  timerSeconds?: number;
  showTimer?: boolean;
}

export function TestHeader({
  section,
  lang,
  onToggleLang,
  onMenuClick,
  timerSeconds,
  showTimer,
}: TestHeaderProps) {
  const timerLabel =
    timerSeconds !== undefined
      ? `${Math.floor(timerSeconds / 60)}:${String(timerSeconds % 60).padStart(2, "0")}`
      : "";

  return (
    <header className="test-header">
      <button
        type="button"
        className="test-header__menu"
        onClick={onMenuClick}
        aria-label="Menu"
      >
        <span />
        <span />
        <span />
      </button>
      <div className="test-header__title">
        {t("section", lang)}: {section}
      </div>
      <div className="test-header__right">
        {showTimer && (
          <span className="test-header__timer" aria-live="polite">
            {timerLabel}
          </span>
        )}
        <button
          type="button"
          className="test-header__lang"
          onClick={onToggleLang}
        >
          {lang === "kz" ? "Kz" : "Ru"} ▾
        </button>
      </div>
    </header>
  );
}
