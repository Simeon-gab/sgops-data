// Plain text to a simple HTML email body.
//
// Lives in the sending layer rather than next to a provider client: every
// transport needs it, and nothing about it is provider-specific. It used to
// sit beside the Resend client, which meant importing it constructed that
// client, which meant a deployment sending only over SMTP still could not
// start without a Resend API key.

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
