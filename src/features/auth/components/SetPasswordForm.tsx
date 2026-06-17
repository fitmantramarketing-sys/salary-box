import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { setPasswordSchema, type SetPasswordForm as SetPasswordFormType } from '@/features/auth/schemas'
import { getErrorMessage } from '@/features/auth/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
]

export function SetPasswordForm() {
  const navigate = useNavigate()
  const employee = useAuthStore((s) => s.employee)
  const setAuth = useAuthStore((s) => s.setAuth)
  const user = useAuthStore((s) => s.user)
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery)
  const setPostPasswordSetup = useAuthStore((s) => s.setPostPasswordSetup)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<SetPasswordFormType>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const watchPassword = form.watch('password')

  const strength = useMemo(() => {
    const passed = PASSWORD_RULES.filter((r) => r.test(watchPassword))
    return { rules: PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(watchPassword) })), score: passed.length }
  }, [watchPassword])

  const strengthColor =
    strength.score <= 1
      ? 'bg-destructive'
      : strength.score <= 2
        ? 'bg-orange-500'
        : strength.score <= 3
          ? 'bg-yellow-500'
          : 'bg-green-500'

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: SetPasswordFormType) {
    setError(null)
    try {
      // 1. Update is_first_login = false first, so any TOKEN_REFRESHED event
      //    triggered by updateUser below reads the correct value from the DB.
      if (employee) {
        const { error: empError } = await supabase
          .from('employees')
          .update({ is_first_login: false })
          .eq('id', employee.id)

        if (empError) {
          setError(getErrorMessage(empError))
          return
        }
      }

      // 2. Update the Supabase Auth password (may trigger TOKEN_REFRESHED)
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      })

      if (updateError) {
        setError(getErrorMessage(updateError))
        return
      }

      // 3. Update the local auth store with the updated employee
      if (user && employee) {
        setAuth(user, { ...employee, is_first_login: false })
      }

      // 4. Suppress the SIGNED_IN handler from overriding navigation,
      //    then go to onboarding
      setPostPasswordSetup(true)
      setPasswordRecovery(false)
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="set-password-form">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id="set-password-new"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Choose a strong password"
                    autoComplete="new-password"
                    autoFocus
                    disabled={isSubmitting}
                    {...field}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password strength indicator */}
        {watchPassword.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= strength.score ? strengthColor : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <div className="space-y-1">
              {strength.rules.map((rule) => (
                <div key={rule.label} className="flex items-center gap-2 text-xs">
                  {rule.passed ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={rule.passed ? 'text-green-600' : 'text-muted-foreground'}>
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id="set-password-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    {...field}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" id="set-password-error">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting} id="set-password-submit">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting password…
            </>
          ) : (
            'Set password & continue'
          )}
        </Button>
      </form>
    </Form>
  )
}
