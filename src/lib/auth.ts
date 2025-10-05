/* eslint-disable @typescript-eslint/no-explicit-any */
// Client-side authentication for static export

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

interface AuthResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

// Demo users for static export
const DEMO_USERS = [
  {
    id: '1',
    email: 'test@example.com',
    password: 'password',
    username: 'testuser',
    fullName: 'Test User'
  },
  {
    id: '2',
    email: 'demo@forecaster.ai',
    password: 'demo123',
    username: 'demo',
    fullName: 'Demo User'
  }
];

export async function login(email: string, password: string): Promise<AuthResult<User>> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find user in demo users
    const user = DEMO_USERS.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return {
        success: false,
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        },
      };
    }

    // Store user in localStorage for persistence
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName
    };
    
    localStorage.setItem('forecaster_user', JSON.stringify(userData));
    localStorage.setItem('forecaster_token', 'demo_token_' + Date.now());

    return {
      success: true,
      data: userData,
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

export async function signup(email: string, password: string, username: string, fullName: string): Promise<AuthResult<User>> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if user already exists
    const existingUser = DEMO_USERS.find(u => u.email === email);
    if (existingUser) {
      return {
        success: false,
        error: {
          message: 'User already exists',
          code: 'USER_EXISTS',
        },
      };
    }

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      email,
      password,
      username,
      fullName
    };

    // Store user in localStorage for persistence
    const userData = {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      fullName: newUser.fullName
    };
    
    localStorage.setItem('forecaster_user', JSON.stringify(userData));
    localStorage.setItem('forecaster_token', 'demo_token_' + Date.now());

    return {
      success: true,
      data: userData,
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
    // Clear localStorage
    localStorage.removeItem('forecaster_user');
    localStorage.removeItem('forecaster_token');
    
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
    // Get user from localStorage
    const userStr = localStorage.getItem('forecaster_user');
    const token = localStorage.getItem('forecaster_token');
    
    if (!userStr || !token) {
      return {
        success: false,
        error: {
          message: 'No user session found',
          code: 'NO_SESSION',
        },
      };
    }

    const user = JSON.parse(userStr);
    return {
      success: true,
      data: user,
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

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(localStorage.getItem('forecaster_user') && localStorage.getItem('forecaster_token'));
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