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
  return (
    <article className="exam-card">
      {question.context && <QuestionContext text={question.context} lang={lang} />}
      <h2 className="exam-card__title">{titleLine}</h2>
      {details && <RichText text={details} className="exam-card__details" />}

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
          onZoom={onZoom}
        />
      )}
    </article>
  );
}
