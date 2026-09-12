import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api.forgotPassword(email);
      setDone(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__toggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Сброс пароля</h1>
        {error && <p className="auth-card__error">{error}</p>}
        {done ? (
          <p className="auth-card__notice">{done}</p>
        ) : (
          <>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <button type="submit" className="auth-card__btn" disabled={busy}>
              {busy ? "..." : "Отправить ссылку"}
            </button>
          </>
        )}
        <p className="auth-card__footer">
          <Link to="/login">Вернуться ко входу</Link>
        </p>
      </form>
    </div>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.resetPassword({ token, password });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <p className="auth-card auth-card__error">Нет токена в ссылке</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-page__toggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Новый пароль</h1>
        {error && <p className="auth-card__error">{error}</p>}
        <label>
          Пароль
          <input
            type="password"
            value={password}
            minLength={6}
            required
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="auth-card__btn" disabled={busy}>
          {busy ? "..." : "Сохранить"}
        </button>
      </form>
    </div>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { applyAuth } = useAuth();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Нет токена в ссылке");
      return;
    }
    let cancelled = false;
    api
      .verifyEmail(token)
      .then(({ token: nextToken, user }) => {
        if (cancelled) return;
        applyAuth(nextToken, user);
        setOk(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка подтверждения");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyAuth, token]);

  return (
    <div className="auth-page">
      <div className="auth-page__toggle">
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <h1>Подтверждение email</h1>
        {error && <p className="auth-card__error">{error}</p>}
        {ok && (
          <p className="auth-card__notice">Почта подтверждена. Можно пользоваться Талапкер.</p>
        )}
        {!error && !ok && <p className="auth-card__hint">Проверяем ссылку...</p>}
        <p className="auth-card__footer">
          <Link to="/">{ok ? "На главную" : "Отмена"}</Link>
        </p>
      </div>
    </div>
  );
}
