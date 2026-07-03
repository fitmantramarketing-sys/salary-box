import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  BarChart3,
  Settings,
  Building2,
  User,
  ChevronDown,
  ChevronRight,
  X,
  ClipboardList,
} from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'

type NavSubItem = {
  label: string
  href: string
  roles?: string[]
}

type NavGroup = {
  label: string
  icon: React.ElementType
  href?: string
  roles?: string[]
  children?: NavSubItem[]
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Employees',
    icon: Users,
    roles: ['owner', 'hr', 'system_admin'],
    children: [
      { label: 'All Employees', href: '/employees', roles: ['owner', 'hr', 'system_admin'] },
      { label: 'Add Employee', href: '/employees/new', roles: ['owner'] },
      { label: 'Bulk Import', href: '/employees/bulk-import', roles: ['owner'] },
      { label: 'Org Chart', href: '/org-chart', roles: ['owner', 'hr'] },
      { label: 'Profile Edits', href: '/employees/profile-edits', roles: ['owner', 'hr'] },
    ],
  },
  {
    label: 'Attendance',
    icon: Clock,
    children: [
      { label: 'My Attendance', href: '/attendance', roles: ['owner', 'hr', 'employee'] },
      { label: 'Team Attendance', href: '/attendance/team', roles: ['owner', 'hr'] },
      { label: 'Regularization', href: '/attendance/regularization', roles: ['owner', 'hr', 'employee'] },
    ],
  },
  {
    label: 'Leave',
    icon: Calendar,
    children: [
      { label: 'Leave Dashboard', href: '/leave', roles: ['owner', 'hr', 'employee'] },
      { label: 'Apply Leave', href: '/leave/apply', roles: ['owner', 'hr', 'employee'] },
      { label: 'Team Leave', href: '/leave/team', roles: ['owner', 'hr'] },
      { label: 'Holiday Calendar', href: '/leave/holidays', roles: ['owner', 'hr', 'employee'] },
    ],
  },
    {
      label: 'Reports',
      icon: BarChart3,
      roles: ['owner', 'hr', 'system_admin'],
      children: [
        { label: 'Reports Home', href: '/reports', roles: ['owner', 'hr', 'system_admin'] },
        { label: 'Attendance Report', href: '/reports/attendance', roles: ['owner', 'hr'] },
      { label: 'Leave Report', href: '/reports/leave', roles: ['owner', 'hr'] },
      { label: 'Headcount', href: '/reports/headcount', roles: ['owner', 'system_admin'] },
      { label: 'Regularization Log', href: '/reports/regularization', roles: ['owner'] },
      { label: 'Heatmap', href: '/reports/heatmap', roles: ['owner'] },
      { label: 'Daily Attendance', href: '/reports/daily', roles: ['owner'] },
    ],
  },
  { label: 'Audit Logs', href: '/audit-logs', icon: ClipboardList, roles: ['owner', 'system_admin'] },
  {
    label: 'Settings',
    icon: Settings,
    roles: ['owner', 'hr', 'system_admin'],
    children: [
      { label: 'Departments', href: '/settings/departments', roles: ['owner'] },
      { label: 'Designations', href: '/settings/designations', roles: ['owner'] },
      { label: 'Shifts', href: '/settings/shifts', roles: ['owner', 'hr'] },
      { label: 'Leave Types', href: '/settings/leave-types', roles: ['owner'] },
      { label: 'IP Whitelist', href: '/settings/ip-whitelist', roles: ['owner', 'system_admin'] },
      { label: 'Geofence', href: '/settings/geofence', roles: ['owner', 'system_admin'] },
      { label: 'Notifications', href: '/settings/notifications', roles: ['owner'] },
      { label: 'Onboarding', href: '/settings/onboarding-checklist', roles: ['owner'] },
      { label: 'Role Management', href: '/settings/roles', roles: ['owner'] },
      { label: 'App Config', href: '/settings/app-config', roles: ['owner'] },
      { label: 'Leave Balances', href: '/settings/leave-balances', roles: ['owner', 'hr'] },
    ],
  },
]

function EmployeeNav({ onItemClick }: { onItemClick?: () => void }) {
  return (
    <>
      <NavItem icon={LayoutDashboard} href="/dashboard" label="Dashboard" onClick={onItemClick} />
      <NavItem icon={User} href="/employees/me" label="My Profile" onClick={onItemClick} />
      <NavItem icon={Clock} href="/attendance" label="My Attendance" onClick={onItemClick} />
      <NavItem icon={Clock} href="/attendance/regularization" label="Regularization" onClick={onItemClick} />
      <NavGroupItem
        icon={Calendar}
        label="My Leave"
        children={[
          { label: 'Apply Leave', href: '/leave/apply' },
          { label: 'Leave Dashboard', href: '/leave' },
          { label: 'Holiday Calendar', href: '/leave/holidays' },
        ]}
        onChildClick={onItemClick}
      />
      <NavItem icon={BarChart3} href="/reports/attendance" label="My Reports" onClick={onItemClick} />
    </>
  )
}

function NavItem({ icon: Icon, href, label, onClick }: { icon: React.ElementType; href: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={href}
      end
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  )
}

function NavGroupItem({
  icon: Icon,
  label,
  children,
  defaultOpen,
  onChildClick,
}: {
  icon: React.ElementType
  label: string
  children: { label: string; href: string }[]
  defaultOpen?: boolean
  onChildClick?: () => void
}) {
  const location = useLocation()
  const childActive = children.some((c) => location.pathname === c.href || location.pathname.startsWith(c.href + '/'))
  const [open, setOpen] = useState(defaultOpen ?? childActive)

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          childActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l pl-3">
          {children.map((child) => (
            <NavLink
              key={child.href}
              to={child.href}
              end
              onClick={onChildClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

type Props = { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: Props) {
  const { role } = useRole()

  const navContent = role === 'employee' ? (
    <nav className="flex-1 space-y-1 p-3">
      <EmployeeNav onItemClick={onClose} />
    </nav>
  ) : (
    <div className="flex-1 overflow-y-auto p-3">
      <nav className="space-y-1">
        {(() => {
          const visibleGroups = NAV_GROUPS.filter(
            (group) => !group.roles || (role && group.roles.includes(role))
          ).map((group) => ({
            ...group,
            children: group.children?.filter(
              (child) => !child.roles || (role && child.roles.includes(role))
            ),
          }))

          return visibleGroups.map((group) => {
            if (!group.children || group.children.length === 0) {
              return (
                <NavItem key={group.href!} icon={group.icon} href={group.href!} label={group.label} onClick={onClose} />
              )
            }
            if (group.children.length === 1) {
              return (
                <NavItem key={group.children[0].href} icon={group.icon} href={group.children[0].href} label={group.children[0].label} onClick={onClose} />
              )
            }
            return (
              <NavGroupItem
                key={group.label}
                icon={group.icon}
                label={group.label}
                children={group.children.map((c) => ({ label: c.label, href: c.href }))}
                onChildClick={onClose}
              />
            )
          })
        })()}
      </nav>
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile header */}
        <div className="flex h-14 items-center justify-between border-b px-4 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">HR Tool</span>
          </Link>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop: logo + nav */}
        <div className="hidden min-h-0 flex-1 flex-col md:flex">
          <Link to="/dashboard" className="flex h-14 items-center gap-2 border-b px-4 shrink-0" onClick={onClose}>
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">HR Tool</span>
          </Link>
          {navContent}
        </div>

        {/* Mobile: nav only (header already rendered above) */}
        <div className="flex min-h-0 flex-1 flex-col md:hidden">
          {navContent}
        </div>
      </aside>
    </>
  )
}
