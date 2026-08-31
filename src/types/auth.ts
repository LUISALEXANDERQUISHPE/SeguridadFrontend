export interface AuthResponse {
  message: string
  token: string
}

export interface ProfileResponse {
  message: string
  user: {
    id: string
    username: string
    email: string
    iat?: number
    exp?: number
  }
}

export interface ApiError {
  error?: string | { message?: string }
}