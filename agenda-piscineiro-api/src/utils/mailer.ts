import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    })
  : null;

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!transporter) {
    console.log(`[recuperação de senha - SMTP não configurado] ${to}: ${resetLink}`);
    return;
  }

  await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject: 'Recuperação de senha - Agenda do Piscineiro',
    html: `
      <p>Você solicitou a redefinição da sua senha no <strong>Agenda do Piscineiro</strong>.</p>
      <p>Clique no link abaixo para cadastrar uma nova senha (válido por 1 hora):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Se você não solicitou essa alteração, ignore este e-mail.</p>
    `,
  });
}