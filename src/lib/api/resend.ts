import { Resend } from "resend";

const client = new Resend(process.env.RESEND_API_KEY);

// Convert plain text (from Claude) to simple HTML email
export function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map(
      (p) =>
        `<p style="margin:0 0 1em 0;line-height:1.6;">${p
          .trim()
          .replace(/\n/g, "<br>")}</p>`
    )
    .join("");
  return `<div style="font-family:system-ui,sans-serif;color:#1a1a1a;max-width:600px;">${paragraphs}</div>`;
}

export interface SendParams {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
}

export interface SendResult {
  resend_id: string;
}

export async function sendEmail(params: SendParams): Promise<SendResult> {
  const from = params.fromEmail.includes("@")
    ? `${params.fromName} <${params.fromEmail}>`
    : params.fromEmail;

  const { data, error } = await client.emails.send({
    from,
    to:      params.to,
    subject: params.subject,
    html:    params.html,
  });

  if (error || !data?.id) {
    throw new Error((error as { message?: string })?.message ?? "Resend send failed");
  }

  return { resend_id: data.id };
}
