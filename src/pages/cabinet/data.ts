import type { AnswerTally, ExamAnalytics, PaymentRequest, api } from "../../api/client";
import { translateSubject } from "../../i18n/subjects";
import type { Lang } from "../../i18n/strings";
import type { ExamStartResponse } from "../../utils/examDraft";
import { entScoreToGrade } from "../../utils/testUtils";

export interface CabinetData {
  lang: Lang;
  onToggleLang: () => void;
  loading: boolean;
  error: string;
  exams: ExamAnalytics[];
  wallet: { credits: number; unlimited: boolean; requests: PaymentRequest[] } | null;
  variants: Awaited<ReturnType<typeof api.examVariants>> | null;
  active: ExamStartResponse | null;
  askLogout: () => void;
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

/** "14.10" for chart axes. */
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** One language-independent key per subject. */
export const subjectKey = (subject: string) => translateSubject(subject, "ru").toLowerCase();

export function grade(exam: ExamAnalytics): number {
  return entScoreToGrade(exam.score, exam.maxScore);
}

export interface SubjectStat {
  key: string;
  name: string;
  /** Mandatory block or profile subject. */
  profile: boolean;
  attempts: Array<{ sessionId: string; finishedAt: string; score: number; maxScore: number; pct: number }>;
  avgPct: number;
  bestPct: number;
  lastPct: number;
  /** Last attempt minus the first, in percentage points (null with one attempt). */
  change: number | null;
  totals: { correct: number; partial: number; wrong: number; skipped: number };
  byType: Record<"single_choice" | "multiple_choice" | "matching", AnswerTally>;
  byWeight: { one: AnswerTally; two: AnswerTally } | null;
}

/** Every subject the student has taken, from all finished exams (oldest first in). */
export function subjectStats(exams: ExamAnalytics[]): SubjectStat[] {
  const map = new Map<string, SubjectStat & { scoreSum: number; maxSum: number }>();
  for (const exam of exams) {
    for (const sec of exam.sections) {
      if (!sec.subject || sec.maxScore <= 0) continue;
      const key = subjectKey(sec.subject);
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          name: sec.subject,
          profile: sec.block === "profile",
          attempts: [],
          avgPct: 0,
          bestPct: 0,
          lastPct: 0,
          change: null,
          totals: { correct: 0, partial: 0, wrong: 0, skipped: 0 },
          byType: {
            single_choice: { total: 0, correct: 0 },
            multiple_choice: { total: 0, correct: 0 },
            matching: { total: 0, correct: 0 },
          },
          byWeight: sec.block === "profile" ? { one: { total: 0, correct: 0 }, two: { total: 0, correct: 0 } } : null,
          scoreSum: 0,
          maxSum: 0,
        };
        map.set(key, row);
      }
      row.attempts.push({
        sessionId: exam.sessionId,
        finishedAt: exam.finishedAt,
        score: sec.score,
        maxScore: sec.maxScore,
        pct: pct(sec.score, sec.maxScore),
      });
      row.scoreSum += sec.score;
      row.maxSum += sec.maxScore;
      const d = sec.detail;
      if (d) {
        row.totals.correct += d.correct;
        row.totals.partial += d.partial;
        row.totals.wrong += d.wrong;
        row.totals.skipped += d.unanswered;
        for (const t of ["single_choice", "multiple_choice", "matching"] as const) {
          row.byType[t].total += d.byType[t].total;
          row.byType[t].correct += d.byType[t].correct;
        }
        if (row.byWeight && d.byWeight) {
          row.byWeight.one.total += d.byWeight.one.total;
          row.byWeight.one.correct += d.byWeight.one.correct;
          row.byWeight.two.total += d.byWeight.two.total;
          row.byWeight.two.correct += d.byWeight.two.correct;
        }
      }
    }
  }
  return [...map.values()].map(({ scoreSum, maxSum, ...row }) => {
    const pcts = row.attempts.map((a) => a.pct);
    return {
      ...row,
      avgPct: pct(scoreSum, maxSum),
      bestPct: Math.max(...pcts),
      lastPct: pcts[pcts.length - 1],
      change: pcts.length > 1 ? pcts[pcts.length - 1] - pcts[0] : null,
    };
  });
}

/** Mandatory blocks first in ҰБТ order, then profile subjects by name. */
export function bySheetOrder(a: SubjectStat, b: SubjectStat): number {
  const order = ["история казахстана", "грамотность чтения", "математическая грамотность"];
  const ia = order.indexOf(a.key);
  const ib = order.indexOf(b.key);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.name.localeCompare(b.name, "ru");
}
