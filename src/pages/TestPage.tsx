import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QuestionView } from "../components/QuestionView";
import { TestFooter } from "../components/TestFooter";
import { TestHeader } from "../components/TestHeader";
import { testsById } from "../data/tests/ent-geography";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnswerValue } from "../types/test";

interface TestPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

export function TestPage({ lang, onToggleLang }: TestPageProps) {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const test = testId ? testsById[testId] : undefined;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    () => (test?.durationMinutes ?? 50) * 60,
  );
  const [startedAt] = useState(() => new Date().toISOString());

  const finishTest = useCallback(() => {
    if (!test) return;
    navigate(`/test/${test.id}/results`, {
      state: { answers, startedAt },
    });
  }, [answers, navigate, startedAt, test]);

  useEffect(() => {
    if (!test) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finishTest, test]);

  const answeredCount = useMemo(
    () =>
      test?.questions.filter((q) => answers[q.id] !== undefined).length ?? 0,
    [answers, test],
  );

  if (!test) {
    return (
      <div className="page page--center">
        <p>Тест табылмады</p>
      </div>
    );
  }

  const question = test.questions[currentIndex];

  const handleAnswerChange = (value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const handleFinish = () => {
    if (window.confirm(t("confirmFinish", lang))) {
      finishTest();
    }
  };

  return (
    <div className="test-page">
      <TestHeader
        section={test.section}
        lang={lang}
        onToggleLang={onToggleLang}
        onMenuClick={() => setMenuOpen((v) => !v)}
        timerSeconds={secondsLeft}
        showTimer
      />

      {menuOpen && (
        <aside className="test-sidebar">
          <p>
            {t("answered", lang)}: {answeredCount} {t("of", lang)}{" "}
            {test.questions.length}
          </p>
          <div className="test-sidebar__grid">
            {test.questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                className={`test-sidebar__item ${
                  answers[q.id] !== undefined ? "test-sidebar__item--done" : ""
                } ${i === currentIndex ? "test-sidebar__item--active" : ""}`}
                onClick={() => {
                  setCurrentIndex(i);
                  setMenuOpen(false);
                }}
              >
                {q.id}
              </button>
            ))}
          </div>
        </aside>
      )}

      <QuestionView
        question={question}
        lang={lang}
        answer={answers[question.id]}
        onAnswerChange={handleAnswerChange}
      />

      <TestFooter
        lang={lang}
        currentIndex={currentIndex}
        totalQuestions={test.questions.length}
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() =>
          setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1))
        }
        onJump={setCurrentIndex}
        isLast={currentIndex === test.questions.length - 1}
        onFinish={handleFinish}
      />
    </div>
  );
}
