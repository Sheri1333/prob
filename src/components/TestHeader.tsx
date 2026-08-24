import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";

export interface SectionSummary {
  subject: string;
  answered: number;
  total: number;
  current: boolean;
}

interface TestHeaderProps {
  section: string;
  lang: Lang;
  current: number;
  total: number;
  timerSeconds?: number;
  onExit: () => void;
  onToggleLang?: () => void;
  sections?: SectionSummary[];
  onSwitchSection?: (index: number) => void;
  answeredIds?: Set<number>;
  onJump?: (index: number) => void;
}

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TestHeader({
  section,
  lang,
  current,
  total,
  timerSeconds,
  onExit,
  onToggleLang,
  sections,
  onSwitchSection,
  answeredIds,
  onJump,
}: TestHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasMenu = !!sections && sections.length > 1 && !!onSwitchSection;
  const currentDotRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    currentDotRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [current]);

  return (
    <header className="exam-header">
      <div className="exam-header__row">
        <div className="exam-header__subject" ref={menuRef}>
          <button
            type="button"
            className={`exam-header__title ${hasMenu ? "exam-header__title--menu" : ""}`}
            onClick={() => hasMenu && setMenuOpen((v) => !v)}
          >
            {section}
            {hasMenu && (
              <span className="material-symbols-outlined" aria-hidden>
                {menuOpen ? "expand_less" : "expand_more"}
              </span>
            )}
          </button>
          {hasMenu && menuOpen && (
            <div className="exam-header__menu" role="menu">
              {sections!.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  className={`exam-header__menu-item ${s.current ? "active" : ""}`}
                  onClick={() => {
                    onSwitchSection!(i);
                    setMenuOpen(false);
                  }}
                >
                  <span>{s.subject}</span>
                  <span className="exam-header__menu-progress">
                    {s.answered}/{s.total}
                  </span>
                </button>
              ))}
            </div>
          )}
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
          <ThemeToggle />
          <button type="button" className="exam-header__exit" onClick={onExit}>
            <span className="exam-header__exit-label">{t("exitTest", lang)}</span>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {total > 0 && (
        <div className="exam-header__nav">
          <span className="exam-header__nav-count">
            {current}/{total}
          </span>
          <div className="exam-header__dots">
            {Array.from({ length: total }, (_, i) => i).map((i) => (
              <button
                key={i}
                ref={i === current - 1 ? currentDotRef : undefined}
                type="button"
                aria-label={`${i + 1}`}
                aria-current={i === current - 1 ? "step" : undefined}
                className={`exam-header__dot ${
                  i === current - 1 ? "exam-header__dot--current" : ""
                } ${answeredIds?.has(i) ? "exam-header__dot--done" : ""}`}
                onClick={() => onJump?.(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
