/* eslint-disable @typescript-eslint/no-explicit-any */
// Client-side authentication with Neon database

import { createUser, authenticateUser, createSession, getUserByToken, deleteSession } from './auth-service';
import { ClientUser, AuthResult, convertDbUserToClientUser } from './types';

export async function login(email: string, password: string): Promise<AuthResult<ClientUser>> {
  try {
    // Check if we're on client side
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: {
          message: 'Authentication not available on server side',
          code: 'SERVER_SIDE_ERROR',
        },
      };
    }

    // Try database authentication first
    try {
      const authResult = await authenticateUser(email, password);
      
      if (authResult.success && authResult.data) {
        // Create session
        const sessionResult = await createSession(authResult.data.id);
        
        if (sessionResult.success && sessionResult.data) {
          // Convert database user to client user
          const clientUser = convertDbUserToClientUser(authResult.data);

          // Store session token in localStorage for client-side persistence
          localStorage.setItem('forecaster_token', sessionResult.data);
          localStorage.setItem('forecaster_user', JSON.stringify(clientUser));

          return {
            success: true,
            data: clientUser,
          };
        }
      }
    } catch (dbError) {
      console.warn('Database authentication failed, falling back to demo mode:', dbError);
    }

    // Fallback to demo authentication if database fails
    const DEMO_USERS = [
      { id: '1', email: 'test@example.com', password: 'password', username: 'testuser', fullName: 'Test User' },
      { id: '2', email: 'demo@forecaster.ai', password: 'demo123', username: 'demo', fullName: 'Demo User' }
    ];

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
    console.error('Login error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export async function signup(email: string, password: string, username: string, fullName: string): Promise<AuthResult<ClientUser>> {
  try {
    // Check if we're on client side
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: {
          message: 'Authentication not available on server side',
          code: 'SERVER_SIDE_ERROR',
        },
      };
    }

    // Try database signup first
    try {
      const createResult = await createUser(email, password, username, fullName);
      
      if (createResult.success && createResult.data) {
        // Create session
        const sessionResult = await createSession(createResult.data.id);
        
        if (sessionResult.success && sessionResult.data) {
          // Convert database user to client user
          const clientUser = convertDbUserToClientUser(createResult.data);

          // Store session token in localStorage for client-side persistence
          localStorage.setItem('forecaster_token', sessionResult.data);
          localStorage.setItem('forecaster_user', JSON.stringify(clientUser));

          return {
            success: true,
            data: clientUser,
          };
        }
      }
    } catch (dbError) {
      console.warn('Database signup failed, falling back to demo mode:', dbError);
    }

    // Fallback to demo signup if database fails
    const newUser = {
      id: Date.now().toString(),
      email,
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
    console.error('Signup error:', error);
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
    // Check if we're on client side
    if (typeof window === 'undefined') {
      return {
        success: true,
      };
    }

    // Get token from localStorage
    const token = localStorage.getItem('forecaster_token');
    
    if (token) {
      // Delete session from database
      await deleteSession(token);
    }

    // Clear localStorage
    localStorage.removeItem('forecaster_user');
    localStorage.removeItem('forecaster_token');
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export async function getCurrentUser(): Promise<AuthResult<ClientUser>> {
  try {
    // Check if we're on client side
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: {
          message: 'No user session found',
          code: 'NO_SESSION',
        },
      };
    }

    // Get token from localStorage
    const token = localStorage.getItem('forecaster_token');
    
    if (!token) {
      return {
        success: false,
        error: {
          message: 'No user session found',
          code: 'NO_SESSION',
        },
      };
    }

    // Try database authentication first
    try {
      const userResult = await getUserByToken(token);
      
      if (userResult.success && userResult.data) {
        // Convert database user to client user
        const clientUser = convertDbUserToClientUser(userResult.data);

        // Update localStorage with fresh user data
        localStorage.setItem('forecaster_user', JSON.stringify(clientUser));

        return {
          success: true,
          data: clientUser,
        };
      }
    } catch (dbError) {
      console.warn('Database getCurrentUser failed, falling back to localStorage:', dbError);
    }

    // Fallback to localStorage if database fails
    const userStr = localStorage.getItem('forecaster_user');
    
    if (!userStr) {
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
    console.error('getCurrentUser error:', error);
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
  if (password.length < 8) { errors.push('Password must be at least 8 characters long'); }
  if (!/[A-Z]/.test(password)) { errors.push('Password must contain at least one uppercase letter'); }
  if (!/[a-z]/.test(password)) { errors.push('Password must contain at least one lowercase letter'); }
  if (!/\d/.test(password)) { errors.push('Password must contain at least one number'); }
  return { isValid: errors.length === 0, errors };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}