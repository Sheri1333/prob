import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AnswerKeyEditor } from "../components/admin/AnswerKeyEditor";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ToastHost, useToasts } from "../components/Toast";
import type { Question, QuestionType, TestDefinition } from "../types/test";
import {
  createBlankQuestion,
  isAnswerKeyComplete,
  keyedCount,
  nextQuestionId,
} from "../utils/answerKey";

type Tab = "dashboard" | "tests" | "editor" | "users" | "attempts";
type ParseResult = Awaited<ReturnType<typeof api.adminParsePdf>>;

const EMPTY_META = {
  id: "",
  title: "",
  titleKz: "",
  section: "",
  subject: "",
  durationMinutes: 50,
  isFree: true,
  priceTenge: "" as string,
  description: "",
};

export function AdminPage() {
  const { user, loading, isAdmin, logout } = useAuth();
  const { toasts, push: toast, dismiss: dismissToast } = useToasts();
  const [tab, setTab] = useState<Tab>("dashboard");

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
  const [parsing, setParsing] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [draftQuestions, setDraftQuestions] = useState<Question[]>([]);
  const [previewMeta, setPreviewMeta] = useState(EMPTY_META);
  const [openPreviewId, setOpenPreviewId] = useState<number | null>(1);
  const [addType, setAddType] = useState<QuestionType>("single_choice");
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      if (tab === "dashboard") setStats(await api.adminStats());
      if (tab === "users") setUsers((await api.adminUsers()).users);
      if (tab === "attempts") setAttempts((await api.adminAttempts()).attempts);
      if (tab === "tests" || tab === "editor") {
        setTests((await api.adminTests()).tests);
      }
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, [tab, toast]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const keyProgress = useMemo(
    () => keyedCount(draftQuestions),
    [draftQuestions],
  );
  const editing = draftQuestions.length > 0;

  if (loading) {
    return <div className="page page--center">Загрузка...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  }
  if (!isAdmin) {
    return (
      <div className="page page--center">
        <p>Вход в админку только по логину администратора</p>
        <Link to="/login" state={{ from: "/admin" }}>
          Войти
        </Link>
      </div>
    );
  }

  function resetEditor() {
    setParseResult(null);
    setDraftQuestions([]);
    setPreviewMeta(EMPTY_META);
    setOpenPreviewId(null);
  }

  function startManual() {
    const first = createBlankQuestion(1);
    setParseResult(null);
    setDraftQuestions([first]);
    setPreviewMeta({ ...EMPTY_META, id: crypto.randomUUID() });
    setOpenPreviewId(1);
    setTab("editor");
  }

  function addQuestion() {
    const id = nextQuestionId(draftQuestions);
    const q = createBlankQuestion(id, addType);
    setDraftQuestions((prev) => [...prev, q]);
    setOpenPreviewId(id);
  }

  function removeQuestion(index: number) {
    setDraftQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (openPreviewId === prev[index]?.id) {
        setOpenPreviewId(next[next.length - 1]?.id ?? null);
      }
      return next;
    });
  }

  async function handlePdfFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    try {
      const result = await api.adminParsePdf(file);
      setParseResult(result);
      setDraftQuestions(result.draft.questions);
      const d = result.draft;
      setPreviewMeta({
        id: d.id || crypto.randomUUID(),
        title: d.title,
        titleKz: d.titleKz,
        section: d.section,
        subject: d.subject,
        durationMinutes: d.durationMinutes,
        isFree: d.isFree,
        priceTenge: d.priceTenge != null ? String(d.priceTenge) : "",
        description: d.description ?? "",
      });
      setOpenPreviewId(
        result.draft.questions.find((q) => !isAnswerKeyComplete(q))?.id ??
          result.parse.questions[0]?.id ??
          null,
      );
      setTab("editor");
      toast(
        "ok",
        `PDF разобран: ${result.parse.questions.length} вопросов, жёлтых ключей: ${result.parse.keysFromHighlight ?? 0}`,
      );
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Ошибка разбора PDF");
    } finally {
      setParsing(false);
    }
  }

  async function handleSavePreview() {
    if (!draftQuestions.length) return;
    setSavingPreview(true);
    try {
      const missing = draftQuestions
        .filter((q) => !isAnswerKeyComplete(q))
        .map((q) => q.id);
      if (missing.length > 0) {
        setOpenPreviewId(missing[0]);
        throw new Error(
          `Отметьте правильные ответы у вопросов: ${missing.join(", ")}`,
        );
      }
      if (!previewMeta.title.trim()) throw new Error("Укажите название теста");
      if (!previewMeta.subject.trim()) throw new Error("Укажите предмет");
      const id = previewMeta.id.trim() || crypto.randomUUID();
      const payload: TestDefinition & { description?: string } = {
        id,
        title: previewMeta.title.trim(),
        titleKz: previewMeta.titleKz.trim() || previewMeta.title.trim(),
        section: previewMeta.section.trim() || previewMeta.subject.trim(),
        subject: previewMeta.subject.trim(),
        examType: "ENT",
        durationMinutes: Number(previewMeta.durationMinutes) || 50,
        isFree: previewMeta.isFree,
        priceTenge: previewMeta.priceTenge
          ? Number(previewMeta.priceTenge)
          : undefined,
        description: previewMeta.description,
        questionCount: draftQuestions.length,
        questions: draftQuestions,
      };
      await api.adminSaveTest(payload);
      setPreviewMeta((m) => ({ ...m, id }));
      toast(
        "ok",
        `Тест «${payload.title}» сохранён · ${payload.questions.length} вопросов`,
      );
      setTests((await api.adminTests()).tests);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingPreview(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Удалить тест «${title}»?`)) return;
    try {
      await api.adminDeleteTest(id);
      toast("ok", `Тест удалён`);
      setTests((await api.adminTests()).tests);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Ошибка удаления");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const { id: newId } = await api.adminDuplicateTest(id);
      toast("ok", `Создана копия: ${newId}`);
      setTests((await api.adminTests()).tests);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Ошибка дублирования");
    }
  }

  async function loadTestForEdit(id: string) {
    try {
      const { test } = await api.adminGetTest(id);
      setParseResult(null);
      setDraftQuestions(test.questions);
      setPreviewMeta({
        id: test.id,
        title: test.title,
        titleKz: test.titleKz,
        section: test.section,
        subject: test.subject,
        durationMinutes: test.durationMinutes,
        isFree: test.isFree,
        priceTenge: test.priceTenge != null ? String(test.priceTenge) : "",
        description: test.description ?? "",
      });
      setOpenPreviewId(test.questions[0]?.id ?? null);
      setTab("editor");
      toast("ok", `Тест «${test.title}» открыт`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Не удалось открыть тест");
    }
  }

  return (
    <div className="admin-page">
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      {removeIndex !== null && (
        <ConfirmDialog
          title="Удалить вопрос"
          message={`Удалить вопрос №${draftQuestions[removeIndex]?.id ?? ""}? Это действие нельзя отменить.`}
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          danger
          onCancel={() => setRemoveIndex(null)}
          onConfirm={() => {
            removeQuestion(removeIndex);
            setRemoveIndex(null);
          }}
        />
      )}
      <aside className="admin-sidebar">
        <Link to="/" className="admin-sidebar__brand">
          <strong>Талапкер</strong>
          <span>Админка</span>
        </Link>
        <nav className="admin-sidebar__nav">
          {(
            [
              ["dashboard", "Обзор"],
              ["tests", "Тесты"],
              ["editor", "Создать"],
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
        <div className="admin-sidebar__foot">
          {user && <span className="admin-sidebar__user">{user.email}</span>}
          <Link to="/">На сайт</Link>
          {user && (
            <button type="button" onClick={logout}>
              Выйти
            </button>
          )}
        </div>
      </aside>

      <main className="admin-main">
        {tab === "dashboard" && stats && (
          <section>
            <div className="admin-page-head">
              <h1>Обзор</h1>
              <p>Сводка по платформе пробных тестов</p>
            </div>
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
              <div className="admin-panel">
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
              <div className="admin-panel">
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
            <div className="admin-page-head">
              <div>
                <h1>Тесты</h1>
                <p>{tests.length} в каталоге</p>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={startManual}
              >
                Создать тест
              </button>
            </div>
            {tests.length === 0 ? (
              <div className="admin-empty">
                Пока нет тестов. Создайте вручную или загрузите PDF.
              </div>
            ) : (
              <div className="admin-panel">
                <table className="admin-table admin-table--actions">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Предмет</th>
                      <th>Вопросов</th>
                      <th>Доступ</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.title}</strong>
                        </td>
                        <td>{t.subject}</td>
                        <td>{t.questionCount}</td>
                        <td>{t.isFree !== false ? "бесплатно" : `${t.priceTenge ?? 0} ₸`}</td>
                        <td>
                          <div className="admin-table__actions">
                            <button
                              type="button"
                              onClick={() => void loadTestForEdit(t.id)}
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDuplicate(t.id)}
                            >
                              Дублировать
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => void handleDelete(t.id, t.title)}
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "editor" && (
          <section>
            <div className="admin-page-head">
              <div>
                <h1>{editing ? "Редактор теста" : "Новый тест"}</h1>
                <p>
                  {editing
                    ? "Проверьте карточку, вопросы и ключи ответов"
                    : "Создайте вручную или разберите PDF пробника"}
                </p>
              </div>
              {editing && (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={resetEditor}
                >
                  Начать заново
                </button>
              )}
            </div>

            {!editing && (
              <div className="admin-create-grid">
                <article className="admin-create-card">
                  <h2>Вручную</h2>
                  <p>
                    Название, предмет, вопросы и правильные ответы — всё в форме,
                    без JSON.
                  </p>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={startManual}
                  >
                    Создать пустой тест
                  </button>
                </article>
                <article className="admin-create-card">
                  <h2>Из PDF</h2>
                  <p>
                    Парсер вытащит вопросы и картинки. Жёлтый маркер в PDF
                    станет ключом — останется проверить.
                  </p>
                  <label className="admin-btn admin-btn--primary">
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
                </article>
              </div>
            )}

            {editing && (
              <div className="admin-preview">
                {parseResult && (
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
                      Жёлтых ключей:{" "}
                      <strong>
                        {parseResult.parse.keysFromHighlight ?? 0}
                      </strong>
                    </span>
                  </div>
                )}

                <h2>Карточка теста</h2>
                <div className="admin-meta-form">
                  <label>
                    Название (RU)
                    <input
                      value={previewMeta.title}
                      placeholder="ЕНТ — География"
                      onChange={(e) =>
                        setPreviewMeta((m) => ({ ...m, title: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Название (KZ)
                    <input
                      value={previewMeta.titleKz}
                      placeholder="ҰБТ — География"
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
                      placeholder="География"
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
                    Минут
                    <input
                      type="number"
                      min={1}
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
                      placeholder="0"
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
                      placeholder="Коротко, что в тесте"
                      onChange={(e) =>
                        setPreviewMeta((m) => ({
                          ...m,
                          description: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="admin-key-progress">
                  <div>
                    Ключи ответов:{" "}
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
                </div>

                <h2>Вопросы</h2>
                <AnswerKeyEditor
                  questions={draftQuestions}
                  onChange={setDraftQuestions}
                  openId={openPreviewId}
                  onOpen={setOpenPreviewId}
                  onRemove={setRemoveIndex}
                  onUploadImage={async (file) => {
                    try {
                      const { url } = await api.adminUploadImage(
                        file,
                        "question",
                      );
                      toast("ok", "Картинка добавлена к вопросу");
                      return url;
                    } catch (err) {
                      toast(
                        "error",
                        err instanceof Error
                          ? err.message
                          : "Не удалось загрузить картинку",
                      );
                      throw err;
                    }
                  }}
                />

                <div className="admin-add-q">
                  <select
                    value={addType}
                    onChange={(e) =>
                      setAddType(e.target.value as QuestionType)
                    }
                  >
                    <option value="single_choice">Один ответ</option>
                    <option value="multiple_choice">Несколько ответов</option>
                    <option value="matching">Сопоставление</option>
                  </select>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={addQuestion}
                  >
                    Добавить вопрос
                  </button>
                </div>

                <button
                  type="button"
                  className="admin-btn admin-btn--primary admin-btn--save"
                  disabled={savingPreview || keyProgress < draftQuestions.length}
                  onClick={() => void handleSavePreview()}
                >
                  {savingPreview
                    ? "Сохранение..."
                    : keyProgress < draftQuestions.length
                      ? `Отметьте ключи (${keyProgress}/${draftQuestions.length})`
                      : `Сохранить тест (${draftQuestions.length})`}
                </button>
              </div>
            )}
          </section>
        )}

        {tab === "users" && (
          <section>
            <div className="admin-page-head">
              <h1>Пользователи</h1>
            </div>
            <div className="admin-panel">
              <table className="admin-table">
                <thead>
                  <tr>
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
            </div>
          </section>
        )}

        {tab === "attempts" && (
          <section>
            <div className="admin-page-head">
              <h1>Результаты</h1>
            </div>
            <div className="admin-panel">
              <table className="admin-table">
                <thead>
                  <tr>
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
            </div>
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
