'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { hashPasswordClient } from '@/lib/clientHash';
import { User, UserRole } from '@/lib/types';
import { loginUser, logoutAction } from '@/lib/services/auth.service';
import { registerUser } from '@/lib/services/user.service';
import { getCollegesFromDb, addCollegeToDb, deleteCollegeFromDb } from '@/lib/services/college.service';
import { getStudentCountStats } from '@/lib/services/student.service';
import { initApp } from '@/lib/services/migrations.service';

interface AuthContextValue {
  user: User | null;
  initialized: boolean;
  dataLoaded: boolean;
  colleges: string[];
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; role: UserRole | null }>;
  register: (name: string, email: string, password: string, role: UserRole, college?: string) => Promise<{ success: boolean; message: string }>;
  addCollege: (college: string) => Promise<{ success: boolean; message: string }>;
  removeCollege: (college: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshColleges: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [dataLoaded,  setDataLoaded]  = useState(false);
  const [colleges,    setColleges]    = useState<string[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      const { user: sessionUser, colleges: dbColleges } = await initApp();
      if (sessionUser) {
        setUser(sessionUser);
        setColleges(dbColleges);
        setDataLoaded(true);
      }
      setInitialized(true);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const passwordHash = await hashPasswordClient(email, password);
    const result = await loginUser(email, passwordHash);
    if (result.success && result.user) {
      setUser(result.user);
      const dbColleges = await getCollegesFromDb().catch(() => [] as string[]);
      setColleges(dbColleges);
      setDataLoaded(true);
      return { success: true, message: result.message, role: result.user.role as UserRole };
    }
    return { success: false, message: result.message, role: null };
  };

  const register = async (name: string, email: string, password: string, role: UserRole, college?: string) => {
    const passwordHash = await hashPasswordClient(email, password);
    const result = await registerUser(name, email, passwordHash, role, college);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, message: result.message };
  };

  const addCollege = async (college: string) => {
    const normalized = college.trim();
    if (!normalized) return { success: false, message: 'Please provide a valid college name.' };
    const result = await addCollegeToDb(normalized);
    if (result.success) setColleges(prev => [...prev, normalized].sort());
    return result;
  };

  const removeCollege = async (college: string) => {
    const normalized = college.trim();
    if (!normalized) return { success: false, message: 'Invalid college name.' };
    // check via DB aggregate — no need to hold all students in memory
    const stats = await getStudentCountStats({ college: normalized }).catch(() => null);
    if (stats && stats.total > 0) {
      return { success: false, message: 'Cannot remove a college that still has students.' };
    }
    const result = await deleteCollegeFromDb(normalized, user?.name || user?.email);
    if (result.success) setColleges(prev => prev.filter(c => c !== normalized));
    return result;
  };

  const logout = useCallback(async () => {
    try { await logoutAction(); } catch { /* ignore */ }
    setUser(null);
    window.location.href = '/login';
  }, []);

  const refreshColleges = useCallback(async () => {
    const dbColleges = await getCollegesFromDb();
    setColleges(dbColleges);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      initialized,
      dataLoaded,
      colleges,
      login,
      register,
      addCollege,
      removeCollege,
      logout,
      refreshColleges,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
