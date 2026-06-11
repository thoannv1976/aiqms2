import { env } from "@/config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(msg: EmailMessage): Promise<{ ok: boolean; id?: string }>;
}

/** Driver mặc định: ghi log (dev / không có SMTP / mạng hạn chế). Không gửi thật. */
class LogMailer implements Mailer {
  async send(msg: EmailMessage) {
    console.log(`[EMAIL:log] to=${msg.to} subject=${msg.subject}`);
    return { ok: true };
  }
}

/**
 * Driver SMTP qua nodemailer — nạp động để KHÔNG bắt buộc cài gói khi chạy driver "log".
 * Nếu thiếu nodemailer hoặc cấu hình → fallback an toàn (ghi log + ok:false) thay vì 500.
 */
class SmtpMailer implements Mailer {
  async send(msg: EmailMessage) {
    if (!env.SMTP_HOST) {
      console.warn("[EMAIL:smtp] thiếu SMTP_HOST — bỏ qua gửi");
      return { ok: false };
    }
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
      const info = await transport.sendMail({ from: env.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
      return { ok: true, id: info.messageId as string };
    } catch (e) {
      console.error("[EMAIL:smtp] gửi thất bại", e);
      return { ok: false };
    }
  }
}

let cached: Mailer | null = null;
export function getMailer(): Mailer {
  if (cached) return cached;
  cached = env.EMAIL_DRIVER === "smtp" ? new SmtpMailer() : new LogMailer();
  return cached;
}

/** Cho test: thay mailer (vd: thu thập email đã gửi). */
export function setMailerForTest(m: Mailer | null) {
  cached = m;
}
