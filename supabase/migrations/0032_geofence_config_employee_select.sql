-- Allow employees to read geofence_config for location map display
-- The previous policy only allowed owner/hr/system_admin, but employees
-- need to see geofence zones on their dashboard LocationMapCard.

drop policy if exists geofence_config_select on geofence_config;

create policy geofence_config_select on geofence_config
for select
using (get_my_role() in ('owner', 'hr', 'system_admin', 'employee'));
