import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-100/40 blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-md">
          <CardHeader className="space-y-3 pb-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" id="login-title">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in with your work email to continue
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <LoginForm />
            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                id="login-forgot-password-link"
              >
                Forgot your password?
              </Link>
            </div>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          HR Tool &mdash; Internal Team Management
        </p>
      </div>
    </div>
  )
}
