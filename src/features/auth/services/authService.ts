import { apiRequest } from '../../../services/api'
import type { AuthResponse, ProfileResponse } from '../../../types/auth'
import { supabase } from '../../../services/supabase'

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function register(fullName: string, email: string, password: string) {
  return apiRequest<{ message: string; user?: unknown }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  })
}

export function getProfile(token: string) {
  return apiRequest<ProfileResponse>('/auth/profile', {
    headers: { Authorization: `Bearer ${token}` },
  })
}