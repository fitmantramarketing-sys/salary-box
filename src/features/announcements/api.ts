import { supabase } from '@/lib/supabase'

export type AnnouncementRow = {
  id: string
  title: string
  body: string
  created_by: string
  created_at: string
  updated_at: string | null
  is_active: boolean
}

export async function fetchAnnouncements(): Promise<AnnouncementRow[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
