'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from 'lib/api/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadCurrentUser = async () => {
      try {
        const currentUser = await authApi.getCurrentUser()
        if (isMounted) {
          setUser(currentUser)
        }
      } catch {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login: async (payload) => {
        const currentUser = await authApi.login(payload)
        setUser(currentUser)
        return currentUser
      },
      logout: async () => {
        await authApi.logout()
        setUser(null)
      },
      register: authApi.register,
      refreshUser: async () => {
        const currentUser = await authApi.getCurrentUser()
        setUser(currentUser)
        return currentUser
      },
    }),
    [isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
