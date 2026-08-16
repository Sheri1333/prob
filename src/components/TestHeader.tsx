import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";

interface TestHeaderProps {
  section: string;
  lang: Lang;
  current: number;
  total: number;
  timerSeconds?: number;
  onExit: () => void;
  onToggleLang?: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TestHeader({
  section,
  lang,
  current,
  total,
  timerSeconds,
  onExit,
  onToggleLang,
}: TestHeaderProps) {
  const percent = total > 0 ? (current / total) * 100 : 0;

  return (
    <header className="exam-header">
      <div className="exam-header__title">{section}</div>
      <div className="exam-header__progress">
        <span className="exam-header__count">
          {current}/{total}
        </span>
        <div className="exam-header__bar" aria-hidden>
          <div className="exam-header__bar-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="exam-header__actions">
        {timerSeconds !== undefined && (
          <span className="exam-header__timer">{formatTimer(timerSeconds)}</span>
        )}
        {onToggleLang && (
          <button type="button" className="exam-header__lang" onClick={onToggleLang}>
            {lang === "kz" ? "RU" : "KZ"}
          </button>
        )}
        <button type="button" className="exam-header__exit" onClick={onExit}>
          <span className="exam-header__exit-label">{t("exitTest", lang)}</span>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </header>
  );
}
