import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";

interface TestFooterProps {
  lang: Lang;
  currentIndex: number;
  totalQuestions: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
  isLast: boolean;
  onFinish: () => void;
}

export function TestFooter({
  lang,
  currentIndex,
  totalQuestions,
  onPrev,
  onNext,
  onJump,
  isLast,
  onFinish,
}: TestFooterProps) {
  return (
    <footer className="test-footer">
      <button
        type="button"
        className="test-footer__btn"
        onClick={onPrev}
        disabled={currentIndex === 0}
      >
        &lt; {t("prevQuestion", lang)}
      </button>

      <div className="test-footer__jump">
        <select
          value={currentIndex}
          onChange={(e) => onJump(Number(e.target.value))}
          aria-label="Question number"
        >
          {Array.from({ length: totalQuestions }, (_, i) => (
            <option key={i} value={i}>
              {i + 1}
            </option>
          ))}
        </select>
      </div>

      {isLast ? (
        <button type="button" className="test-footer__btn" onClick={onFinish}>
          {t("finishTest", lang)} &gt;
        </button>
      ) : (
        <button type="button" className="test-footer__btn" onClick={onNext}>
          {t("nextQuestion", lang)} &gt;
        </button>
      )}
    </footer>
  );
}
