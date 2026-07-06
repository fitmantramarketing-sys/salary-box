CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_employee ON push_subscriptions(employee_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push subscriptions
CREATE POLICY push_subscriptions_self ON push_subscriptions
  FOR ALL
  USING (employee_id = get_my_employee_id())
  WITH CHECK (employee_id = get_my_employee_id());

-- Service role can read all for sending push notifications
-- (no policy needed — service_role bypasses RLS)
