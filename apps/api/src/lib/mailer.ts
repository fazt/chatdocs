import { env, isProduction } from "../config/env.js";
import { logger } from "./logger.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plantilla mínima y legible en cualquier cliente de correo. */
function layout(title: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;color:#333">${escapeHtml(p)}</p>`).join("");
  const button = action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 22px;background:#1c1917;color:#fafaf9;text-decoration:none;border-radius:8px">${escapeHtml(action.label)}</a></p>
       <p style="font-size:12px;color:#777;word-break:break-all">Si el botón no funciona, copia este enlace: ${escapeHtml(action.url)}</p>`
    : "";
  return `<div style="max-width:520px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <p style="font-family:monospace;font-size:13px;color:#78716c;margin:0 0 18px">folio</p>
    <h1 style="font-size:20px;margin:0 0 16px;color:#111">${escapeHtml(title)}</h1>${body}${button}
  </div>`;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (env.MAIL_DRIVER === "resend" && env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!response.ok) {
      logger.error({ status: response.status, subject: mail.subject }, "Resend rechazó el email");
      throw new Error(`Resend respondió ${response.status}`);
    }
    return;
  }
  // Driver de consola: en desarrollo se muestra el texto (con el enlace) para poder probar;
  // en producción NUNCA se registran enlaces con tokens.
  if (isProduction) {
    logger.warn({ subject: mail.subject }, "email no enviado: configura MAIL_DRIVER=resend");
  } else {
    logger.info({ to: mail.to, subject: mail.subject }, `[email de desarrollo]\n${mail.text}`);
  }
}

/** Envía sin bloquear la respuesta HTTP; los fallos quedan en el log. */
export function sendMailInBackground(mail: Mail): void {
  sendMail(mail).catch((error) => logger.error({ err: error, subject: mail.subject }, "no se pudo enviar el email"));
}

export const emails = {
  welcome(to: string, name: string): Mail {
    const url = `${env.APP_URL}/app`;
    return {
      to,
      subject: "Bienvenido a Folio",
      text: `Hola ${name}:\n\nTu cuenta de Folio está lista. Sube tus contratos, políticas o papers y pregunta: cada respuesta trae la cita exacta con su página.\n\n${url}`,
      html: layout(
        `Hola ${name}, tu cuenta está lista`,
        ["Sube tus contratos, políticas o papers y pregunta: cada respuesta trae la cita exacta con su página, verificada contra el documento."],
        { label: "Abrir Folio", url },
      ),
    };
  },
  passwordReset(to: string, token: string): Mail {
    // El token va en el #fragmento: no llega a logs de servidores ni a cabeceras Referer.
    const url = `${env.APP_URL}/restablecer#token=${token}`;
    return {
      to,
      subject: "Restablece tu contraseña de Folio",
      text: `Recibimos una solicitud para restablecer tu contraseña. El enlace caduca en 1 hora y solo sirve una vez:\n\n${url}\n\nSi no fuiste tú, ignora este correo.`,
      html: layout(
        "Restablece tu contraseña",
        ["Recibimos una solicitud para restablecer tu contraseña. El enlace caduca en 1 hora y solo sirve una vez.", "Si no fuiste tú, ignora este correo: tu contraseña no cambia."],
        { label: "Elegir una contraseña nueva", url },
      ),
    };
  },
  invitation(to: string, workspaceName: string, inviterName: string, role: string, token: string): Mail {
    const url = `${env.APP_URL}/invitacion#token=${token}`;
    const roleName = role === "editor" ? "editor" : role === "owner" ? "propietario" : "lector";
    return {
      to,
      subject: `${inviterName} te invitó a «${workspaceName}» en Folio`,
      text: `${inviterName} te invitó a unirte a «${workspaceName}» como ${roleName}. La invitación caduca en 7 días:\n\n${url}`,
      html: layout(
        `Te invitaron a «${workspaceName}»`,
        [`${inviterName} te invitó a unirte como ${roleName}. Inicia sesión (o crea tu cuenta) con este mismo email para aceptar. La invitación caduca en 7 días.`],
        { label: "Aceptar invitación", url },
      ),
    };
  },
  paymentConfirmed(to: string, workspaceName: string, planName: string, until: Date): Mail {
    const date = until.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    return {
      to,
      subject: `Plan ${planName} activo en «${workspaceName}»`,
      text: `Recibimos tu pago. El plan ${planName} de «${workspaceName}» está activo hasta el ${date}.`,
      html: layout(`Plan ${planName} activo`, [`Recibimos tu pago. El plan ${planName} de «${workspaceName}» está activo hasta el ${date}.`], {
        label: "Ver el plan",
        url: `${env.APP_URL}/app`,
      }),
    };
  },
};
