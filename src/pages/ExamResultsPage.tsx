import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ThemeToggle } from "../components/ThemeToggle";
import { translateSubject } from "../i18n/subjects";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import { isSubmittedExam, type ExamSubmitResponse } from "../utils/examDraft";
import { entScoreToGrade } from "../utils/testUtils";

interface ExamResultsPageProps {
  lang: Lang;
}

export function ExamResultsPage({ lang }: ExamResultsPageProps) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = location.state as ExamSubmitResponse | null;
  const [state, setState] = useState<ExamSubmitResponse | null>(
    fromState?.sessionId && (!sessionId || fromState.sessionId === sessionId)
      ? fromState
      : null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!state && Boolean(sessionId));

  useEffect(() => {
    if (state || !sessionId) return;
    let cancelled = false;
    api
      .examSession(sessionId)
      .then((data) => {
        if (cancelled) return;
        if (!isSubmittedExam(data)) {
          navigate(`/exam/${sessionId}`, { replace: true });
          return;
        }
        setState(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Нәтиже табылмады");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, state, navigate]);

  if (loading) {
    return <div className="page page--center">Загрузка...</div>;
  }

  if (!state?.sections?.length) {
    return (
      <div className="page page--center">
        <p>{error || `${t("results", lang)} жоқ`}</p>
        <Link to="/profile">{lang === "kz" ? "Тарихқа" : "К истории"}</Link>
      </div>
    );
  }

  const entGrade = entScoreToGrade(state.score, state.maxScore);

  return (
    <div className="page ent-results">
      <header className="ent-results__top">
        <div className="ent-results__crumbs">
          {lang === "kz" ? "ТЕСТІЛЕУ > ТЕСТІЛЕУДІ АЯҚТАУ" : "ТЕСТИРОВАНИЕ > ЗАВЕРШЕНИЕ"}
        </div>
        <div className="ent-results__actions">
          <ThemeToggle />
          <Link to="/profile" className="ent-results__history">
            {lang === "kz" ? "Тарих" : "История"}
          </Link>
          <Link to="/" className="ent-results__home">
            {lang === "kz" ? "Басты бетке" : "На главную"}
          </Link>
        </div>
      </header>

      <section className="ent-results__panel">
        <table className="ent-summary-table">
          <thead>
            <tr>
              <th>{lang === "kz" ? "Бөлім" : "Раздел"}</th>
              <th>
                {lang === "kz"
                  ? "Бөлім бойынша ұпай саны"
                  : "Баллы по разделу"}
              </th>
              <th>{lang === "kz" ? "Барлығы" : "Итого"}</th>
            </tr>
          </thead>
          <tbody>
            {state.sections.map((section, index) => (
              <tr key={section.testId}>
                <td>
                  {lang === "kz"
                    ? section.titleKz || translateSubject(section.subject, lang)
                    : section.title || section.subject}
                </td>
                <td className="ent-summary-table__score">{section.score}</td>
                {index === 0 && (
                  <td
                    className="ent-summary-table__total"
                    rowSpan={state.sections.length}
                  >
                    <strong>{state.score}</strong>
                    <span className="ent-summary-table__max">
                      / {state.maxScore}
                    </span>
                    <div className="ent-summary-table__grade">
                      {t("entGrade", lang)}: {entGrade}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="ent-results__subtitle">
        {lang === "kz" ? "Тестілеу деректері" : "Данные тестирования"}
      </h2>

      {state.sections.map((section) => {
        const answered = Object.values(section.answerLabels).filter(Boolean)
          .length;
        const numbers = section.questionIds?.length
          ? section.questionIds
          : Array.from({ length: section.questionCount }, (_, i) => i + 1);
        return (
          <details key={section.testId} className="ent-detail" open>
            <summary className="ent-detail__toggle">
              <span className="material-symbols-outlined">expand_more</span>
              {lang === "kz"
                ? section.titleKz || translateSubject(section.subject, lang)
                : section.title || translateSubject(section.subject, lang)}
            </summary>
            <div className="ent-detail__meta">
              <div>
                <span>{lang === "kz" ? "Бөлім" : "Раздел"}</span>
                <strong>{translateSubject(section.subject, lang)}</strong>
              </div>
              <div>
                <span>{lang === "kz" ? "Жауаптар саны" : "Ответов"}</span>
                <strong>{answered}</strong>
              </div>
              <div>
                <span>
                  {lang === "kz"
                    ? "Бөлім бойынша ұпай саны"
                    : "Баллы по разделу"}
                </span>
                <strong>
                  {section.score} / {section.maxScore}
                </strong>
              </div>
            </div>

            <div className="ent-detail__scroll">
              <table className="ent-grid-table">
                <tbody>
                  <tr>
                    <th>
                      {lang === "kz"
                        ? "Тест тапсырмасының реті"
                        : "Номер задания"}
                    </th>
                    {numbers.map((n, i) => (
                      <td key={`n-${n}`}>{i + 1}</td>
                    ))}
                  </tr>
                  <tr>
                    <th>
                      {lang === "kz" ? "Сіздің жауабыңыз" : "Ваш ответ"}
                    </th>
                    {numbers.map((n) => (
                      <td key={`a-${n}`}>{section.answerLabels[n] || ""}</td>
                    ))}
                  </tr>
                  <tr>
                    <th>
                      {lang === "kz" ? "Тестілеу нәтижесі" : "Результат"}
                    </th>
                    {numbers.map((n) => (
                      <td
                        key={`r-${n}`}
                        className={
                          section.results[n]
                            ? "ent-grid-table__ok"
                            : "ent-grid-table__bad"
                        }
                      >
                        {section.points?.[n] ?? (section.results[n] ? 1 : 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        );
      })}

      <div className="results-page__links">
        <Link to="/profile" className="results-page__back">
          {lang === "kz" ? "Тарихқа қайту" : "К истории"}
        </Link>
      </div>
    </div>
  );
}
