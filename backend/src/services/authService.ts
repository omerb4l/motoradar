import bcrypt from 'bcrypt';
import { pool } from '../config/db';
import { signAuthToken } from '../utils/jwt';

const BCRYPT_ROUNDS = 12;

// Used to normalize login timing when no user row matches the given email —
// compared against on every failed lookup so a nonexistent email doesn't
// resolve measurably faster than a wrong password (basic enumeration guard).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('unused-timing-guard', BCRYPT_ROUNDS);

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface SignupInput {
  username: string;
  email: string;
  password: string;
}

export async function signup({ username, email, password }: SignupInput): Promise<{ user: AuthUser; token: string }> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const { rows } = await pool.query<AuthUser>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email, passwordHash]
    );
    const user = rows[0];
    return { user, token: signAuthToken(user.id) };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AuthError('Username or email already in use', 409);
    }
    throw err;
  }
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function login({ email, password }: LoginInput): Promise<{ user: AuthUser; token: string }> {
  const { rows } = await pool.query<AuthUser & { password_hash: string }>(
    `SELECT id, username, email, password_hash
     FROM users
     WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );
  const row = rows[0];

  const passwordHash = row?.password_hash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!row || !passwordMatches) {
    throw new AuthError('Invalid email or password', 401);
  }

  return {
    user: { id: row.id, username: row.username, email: row.email },
    token: signAuthToken(row.id),
  };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const { rows } = await pool.query<AuthUser>(
    `SELECT id, username, email FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return rows[0] ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
