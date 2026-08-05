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
}

export function QuestionView({
  question,
  lang,
  answer,
  onAnswerChange,
}: QuestionViewProps) {
  return (
    <div className="question-view">
      <div className="question-view__watermark">{t("watermark", lang)}</div>
      <div className="question-view__content">
        <p className="question-view__text">{question.text}</p>

        {question.images && question.images.length > 0 && (
          <div
            className={`question-view__images ${
              question.images.length > 1 ? "question-view__images--grid" : ""
            }`}
          >
            {question.images.map((src) => (
              <img key={src} src={src} alt="" className="question-view__image" />
            ))}
          </div>
        )}

        {question.type === "single_choice" && (
          <SingleChoiceQuestion
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
              typeof answer === "object" && !Array.isArray(answer)
                ? answer
                : {}
            }
            onChange={onAnswerChange}
          />
        )}
      </div>
    </div>
  );
}
