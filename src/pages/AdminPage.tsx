import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AnswerKeyEditor } from "../components/admin/AnswerKeyEditor";
import type { Question, TestDefinition } from "../types/test";
import { isAnswerKeyComplete, keyedCount } from "../utils/answerKey";

type Tab = "dashboard" | "tests" | "users" | "attempts" | "upload";

type ParseResult = Awaited<ReturnType<typeof api.adminParsePdf>>;

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
  const [parsing, setParsing] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [draftQuestions, setDraftQuestions] = useState<Question[]>([]);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [previewMeta, setPreviewMeta] = useState({
    id: "",
    title: "",
    titleKz: "",
    section: "",
    subject: "",
    examType: "ENT",
    durationMinutes: 50,
    isFree: true,
    priceTenge: "" as string,
    description: "",
  });
  const [openPreviewId, setOpenPreviewId] = useState<number | null>(1);

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

  const keyProgress = useMemo(
    () => keyedCount(draftQuestions),
    [draftQuestions],
  );

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
      setMessage(
        `Тест «${parsed.id}» сохранён (${parsed.questions?.length ?? 0} вопросов)`,
      );
      setTests((await api.adminTests()).tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    }
  }

  async function handleJsonFile(file: File | null) {
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

  async function handlePdfFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setError("");
    setMessage("");
    try {
      const result = await api.adminParsePdf(file);
      setParseResult(result);
      setDraftQuestions(result.draft.questions);
      setOnlyMissing(false);
      const d = result.draft;
      setPreviewMeta({
        id: d.id,
        title: d.title,
        titleKz: d.titleKz,
        section: d.section,
        subject: d.subject,
        examType: d.examType,
        durationMinutes: d.durationMinutes,
        isFree: d.isFree,
        priceTenge: d.priceTenge != null ? String(d.priceTenge) : "",
        description: d.description ?? "",
      });
      setOpenPreviewId(result.parse.questions[0]?.id ?? null);
      setJsonText(
        JSON.stringify(
          {
            ...d,
            questionCount: d.questions.length,
          },
          null,
          2,
        ),
      );
      setMessage(
        `PDF разобран: ${result.parse.questions.length} вопросов (${result.filename})`,
      );
      } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка разбора PDF");
    } finally {
      setParsing(false);
    }
  }

  async function handleSavePreview() {
    if (!draftQuestions.length) return;
    setSavingPreview(true);
    setError("");
    setMessage("");
    try {
      const missing = draftQuestions
        .filter((q) => !isAnswerKeyComplete(q))
        .map((q) => q.id);
      if (missing.length > 0) {
        setOpenPreviewId(missing[0]);
        setOnlyMissing(true);
        throw new Error(
          `Сначала отметьте правильные ответы у вопросов: ${missing.join(", ")}`,
        );
      }
      const payload: TestDefinition & { description?: string } = {
        id: previewMeta.id.trim(),
        title: previewMeta.title.trim(),
        titleKz: previewMeta.titleKz.trim(),
        section: previewMeta.section.trim(),
        subject: previewMeta.subject.trim(),
        examType: previewMeta.examType as "ENT" | "OGE",
        durationMinutes: Number(previewMeta.durationMinutes) || 50,
        isFree: previewMeta.isFree,
        priceTenge: previewMeta.priceTenge
          ? Number(previewMeta.priceTenge)
          : undefined,
        description: previewMeta.description,
        questionCount: draftQuestions.length,
        questions: draftQuestions,
      };
      if (!payload.id) throw new Error("Укажите ID теста");
      await api.adminSaveTest(payload);
      setMessage(
        `Тест «${payload.id}» сохранён (${payload.questions.length} вопросов, все ключи заполнены).`,
      );
      setTests((await api.adminTests()).tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingPreview(false);
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
      setParseResult(null);
      setDraftQuestions(test.questions);
      setOnlyMissing(false);
      setPreviewMeta({
        id: test.id,
        title: test.title,
        titleKz: test.titleKz,
        section: test.section,
        subject: test.subject,
        examType: test.examType,
        durationMinutes: test.durationMinutes,
        isFree: test.isFree,
        priceTenge: test.priceTenge != null ? String(test.priceTenge) : "",
        description: "",
      });
      setOpenPreviewId(test.questions[0]?.id ?? null);
      setTab("upload");
      setMessage(`Редактор ключей: ${id}`);
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
            <h1>Загрузка теста</h1>

            <div className="admin-pdf-zone">
              <h2>1. PDF из НЦТ / пробника</h2>
              <p className="admin-hint">
                Парсер только вытаскивает вопросы, варианты и картинки. Правильные
                ответы система не угадывает — вы отмечаете их сами в шаге 2,
                затем сохраняете тест.
              </p>
              <label className="admin-upload__btn admin-upload__btn--pdf">
                {parsing ? "Разбор PDF..." : "Выбрать PDF"}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  disabled={parsing}
                  onChange={(e) => {
                    void handlePdfFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {draftQuestions.length > 0 && (
              <div className="admin-preview">
                <h2>2. Ключи ответов</h2>
                {parseResult && (
                  <>
                    <div className="admin-preview__stats">
                      <span>
                        Файл: <strong>{parseResult.filename}</strong>
                      </span>
                      <span>
                        Страниц: <strong>{parseResult.parse.pages}</strong>
                      </span>
                      <span>
                        Вопросов:{" "}
                        <strong>{parseResult.parse.questions.length}</strong>
                      </span>
                      <span>
                        Одиночных:{" "}
                        <strong>{parseResult.parse.byType.single_choice}</strong>
                      </span>
                      <span>
                        Сопоставление:{" "}
                        <strong>{parseResult.parse.byType.matching}</strong>
                      </span>
                      <span>
                        Множественных:{" "}
                        <strong>
                          {parseResult.parse.byType.multiple_choice}
                        </strong>
                      </span>
                      <span>
                        Картинок:{" "}
                        <strong>{parseResult.parse.imagesAttached ?? 0}</strong>
                      </span>
                    </div>
                    <div className="admin-preview__pipeline">
                      {parseResult.parse.steps.map((s) => (
                        <div key={s.step} className="admin-preview__step">
                          <strong>
                            {s.step}. {s.name}
                          </strong>
                          <span>{s.detail}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="admin-key-progress">
                  <div>
                    Отмечено ключей:{" "}
                    <strong>
                      {keyProgress} / {draftQuestions.length}
                    </strong>
                  </div>
                  <div className="admin-key-progress__bar">
                    <div
                      style={{
                        width: `${
                          draftQuestions.length
                            ? (100 * keyProgress) / draftQuestions.length
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <label className="admin-key-progress__filter">
                    <input
                      type="checkbox"
                      checked={onlyMissing}
                      onChange={(e) => setOnlyMissing(e.target.checked)}
                    />
                    Только без ключа
                  </label>
                </div>

                <div className="admin-meta-form">
                  <label>
                    ID
                    <input
                      value={previewMeta.id}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({ ...m, id: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Название (RU)
                    <input
                      value={previewMeta.title}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({ ...m, title: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Название (KZ)
                    <input
                      value={previewMeta.titleKz}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          titleKz: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Предмет
                    <input
                      value={previewMeta.subject}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          subject: e.target.value,
                          section: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Тип
                    <select
                      value={previewMeta.examType}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          examType: e.target.value,
                        }))
                      }
                    >
                      <option value="ENT">ENT</option>
                      <option value="OGE">OGE</option>
                    </select>
                  </label>
                  <label>
                    Минут
                    <input
                      type="number"
                      value={previewMeta.durationMinutes}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          durationMinutes: Number(e.target.value) || 50,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-meta-form__check">
                    <input
                      type="checkbox"
                      checked={previewMeta.isFree}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          isFree: e.target.checked,
                        }))
                      }
                    />
                    Бесплатный
                  </label>
                  <label>
                    Цена ₸
                    <input
                      value={previewMeta.priceTenge}
                      disabled={previewMeta.isFree}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          priceTenge: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-meta-form__full">
                    Описание
                    <textarea
                      rows={2}
                      value={previewMeta.description}
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          description: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <h3>Вопросы — отметьте правильные ответы</h3>
                <AnswerKeyEditor
                  questions={draftQuestions}
                  onChange={setDraftQuestions}
                  openId={openPreviewId}
                  onOpen={setOpenPreviewId}
                  onlyMissing={onlyMissing}
                />

                <button
                  type="button"
                  className="auth-card__btn"
                  disabled={savingPreview || keyProgress < draftQuestions.length}
                  onClick={() => void handleSavePreview()}
                >
                  {savingPreview
                    ? "Сохранение..."
                    : keyProgress < draftQuestions.length
                      ? `Отметьте ключи (${keyProgress}/${draftQuestions.length})`
                      : `Сохранить тест (${draftQuestions.length} вопросов)`}
                </button>
              </div>
            )}

            <hr className="admin-divider" />

            <h2>JSON вручную</h2>
            <p className="admin-hint">
              Для готового файла с уже проставленными ключами. Без правильных
              ответов сервер тест не сохранит.
            </p>
            <div className="admin-upload">
              <label className="admin-upload__btn">
                {uploading ? "Загрузка..." : "Выбрать JSON-файл"}
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    void handleJsonFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <form onSubmit={handleSaveJson} className="admin-json-form">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={16}
                spellCheck={false}
              />
              <button type="submit" className="auth-card__btn">
                Сохранить JSON
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
    return new Date(
      iso.endsWith("Z") || iso.includes("T") ? iso : iso + "Z",
    ).toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}
