import { Link, useLocation, useParams } from "react-router-dom";
import { testsById } from "../data/tests/ent-geography";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnswerValue, Question } from "../types/test";
import {
  entScoreToGrade,
  saveAttempt,
  scoreTest,
} from "../utils/testUtils";

interface ResultsState {
  answers: Record<number, AnswerValue>;
  startedAt: string;
}

interface ResultsPageProps {
  lang: Lang;
}

function formatAnswer(question: Question, answer: AnswerValue | undefined): string {
  if (answer === undefined) return "—";

  switch (question.type) {
    case "single_choice": {
      const opt = question.options.find((o) => o.id === answer);
      return opt ? `${opt.id}) ${opt.label}` : String(answer);
    }
    case "multiple_choice": {
      if (!Array.isArray(answer)) return "—";
      return answer
        .map((id) => {
          const opt = question.options.find((o) => o.id === id);
          return opt ? `${opt.id}) ${opt.label}` : id;
        })
        .join("; ");
    }
    case "matching": {
      if (typeof answer !== "object" || Array.isArray(answer)) return "—";
      return Object.entries(answer)
        .map(([rowId, optId]) => {
          const row = question.rows.find((r) => r.id === rowId);
          const opt = question.options.find((o) => o.id === optId);
          return `${row?.label ?? rowId}: ${opt?.label ?? optId}`;
        })
        .join("; ");
    }
    default:
      return "—";
  }
}

function formatCorrect(question: Question): string {
  switch (question.type) {
    case "single_choice": {
      const opt = question.options.find((o) => o.id === question.correctAnswer);
      return opt ? `${opt.id}) ${opt.label}` : question.correctAnswer;
    }
    case "multiple_choice":
      return question.correctAnswers
        .map((id) => {
          const opt = question.options.find((o) => o.id === id);
          return opt ? `${opt.id}) ${opt.label}` : id;
        })
        .join("; ");
    case "matching":
      return Object.entries(question.correctAnswers)
        .map(([rowId, optId]) => {
          const row = question.rows.find((r) => r.id === rowId);
          const opt = question.options.find((o) => o.id === optId);
          return `${row?.label ?? rowId}: ${opt?.label ?? optId}`;
        })
        .join("; ");
    default:
      return "—";
  }
}

export function ResultsPage({ lang }: ResultsPageProps) {
  const { testId } = useParams<{ testId: string }>();
  const location = useLocation();
  const state = location.state as ResultsState | null;
  const test = testId ? testsById[testId] : undefined;

  if (!test || !state?.answers) {
    return (
      <div className="page page--center">
        <p>{t("results", lang)} жоқ</p>
        <Link to="/">{t("backToCatalog", lang)}</Link>
      </div>
    );
  }

  const { score, maxScore, results } = scoreTest(test.questions, state.answers);
  const entGrade = entScoreToGrade(score, maxScore);

  saveAttempt({
    testId: test.id,
    answers: state.answers,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    score,
    maxScore,
  });

  return (
    <div className="page results-page">
      <header className="site-header">
        <div className="site-header__logo">PROB</div>
        <h1>{t("results", lang)}</h1>
      </header>

      <section className="results-summary">
        <div className="results-summary__card">
          <span>{t("score", lang)}</span>
          <strong>
            {score} / {maxScore}
          </strong>
        </div>
        <div className="results-summary__card">
          <span>{t("entGrade", lang)}</span>
          <strong>{entGrade}</strong>
        </div>
        <div className="results-summary__card">
          <span>{t("correct", lang)}</span>
          <strong>{score}</strong>
        </div>
        <div className="results-summary__card">
          <span>{t("incorrect", lang)}</span>
          <strong>{maxScore - score}</strong>
        </div>
      </section>

      <section className="results-breakdown">
        <h2>{lang === "kz" ? "Жауаптар талдауы" : "Разбор ответов"}</h2>
        <div className="results-list">
          {test.questions.map((question) => {
            const userAnswer = state.answers[question.id];
            const correct = results[question.id];
            return (
              <article
                key={question.id}
                className={`result-item ${correct ? "result-item--ok" : "result-item--bad"}`}
              >
                <div className="result-item__head">
                  <span>№{question.id}</span>
                  <span>
                    {correct ? t("correct", lang) : t("incorrect", lang)}
                  </span>
                </div>
                <p className="result-item__question">{question.text}</p>
                <p>
                  <strong>{t("yourAnswer", lang)}:</strong>{" "}
                  {formatAnswer(question, userAnswer) || t("unanswered", lang)}
                </p>
                {!correct && (
                  <p>
                    <strong>{t("correctAnswer", lang)}:</strong>{" "}
                    {formatCorrect(question)}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <Link to="/" className="results-page__back">
        {t("backToCatalog", lang)}
      </Link>
    </div>
  );
}
