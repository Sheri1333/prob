import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ProfilePage() {
  const { user, loading, isAdmin, logout } = useAuth();
  const [attempts, setAttempts] = useState<
    Awaited<ReturnType<typeof api.myAttempts>>["attempts"]
  >([]);
  const [error, setError] = useState("");
  const [loadingAttempts, setLoadingAttempts] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .myAttempts()
      .then(({ attempts: list }) => setAttempts(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoadingAttempts(false));
  }, [user]);

  const stats = useMemo(() => {
    if (attempts.length === 0) return null;
    const avgPercent =
      attempts.reduce((sum, a) => sum + (100 * a.score) / a.maxScore, 0) /
      attempts.length;
    const best = attempts.reduce((max, a) =>
      a.score / a.maxScore > max.score / max.maxScore ? a : max,
    );
    return {
      count: attempts.length,
      avgPercent: Math.round(avgPercent),
      bestPercent: Math.round((100 * best.score) / best.maxScore),
      last: attempts[0],
    };
  }, [attempts]);

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
          <Link to="/">Каталог</Link>
          <button type="button" className="link-btn" onClick={logout}>
            Выйти
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
          {isAdmin ? "Админ" : "Ученик"}
        </span>
      </section>

      {error && <p className="auth-card__error">{error}</p>}

      <section className="profile-stats">
        <div className="profile-stat">
          <strong>{stats ? stats.count : loadingAttempts ? "…" : 0}</strong>
          <span>Пройдено сессий</span>
        </div>
        <div className="profile-stat">
          <strong>{stats ? `${stats.avgPercent}%` : "—"}</strong>
          <span>Средний результат</span>
        </div>
        <div className="profile-stat">
          <strong>{stats ? `${stats.bestPercent}%` : "—"}</strong>
          <span>Лучший результат</span>
        </div>
      </section>

      <section className="profile-history">
        <h2>История тестов</h2>
        {loadingAttempts ? (
          <p>Загрузка...</p>
        ) : attempts.length === 0 ? (
          <p className="admin-empty">
            Пока нет прохождений.{" "}
            <Link to="/">Выбрать тест в каталоге</Link>
          </p>
        ) : (
          <div className="profile-history__list">
            {attempts.map((a) => {
              const percent = Math.round((100 * a.score) / a.maxScore);
              return (
                <div key={a.id} className="profile-history__item">
                  <div className="profile-history__info">
                    <strong>{a.title}</strong>
                    <span>{a.subject}</span>
                  </div>
                  <div className="profile-history__score">
                    <span
                      className={`profile-history__percent ${
                        percent >= 60
                          ? "profile-history__percent--ok"
                          : "profile-history__percent--low"
                      }`}
                    >
                      {percent}%
                    </span>
                    <span className="profile-history__meta">
                      {a.score}/{a.maxScore} ·{" "}
                      {new Date(a.finishedAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
