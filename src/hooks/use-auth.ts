'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setTokens, clearTokens, loadTokens, getAccessToken } from '@/lib/api-client';

type User = {
  id: string;
  email: string;
  name: string;
};

type Workspace = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
};

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    loadTokens();
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }

    const res = await apiFetch<{ user: User; workspace: Workspace }>('/api/auth/me');
    if ('data' in res) {
      setUser(res.data.user);
      setWorkspace(res.data.workspace);
    } else {
      clearTokens();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if ('data' in res) {
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
      router.push('/dashboard');
      return { success: true };
    }
    return { success: false, error: res.error.message };
  };

  const register = async (email: string, password: string, name: string, workspaceName: string) => {
    const res = await apiFetch<{
      user: User;
      workspace: Workspace;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, workspaceName }),
    });

    if ('data' in res) {
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
      setWorkspace(res.data.workspace);
      router.push('/dashboard');
      return { success: true };
    }
    return { success: false, error: res.error.message };
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    setWorkspace(null);
    router.push('/login');
  };

  return { user, workspace, loading, login, register, logout };
}
