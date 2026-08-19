import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchUnreadNotifications, fetchAllNotifications, markAsRead, markAllAsRead } from './api'

export function useUnreadNotifications() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30_000,
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: fetchAllNotifications,
    refetchInterval: 30_000,
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
