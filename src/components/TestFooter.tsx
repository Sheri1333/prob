import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";

interface TestFooterProps {
  lang: Lang;
  currentIndex: number;
  totalQuestions: number;
  answeredIds: Set<number>;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
  onOpenMap: () => void;
  isLast: boolean;
  onFinish: () => void;
  finishing?: boolean;
}

export function TestFooter({
  lang,
  currentIndex,
  totalQuestions,
  answeredIds,
  onPrev,
  onNext,
  onJump,
  onOpenMap,
  isLast,
  onFinish,
  finishing,
}: TestFooterProps) {
  const windowSize = Math.min(5, totalQuestions);
  let start = Math.max(0, currentIndex - 2);
  if (start + windowSize > totalQuestions) {
    start = Math.max(0, totalQuestions - windowSize);
  }
  const dots = Array.from({ length: windowSize }, (_, i) => start + i);

  return (
    <nav className="exam-footer">
      <button
        type="button"
        className="exam-footer__ghost"
        onClick={onPrev}
        disabled={currentIndex === 0 || finishing}
      >
        <span className="material-symbols-outlined">chevron_left</span>
        {t("prevQuestion", lang)}
      </button>

      <div className="exam-footer__dots">
        {start > 0 && <span className="exam-footer__ellipsis">...</span>}
        {dots.map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1}`}
            aria-current={i === currentIndex ? "step" : undefined}
            className={`exam-footer__dot ${
              i === currentIndex ? "exam-footer__dot--current" : ""
            } ${answeredIds.has(i) ? "exam-footer__dot--done" : ""}`}
            onClick={() => onJump(i)}
          />
        ))}
        {start + windowSize < totalQuestions && (
          <span className="exam-footer__ellipsis">...</span>
        )}
      </div>

      <div className="exam-footer__right">
        <button type="button" className="exam-footer__ghost" onClick={onOpenMap}>
          <span className="material-symbols-outlined">grid_view</span>
          <span className="exam-footer__map-label">{t("questionMap", lang)}</span>
        </button>
        {isLast ? (
          <button
            type="button"
            className="exam-footer__next"
            onClick={onFinish}
            disabled={finishing}
          >
            {t("finishTest", lang)}
            <span className="material-symbols-outlined">check</span>
          </button>
        ) : (
          <button
            type="button"
            className="exam-footer__next"
            onClick={onNext}
            disabled={finishing}
          >
            {t("nextQuestion", lang)}
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        )}
      </div>
    </nav>
  );
}
