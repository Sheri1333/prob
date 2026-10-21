import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { SiteHeader } from "../components/SiteHeader";
import { translateSubject } from "../i18n/subjects";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import { isSubmittedExam, type ExamSubmitResponse } from "../utils/examDraft";
import { entScoreToGrade } from "../utils/testUtils";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface ExamResultsPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

function share(score: number, max: number): string {
  return max > 0 ? `${Math.min(100, Math.max(0, (score / max) * 100))}%` : "0%";
}

export function ExamResultsPage({ lang, onToggleLang }: ExamResultsPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "ҰБТ нәтижесі" : "Результаты ЕНТ");
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

  const header = (
    <SiteHeader lang={lang} onToggleLang={onToggleLang}>
      <Link to="/profile">{kz ? "Нәтижелер тарихы" : "История результатов"}</Link>
      <Link to="/">{kz ? "Басты бет" : "Главная"}</Link>
    </SiteHeader>
  );

  if (loading) {
    return (
      <div className="page v2">
        {header}
        <p className="v2-section__intro" role="status">
          {kz ? "Нәтиже жүктелуде…" : "Загружаем результат…"}
        </p>
      </div>
    );
  }

  if (!state?.sections?.length) {
    return (
      <div className="page v2">
        {header}
        <main className="not-found">
          <h1>{kz ? "Нәтиже табылмады" : "Результат не найден"}</h1>
          <p>
            {error ||
              (kz
                ? "Бұл сілтеме бойынша аяқталған ҰБТ жоқ."
                : "По этой ссылке нет завершённого ЕНТ.")}
          </p>
          <Link to="/profile" className="v2-btn">
            {kz ? "Нәтижелер тарихына" : "К истории результатов"}
          </Link>
        </main>
      </div>
    );
  }

  const entGrade = entScoreToGrade(state.score, state.maxScore);
  const finished = new Date(state.finishedAt).toLocaleDateString("ru-RU");

  return (
    <div className="page v2">
      {header}

      <section className="result-head">
        <h1>{kz ? "ҰБТ нәтижесі" : "Результат ЕНТ"}</h1>
        <p className="result-head__date">
          {kz ? `${finished} тапсырылды` : `Сдан ${finished}`}
        </p>
        <p className="result-head__score">
          <strong>{state.score}</strong>
          <span>/ {state.maxScore}</span>
        </p>
        {state.maxScore !== 140 && (
          <p className="result-head__grade">
            {t("entGrade", lang)}: {entGrade} / 140
          </p>
        )}

        <div className="result-scale" aria-hidden="true">
          {state.sections.map((s) => (
            <div
              key={s.testId}
              className="result-scale__seg"
              style={{ flexGrow: s.maxScore }}
              title={`${translateSubject(s.subject, lang)}: ${s.score} / ${s.maxScore}`}
            >
              <span
                className="result-scale__fill"
                style={{ width: share(s.score, s.maxScore) }}
              />
            </div>
          ))}
        </div>

        <table className="result-table">
          <caption className="visually-hidden">
            {kz ? "Пәндер бойынша балл" : "Баллы по предметам"}
          </caption>
          <tbody>
            {state.sections.map((s) => (
              <tr key={s.testId}>
                <th scope="row">{translateSubject(s.subject, lang)}</th>
                <td className="result-table__bar">
                  <span className="result-table__track">
                    <span style={{ width: share(s.score, s.maxScore) }} />
                  </span>
                </td>
                <td className="result-table__score">
                  {s.score}
                  <span> / {s.maxScore}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{kz ? "Барлығы" : "Итого"}</th>
              <td />
              <td className="result-table__score">
                {state.score}
                <span> / {state.maxScore}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="v2-section">
        <h2>{kz ? "Әр сұрақ бойынша" : "По каждому вопросу"}</h2>
        <p className="v2-section__intro">
          {kz
            ? "Нағыз ҰБТ парағындағыдай: тапсырма нөмірі, сіздің жауабыңыз және алған балыңыз."
            : "Как в листе настоящего ЕНТ: номер задания, ваш ответ и полученный балл."}
        </p>

        {state.sections.map((section) => {
          const answered = Object.values(section.answerLabels).filter(Boolean).length;
          const numbers = section.questionIds?.length
            ? section.questionIds
            : Array.from({ length: section.questionCount }, (_, i) => i + 1);
          return (
            <details key={section.testId} className="answer-sheet" open>
              <summary>
                <span className="answer-sheet__subject">
                  {translateSubject(section.subject, lang)}
                </span>
                <span className="answer-sheet__meta">
                  {kz
                    ? `${answered} / ${section.questionCount} жауап`
                    : `${answered} из ${section.questionCount} отвечено`}
                </span>
                <span className="answer-sheet__score">
                  {section.score} / {section.maxScore}
                </span>
              </summary>

              <div className="answer-sheet__scroll">
                <table className="answer-grid">
                  <tbody>
                    <tr>
                      <th scope="row">{kz ? "Тапсырма" : "Задание"}</th>
                      {numbers.map((n, i) => (
                        <td key={`n-${n}`}>{i + 1}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">{kz ? "Сіздің жауабыңыз" : "Ваш ответ"}</th>
                      {numbers.map((n) => (
                        <td key={`a-${n}`}>{section.answerLabels[n] || ""}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">{kz ? "Балл" : "Балл"}</th>
                      {numbers.map((n) => {
                        const pts = section.points?.[n] ?? (section.results[n] ? 1 : 0);
                        return (
                          <td
                            key={`r-${n}`}
                            className={
                              section.results[n]
                                ? "is-ok"
                                : pts > 0
                                  ? "is-part"
                                  : "is-bad"
                            }
                          >
                            {pts}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}

        <div className="result-actions">
          <Link to="/" className="v2-btn">
            {kz ? "Тағы бір ҰБТ тапсыру" : "Пройти ЕНТ ещё раз"}
          </Link>
          <Link to="/profile" className="v2-btn v2-btn--quiet">
            {kz ? "Нәтижелер тарихы" : "История результатов"}
          </Link>
        </div>
      </section>
    </div>
  );
}
