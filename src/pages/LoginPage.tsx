import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";

interface AuthLocationState {
  from?: string;
  notice?: "pricing";
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as AuthLocationState | null;
  const from = routeState?.from || "/";
  const notice = routeState?.notice;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--center auth-page">
      <div className="auth-page__toggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Талапкер · Вход</h1>
        {notice === "pricing" && (
          <p className="auth-card__notice">
            Мы перейдём к тарифу сразу после входа или регистрации. Не забудьте
            снять лимит на покупки в интернете, если собираетесь оплачивать
            картой.
          </p>
        )}
        {error && <p className="auth-card__error">{error}</p>}
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
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="auth-card__btn" disabled={busy}>
          {busy ? "..." : "Войти"}
        </button>
        <p className="auth-card__footer">
          Нет аккаунта?{" "}
          <Link to="/register" state={{ from, notice }}>
            Создать
          </Link>
        </p>
        <Link to="/" className="auth-card__back">
          ← На главную
        </Link>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as AuthLocationState | null;
  const from = routeState?.from || "/";
  const notice = routeState?.notice;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(name, email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--center auth-page">
      <div className="auth-page__toggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Талапкер · Регистрация</h1>
        {notice === "pricing" && (
          <p className="auth-card__notice">
            Мы перейдём к тарифу сразу после регистрации. Не забудьте снять
            лимит на покупки в интернете, если собираетесь оплачивать картой.
          </p>
        )}
        {error && <p className="auth-card__error">{error}</p>}
        <label>
          Имя
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
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
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="auth-card__btn" disabled={busy}>
          {busy ? "..." : "Создать аккаунт"}
        </button>
        <p className="auth-card__footer">
          Уже есть аккаунт?{" "}
          <Link to="/login" state={{ from, notice }}>
            Войти
          </Link>
        </p>
        <Link to="/" className="auth-card__back">
          ← На главную
        </Link>
      </form>
    </div>
  );
}
