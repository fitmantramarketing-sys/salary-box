import { useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useUnreadNotifications, useMarkAsRead, useMarkAllAsRead } from '@/features/notifications/hooks'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NotificationBell() {
  const { data: notifications, isLoading } = useUnreadNotifications()
  const markRead = useMarkAsRead()
  const markAll = useMarkAllAsRead()
  const navigate = useNavigate()

  const prevCountRef = useRef(0)
  const unreadCount = notifications?.length ?? 0

  useEffect(() => {
    const count = notifications?.length ?? 0
    if (count > 0 && count > prevCountRef.current) {
      const audio = new Audio('/notification.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {})
    }
    prevCountRef.current = count
  }, [notifications])

  function handleClick(notification: { id: string; reference_id: string | null; reference_table: string | null; type: string }) {
    markRead.mutate(notification.id)
    if (notification.reference_id && notification.reference_table) {
      const path = notification.reference_table === 'leave_applications'
        ? `/leave/applications/${notification.reference_id}`
        : notification.reference_table === 'attendance_records'
        ? `/attendance`
        : null
      if (path) navigate(path)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-md p-1.5 hover:bg-accent">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto text-xs font-normal"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              <p>No new notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                onClick={() => handleClick(n)}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
