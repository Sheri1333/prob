import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SiteHeader } from "../components/SiteHeader";
import type { Lang } from "../i18n/strings";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface AuthPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

export function ForgotPasswordPage({ lang, onToggleLang }: AuthPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Құпиясөзді қалпына келтіру" : "Сброс пароля");
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
    <div className="page v2 auth-v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang} />
      <main className="auth-v2__main">
        <form className="auth-form" onSubmit={onSubmit}>
          <h1>{kz ? "Құпиясөзді қалпына келтіру" : "Сброс пароля"}</h1>
          {done ? (
            <p className="v2-notice" role="status">
              {done}
            </p>
          ) : (
            <>
              <p className="auth-form__lead">
                {kz
                  ? "Тіркелген email-ді жазыңыз, жаңа құпиясөз орнату сілтемесін жібереміз."
                  : "Укажите email, с которым регистрировались. Пришлём ссылку для нового пароля."}
              </p>
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
              <button type="submit" className="v2-btn auth-form__submit" disabled={busy}>
                {busy
                  ? kz
                    ? "Жіберілуде…"
                    : "Отправляем…"
                  : kz
                    ? "Сілтеме жіберу"
                    : "Отправить ссылку"}
              </button>
            </>
          )}
          <p className="auth-form__switch">
            <Link to="/login">{kz ? "Кіру бетіне оралу" : "Вернуться ко входу"}</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

export function ResetPasswordPage({ lang, onToggleLang }: AuthPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Жаңа құпиясөз" : "Новый пароль");
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

  return (
    <div className="page v2 auth-v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang} />
      <main className="auth-v2__main">
        {!token ? (
          <div className="auth-form">
            <h1>{kz ? "Сілтеме жарамсыз" : "Ссылка не работает"}</h1>
            <p className="auth-form__lead">
              {kz
                ? "Сілтемеде қажетті код жоқ. Хаттағы сілтемені толық көшіріңіз немесе жаңасын сұраңыз."
                : "В ссылке нет нужного кода. Откройте ссылку из письма целиком или запросите новую."}
            </p>
            <Link to="/forgot" className="v2-btn auth-form__submit">
              {kz ? "Жаңа сілтеме сұрау" : "Запросить новую ссылку"}
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={onSubmit}>
            <h1>{kz ? "Жаңа құпиясөз" : "Новый пароль"}</h1>
            <p className="auth-form__lead">
              {kz
                ? "Сақтағаннан кейін жаңа құпиясөзбен кіресіз."
                : "После сохранения войдите с новым паролем."}
            </p>
            {error && (
              <p className="v2-error" role="alert">
                {error}
              </p>
            )}
            <label className="field">
              <span className="field__label">{kz ? "Жаңа құпиясөз" : "Новый пароль"}</span>
              <input
                type="password"
                value={password}
                minLength={6}
                required
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="field__hint">
                {kz ? "Кемінде 6 таңба" : "Не меньше 6 символов"}
              </span>
            </label>
            <button type="submit" className="v2-btn auth-form__submit" disabled={busy}>
              {busy
                ? kz
                  ? "Сақталуда…"
                  : "Сохраняем…"
                : kz
                  ? "Құпиясөзді сақтау"
                  : "Сохранить пароль"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export function VerifyEmailPage({ lang, onToggleLang }: AuthPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Email растау" : "Подтверждение email");
  const [params] = useSearchParams();
  const { applyAuth } = useAuth();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(kz ? "Сілтемеде растау коды жоқ." : "В ссылке нет кода подтверждения.");
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
    // kz only changes copy; a language switch must not verify the token twice.
  }, [applyAuth, token]);

  return (
    <div className="page v2 auth-v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang} />
      <main className="auth-v2__main">
        <div className="auth-form" role="status" aria-live="polite">
          <h1>
            {ok
              ? kz
                ? "Email расталды"
                : "Email подтверждён"
              : error
                ? kz
                  ? "Email расталмады"
                  : "Email не подтверждён"
                : kz
                  ? "Сілтемені тексеріп жатырмыз…"
                  : "Проверяем ссылку…"}
          </h1>
          {ok && (
            <p className="auth-form__lead">
              {kz
                ? "Енді нәтижелер поштаңызға келеді және құпиясөзді қалпына келтіре аласыз."
                : "Теперь результаты будут приходить на почту, а пароль можно будет сбросить."}
            </p>
          )}
          {error && (
            <p className="v2-error" role="alert">
              {error}
            </p>
          )}
          {(ok || error) && (
            <Link to={ok ? "/" : "/cabinet/settings"} className="v2-btn auth-form__submit">
              {ok
                ? kz
                  ? "Басты бетке"
                  : "На главную"
                : kz
                  ? "Кабинеттен хатты қайта жіберу"
                  : "Отправить письмо ещё раз из кабинета"}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
