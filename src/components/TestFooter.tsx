import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";

interface TestFooterProps {
  lang: Lang;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onOpenMap: () => void;
  isLast: boolean;
  onFinish: () => void;
  finishing?: boolean;
}

export function TestFooter({
  lang,
  currentIndex,
  onPrev,
  onNext,
  onOpenMap,
  isLast,
  onFinish,
  finishing,
}: TestFooterProps) {
  return (
    <nav className="exam-footer">
      <div className="exam-footer__left">
        <button
          type="button"
          className="exam-footer__ghost"
          onClick={onPrev}
          disabled={currentIndex === 0 || finishing}
        >
          <span className="material-symbols-outlined">chevron_left</span>
          <span className="exam-footer__text">{t("prevQuestion", lang)}</span>
        </button>
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
            <span className="exam-footer__text">{t("finishTest", lang)}</span>
            <span className="material-symbols-outlined">check</span>
          </button>
        ) : (
          <button
            type="button"
            className="exam-footer__next"
            onClick={onNext}
            disabled={finishing}
          >
            <span className="exam-footer__text">{t("nextQuestion", lang)}</span>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        )}
      </div>
    </nav>
  );
}
