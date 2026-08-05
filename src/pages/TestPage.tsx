import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { QuestionView } from "../components/QuestionView";
import { TestFooter } from "../components/TestFooter";
import { TestHeader } from "../components/TestHeader";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnswerValue, TestDefinition } from "../types/test";

interface TestPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

export function TestPage({ lang, onToggleLang }: TestPageProps) {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [test, setTest] = useState<TestDefinition | null>(null);
  const [loadError, setLoadError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startedAt] = useState(() => new Date().toISOString());
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!testId) return;
    api
      .getTest(testId)
      .then(({ test: loaded }) => {
        setTest(loaded);
        setSecondsLeft(loaded.durationMinutes * 60);
      })
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Тест не найден"),
      );
  }, [testId]);

  const finishTest = useCallback(async () => {
    if (!test || finishing) return;
    setFinishing(true);
    try {
      const result = await api.submitAttempt({
        testId: test.id,
        answers,
        startedAt,
      });
      navigate(`/test/${test.id}/results`, {
        state: {
          answers,
          startedAt,
          attempt: result.attempt,
          questions: result.questions,
        },
      });
    } catch (e) {
      setFinishing(false);
      window.alert(e instanceof Error ? e.message : "Не удалось сохранить результат");
    }
  }, [answers, finishing, navigate, startedAt, test]);

  const finishRef = useRef(finishTest);
  finishRef.current = finishTest;

  useEffect(() => {
    if (!test) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void finishRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [test?.id]);

  const answeredCount = useMemo(
    () =>
      test?.questions.filter((q) => answers[q.id] !== undefined).length ?? 0,
    [answers, test],
  );

  if (authLoading) {
    return <div className="page page--center">Загрузка...</div>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `/test/${testId ?? ""}` }}
      />
    );
  }

  if (loadError) {
    return (
      <div className="page page--center">
        <p>{loadError}</p>
        <Link to="/">Каталог</Link>
      </div>
    );
  }

  if (!test) {
    return <div className="page page--center">Загрузка теста...</div>;
  }

  const question = test.questions[currentIndex];

  const handleAnswerChange = (value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const handleFinish = () => {
    if (window.confirm(t("confirmFinish", lang))) {
      void finishTest();
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
