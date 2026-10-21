import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SiteHeader } from "../components/SiteHeader";
import type { Lang } from "../i18n/strings";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface AuthLocationState {
  from?: string;
  notice?: "pricing";
}

interface AuthPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

export function LoginPage({ lang, onToggleLang }: AuthPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Кіру" : "Вход");
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
      setError(err instanceof Error ? err.message : kz ? "Кіру сәтсіз" : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page v2 auth-v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang} />
      <main className="auth-v2__main">
        <form className="auth-form" onSubmit={onSubmit}>
          <h1>{kz ? "Кіру" : "Вход"}</h1>
          <p className="auth-form__lead">
            {kz
              ? "Сынақ нәтижелері профиліңізде сақталады."
              : "Результаты пробников сохраняются в профиле."}
          </p>
          {notice === "pricing" && (
            <p className="v2-notice">
              {kz
                ? "ҰБТ сынағын бастау үшін кіріңіз немесе тіркеліңіз."
                : "Войдите или зарегистрируйтесь, чтобы начать пробный ЕНТ."}
            </p>
          )}
          {error && (
            <p className="v2-error" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span className="field__label">{kz ? "Құпиясөз" : "Пароль"}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <Link to="/forgot" className="auth-form__aside">
            {kz ? "Құпиясөзді ұмыттыңыз ба?" : "Забыли пароль?"}
          </Link>
          <button type="submit" className="v2-btn auth-form__submit" disabled={busy}>
            {busy ? (kz ? "Кіруде…" : "Входим…") : kz ? "Кіру" : "Войти"}
          </button>
          <p className="auth-form__switch">
            {kz ? "Аккаунтыңыз жоқ па?" : "Нет аккаунта?"}{" "}
            <Link to="/register" state={{ from, notice }}>
              {kz ? "Тіркелу" : "Зарегистрироваться"}
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

export function RegisterPage({ lang, onToggleLang }: AuthPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Тіркелу" : "Регистрация");
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
      setError(
        err instanceof Error ? err.message : kz ? "Тіркелу сәтсіз" : "Ошибка регистрации",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page v2 auth-v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang} />
      <main className="auth-v2__main">
        <form className="auth-form" onSubmit={onSubmit}>
          <h1>{kz ? "Тіркелу" : "Регистрация"}</h1>
          <p className="auth-form__lead">
            {kz
              ? "Аккаунт тегін. Тегін ҰБТ сынағын бірден тапсыра аласыз."
              : "Аккаунт бесплатный. Пробный ЕНТ можно пройти сразу."}
          </p>
          {notice === "pricing" && (
            <p className="v2-notice">
              {kz
                ? "Тіркелгеннен кейін бірден тарифке өтесіз. Картамен төлесеңіз, интернеттегі сатып алу лимитін алып тастаңыз."
                : "Сразу после регистрации перейдём к тарифу. Если будете платить картой, снимите лимит на покупки в интернете."}
            </p>
          )}
          {error && (
            <p className="v2-error" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            <span className="field__label">{kz ? "Аты-жөні" : "Имя"}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span className="field__label">{kz ? "Құпиясөз" : "Пароль"}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <span className="field__hint">
              {kz ? "Кемінде 6 таңба" : "Не меньше 6 символов"}
            </span>
          </label>
          <button type="submit" className="v2-btn auth-form__submit" disabled={busy}>
            {busy
              ? kz
                ? "Аккаунт ашылуда…"
                : "Создаём аккаунт…"
              : kz
                ? "Аккаунт ашу"
                : "Создать аккаунт"}
          </button>
          <p className="auth-form__switch">
            {kz ? "Аккаунтыңыз бар ма?" : "Уже есть аккаунт?"}{" "}
            <Link to="/login" state={{ from, notice }}>
              {kz ? "Кіру" : "Войти"}
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
