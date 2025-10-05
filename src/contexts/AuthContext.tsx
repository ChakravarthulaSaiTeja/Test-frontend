"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, logout as authLogout, isAuthenticated } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, username: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (isAuthenticated()) {
        const result = await getCurrentUser();
        if (result.success && result.data) {
          setUser(result.data);
        } else {
          // Clear invalid session
          await authLogout();
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { login: authLogin } = await import('@/lib/auth');
      const result = await authLogin(email, password);
      
      if (result.success && result.data) {
        setUser(result.data);
        return { success: true };
      } else {
        return { success: false, error: result.error?.message || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const signup = async (email: string, password: string, username: string, fullName: string) => {
    try {
      const { signup: authSignup } = await import('@/lib/auth');
      const result = await authSignup(email, password, username, fullName);
      
      if (result.success && result.data) {
        setUser(result.data);
        return { success: true };
      } else {
        return { success: false, error: result.error?.message || 'Signup failed' };
      }
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    try {
      await authLogout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    signup,
    logout,
    isLoggedIn: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}