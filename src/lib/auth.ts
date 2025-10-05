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

    // Authenticate user with database
    const authResult = await authenticateUser(email, password);
    
    if (!authResult.success || !authResult.data) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    // Create session
    const sessionResult = await createSession(authResult.data.id);
    
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: {
          message: 'Failed to create session',
          code: 'SESSION_ERROR',
        },
      };
    }

    // Convert database user to client user
    const clientUser = convertDbUserToClientUser(authResult.data);

    // Store session token in localStorage for client-side persistence
    localStorage.setItem('forecaster_token', sessionResult.data);
    localStorage.setItem('forecaster_user', JSON.stringify(clientUser));

    return {
      success: true,
      data: clientUser,
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

    // Create user in database
    const createResult = await createUser(email, password, username, fullName);
    
    if (!createResult.success || !createResult.data) {
      return {
        success: false,
        error: createResult.error,
      };
    }

    // Create session
    const sessionResult = await createSession(createResult.data.id);
    
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: {
          message: 'Failed to create session',
          code: 'SESSION_ERROR',
        },
      };
    }

    // Convert database user to client user
    const clientUser = convertDbUserToClientUser(createResult.data);

    // Store session token in localStorage for client-side persistence
    localStorage.setItem('forecaster_token', sessionResult.data);
    localStorage.setItem('forecaster_user', JSON.stringify(clientUser));

    return {
      success: true,
      data: clientUser,
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

    // Get user from database using token
    const userResult = await getUserByToken(token);
    
    if (!userResult.success || !userResult.data) {
      // Clear invalid session
      localStorage.removeItem('forecaster_user');
      localStorage.removeItem('forecaster_token');
      return {
        success: false,
        error: userResult.error,
      };
    }

    // Convert database user to client user
    const clientUser = convertDbUserToClientUser(userResult.data);

    // Update localStorage with fresh user data
    localStorage.setItem('forecaster_user', JSON.stringify(clientUser));

    return {
      success: true,
      data: clientUser,
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