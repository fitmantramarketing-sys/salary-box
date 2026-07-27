import { useState } from 'react'
import { useRole } from '@/hooks/useRole'
import { useAnnouncements, useCreateAnnouncement } from '@/features/announcements/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Megaphone } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { format } from 'date-fns'

export function EmployeeAnnouncementsTab() {
  const { data: announcements, isLoading } = useAnnouncements()
  const { isOwner, isHR } = useRole()
  const canCreate = isOwner || isHR
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const createMutation = useCreateAnnouncement()

  const handlePublish = async () => {
    if (!title.trim() || !body.trim()) return
    try {
      await createMutation.mutateAsync({ title: title.trim(), body: body.trim() })
      setDialogOpen(false)
      setTitle('')
      setBody('')
    } catch { /* error toast handled by mutation */ }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Announcements</CardTitle>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Megaphone className="mr-2 h-4 w-4" />New Announcement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your announcement…" rows={5} />
                </div>
                <Button className="w-full" onClick={handlePublish} disabled={!title.trim() || !body.trim() || createMutation.isPending}>
                  {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…</> : 'Publish'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading announcements…</p>
        ) : !announcements || announcements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Megaphone className="h-8 w-8" />
            <p className="text-sm">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(a.created_at), 'dd MMM yyyy, h:mm a')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
