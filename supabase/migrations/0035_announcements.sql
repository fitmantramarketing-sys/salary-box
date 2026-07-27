CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcements_select_all ON public.announcements
  FOR SELECT USING (
    get_my_role() IN ('owner', 'hr', 'system_admin')
    OR is_active = true
  );

CREATE POLICY announcements_insert_owner_hr ON public.announcements
  FOR INSERT WITH CHECK (get_my_role() IN ('owner', 'hr'));

CREATE POLICY announcements_update_owner_hr ON public.announcements
  FOR UPDATE USING (get_my_role() IN ('owner', 'hr'))
  WITH CHECK (get_my_role() IN ('owner', 'hr'));

CREATE POLICY announcements_delete_owner_hr ON public.announcements
  FOR DELETE USING (get_my_role() IN ('owner', 'hr'));
