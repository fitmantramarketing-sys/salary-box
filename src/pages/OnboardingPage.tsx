import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuth'
import { useEmployeeOnboardingProgress } from '@/features/employees/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const employee = useAuthStore((s) => s.employee)
  const isLoading = useAuthStore((s) => s.isLoading)
  const { data: items, isLoading: checklistLoading } = useEmployeeOnboardingProgress(employee?.id ?? '')

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!employee) return <Navigate to="/login" replace />

  if (employee.is_first_login) return <Navigate to="/set-password" replace />

  const completed = items?.filter((i) => i.is_completed).length ?? 0
  const total = items?.length ?? 0
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-4">
        <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-md">
          <CardHeader className="space-y-3 pb-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome, {employee.first_name}!
              </h1>
              <p className="text-sm text-muted-foreground">
                Complete your onboarding checklist to get started. You can always come back to this later.
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-2">
            {checklistLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !items?.length ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
                <p className="mt-2 text-sm font-medium">No onboarding items configured</p>
                <p className="text-xs text-muted-foreground">
                  Your HR team hasn't set up any onboarding steps yet. You're all set!
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Your progress</span>
                  <Badge variant="outline">{completed}/{total} done</Badge>
                </div>
                <Progress value={pct} className="h-2" />

                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      {item.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${item.is_completed ? 'text-muted-foreground line-through' : ''}`}>
                          {item.template?.item_name ?? 'Unknown item'}
                        </p>
                        {item.template?.description && (
                          <p className="text-xs text-muted-foreground">{item.template.description}</p>
                        )}
                      </div>
                      {item.template?.is_required && (
                        <Badge variant="secondary" className="shrink-0">Required</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <Button className="w-full" onClick={() => navigate('/dashboard', { replace: true })}>
              Continue to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          <Building2 className="mr-1 inline h-3 w-3" />
          HR Tool &mdash; Onboarding
        </p>
      </div>
    </div>
  )
}
