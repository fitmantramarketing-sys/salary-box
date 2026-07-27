import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAnnouncements } from './api'
import { callEdgeFunction } from '@/lib/edge'
import { toast } from 'sonner'

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: fetchAnnouncements,
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; body: string }) =>
      callEdgeFunction<{ title: string; body: string }, { id: string; title: string; body: string; created_at: string }>('create-announcement', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      toast.success('Announcement published')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
