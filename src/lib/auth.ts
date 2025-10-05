/* eslint-disable @typescript-eslint/no-explicit-any */
// Auth utility functions

interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  username: string;
  password: string;
  fullName: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: any;
}

interface SignupResponse {
  access_token: string;
  refresh_token: string;
  user: any;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
}

interface AuthResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

export async function login(credentials: LoginRequest): Promise<AuthResult<LoginResponse>> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: data.detail || 'Login failed',
          code: response.status.toString(),
        },
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export async function signup(userData: SignupRequest): Promise<AuthResult<SignupResponse>> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: data.detail || 'Signup failed',
          code: response.status.toString(),
        },
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export async function refresh(): Promise<AuthResult<RefreshResponse>> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: data.detail || 'Token refresh failed',
          code: response.status.toString(),
        },
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export async function logout(): Promise<AuthResult<void>> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: 'Logout failed',
          code: response.status.toString(),
        },
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export async function getCurrentUser(): Promise<AuthResult<User>> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: 'Failed to get user info',
          code: response.status.toString(),
        },
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.user,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}