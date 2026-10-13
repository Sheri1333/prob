import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AnswerValue, Question, TestDefinition } from "../../types/test";
import { QuestionView } from "../QuestionView";

interface TestPreviewProps {
  testId: string;
  onClose: () => void;
}

function correctAnswerOf(q: Question): AnswerValue | undefined {
  if (q.type === "single_choice") return q.correctAnswer;
  return q.correctAnswers;
}

function formatAnswer(q: Question): string {
  if (q.type === "single_choice") return q.correctAnswer ?? "";
  if (q.type === "multiple_choice") return (q.correctAnswers ?? []).join(", ");
  const keys = q.correctAnswers ?? {};
  return q.rows
    .map((row, i) => (keys[row.id] ? `${i + 1}–${keys[row.id]}` : ""))
    .filter(Boolean)
    .join(", ");
}

/** Read-only walk through a test exactly as a student sees it. */
export function TestPreview({ testId, onClose }: TestPreviewProps) {
  const [test, setTest] = useState<TestDefinition | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .adminGetTest(testId)
      .then(({ test }) => {
        if (!cancelled) setTest(test);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось открыть тест");
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomSrc) setZoomSrc(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, zoomSrc]);

  const questions = test?.questions ?? [];
  const question = questions[index];
  const key = question ? formatAnswer(question) : "";

  return (
    <div className="test-preview exam" role="dialog" aria-label="Просмотр теста">
      <header className="test-preview__head">
        <div className="test-preview__title">
          <strong>{test ? test.titleKz || test.title : "Загрузка…"}</strong>
          {test && (
            <span>
              {test.subject} · {questions.length} вопросов
            </span>
          )}
        </div>
        <label className="test-preview__toggle">
          <input
            type="checkbox"
            checked={showAnswers}
            onChange={(e) => setShowAnswers(e.target.checked)}
          />
          Показать ответы
        </label>
        <button type="button" className="admin-btn" onClick={onClose}>
          Закрыть
        </button>
      </header>

      {questions.length > 0 && (
        <div className="test-preview__dots exam-header__dots">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              aria-label={`${i + 1}`}
              aria-current={i === index ? "step" : undefined}
              className={`exam-header__dot ${i === index ? "exam-header__dot--current" : ""} ${
                answers[q.id] !== undefined ? "exam-header__dot--done" : ""
              }`}
              onClick={() => setIndex(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <main className="test-preview__body">
        {error && <p className="admin-alert admin-alert--error">{error}</p>}
        {!error && !test && <p className="admin-hint">Загрузка теста…</p>}
        {test && questions.length === 0 && (
          <p className="admin-hint">В тесте нет вопросов.</p>
        )}
        {question && (
          <>
            <QuestionView
              key={question.id}
              question={question}
              lang="kz"
              answer={showAnswers ? correctAnswerOf(question) : answers[question.id]}
              onAnswerChange={(value) => {
                if (!showAnswers) setAnswers((prev) => ({ ...prev, [question.id]: value }));
              }}
              onZoom={setZoomSrc}
            />
            {showAnswers && (
              <p className={`test-preview__key ${key ? "" : "is-missing"}`}>
                {key ? `Правильный ответ: ${key}` : "У этого вопроса нет ключа"}
              </p>
            )}
          </>
        )}
      </main>

      {questions.length > 0 && (
        <footer className="test-preview__foot">
          <button
            type="button"
            className="admin-btn"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            ← Назад
          </button>
          <span>
            {index + 1} / {questions.length}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={index >= questions.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Далее →
          </button>
        </footer>
      )}

      {zoomSrc && (
        <button type="button" className="exam-lightbox" onClick={() => setZoomSrc(null)}>
          <img src={zoomSrc} alt="" />
        </button>
      )}
    </div>
  );
}
