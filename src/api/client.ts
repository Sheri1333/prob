import type { AnswerValue, CatalogItem, Question, TestDefinition } from "../types/test";

const TOKEN_KEY = "prob_token";
const USER_KEY = "prob_user";

/** API origin: empty in Vite dev (proxy), Railway in production builds. */
export const API_BASE = import.meta.env.DEV
  ? ""
  : "https://prob-production-51a0.up.railway.app";

/** Resolve /uploads/... or leave data:/http(s) as-is. */
export function mediaUrl(src: string): string {
  if (!src) return src;
  if (
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }
  return `${API_BASE}${src.startsWith("/") ? src : `/${src}`}`;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  return data;
}

export const api = {
  register(body: { email: string; password: string; name: string }) {
    return request<{ token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }) {
    return request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  me() {
    return request<{ user: AuthUser }>("/auth/me");
  },

  getCatalog() {
    return request<{ tests: CatalogItem[] }>("/tests");
  },

  getTest(id: string) {
    return request<{ test: TestDefinition }>("/tests/" + encodeURIComponent(id));
  },

  submitAttempt(body: {
    testId: string;
    answers: Record<number, AnswerValue>;
    startedAt: string;
  }) {
    const answers: Record<string, AnswerValue> = {};
    for (const [k, v] of Object.entries(body.answers)) {
      answers[k] = v;
    }
    return request<{
      attempt: {
        id: string;
        testId: string;
        score: number;
        maxScore: number;
        results: Record<number, boolean>;
        startedAt: string;
        finishedAt: string;
      };
      questions: Question[];
    }>("/attempts", {
      method: "POST",
      body: JSON.stringify({
        testId: body.testId,
        answers,
        startedAt: body.startedAt,
      }),
    });
  },

  myAttempts() {
    return request<{
      attempts: Array<{
        id: string;
        testId: string;
        score: number;
        maxScore: number;
        startedAt: string;
        finishedAt: string;
        title: string;
        titleKz: string;
        subject: string;
      }>;
    }>("/attempts/me");
  },

  adminStats() {
    return request<{
      stats: {
        users: number;
        admins: number;
        tests: number;
        attempts: number;
        avgScorePercent: number;
      };
      recentUsers: Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        created_at: string;
      }>;
      topAttempts: Array<{
        id: string;
        score: number;
        max_score: number;
        finished_at: string;
        user_name: string;
        user_email: string;
        test_title: string;
      }>;
    }>("/admin/stats");
  },

  adminUsers() {
    return request<{
      users: Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        createdAt: string;
        attemptsCount: number;
        avgPercent: number | null;
      }>;
    }>("/admin/users");
  },

  adminAttempts(params?: { userId?: string; testId?: string }) {
    const q = new URLSearchParams();
    if (params?.userId) q.set("userId", String(params.userId));
    if (params?.testId) q.set("testId", params.testId);
    const qs = q.toString();
    return request<{
      attempts: Array<{
        id: string;
        userId: string;
        testId: string;
        score: number;
        maxScore: number;
        startedAt: string;
        finishedAt: string;
        userName: string;
        userEmail: string;
        testTitle: string;
        subject: string;
      }>;
    }>(`/admin/attempts${qs ? `?${qs}` : ""}`);
  },

  adminTests() {
    return request<{
      tests: Array<{
        id: string;
        title: string;
        titleKz: string;
        section: string;
        examType: string;
        subject: string;
        durationMinutes: number;
        questionCount: number;
        isFree: boolean;
        priceTenge: number | null;
        description: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/admin/tests");
  },

  adminGetTest(id: string) {
    return request<{ test: TestDefinition }>(
      "/admin/tests/" + encodeURIComponent(id),
    );
  },

  adminSaveTest(test: TestDefinition & { description?: string }) {
    return request<{ ok: boolean; id: string }>("/admin/tests", {
      method: "POST",
      body: JSON.stringify(test),
    });
  },

  adminDeleteTest(id: string) {
    return request<{ ok: boolean }>(
      "/admin/tests/" + encodeURIComponent(id),
      { method: "DELETE" },
    );
  },

  adminUploadTest(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ ok: boolean; id: string; questionCount: number }>(
      "/admin/tests/upload",
      { method: "POST", body: form },
    );
  },

  adminParsePdf(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{
      ok: boolean;
      filename: string;
      parse: {
        pages: number;
        chars: number;
        steps: { step: number; name: string; detail: string }[];
        sections: { key: string; label: string; chars: number }[];
        contexts: { title: string; text: string }[];
        questions: Array<{
          id: number;
          type: "single_choice" | "multiple_choice" | "matching";
          text: string;
          options: { id: string; label: string }[];
          rows?: { id: string; label: string }[];
          hasImageHint: boolean;
          images?: string[];
        }>;
        byType: {
          single_choice: number;
          matching: number;
          multiple_choice: number;
        };
        withImages: number;
        imagesAttached: number;
        keysFromHighlight?: number;
      };
      draft: TestDefinition & { description?: string; priceTenge?: number | null };
    }>("/admin/tests/parse-pdf", { method: "POST", body: form });
  },
};
