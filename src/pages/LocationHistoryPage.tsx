import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LocationSnapshot } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle } from 'react-leaflet'
import L from 'leaflet'
import { Clock, MapPin, XCircle, CheckCircle2, Filter, Crosshair, Activity } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const icons = {
  checkIn: L.divIcon({
    className: '',
    html: `<div style="background:#16a34a;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:3px solid #bbf7d0;box-shadow:0 2px 6px rgba(0,0,0,0.3)">CI</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  checkOut: L.divIcon({
    className: '',
    html: `<div style="background:#2563eb;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:3px solid #bfdbfe;box-shadow:0 2px 6px rgba(0,0,0,0.3)">CO</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  failed: L.divIcon({
    className: '',
    html: `<div style="background:#dc2626;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid #fecaca;box-shadow:0 2px 6px rgba(0,0,0,0.3)">!</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  employeeSelected: L.divIcon({
    className: '',
    html: `<div style="background:#f59e0b;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:3px solid #fde68a;box-shadow:0 2px 8px rgba(245,158,11,0.5)">●</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
}

interface SnapshotWithEmployee extends LocationSnapshot {
  employee?: { first_name: string; last_name: string } | null
}

async function fetchEmployees(): Promise<{ id: string; first_name: string; last_name: string }[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name')
  if (error) throw error
  return data ?? []
}

async function fetchSnapshots(days: number): Promise<SnapshotWithEmployee[]> {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const since = date.toISOString()
  const { data, error } = await supabase
    .from('location_snapshots')
    .select('*, employee:employees!employee_id(first_name, last_name)')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as SnapshotWithEmployee[]
}

function getMarkerIcon(s: SnapshotWithEmployee, selectedEmployee: string) {
  if (!s.successful) return icons.failed
  if (selectedEmployee !== 'all' && s.employee_id === selectedEmployee) return icons.employeeSelected
  return s.action === 'check_in' ? icons.checkIn : icons.checkOut
}

type GeofenceZone = {
  id: string
  label: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
}

async function fetchGeofences(): Promise<GeofenceZone[]> {
  const { data, error } = await supabase
    .from('geofence_config')
    .select('id, label, latitude, longitude, radius_meters, is_active')
    .eq('is_active', true)
  if (error) throw error
  return (data ?? []) as GeofenceZone[]
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LocationHistoryPage() {
  const [days, setDays] = useState(7)
  const [employeeId, setEmployeeId] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [mapZoom] = useState(13)

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: fetchEmployees,
  })

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['location-snapshots', days],
    queryFn: () => fetchSnapshots(days),
  })

  const { data: geofences } = useQuery({
    queryKey: ['geofence-config'],
    queryFn: fetchGeofences,
  })

  const filtered = useMemo(() => {
    let list = snapshots ?? []
    if (employeeId !== 'all') list = list.filter((s) => s.employee_id === employeeId)
    if (actionFilter !== 'all') list = list.filter((s) => s.action === actionFilter)
    if (statusFilter === 'successful') list = list.filter((s) => s.successful)
    if (statusFilter === 'blocked') list = list.filter((s) => !s.successful)
    return list
  }, [snapshots, employeeId, actionFilter, statusFilter])

  const withCoords = filtered.filter((s) => s.latitude != null && s.longitude != null)

  const stats = useMemo(() => {
    const total = filtered.length
    const successful = filtered.filter((s) => s.successful).length
    const blocked = total - successful
    const checkIns = filtered.filter((s) => s.action === 'check_in').length
    const checkOuts = filtered.filter((s) => s.action === 'check_out').length
    return { total, successful, blocked, checkIns, checkOuts }
  }, [filtered])

  const mapCenter = useMemo(() => {
    if (withCoords.length === 0) return [20.5937, 78.9629] as [number, number]
    const avgLat = withCoords.reduce((sum, s) => sum + Number(s.latitude!), 0) / withCoords.length
    const avgLng = withCoords.reduce((sum, s) => sum + Number(s.longitude!), 0) / withCoords.length
    return [avgLat, avgLng] as [number, number]
  }, [withCoords])

  const employeeName = (s: SnapshotWithEmployee) =>
    (s as SnapshotWithEmployee).employee
      ? `${(s as SnapshotWithEmployee).employee?.first_name ?? ''} ${(s as SnapshotWithEmployee).employee?.last_name ?? ''}`
      : 'Unknown'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Location History</h1>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {[1, 3, 7, 30].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'ghost'}
              size="sm"
              className="px-3"
              onClick={() => setDays(d)}
            >
              {d === 1 ? 'Today' : `${d}d`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Activity, color: 'text-muted-foreground' },
          { label: 'Successful', value: stats.successful, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Blocked', value: stats.blocked, icon: XCircle, color: 'text-red-600' },
          { label: 'Check-Ins', value: stats.checkIns, icon: Crosshair, color: 'text-emerald-600' },
          { label: 'Check-Outs', value: stats.checkOuts, icon: Clock, color: 'text-blue-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="relative z-10">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 mr-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Filters</span>
            </div>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent className="z-[999]">
                <SelectItem value="all">All Employees</SelectItem>
                {employees?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[999]">
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="check_in">Check-In</SelectItem>
                <SelectItem value="check_out">Check-Out</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[999]">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs ml-auto">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden relative z-0">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Map View
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600" /> Check-In</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600" /> Check-Out</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" /> Blocked</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0 border-t-2 border-dotted border-blue-500" /> Geofence</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <Skeleton className="h-[450px] w-full rounded-none" />
            ) : withCoords.length === 0 ? (
              <div className="h-[450px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-8 w-8 opacity-30" />
                <p>No location data matches the selected filters.</p>
                <p className="text-xs">Try expanding the date range or clearing filters.</p>
              </div>
            ) : (
              <div className="h-[450px] w-full relative">
                <div className="absolute top-2 right-2 z-[999] bg-background/90 rounded-md px-2 py-1 text-xs text-muted-foreground shadow-sm border">
                  Scroll to zoom · Drag to pan
                </div>
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                  zoomDelta={0.5}
                  wheelPxPerZoomLevel={60}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {geofences?.map((g) => (
                    <Circle
                      key={g.id}
                      center={[g.latitude, g.longitude]}
                      radius={g.radius_meters}
                      pathOptions={{
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.06,
                        weight: 2,
                        dashArray: '6, 4',
                      }}
                    >
                      <Tooltip permanent direction="center" className="border-0 bg-transparent shadow-none">
                        <span className="bg-background/80 text-xs font-medium px-2 py-0.5 rounded border whitespace-nowrap shadow-sm">
                          {g.label}
                        </span>
                      </Tooltip>
                    </Circle>
                  ))}
                  {withCoords.map((s) => (
                    <Marker
                      key={s.id}
                      position={[Number(s.latitude!), Number(s.longitude!)]}
                      icon={getMarkerIcon(s, employeeId)}
                    >
                      <Tooltip
                        permanent={employeeId !== 'all' && s.employee_id === employeeId}
                        direction="top"
                        offset={[0, -16]}
                      >
                        {employeeName(s)}
                      </Tooltip>
                      <Popup>
                        <div className="text-xs space-y-1.5 min-w-[160px]">
                          <p className="font-semibold text-sm">{employeeName(s)}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant={s.successful ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                              {s.successful ? 'Successful' : s.error_code}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {s.action === 'check_in' ? 'Check-In' : 'Check-Out'}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{formatTime(s.created_at)}</p>
                          <p className="text-muted-foreground font-mono text-[10px]">
                            {Number(s.latitude!).toFixed(6)}, {Number(s.longitude!).toFixed(6)}
                          </p>
                          {s.inside_geofence != null && (
                            <p className={s.inside_geofence ? 'text-green-600' : 'text-red-600'}>
                              {s.inside_geofence ? 'Inside geofence zone' : 'Outside geofence zone'}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Attempts
              <Badge variant="secondary" className="ml-auto text-xs">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-[450px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-8 w-8 opacity-30" />
                <p>No records found.</p>
              </div>
            ) : (
              <ScrollArea className="h-[450px]">
                <div className="divide-y">
                  {filtered.map((s) => (
                    <div key={s.id} className="px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        {s.successful ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium truncate">{employeeName(s)}</span>
                        <Badge
                          variant="outline"
                          className={`ml-auto text-[10px] px-1.5 py-0 ${
                            s.action === 'check_in' ? 'text-emerald-600 border-emerald-200' : 'text-blue-600 border-blue-200'
                          }`}
                        >
                          {s.action === 'check_in' ? 'IN' : 'OUT'}
                        </Badge>
                        {!s.successful && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{s.error_code}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(s.created_at)}</span>
                        {s.inside_geofence != null && (
                          <span className={s.inside_geofence ? 'text-green-600' : 'text-red-600'}>
                            {s.inside_geofence ? '✓ zone' : '✗ zone'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
