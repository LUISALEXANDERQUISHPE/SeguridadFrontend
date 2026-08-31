import { useEffect, useState } from 'react'
import { getProfile } from '../features/auth/services/authService'
import type { ProfileResponse } from '../types/auth'
import { supabase } from '../services/supabase'

const TOKEN_KEY = 'seguridad_auth_token'

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [profile, setProfile] = useState<ProfileResponse['user'] | null>(null)
  const [loading, setLoading] = useState(true)

  const signIn = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
  }

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setProfile(null)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    clearSession()
    if (error) throw error
  }

  useEffect(() => {
    let mounted = true
    const loadSession = async () => {
      if (!token) {
        const { data } = await supabase.auth.getSession()
        if (data.session && mounted) {
          signIn(data.session.access_token)
          return
        }
        if (mounted) setLoading(false)
        return
      }

      getProfile(token)
        .then((response) => { if (mounted) setProfile(response.user) })
        .catch(() => { if (mounted) signOut() })
        .finally(() => { if (mounted) setLoading(false) })
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearSession()
      if (session) signIn(session.access_token)
    })
    void loadSession()
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [token])

  return { isAuthenticated: Boolean(token && profile), loading, profile, signIn, signOut }
}