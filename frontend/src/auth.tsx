import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface AuthUser {
  id: number
  username: string
  email: string | null
  display_name: string
  role: 'admin' | 'user'
  is_active: boolean
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'fo_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async (tok: string): Promise<AuthUser | null> => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (!res.ok) return null
    return res.json()
  }, [])

  const refresh = useCallback(async () => {
    const tok = localStorage.getItem(TOKEN_KEY)
    if (!tok) { setUser(null); setLoading(false); return }
    const me = await fetchMe(tok)
    if (me) { setUser(me); setToken(tok) }
    else { localStorage.removeItem(TOKEN_KEY); setToken(null); setUser(null) }
    setLoading(false)
  }, [fetchMe])

  useEffect(() => { refresh() }, [refresh])

  const login = async (username: string, password: string) => {
    const body = new URLSearchParams({ username, password })
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }))
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setToken(data.access_token)
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, logout,
      isAdmin: user?.role === 'admin',
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
