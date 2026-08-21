import { Link, useLocation } from "react-router-dom";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { ExamSubmitResponse } from "../utils/examDraft";
import { entScoreToGrade } from "../utils/testUtils";

interface ExamResultsPageProps {
  lang: Lang;
}

export function ExamResultsPage({ lang }: ExamResultsPageProps) {
  const location = useLocation();
  const state = location.state as ExamSubmitResponse | null;

  if (!state?.sections?.length) {
    return (
      <div className="page page--center">
        <p>{t("results", lang)} жоқ</p>
        <Link to="/">{t("backToCatalog", lang)}</Link>
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
        <Link to="/" className="ent-results__home">
          {lang === "kz" ? "Басты бетке" : "На главную"}
        </Link>
      </header>

      <div className="ent-results__watermark" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i}>{t("watermark", lang)}</span>
        ))}
      </div>

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
                <td>{lang === "kz" ? section.titleKz || section.subject : section.title || section.subject}</td>
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
          <section key={section.testId} className="ent-detail">
            <div className="ent-detail__meta">
              <div>
                <span>{lang === "kz" ? "Бөлім" : "Раздел"}</span>
                <strong>{section.subject}</strong>
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
                        {section.results[n] ? "1" : "0"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="results-page__links">
        <Link to="/" className="results-page__back">
          {t("backToCatalog", lang)}
        </Link>
      </div>
    </div>
  );
}
