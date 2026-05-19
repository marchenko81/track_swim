import { createContext, useContext, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/auth'

export type UserProfile = {
  id: number
  email: string
  first_name: string
  last_name: string
  language: string
  role: 'coach' | 'athlete' | ''
  avatar_url: string | null
  date_of_birth: string | null
  sport: string
  stroke_specialty: string
  fitness_level: string
  club_name: string | null
  onboarding_completed: boolean
}

type RegisterData = {
  email: string
  password: string
  first_name: string
  last_name: string
  role: 'coach' | 'athlete'
  invite_token?: string
}

interface AuthContextValue {
  user: UserProfile | null
  isLoading: boolean
  login: (email: string, password: string, inviteToken?: string) => Promise<UserProfile>
  register: (data: RegisterData) => Promise<UserProfile>
  logout: () => void
  refetchUser: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthResponse = {
  access: string
  refresh: string
  user: UserProfile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user, isPending, refetch } = useQuery<UserProfile | null>({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const data = await apiFetch<UserProfile>('/users/profile/')
      return data
    },
    enabled: !!getAccessToken(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const login = async (email: string, password: string, inviteToken?: string): Promise<UserProfile> => {
    const data = await apiFetch<AuthResponse>('/users/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password, invite_token: inviteToken }),
    })
    setTokens(data.access, data.refresh)
    queryClient.setQueryData(['auth', 'user'], data.user)
    return data.user
  }

  const register = async (registerData: RegisterData): Promise<UserProfile> => {
    const data = await apiFetch<AuthResponse>('/users/auth/register/', {
      method: 'POST',
      body: JSON.stringify(registerData),
    })
    setTokens(data.access, data.refresh)
    queryClient.setQueryData(['auth', 'user'], data.user)
    return data.user
  }

  const logout = () => {
    const refresh = getRefreshToken()
    if (refresh) {
      apiFetch('/users/auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      }).catch(() => {})
    }
    clearTokens()
    queryClient.clear()
  }

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading: isPending && !!getAccessToken(),
        login,
        register,
        logout,
        refetchUser: () => refetch(),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
