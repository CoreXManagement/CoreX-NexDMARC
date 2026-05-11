import nodemailer from "nodemailer";
import { getSetting } from "./db";

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  const host = getSetting("smtp_host");
  const port = Number(getSetting("smtp_port") || 587);
  const user = getSetting("smtp_user");
  const pass = getSetting("smtp_pass");
  const from = getSetting("smtp_from") || user || "nexdmarc@localhost";
  if (!host) throw new Error("SMTP not configured");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
}
