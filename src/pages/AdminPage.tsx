import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { TestDefinition } from "../types/test";

type Tab = "dashboard" | "tests" | "users" | "attempts" | "upload";

const EMPTY_JSON = `{
  "id": "ent-new-subject",
  "title": "ЕНТ — Новый предмет",
  "titleKz": "ҰБТ — Жаңа пән",
  "section": "Предмет",
  "examType": "ENT",
  "subject": "Предмет",
  "durationMinutes": 50,
  "isFree": true,
  "priceTenge": null,
  "description": "Описание теста",
  "questions": [
    {
      "id": 1,
      "type": "single_choice",
      "text": "Текст вопроса",
      "options": [
        { "id": "A", "label": "Вариант A" },
        { "id": "B", "label": "Вариант B" },
        { "id": "C", "label": "Вариант C" },
        { "id": "D", "label": "Вариант D" }
      ],
      "correctAnswer": "A"
    }
  ]
}`;

export function AdminPage() {
  const { user, loading, isAdmin, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof api.adminStats>
  > | null>(null);
  const [users, setUsers] = useState<
    Awaited<ReturnType<typeof api.adminUsers>>["users"]
  >([]);
  const [attempts, setAttempts] = useState<
    Awaited<ReturnType<typeof api.adminAttempts>>["attempts"]
  >([]);
  const [tests, setTests] = useState<
    Awaited<ReturnType<typeof api.adminTests>>["tests"]
  >([]);
  const [jsonText, setJsonText] = useState(EMPTY_JSON);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      if (tab === "dashboard") setStats(await api.adminStats());
      if (tab === "users") setUsers((await api.adminUsers()).users);
      if (tab === "attempts") setAttempts((await api.adminAttempts()).attempts);
      if (tab === "tests" || tab === "upload") {
        setTests((await api.adminTests()).tests);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, [tab]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (loading) {
    return <div className="page page--center">Загрузка...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  }
  if (!isAdmin) {
    return (
      <div className="page page--center">
        <p>Доступ только для администратора</p>
        <Link to="/">На главную</Link>
      </div>
    );
  }

  async function handleSaveJson(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const parsed = JSON.parse(jsonText) as TestDefinition & {
        description?: string;
      };
      await api.adminSaveTest(parsed);
      setMessage(`Тест «${parsed.id}» сохранён (${parsed.questions?.length ?? 0} вопросов)`);
      setTests((await api.adminTests()).tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const result = await api.adminUploadTest(file);
      setMessage(
        `Загружен тест «${result.id}» (${result.questionCount} вопросов)`,
      );
      setTests((await api.adminTests()).tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(`Удалить тест ${id}?`)) return;
    try {
      await api.adminDeleteTest(id);
      setMessage(`Удалён ${id}`);
      setTests((await api.adminTests()).tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  }

  async function loadTestJson(id: string) {
    try {
      const { test } = await api.adminGetTest(id);
      setJsonText(JSON.stringify(test, null, 2));
      setTab("upload");
      setMessage(`Загружен в редактор: ${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <strong>PROB Admin</strong>
          <span className="admin-header__user">{user.email}</span>
        </div>
        <nav className="admin-nav">
          {(
            [
              ["dashboard", "Обзор"],
              ["tests", "Тесты"],
              ["upload", "Загрузка"],
              ["users", "Пользователи"],
              ["attempts", "Результаты"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-header__actions">
          <Link to="/">Сайт</Link>
          <button type="button" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="admin-main">
        {error && <p className="admin-alert admin-alert--error">{error}</p>}
        {message && <p className="admin-alert admin-alert--ok">{message}</p>}

        {tab === "dashboard" && stats && (
          <section>
            <h1>Обзор</h1>
            <div className="admin-stats">
              <div className="admin-stat">
                <span>Пользователи</span>
                <strong>{stats.stats.users}</strong>
              </div>
              <div className="admin-stat">
                <span>Тесты</span>
                <strong>{stats.stats.tests}</strong>
              </div>
              <div className="admin-stat">
                <span>Попытки</span>
                <strong>{stats.stats.attempts}</strong>
              </div>
              <div className="admin-stat">
                <span>Средний %</span>
                <strong>{stats.stats.avgScorePercent}%</strong>
              </div>
            </div>

            <div className="admin-grid-2">
              <div>
                <h2>Недавние регистрации</h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Email</th>
                      <th>Роль</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td>{formatDate(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h2>Лучшие результаты</h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ученик</th>
                      <th>Тест</th>
                      <th>Балл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topAttempts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {a.user_name}
                          <br />
                          <small>{a.user_email}</small>
                        </td>
                        <td>{a.test_title}</td>
                        <td>
                          {a.score}/{a.max_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "tests" && (
          <section>
            <h1>Тесты</h1>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Предмет</th>
                  <th>Вопросов</th>
                  <th>Цена</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <code>{t.id}</code>
                    </td>
                    <td>{t.title}</td>
                    <td>{t.subject}</td>
                    <td>{t.questionCount}</td>
                    <td>{t.isFree ? "бесплатно" : `${t.priceTenge} ₸`}</td>
                    <td className="admin-table__actions">
                      <button type="button" onClick={() => loadTestJson(t.id)}>
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(t.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "upload" && (
          <section>
            <h1>Загрузка / редактирование теста</h1>
            <p className="admin-hint">
              Загрузите JSON-файл или вставьте JSON ниже. Формат — как в{" "}
              <code>ent-geography.sample.json</code>.
            </p>

            <div className="admin-upload">
              <label className="admin-upload__btn">
                {uploading ? "Загрузка..." : "Выбрать JSON-файл"}
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  disabled={uploading}
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <form onSubmit={handleSaveJson} className="admin-json-form">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={22}
                spellCheck={false}
              />
              <button type="submit" className="auth-card__btn">
                Сохранить тест
              </button>
            </form>
          </section>
        )}

        {tab === "users" && (
          <section>
            <h1>Пользователи</h1>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Регистрация</th>
                  <th>Попыток</th>
                  <th>Средний %</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-badge role-badge--${u.role}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u.attemptsCount}</td>
                    <td>{u.avgPercent != null ? `${u.avgPercent}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "attempts" && (
          <section>
            <h1>Результаты прохождений</h1>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ученик</th>
                  <th>Тест</th>
                  <th>Балл</th>
                  <th>%</th>
                  <th>Завершено</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>
                      {a.userName}
                      <br />
                      <small>{a.userEmail}</small>
                    </td>
                    <td>
                      {a.testTitle}
                      <br />
                      <small>{a.testId}</small>
                    </td>
                    <td>
                      {a.score}/{a.maxScore}
                    </td>
                    <td>
                      {a.maxScore
                        ? Math.round((100 * a.score) / a.maxScore)
                        : 0}
                      %
                    </td>
                    <td>{formatDate(a.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso.endsWith("Z") || iso.includes("T") ? iso : iso + "Z").toLocaleString(
      "ru-RU",
    );
  } catch {
    return iso;
  }
}
