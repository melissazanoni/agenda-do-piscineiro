import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { sendPasswordResetEmail } from '../../utils/mailer';
import * as repo from './auth.repository';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from './auth.schemas';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const publicUser = (u: repo.PublicUser) => ({ user_id: u.user_id, name: u.name, email: u.email });

function signAccessToken(userId: number): string {
  return jwt.sign({ type: 'access' }, env.jwtSecret, {
    subject: String(userId),
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

/** RF01 - Cadastro de usuário (RN08: e-mail único) */
export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);
  if (await repo.findUserByEmail(data.email)) throw new AppError('Este e-mail já está cadastrado.', 409);

  const hash = await bcrypt.hash(data.password, 10); // RNF03: senha criptografada
  const user = await repo.createUser(data.name, data.email, hash);
  res.status(201).json({ user, token: signAccessToken(user.user_id) });
}

/** RF02 - Login com e-mail e senha */
export async function login(req: Request, res: Response): Promise<void> {
  const data = loginSchema.parse(req.body);
  const user = await repo.findUserByEmail(data.email);
  if (!user || !(await bcrypt.compare(data.password, user.password))) {
    throw new AppError('E-mail ou senha inválidos.', 401);
  }
  res.json({ user: publicUser(user), token: signAccessToken(user.user_id) });
}

/** RF10 - Solicitar recuperação de senha */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);
  const user = await repo.findUserByEmail(email);

  // A resposta é sempre a mesma, para não revelar quais e-mails estão cadastrados.
  const response: Record<string, unknown> = {
    message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
  };

  if (user) {
    // Token válido por 1 hora; no banco fica só o hash dele.
    const token = jwt.sign({ type: 'reset' }, env.jwtSecret, { subject: String(user.user_id), expiresIn: '1h' });
    await repo.setResetToken(user.user_id, sha256(token));

    const link = `${env.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(user.email, link);

    // Só expõe o link na resposta se o SMTP não estiver configurado
    if (env.nodeEnv === 'development' && !env.smtpHost) response.resetLink = link;
  }

  res.json(response);
}

/** RF10 - Definir nova senha usando o token recebido */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const invalid = new AppError('Link de recuperação inválido ou expirado.', 400);

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw invalid;
  }
  if (payload.type !== 'reset') throw invalid;

  const user = await repo.findUserById(Number(payload.sub));
  // Compara com o hash salvo: garante que o link só funciona uma vez
  if (!user || user.reset_token !== sha256(token)) throw invalid;

  await repo.updatePassword(user.user_id, await bcrypt.hash(password, 10));
  res.json({ message: 'Senha alterada com sucesso. Faça login com a nova senha.' });
}

/** Dados do usuário logado */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await repo.findUserById(req.userId!);
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  res.json(publicUser(user));
}