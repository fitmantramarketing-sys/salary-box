import type { Role } from '@/types'

export const ROUTE_ROLES: Record<string, Role[]> = {
  '/team-members/new': ['owner'],
  '/team-members/bulk-import': ['owner'],
  '/attendance/team': ['owner', 'hr'],
  '/leave/team': ['owner', 'hr'],
  '/settings/departments': ['owner'],
  '/settings/designations': ['owner'],
  '/settings/shifts': ['owner', 'hr'],
  '/settings/leave-types': ['owner'],
  '/settings/holidays': ['owner', 'hr'],
  '/settings/ip-whitelist': ['owner', 'system_admin'],
  '/settings/geofence': ['owner', 'system_admin'],
  '/settings/app-config': ['owner'],
} as const
