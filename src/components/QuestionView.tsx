import { mediaUrl } from "../api/client";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnswerValue, Question } from "../types/test";
import {
  MatchingQuestion,
  MultipleChoiceQuestion,
  SingleChoiceQuestion,
} from "./questions/QuestionInputs";

interface QuestionViewProps {
  question: Question;
  lang: Lang;
  answer: AnswerValue | undefined;
  onAnswerChange: (value: AnswerValue) => void;
  onZoom?: (src: string) => void;
}

export function QuestionView({
  question,
  lang,
  answer,
  onAnswerChange,
  onZoom,
}: QuestionViewProps) {
  return (
    <article className="exam-card">
      <h2 className="exam-card__title">{question.text}</h2>

      {question.images && question.images.length > 0 && (
        <div
          className={`exam-card__media ${
            question.images.length > 1 ? "exam-card__media--grid" : ""
          }`}
        >
          {question.images.map((src, i) => {
            const url = mediaUrl(src);
            return (
              <div key={`${i}-${src.slice(0, 40)}`} className="exam-card__figure">
                <img src={url} alt="" />
                {onZoom && (
                  <button
                    type="button"
                    className="exam-card__zoom"
                    onClick={() => onZoom(url)}
                  >
                    <span className="material-symbols-outlined">zoom_in</span>
                    {t("zoomImage", lang)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {question.type === "single_choice" && (
        <SingleChoiceQuestion
          name={`q-${question.id}`}
          options={question.options}
          value={typeof answer === "string" ? answer : undefined}
          onChange={onAnswerChange}
        />
      )}

      {question.type === "multiple_choice" && (
        <MultipleChoiceQuestion
          options={question.options}
          value={Array.isArray(answer) ? answer : []}
          onChange={onAnswerChange}
        />
      )}

      {question.type === "matching" && (
        <MatchingQuestion
          lang={lang}
          rows={question.rows}
          options={question.options}
          value={
            typeof answer === "object" && !Array.isArray(answer) ? answer : {}
          }
          onChange={onAnswerChange}
        />
      )}
    </article>
  );
}
