"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as authLogin, signup as authSignup, logout as authLogout, getCurrentUser, isAuthenticated } from '@/lib/auth';
import { ClientUser } from '@/lib/types';

interface AuthContextType {
  user: ClientUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, username: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      // Only check auth on client side
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      if (isAuthenticated()) {
        const result = await getCurrentUser();
        if (result.success && result.data) {
          setUser(result.data);
        } else {
          // Clear invalid session
          await authLogout();
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    try {
      const result = await authLogin(email, password);
      
      if (result.success && result.data) {
        setUser(result.data);
        return { success: true };
      } else {
        return { success: false, error: result.error?.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const signup = async (email: string, password: string, username: string, fullName: string) => {
    try {
      const result = await authSignup(email, password, username, fullName);
      
      if (result.success && result.data) {
        setUser(result.data);
        return { success: true };
      } else {
        return { success: false, error: result.error?.message || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    try {
      await authLogout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      setUser(null);
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