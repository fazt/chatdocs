import { Resend } from "resend";
import { config } from "../config.js";

const resend = new Resend(config.resendApiKey);

export async function sendWelcomeEmail(email: string, name: string) {
  const appUrl = config.appUrl;

  await resend.emails.send({
    from: config.resendFrom,
    to: email,
    subject: "Welcome to ChatDocs!",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
        <h1 style="font-size:24px;margin-bottom:8px">Welcome to ChatDocs, ${name}!</h1>
        <p style="color:#555;line-height:1.6">Upload your Markdown files and start asking questions about their content using AI. Your documents are indexed semantically so you can search naturally.</p>
        <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;margin-top:8px">Get started</a>
        <p style="color:#999;font-size:13px;margin-top:24px">If you didn't create this account, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendResetPasswordEmail(email: string, token: string) {
  const resetUrl = `${config.appUrl}/reset-password?token=${token}`;

  await resend.emails.send({
    from: config.resendFrom,
    to: email,
    subject: "Reset your ChatDocs password",
    html: `
      <h2>Reset your password</h2>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px">Reset password</a>
      <p style="margin-top:16px">If you didn't request this, ignore this email.</p>
    `,
  });
}
