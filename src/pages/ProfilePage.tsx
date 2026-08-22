import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const [attempts, setAttempts] = useState<
    Awaited<ReturnType<typeof api.myAttempts>>["attempts"]
  >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .myAttempts()
      .then(({ attempts: list }) => setAttempts(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
  }, [user]);

  if (loading) return <div className="page page--center">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: "/profile" }} />;

  return (
    <div className="page">
      <header className="site-header">
        <Link to="/" className="site-header__logo">
          Талапкер
        </Link>
        <nav className="site-header__nav">
          <span>{user.name}</span>
          <button type="button" className="link-btn" onClick={logout}>
            Выйти
          </button>
        </nav>
      </header>

      <h1>Личный кабинет</h1>
      <p>
        {user.email} · зарегистрирован как{" "}
        {user.role === "admin" ? "админ" : "ученик"}
      </p>
      {error && <p className="auth-card__error">{error}</p>}

      <h2>История тестов</h2>
      {attempts.length === 0 ? (
        <p>Пока нет прохождений. <Link to="/">Каталог</Link></p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Тест</th>
              <th>Балл</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.title}
                  <br />
                  <small>{a.subject}</small>
                </td>
                <td>
                  {a.score}/{a.maxScore} (
                  {Math.round((100 * a.score) / a.maxScore)}%)
                </td>
                <td>{new Date(a.finishedAt).toLocaleString("ru-RU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
