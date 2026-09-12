import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../api/client";
import { ExamTools } from "../components/ExamTools";
import { QuestionView } from "../components/QuestionView";
import { TestFooter } from "../components/TestFooter";
import { TestHeader } from "../components/TestHeader";
import { translateSubject } from "../i18n/subjects";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnswerValue } from "../types/test";
import {
  answersToStringKeys,
  clearExamDraft,
  draftFromSession,
  isSubmittedExam,
  loadUsedVariants,
  rememberUsedVariants,
  saveExamDraft,
  type ExamDraft,
  type ExamSectionMeta,
  type ExamSessionResponse,
} from "../utils/examDraft";

interface ExamPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.values(value).some((v) => Boolean(v));
}

export function ExamPage({ lang, onToggleLang }: ExamPageProps) {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams<{ sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const combo = searchParams.get("combo");
  const [draft, setDraft] = useState<ExamDraft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const endsAtRef = useRef(0);
  const finishingRef = useRef(false);
  const draftRef = useRef<ExamDraft | null>(null);
  const saveTimer = useRef<number>(0);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const applySession = useCallback(
    (session: ExamSessionResponse) => {
      if (isSubmittedExam(session)) {
        clearExamDraft();
        navigate(`/exam/results/${session.sessionId}`, { state: session, replace: true });
        return false;
      }
      const remaining =
        session.remainingSeconds ??
        Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
      endsAtRef.current = Date.now() + remaining * 1000;
      const next = draftFromSession({
        ...session,
        endsAt: endsAtRef.current,
      });
      saveExamDraft(next);
      setDraft(next);
      setSecondsLeft(remaining);
      return true;
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    const boot = async () => {
      if (routeSessionId) {
        const session = await api.examSession(routeSessionId);
        if (!cancelled) applySession(session);
        return;
      }

      if (combo) {
        const session = await api.startExam({
          comboId: combo,
          excludeTestIds: loadUsedVariants(),
        });
        if (cancelled) return;
        if (applySession(session)) {
          navigate(`/exam/${session.sessionId}`, { replace: true });
        }
        return;
      }

      const { session } = await api.examActive();
      if (cancelled) return;
      if (session) {
        if (applySession(session)) {
          navigate(`/exam/${session.sessionId}`, { replace: true });
        }
        return;
      }

      setLoadError(
        lang === "kz"
          ? "Алдымен бейіндік пәндер комбинациясын таңдаңыз"
          : "Сначала выберите комбинацию профильных предметов",
      );
    };

    void boot()
      .catch((e) => {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Не удалось открыть ЕНТ",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applySession, combo, navigate, routeSessionId]);

  const persistProgress = useCallback(
    async (next: ExamDraft) => {
      try {
        const saved = await api.saveExamProgress(next.sessionId, {
          sectionIndex: next.sectionIndex,
          currentIndexByTest: next.currentIndexByTest,
          answersByTest: Object.fromEntries(
            Object.entries(next.answersByTest).map(([testId, answers]) => [
              testId,
              answersToStringKeys(answers),
            ]),
          ),
        });
        if (isSubmittedExam(saved)) {
          rememberUsedVariants(next.usedTestIds);
          clearExamDraft();
          navigate(`/exam/results/${saved.sessionId}`, { state: saved });
          return;
        }
        if (typeof saved.remainingSeconds === "number") {
          endsAtRef.current = Date.now() + saved.remainingSeconds * 1000;
        }
      } catch {
        /* keep local draft if the network drops */
      }
    },
    [navigate],
  );

  const patchDraft = useCallback(
    (updater: (prev: ExamDraft) => ExamDraft) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveExamDraft(next);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          void persistProgress(next);
        }, 800);
        return next;
      });
    },
    [persistProgress],
  );

  const finishExam = useCallback(async () => {
    const current = draftRef.current;
    if (!current || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    window.clearTimeout(saveTimer.current);
    try {
      const result = await api.submitExam({
        sessionId: current.sessionId,
        startedAt: current.startedAt,
        sections: current.sections.map((s) => ({
          testId: s.testId,
          answers: answersToStringKeys(current.answersByTest[s.testId] ?? {}),
        })),
      });
      rememberUsedVariants(current.usedTestIds);
      clearExamDraft();
      navigate(`/exam/results/${result.sessionId}`, { state: result });
    } catch (e) {
      finishingRef.current = false;
      setFinishing(false);
      window.alert(
        e instanceof Error ? e.message : "Не удалось сохранить результат ЕНТ",
      );
    }
  }, [navigate]);

  const finishRef = useRef(finishExam);
  finishRef.current = finishExam;

  useEffect(() => {
    return () => window.clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    if (!draft) return;
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
    const flush = window.setInterval(() => {
      const current = draftRef.current;
      if (current) void persistProgress(current);
    }, 20_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(flush);
    };
  }, [draft?.sessionId, persistProgress]);

  const section: ExamSectionMeta | null = draft
    ? draft.sections[draft.sectionIndex] ?? null
    : null;

  const answers = section
    ? (draft!.answersByTest[section.testId] ?? {})
    : {};
  const currentIndex = section
    ? (draft!.currentIndexByTest[section.testId] ?? 0)
    : 0;

  const answeredIndexes = useMemo(() => {
    const set = new Set<number>();
    section?.questions.forEach((q, i) => {
      if (isAnswered(answers[q.id])) set.add(i);
    });
    return set;
  }, [answers, section]);

  const sectionSummaries = useMemo(() => {
    if (!draft) return [];
    return draft.sections.map((s, i) => {
      const ans = draft.answersByTest[s.testId] ?? {};
      const answered = s.questions.filter((q) => isAnswered(ans[q.id])).length;
      return {
        subject: translateSubject(s.subject, lang),
        answered,
        total: s.questions.length,
        current: i === draft.sectionIndex,
      };
    });
  }, [draft, lang]);

  if (loading) {
    return <div className="page page--center">Загрузка ЕНТ...</div>;
  }

  if (loadError || !draft || !section) {
    return (
      <div className="page page--center">
        <p>{loadError || "Сессия не найдена"}</p>
        <Link to="/">Каталог</Link>
      </div>
    );
  }

  const question = section.questions[currentIndex];
  const isLastQuestion = currentIndex === section.questions.length - 1;
  const isLastSection = draft.sectionIndex === draft.sections.length - 1;

  const goTo = (index: number) => {
    const nextIndex = Math.min(
      section.questions.length - 1,
      Math.max(0, index),
    );
    patchDraft((prev) => ({
      ...prev,
      currentIndexByTest: {
        ...prev.currentIndexByTest,
        [section.testId]: nextIndex,
      },
    }));
  };

  const handleAnswerChange = (value: AnswerValue) => {
    patchDraft((prev) => ({
      ...prev,
      answersByTest: {
        ...prev.answersByTest,
        [section.testId]: {
          ...(prev.answersByTest[section.testId] ?? {}),
          [question.id]: value,
        },
      },
    }));
  };

  const handleNext = () => {
    if (!isLastQuestion) {
      goTo(currentIndex + 1);
      return;
    }
    if (!isLastSection) {
      const ok = window.confirm(
        lang === "kz"
          ? "Осы бөлімді аяқтап, келесіге өту керек пе?"
          : "Завершить этот раздел и перейти к следующему?",
      );
      if (!ok) return;
      patchDraft((prev) => ({
        ...prev,
        sectionIndex: prev.sectionIndex + 1,
      }));
      return;
    }
    if (window.confirm(t("confirmFinish", lang))) {
      void finishExam();
    }
  };

  const handleFinish = () => {
    if (window.confirm(t("confirmFinish", lang))) {
      void finishExam();
    }
  };

  const handleExit = () => {
    if (window.confirm(t("confirmExit", lang))) {
      const current = draftRef.current;
      if (current) void persistProgress(current);
      navigate("/");
    }
  };

  const sectionLabel = `${translateSubject(section.subject, lang)} · ${draft.sectionIndex + 1}/${draft.sections.length}`;

  return (
    <div className="exam">
      <TestHeader
        section={sectionLabel}
        lang={lang}
        current={currentIndex + 1}
        total={section.questions.length}
        timerSeconds={secondsLeft}
        onExit={handleExit}
        onToggleLang={onToggleLang}
        sections={sectionSummaries}
        onSwitchSection={(i) =>
          patchDraft((prev) => ({ ...prev, sectionIndex: i }))
        }
        answeredIds={answeredIndexes}
        onJump={goTo}
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
        onPrev={() => goTo(currentIndex - 1)}
        onNext={handleNext}
        onOpenMap={() => setMapOpen(true)}
        isLast={isLastQuestion && isLastSection}
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
              {draft.sections.map((s, i) => (
                <button
                  key={s.testId}
                  type="button"
                  className={`exam-map__section ${
                    i === draft.sectionIndex ? "active" : ""
                  }`}
                  onClick={() =>
                    patchDraft((prev) => ({ ...prev, sectionIndex: i }))
                  }
                >
                  {translateSubject(s.subject, lang)}
                </button>
              ))}
            </p>
            <div className="exam-map__grid">
              {section.questions.map((q, i) => (
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
