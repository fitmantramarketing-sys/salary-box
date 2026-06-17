import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Employee, Role } from '@/types'

type AuthState = {
  user: User | null
  employee: Employee | null
  role: Role | null
  isLoading: boolean
  /** True when the user arrives via a password-reset email link (PASSWORD_RECOVERY event). */
  isPasswordRecovery: boolean
  /** Suppresses the SIGNED_IN handler's navigate('/dashboard') when the user
   *  has just completed the set-password flow, preventing a race where the
   *  handler overwrites SetPasswordForm's navigate('/onboarding'). */
  isPostPasswordSetup: boolean
  setAuth: (user: User, employee: Employee) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  setPasswordRecovery: (value: boolean) => void
  setPostPasswordSetup: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  employee: null,
  role: null,
  isLoading: true,
  isPasswordRecovery: false,
  isPostPasswordSetup: false,
  setAuth: (user, employee) =>
    set({ user, employee, role: employee.role, isLoading: false }),
  clearAuth: () =>
    set({ user: null, employee: null, role: null, isLoading: false, isPasswordRecovery: false, isPostPasswordSetup: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setPasswordRecovery: (isPasswordRecovery) => set({ isPasswordRecovery }),
  setPostPasswordSetup: (isPostPasswordSetup) => set({ isPostPasswordSetup }),
}))
