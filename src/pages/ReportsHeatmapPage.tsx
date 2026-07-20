import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useHeatmapData } from '@/features/reports/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

function heatColor(pct: number): string {
  if (pct >= 90) return 'bg-green-600'
  if (pct >= 75) return 'bg-green-400'
  if (pct >= 60) return 'bg-yellow-400'
  if (pct >= 40) return 'bg-orange-400'
  return 'bg-red-400'
}

export default function ReportsHeatmapPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: heatmap, isLoading } = useHeatmapData(year, month)
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Attendance Heatmap</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthName} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Legend:</span>
        {[
          { pct: '90-100%', cls: 'bg-green-600' },
          { pct: '75-89%', cls: 'bg-green-400' },
          { pct: '60-74%', cls: 'bg-yellow-400' },
          { pct: '40-59%', cls: 'bg-orange-400' },
          { pct: '0-39%', cls: 'bg-red-400' },
          { pct: 'Holiday / Weekly Off', cls: 'bg-gray-200' },
        ].map((l) => (
          <span key={l.cls} className="flex items-center gap-1">
            <span className={cn('inline-block h-3 w-3 rounded-sm', l.cls)} />
            {l.pct}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !heatmap || heatmap.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No department data available for this month.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 bg-muted/50 z-10 text-left p-2 font-medium min-w-[160px]">Department</th>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <th key={i} className="p-1 text-center font-medium w-7 sm:w-9 text-muted-foreground">{i + 1}</th>
                    ))}
                    <th className="p-2 text-center font-medium min-w-[60px]">Avg %</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((dept) => {
                    const avg = dept.dayAttendance.length > 0
                      ? Math.round(dept.dayAttendance.reduce((s, d) => s + d.pct, 0) / dept.dayAttendance.length)
                      : 0
                    return (
                      <tr key={dept.departmentId} className="border-b hover:bg-accent/30">
                        <td className="sticky left-0 bg-background z-10 p-2 font-medium">{dept.departmentName}</td>
                        {dept.dayAttendance.map((d) => (
                          <td key={d.day} className="p-1 text-center">
                            {d.type === 'holiday' || d.type === 'weekly_off' ? (
                              <span
                                className="inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-sm bg-gray-200"
                                title={d.type === 'holiday' ? 'Holiday' : 'Weekly Off'}
                              />
                            ) : d.total > 0 ? (
                              <span
                                className={cn('inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-sm', heatColor(d.pct))}
                                title={`${d.present}/${d.total} (${d.pct}%)`}
                              />
                            ) : (
                              <span className="text-muted-foreground">·</span>
                            )}
                          </td>
                        ))}
                        <td className="p-2 text-center font-medium">{avg}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
