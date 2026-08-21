import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ExamTools } from "../components/ExamTools";
import { QuestionView } from "../components/QuestionView";
import { TestFooter } from "../components/TestFooter";
import { TestHeader } from "../components/TestHeader";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnswerValue, TestDefinition } from "../types/test";
import {
  clearTestDraft,
  loadTestDraft,
  saveTestDraft,
} from "../utils/testDraft";

interface TestPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.values(value).some((v) => Boolean(v));
}

export function TestPage({ lang, onToggleLang }: TestPageProps) {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestDefinition | null>(null);
  const [loadError, setLoadError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [finishing, setFinishing] = useState(false);
  const [ready, setReady] = useState(false);
  const endsAtRef = useRef(0);
  const finishingRef = useRef(false);

  useEffect(() => {
    if (!testId) return;
    setReady(false);
    setTest(null);
    setLoadError("");
    finishingRef.current = false;
    setFinishing(false);
    api
      .getTest(testId)
      .then(({ test: loaded }) => {
        const draft = loadTestDraft(loaded.id);
        setTest(loaded);
        if (draft) {
          setAnswers(draft.answers);
          setCurrentIndex(
            Math.min(
              Math.max(0, draft.currentIndex),
              Math.max(0, loaded.questions.length - 1),
            ),
          );
          setStartedAt(draft.startedAt);
          endsAtRef.current = draft.endsAt;
          setSecondsLeft(
            Math.max(0, Math.ceil((draft.endsAt - Date.now()) / 1000)),
          );
        } else {
          const duration = loaded.durationMinutes * 60;
          const nowIso = new Date().toISOString();
          const endsAt = Date.now() + duration * 1000;
          endsAtRef.current = endsAt;
          setAnswers({});
          setCurrentIndex(0);
          setStartedAt(nowIso);
          setSecondsLeft(duration);
          saveTestDraft({
            testId: loaded.id,
            answers: {},
            currentIndex: 0,
            startedAt: nowIso,
            endsAt,
          });
        }
        setReady(true);
      })
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Тест не найден"),
      );
  }, [testId]);

  useEffect(() => {
    if (!test || !ready || finishing || !endsAtRef.current) return;
    saveTestDraft({
      testId: test.id,
      answers,
      currentIndex,
      startedAt,
      endsAt: endsAtRef.current,
    });
  }, [answers, currentIndex, finishing, ready, startedAt, test]);

  const finishTest = useCallback(async () => {
    if (!test || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      const result = await api.submitAttempt({
        testId: test.id,
        answers,
        startedAt,
      });
      clearTestDraft(test.id);
      navigate(`/test/${test.id}/results`, {
        state: {
          answers,
          startedAt,
          attempt: result.attempt,
          questions: result.questions,
        },
      });
    } catch (e) {
      finishingRef.current = false;
      setFinishing(false);
      window.alert(e instanceof Error ? e.message : "Не удалось сохранить результат");
    }
  }, [answers, navigate, startedAt, test]);

  const finishRef = useRef(finishTest);
  finishRef.current = finishTest;

  useEffect(() => {
    if (!test || !ready) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((endsAtRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(left);
      if (left <= 0) {
        void finishRef.current();
        return false;
      }
      return true;
    };
    if (!tick()) return;
    const timer = window.setInterval(() => {
      if (!tick()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready, test?.id]);

  const answeredIndexes = useMemo(() => {
    const set = new Set<number>();
    test?.questions.forEach((q, i) => {
      if (isAnswered(answers[q.id])) set.add(i);
    });
    return set;
  }, [answers, test]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setZoomSrc(null);
      setMapOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const persist = (
    nextAnswers: Record<number, AnswerValue>,
    nextIndex: number,
  ) => {
    if (finishingRef.current || !endsAtRef.current) return;
    saveTestDraft({
      testId: test.id,
      answers: nextAnswers,
      currentIndex: nextIndex,
      startedAt,
      endsAt: endsAtRef.current,
    });
  };

  const handleAnswerChange = (value: AnswerValue) => {
    setAnswers((prev) => {
      const next = { ...prev, [question.id]: value };
      persist(next, currentIndex);
      return next;
    });
  };

  const goTo = (index: number) => {
    const nextIndex = Math.min(
      test.questions.length - 1,
      Math.max(0, index),
    );
    setCurrentIndex(nextIndex);
    persist(answers, nextIndex);
  };

  const handleFinish = () => {
    if (window.confirm(t("confirmFinish", lang))) {
      void finishTest();
    }
  };

  const handleExit = () => {
    if (window.confirm(t("confirmExit", lang))) {
      navigate("/");
    }
  };

  return (
    <div className="exam">
      <TestHeader
        section={test.section || test.subject}
        lang={lang}
        current={currentIndex + 1}
        total={test.questions.length}
        timerSeconds={secondsLeft}
        onExit={handleExit}
        onToggleLang={onToggleLang}
      />

      <main className="exam-main">
        <QuestionView
          question={question}
          lang={lang}
          answer={answers[question.id]}
          onAnswerChange={handleAnswerChange}
          onZoom={setZoomSrc}
        />
      </main>

      <TestFooter
        lang={lang}
        currentIndex={currentIndex}
        totalQuestions={test.questions.length}
        answeredIds={answeredIndexes}
        onPrev={() => goTo(currentIndex - 1)}
        onNext={() => goTo(currentIndex + 1)}
        onJump={goTo}
        onOpenMap={() => setMapOpen(true)}
        isLast={currentIndex === test.questions.length - 1}
        onFinish={handleFinish}
        finishing={finishing}
      />

      <ExamTools lang={lang} />

      {mapOpen && (
        <div
          className="exam-map"
          role="dialog"
          aria-label={t("questionMap", lang)}
          onClick={() => setMapOpen(false)}
        >
          <div className="exam-map__panel" onClick={(e) => e.stopPropagation()}>
            <div className="exam-map__handle" aria-hidden="true" />
            <div className="exam-map__head">
              <h3>{t("questionMap", lang)}</h3>
              <button type="button" onClick={() => setMapOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="exam-map__meta">
              {t("answered", lang)}: {answeredIndexes.size} {t("of", lang)}{" "}
              {test.questions.length}
            </p>
            <div className="exam-map__legend">
              <span>
                <i className="exam-map__swatch exam-map__swatch--active" />
                {lang === "kz" ? "Қазіргі" : "Текущий"}
              </span>
              <span>
                <i className="exam-map__swatch exam-map__swatch--done" />
                {t("answered", lang)}
              </span>
              <span>
                <i className="exam-map__swatch" />
                {t("unanswered", lang)}
              </span>
            </div>
            <div className="exam-map__grid">
              {test.questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  className={`exam-map__cell ${
                    isAnswered(answers[q.id]) ? "exam-map__cell--done" : ""
                  } ${i === currentIndex ? "exam-map__cell--active" : ""}`}
                  onClick={() => {
                    goTo(i);
                    setMapOpen(false);
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {zoomSrc && (
        <button
          type="button"
          className="exam-lightbox"
          onClick={() => setZoomSrc(null)}
        >
          <img src={zoomSrc} alt="" />
        </button>
      )}
    </div>
  );
}
