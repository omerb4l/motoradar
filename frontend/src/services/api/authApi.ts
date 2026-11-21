import { API_BASE_URL } from './config';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export function signup(input: { username: string; email: string; password: string }): Promise<AuthResult> {
  return postJson<AuthResult>('/auth/signup', input);
}

export function login(input: { email: string; password: string }): Promise<AuthResult> {
  return postJson<AuthResult>('/auth/login', input);
}
