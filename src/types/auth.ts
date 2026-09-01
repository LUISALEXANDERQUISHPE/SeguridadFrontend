export interface AuthResponse {
  message: string
  token: string
  user?: {
    id: string
    nombre_completo?: string
    correo?: string
    avatar_url?: string | null
    esta_activo?: boolean
  }
}

export interface ProfileResponse {
  message: string
  user: {
    id: string
    nombre_completo?: string
    correo?: string
    avatar_url?: string | null
    esta_activo?: boolean
    creado_en?: string
    actualizado_en?: string
  }
}

export interface ApiError {
  error?: string | { message?: string }
}