const BREVO_API = "https://api.brevo.com/v3";

function apiKey(): string {
  return process.env.BREVO_API_KEY?.trim() || "";
}

export function isBrevoConfigured(): boolean {
  return Boolean(apiKey());
}

export function brevoSender(): { name: string; email: string } {
  return {
    name: process.env.BREVO_SENDER_NAME?.trim() || "Talapker",
    email:
      process.env.BREVO_SENDER_EMAIL?.trim() || "sausee.com@gmail.com",
  };
}

export function brevoListId(): number {
  const raw = Number(process.env.BREVO_LIST_ID ?? 3);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

export function publicAppUrl(): string {
  const fromEnv = process.env.APP_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const cors = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .find(Boolean);
  return (cors || "http://localhost:5173").replace(/\/$/, "");
}

async function brevoRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BREVO_API}${path}`, {
    ...init,
    headers: {
      "api-key": apiKey(),
      Accept: "application/json",
      "User-Agent": "Talapker/1.0",
      ...(init.body
        ? { "Content-Type": "application/json; charset=utf-8" }
        : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let data: T & { message?: string } = {} as T & { message?: string };
  if (text) {
    try {
      data = JSON.parse(text) as T & { message?: string };
    } catch {
      data = { message: text } as T & { message?: string };
    }
  }
  if (!res.ok) {
    throw new Error(data.message || `Brevo ${res.status}`);
  }
  return data;
}

export async function sendSmtpEmail(params: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
}): Promise<void> {
  const sender = brevoSender();
  await brevoRequest("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender,
      to: [params.to],
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
      tags: params.tags,
    }),
  });
}

export async function upsertContact(params: {
  email: string;
  name: string;
  listId?: number;
}): Promise<void> {
  const listId = params.listId ?? brevoListId();
  const [firstName, ...rest] = params.name.trim().split(/\s+/);
  await brevoRequest("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email: params.email.trim().toLowerCase(),
      attributes: {
        FIRSTNAME: firstName || params.name,
        LASTNAME: rest.join(" "),
        SOURCE: "Talapker",
      },
      listIds: [listId],
      updateEnabled: true,
    }),
  });
}

export async function createEmailCampaign(params: {
  name: string;
  subject: string;
  htmlContent: string;
  listIds?: number[];
  scheduledAt?: string | null;
}): Promise<{ id: number }> {
  const sender = brevoSender();
  const body: Record<string, unknown> = {
    name: params.name,
    subject: params.subject,
    sender,
    type: "classic",
    htmlContent: params.htmlContent,
    recipients: { listIds: params.listIds?.length ? params.listIds : [brevoListId()] },
  };
  if (params.scheduledAt) body.scheduledAt = params.scheduledAt;
  return brevoRequest<{ id: number }>("/emailCampaigns", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sendCampaignNow(campaignId: number): Promise<void> {
  await brevoRequest(`/emailCampaigns/${campaignId}/sendNow`, {
    method: "POST",
  });
}

export async function getBrevoStatus() {
  const account = await brevoRequest<{
    email: string;
    companyName?: string;
    plan?: Array<{ type?: string; creditsType?: string; credits?: number }>;
  }>("/account");
  const lists = await brevoRequest<{
    lists: Array<{
      id: number;
      name: string;
      uniqueSubscribers: number;
      totalSubscribers: number;
    }>;
  }>("/contacts/lists?limit=50");
  const listId = brevoListId();
  const list = lists.lists.find((row) => row.id === listId);
  const emailPlan = account.plan?.find((row) => row.type !== "sms") ?? account.plan?.[0];
  return {
    configured: true,
    email: account.email,
    companyName: account.companyName ?? "Talapker",
    credits: emailPlan?.credits ?? 0,
    sender: brevoSender(),
    listId,
    listName: list?.name ?? "Talapker",
    subscribers: list?.uniqueSubscribers ?? list?.totalSubscribers ?? 0,
  };
}
