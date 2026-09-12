import { Link } from "react-router-dom";
import type { Lang } from "../i18n/strings";

const SOCIAL = {
  instagram: "#",
  x: "#",
  whatsapp: "#",
};

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm11.2 1.3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.5 3h3.1l-6.8 7.8L22 21h-6.1l-4.8-6.3L5.5 21H2.4l7.3-8.4L2 3h6.2l4.3 5.7L17.5 3zm-1.1 16.2h1.7L7.7 4.7H5.9l10.5 14.5z"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.1A8.9 8.9 0 0 0 4.4 16.3L3 21l4.8-1.4A8.9 8.9 0 1 0 12 3.1zm0 1.8a7.1 7.1 0 0 1 6 10.9 7.1 7.1 0 0 1-8.6 2.1l-.4-.2-2.8.8.8-2.7-.2-.4A7.1 7.1 0 0 1 12 4.9zm-2.4 3.3c-.2 0-.5.1-.7.4-.2.3-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.6 4 3.5 2 .8 2.4.6 2.8.6.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.4-.2-.8-.4s-1.3-.6-1.5-.7-.3-.1-.5.1-.5.7-.7.8c-.1.1-.3.2-.6.1s-1.1-.4-2.1-1.3c-.8-.7-1.3-1.6-1.5-1.8s0-.4.1-.5c.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4 0-.1 0-.3 0-.4s-.5-1.3-.7-1.8c-.2-.5-.4-.4-.5-.4h-.4z"
      />
    </svg>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const kz = lang === "kz";

  return (
    <footer className="site-footer">
      <section className="site-footer__block">
        <h2 className="landing-section-title">
          {kz ? "Талапкер әлеуметтік желіде" : "Талапкер в соцсетях"}
        </h2>
        <p>
          {kz
            ? "Instagram-да акциялар мен жеңілдіктер жариялаймыз. Маңызды жаңалықтарды өткізіп алмау үшін жазылыңыз."
            : "Мы проводим акции в Instagram, делаем скидки и поощряем активных пользователей. Подпишитесь, чтобы не пропустить важные новости."}
        </p>
        <div className="site-social">
          <a
            className="site-social__ig"
            href={SOCIAL.instagram}
            aria-label="Instagram"
          >
            <InstagramIcon />
          </a>
          <a className="site-social__x" href={SOCIAL.x} aria-label="X">
            <XIcon />
          </a>
          <a
            className="site-social__wa"
            href={SOCIAL.whatsapp}
            aria-label="WhatsApp"
          >
            <WhatsAppIcon />
          </a>
        </div>
      </section>

      <section className="site-footer__block">
        <h2 className="landing-section-title">
          {kz ? "Сұрақтарыңыз қалды ма?" : "Остались вопросы?"}
        </h2>
        <p>
          {kz
            ? "Жаңа қолданушылар жиі қоятын сұрақтарды жинадық. Жауап таппасаңыз — бізбен байланысыңыз."
            : "Мы собрали список самых частых вопросов новых пользователей. Если не нашли ответ на свой вопрос — свяжитесь с нами."}
        </p>
        <div className="site-legal">
          <Link to="/faq">
            <span>{kz ? "Жиі қойылатын сұрақтар" : "Частые вопросы"}</span>
            <span className="material-symbols-outlined">help</span>
          </Link>
          <Link to="/terms">
            <span>
              {kz ? "Пайдаланушы келісімі" : "Пользовательское соглашение"}
            </span>
            <span className="material-symbols-outlined">contract</span>
          </Link>
          <Link to="/privacy">
            <span>
              {kz ? "Құпиялылық саясаты" : "Политика конфиденциальности"}
            </span>
            <span className="material-symbols-outlined">verified_user</span>
          </Link>
        </div>
      </section>
    </footer>
  );
}
