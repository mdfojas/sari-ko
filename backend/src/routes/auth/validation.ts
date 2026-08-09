export interface LoginBody {
  username?: string;
  password?: string;
}

export function validateLogin(body: LoginBody): string | null {
  if (!body.username || !body.password) {
    return 'username and password are required';
  }
  return null;
}
