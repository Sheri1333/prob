import type { SyntheticEvent } from "react";
import { mediaUrl } from "../api/client";
import { RichText } from "./RichText";
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

/**
 * PDF question pictures are rendered at 2 px per point; shown 1:1 the body
 * text is ~22px and fractions stay readable. Never wider than the card.
 */
function showAtPrintSize(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.style.width = `${img.naturalWidth}px`;
}

/** Older imports stored "Heading\nbody" without the "## " marker. */
function withHeading(text: string): string {
  if (text.includes("## ") || text.includes("|")) return text;
  const [first, ...rest] = text.split("\n");
  return rest.length > 0 && first.length <= 60 && !/[.!?:;]$/.test(first)
    ? `## ${first}\n${rest.join("\n")}`
    : text;
}

function QuestionContext({ text, lang }: { text: string; lang: Lang }) {
  return (
    <section className="exam-context" aria-label={lang === "kz" ? "Мәтін" : "Текст"}>
      <span className="exam-context__badge">
        <span className="material-symbols-outlined">menu_book</span>
        {lang === "kz" ? "Мәтінді оқыңыз" : "Прочитайте текст"}
      </span>
      <RichText text={withHeading(text)} className="exam-context__body" />
    </section>
  );
}

export function QuestionView({
  question,
  lang,
  answer,
  onAnswerChange,
  onZoom,
}: QuestionViewProps) {
  // First line is the question; numbered statements, tables and code follow.
  const [titleLine, ...more] = question.text.split("\n");
  const details = more.join("\n").trim();
  // Questions imported as pictures from a maths PDF have no text of their own.
  const pageCut = !question.text.trim() && (question.images?.length ?? 0) > 0;
  return (
    <article className="exam-card">
      {question.context && <QuestionContext text={question.context} lang={lang} />}
      {titleLine && <h2 className="exam-card__title">{titleLine}</h2>}
      {details && <RichText text={details} className="exam-card__details" />}

      {question.images && question.images.length > 0 && (
        <div
          className={`exam-card__media ${
            pageCut
              ? "exam-card__media--page"
              : question.images.length > 1
                ? "exam-card__media--grid"
                : ""
          }`}
        >
          {question.images.map((src, i) => {
            const url = mediaUrl(src);
            return (
              <div key={`${i}-${src.slice(0, 40)}`} className="exam-card__figure">
                <img
                  src={url}
                  alt=""
                  onLoad={pageCut ? showAtPrintSize : undefined}
                />
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
          onZoom={onZoom}
        />
      )}
    </article>
  );
}
