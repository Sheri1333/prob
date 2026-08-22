import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ExamTools } from "../components/ExamTools";
import { QuestionView } from "../components/QuestionView";
import { TestFooter } from "../components/TestFooter";
import { TestHeader } from "../components/TestHeader";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnswerValue } from "../types/test";
import {
  clearExamDraft,
  loadExamDraft,
  loadUsedVariants,
  rememberUsedVariants,
  saveExamDraft,
  type ExamDraft,
  type ExamSectionMeta,
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
  const [draft, setDraft] = useState<ExamDraft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const endsAtRef = useRef(0);
  const finishingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const combo = params.get("combo");
    const existing = loadExamDraft();

    if (!combo && existing && existing.sections.length > 0) {
      endsAtRef.current = existing.endsAt;
      setDraft(existing);
      setSecondsLeft(
        Math.max(0, Math.ceil((existing.endsAt - Date.now()) / 1000)),
      );
      setLoading(false);
      return;
    }

    if (!combo) {
      setLoadError(
        lang === "kz"
          ? "Алдымен бейіндік пәндер комбинациясын таңдаңыз"
          : "Сначала выберите комбинацию профильных предметов",
      );
      setLoading(false);
      return;
    }

    clearExamDraft();
    api
      .startExam({
        comboId: combo,
        excludeTestIds: loadUsedVariants(),
      })
      .then((session) => {
        const next: ExamDraft = {
          sessionId: session.sessionId,
          startedAt: session.startedAt,
          endsAt: session.endsAt,
          sectionIndex: 0,
          answersByTest: Object.fromEntries(
            session.sections.map((s) => [s.testId, {}]),
          ),
          currentIndexByTest: Object.fromEntries(
            session.sections.map((s) => [s.testId, 0]),
          ),
          sections: session.sections,
          usedTestIds: session.sections.map((s) => s.testId),
        };
        endsAtRef.current = session.endsAt;
        saveExamDraft(next);
        setDraft(next);
        setSecondsLeft(
          Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000)),
        );
        window.history.replaceState({}, "", "/exam");
      })
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Не удалось начать ЕНТ"),
      )
      .finally(() => setLoading(false));
  }, [lang]);

  const section: ExamSectionMeta | null = draft
    ? draft.sections[draft.sectionIndex] ?? null
    : null;

  const answers = section
    ? (draft!.answersByTest[section.testId] ?? {})
    : {};
  const currentIndex = section
    ? (draft!.currentIndexByTest[section.testId] ?? 0)
    : 0;

  const patchDraft = useCallback((updater: (prev: ExamDraft) => ExamDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveExamDraft(next);
      return next;
    });
  }, []);

  const finishExam = useCallback(async () => {
    if (!draft || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      const result = await api.submitExam({
        sessionId: draft.sessionId,
        startedAt: draft.startedAt,
        sections: draft.sections.map((s) => {
          const ans = draft.answersByTest[s.testId] ?? {};
          const mapped: Record<string, AnswerValue> = {};
          for (const [k, v] of Object.entries(ans)) mapped[k] = v;
          return { testId: s.testId, answers: mapped };
        }),
      });
      rememberUsedVariants(draft.usedTestIds);
      clearExamDraft();
      navigate("/exam/results", { state: result });
    } catch (e) {
      finishingRef.current = false;
      setFinishing(false);
      window.alert(
        e instanceof Error ? e.message : "Не удалось сохранить результат ЕНТ",
      );
    }
  }, [draft, navigate]);

  const finishRef = useRef(finishExam);
  finishRef.current = finishExam;

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
    return () => window.clearInterval(timer);
  }, [draft?.sessionId]);

  const answeredIndexes = useMemo(() => {
    const set = new Set<number>();
    section?.questions.forEach((q, i) => {
      if (isAnswered(answers[q.id])) set.add(i);
    });
    return set;
  }, [answers, section]);

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
      navigate("/");
    }
  };

  const sectionLabel =
    lang === "kz"
      ? `${section.subject} · ${draft.sectionIndex + 1}/${draft.sections.length}`
      : `${section.subject} · ${draft.sectionIndex + 1}/${draft.sections.length}`;

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
        totalQuestions={section.questions.length}
        answeredIds={answeredIndexes}
        onPrev={() => goTo(currentIndex - 1)}
        onNext={handleNext}
        onJump={goTo}
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
                  {s.subject}
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
