import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import { t } from "../i18n/strings";
import type { Lang } from "../i18n/strings";
import { entScoreToGrade } from "../utils/testUtils";

interface ProfilePageProps {
  lang: Lang;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ProfilePage({ lang }: ProfilePageProps) {
  const { user, loading, isAdmin, logout } = useAuth();
  const [sessions, setSessions] = useState<
    Awaited<ReturnType<typeof api.examHistory>>["sessions"]
  >([]);
  const [error, setError] = useState("");
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .examHistory()
      .then(({ sessions: list }) => setSessions(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoadingAttempts(false));
  }, [user]);

  const stats = useMemo(() => {
    if (sessions.length === 0) return null;
    const grades = sessions.map((a) => entScoreToGrade(a.score, a.maxScore));
    const avgGrade = Math.round(
      grades.reduce((sum, g) => sum + g, 0) / grades.length,
    );
    const bestGrade = Math.max(...grades);
    return { count: sessions.length, avgGrade, bestGrade };
  }, [sessions]);

  if (loading) return <div className="page page--center">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: "/profile" }} />;

  return (
    <div className="page">
      <header className="site-header">
        <Link to="/" className="site-header__logo">
          Талапкер
        </Link>
        <nav className="site-header__nav">
          <ThemeToggle />
          {isAdmin && <Link to="/admin">Админка</Link>}
          <Link to="/">{lang === "kz" ? "Каталог" : "Каталог"}</Link>
          <button
            type="button"
            className="link-btn"
            onClick={() => setConfirmLogout(true)}
          >
            {lang === "kz" ? "Шығу" : "Выйти"}
          </button>
        </nav>
      </header>

      <section className="profile-head">
        <div className="profile-avatar">{initials(user.name)}</div>
        <div>
          <h1 className="profile-name">{user.name}</h1>
          <p className="profile-email">{user.email}</p>
        </div>
        <span
          className={`role-badge ${isAdmin ? "role-badge--admin" : "role-badge--user"}`}
        >
          {isAdmin
            ? lang === "kz"
              ? "Админ"
              : "Админ"
            : lang === "kz"
              ? "Оқушы"
              : "Ученик"}
        </span>
      </section>

      {error && <p className="auth-card__error">{error}</p>}

      <section className="profile-stats">
        <div className="profile-stat">
          <strong>{stats ? stats.count : loadingAttempts ? "…" : 0}</strong>
          <span>{lang === "kz" ? "Өткен сессиялар" : "Пройдено сессий"}</span>
        </div>
        <div className="profile-stat">
          <strong>{stats ? stats.avgGrade : "—"}</strong>
          <span>{lang === "kz" ? "Орташа балл (ҰБТ)" : "Средний балл (ЕНТ)"}</span>
        </div>
        <div className="profile-stat">
          <strong>{stats ? stats.bestGrade : "—"}</strong>
          <span>{lang === "kz" ? "Үздік балл (ҰБТ)" : "Лучший балл (ЕНТ)"}</span>
        </div>
      </section>

      <section className="profile-history">
        <h2>{lang === "kz" ? "ҰБТ тарихы" : "История ЕНТ"}</h2>
        {loadingAttempts ? (
          <p>Загрузка...</p>
        ) : sessions.length === 0 ? (
          <p className="admin-empty">
            {lang === "kz" ? "Әзірге өткен ҰБТ жоқ." : "Пока нет прохождений ЕНТ."}{" "}
            <Link to="/">
              {lang === "kz" ? "Пробный бастау" : "Начать пробный"}
            </Link>
          </p>
        ) : (
          <div className="profile-history__list">
            {sessions.map((a) => {
              const grade = entScoreToGrade(a.score, a.maxScore);
              return (
                <Link
                  key={a.sessionId}
                  to={`/exam/results/${a.sessionId}`}
                  className="profile-history__item"
                >
                  <div className="profile-history__info">
                    <strong>{lang === "kz" ? "ҰБТ" : "ЕНТ"}</strong>
                    <span>
                      {a.sectionCount}{" "}
                      {lang === "kz" ? "бөлім" : "разделов"} ·{" "}
                      {new Date(a.finishedAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <div className="profile-history__score">
                    <span
                      className={`profile-history__percent ${
                        grade >= 70
                          ? "profile-history__percent--ok"
                          : "profile-history__percent--low"
                      }`}
                    >
                      {grade} {t("entGrade", lang)}
                    </span>
                    <span className="profile-history__meta">
                      {a.score}/{a.maxScore}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {confirmLogout && (
        <ConfirmDialog
          title={lang === "kz" ? "Аккаунттан шығу" : "Выйти из аккаунта"}
          message={
            lang === "kz"
              ? "Аккаунттан шыққыңыз келетініне сенімдісіз бе?"
              : "Вы уверены, что хотите выйти из аккаунта?"
          }
          confirmLabel={lang === "kz" ? "Шығу" : "Выйти"}
          cancelLabel={lang === "kz" ? "Болдырмау" : "Отмена"}
          danger
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            logout();
          }}
        />
      )}
    </div>
  );
}
