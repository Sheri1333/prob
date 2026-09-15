import { sendSmtpEmail, upsertContact, publicAppUrl } from "./brevo.js";

function wrap(title: string, body: string): string {
  return `<!doctype html>
<html lang="kk">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  </head>
  <body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#1b2437;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eaf3;">
            <tr>
              <td style="padding:20px 28px;background:#5466f5;color:#fff;font-size:20px;font-weight:700;">
                Талапкер
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:22px;">${title}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px;color:#7b8499;font-size:12px;">
                Talapker · пробное ЕНТ / ҰБТ
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0 8px;">
    <a href="${href}" style="display:inline-block;background:#5466f5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">
      ${label}
    </a>
  </p>
  <p style="word-break:break-all;font-size:12px;color:#7b8499;">${href}</p>`;
}

export async function syncUserToBrevo(email: string, name: string): Promise<void> {
  await upsertContact({ email, name });
}

export async function sendWelcomeEmail(params: {
  email: string;
  name: string;
  verifyToken: string;
}): Promise<void> {
  const href = `${publicAppUrl()}/verify?token=${encodeURIComponent(params.verifyToken)}`;
  const name = escapeHtml(params.name.split(/\s+/)[0] || params.name);
  await sendSmtpEmail({
    to: { email: params.email, name: params.name },
    subject: "Талапкер: растаңыз email / подтвердите почту",
    tags: ["welcome", "verify"],
    text: `Сәлем, ${params.name}!\n\nТалапкерде тіркелдіңіз. Email-ді растау үшін сілтемені ашыңыз:\n${href}\n\nВы зарегистрировались в Талапкер. Откройте ссылку, чтобы подтвердить почту.`,
    html: wrap(
      `Сәлем, ${name}!`,
      `<p>Талапкерде тіркелдіңіз. Email-ді растаңыз — содан кейін нәтиже мен парольді қалпына келтіру жұмыс істейді.</p>
       <p>Вы зарегистрировались в Талапкер. Подтвердите почту, чтобы получать результаты и сбрасывать пароль.</p>
       ${button(href, "Растау / Подтвердить")}`,
    ),
  });
}

export async function sendVerifyEmail(params: {
  email: string;
  name: string;
  verifyToken: string;
}): Promise<void> {
  const href = `${publicAppUrl()}/verify?token=${encodeURIComponent(params.verifyToken)}`;
  await sendSmtpEmail({
    to: { email: params.email, name: params.name },
    subject: "Талапкер: растаңыз email / подтвердите почту",
    tags: ["verify"],
    text: `Email-ді растаңыз. Сілтеме 48 сағат жарамды:\n${href}\n\nПодтвердите почту. Ссылка действует 48 часов.`,
    html: wrap(
      "Email-ді растаңыз",
      `<p>Жаңа растау сілтемесі дайын. Сілтеме 48 сағат бойы жарамды.</p>
       <p>Новая ссылка для подтверждения почты. Она действует 48 часов.</p>
       ${button(href, "Растау / Подтвердить")}`,
    ),
  });
}

export async function sendResetEmail(params: {
  email: string;
  name: string;
  resetToken: string;
}): Promise<void> {
  const href = `${publicAppUrl()}/reset?token=${encodeURIComponent(params.resetToken)}`;
  await sendSmtpEmail({
    to: { email: params.email, name: params.name },
    subject: "Талапкер: жаңа пароль / сброс пароля",
    tags: ["reset"],
    text: `Парольді өзгерту сілтемесі (1 сағат):\n${href}\n\nСсылка для смены пароля действует 1 час. Если это были не вы — проигнорируйте письмо.`,
    html: wrap(
      "Жаңа пароль",
      `<p>Егер бұл сіз болмасаңыз — хатты елемеңіз. Сілтеме 1 сағат бойы жарамды.</p>
       <p>Если это были не вы — просто проигнорируйте письмо. Ссылка действует 1 час.</p>
       ${button(href, "Парольді өзгерту / Сменить пароль")}`,
    ),
  });
}

export async function sendExamResultEmail(params: {
  email: string;
  name: string;
  score: number;
  maxScore: number;
  sessionId: string;
}): Promise<void> {
  const href = `${publicAppUrl()}/exam/results/${encodeURIComponent(params.sessionId)}`;
  await sendSmtpEmail({
    to: { email: params.email, name: params.name },
    subject: `Талапкер: нәтиже ${params.score}/${params.maxScore}`,
    tags: ["exam-result"],
    text: `${params.name}, сіздің баллыңыз: ${params.score} / ${params.maxScore}\nРезультат пробного ЕНТ: ${params.score} / ${params.maxScore}\n${href}`,
    html: wrap(
      "ҰБТ нәтижесі дайын",
      `<p>${escapeHtml(params.name)}, сіздің баллыңыз: <strong>${params.score} / ${params.maxScore}</strong>.</p>
       <p>Результат пробного ЕНТ: <strong>${params.score} / ${params.maxScore}</strong>.</p>
       ${button(href, "Нәтижені ашу / Открыть результат")}`,
    ),
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function asEmailHtml(title: string, content: string): string {
  const trimmed = content.trim();
  if (/<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  const body = /<[a-z][\s\S]*>/i.test(trimmed)
    ? trimmed
    : `<p>${escapeHtml(trimmed).replaceAll("\n", "<br/>")}</p>`;
  return wrap(title, body);
}

export function queueMail(task: Promise<unknown>): void {
  void task.catch((err) => {
    console.error("Brevo mail failed:", err instanceof Error ? err.message : err);
  });
}
