import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import type { LocationSnapshot } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, XCircle, CheckCircle2, Activity } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

const icons = {
  checkIn: L.divIcon({
    className: '',
    html: `<div style="background:#16a34a;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:3px solid #bbf7d0;box-shadow:0 2px 6px rgba(0,0,0,0.3)">CI</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  }),
  checkOut: L.divIcon({
    className: '',
    html: `<div style="background:#2563eb;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:3px solid #bfdbfe;box-shadow:0 2px 6px rgba(0,0,0,0.3)">CO</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  }),
  failed: L.divIcon({
    className: '',
    html: `<div style="background:#dc2626;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:3px solid #fecaca;box-shadow:0 2px 6px rgba(0,0,0,0.3)">!</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  }),
}

type SnapshotRow = LocationSnapshot & {
  employee?: { first_name: string; last_name: string } | null
}

type GeofenceRow = {
  id: string
  label: string
  latitude: number
  longitude: number
  radius_meters: number
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function GeofenceLayer({ geofences }: { geofences: GeofenceRow[] | undefined }) {
  const map = useMap()

  useEffect(() => {
    if (!geofences || geofences.length === 0) return

    const circles: L.Circle[] = []
    const markers: L.Marker[] = []
    const bounds = L.latLngBounds([])

    for (const g of geofences) {
      const lat = Number(g.latitude)
      const lng = Number(g.longitude)
      const center = L.latLng(lat, lng)
      const radius = g.radius_meters

      const circle = L.circle(center, {
        radius,
        color: '#1d4ed8',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 5,
        dashArray: '8, 6',
      }).addTo(map)

      circle.bindTooltip(g.label, { direction: 'center', permanent: true })
      circles.push(circle)

      const marker = L.marker(center, {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#2563eb;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:3px solid #93c5fd;box-shadow:0 2px 6px rgba(0,0,0,0.3)">G</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map)

      marker.bindTooltip(g.label, { direction: 'top', permanent: true })
      markers.push(marker)

      bounds.extend(center)
      const edge = center.toBounds(radius + 50)
      bounds.extend(edge.getNorthEast())
      bounds.extend(edge.getSouthWest())
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }

    return () => {
      circles.forEach((c) => c.remove())
      markers.forEach((m) => m.remove())
    }
  }, [geofences, map])

  return null
}

function MapBoundsFitter({ snapshots }: { snapshots: SnapshotRow[] }) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.latLngBounds([])
    snapshots
      .filter((s) => s.latitude != null && s.longitude != null)
      .forEach((s) => bounds.extend([Number(s.latitude), Number(s.longitude)]))
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [snapshots, map])

  return null
}

function getMapCenter(snapshots: SnapshotRow[], geofences: GeofenceRow[] | undefined): [number, number] {
  if (geofences && geofences.length > 0) {
    return [Number(geofences[0].latitude), Number(geofences[0].longitude)]
  }
  const withCoords = snapshots.filter((s) => s.latitude != null && s.longitude != null)
  if (withCoords.length === 0) return [20.5937, 78.9629]
  const avgLat = withCoords.reduce((a, s) => a + Number(s.latitude), 0) / withCoords.length
  const avgLng = withCoords.reduce((a, s) => a + Number(s.longitude), 0) / withCoords.length
  return [avgLat, avgLng]
}

export function LocationMapCard() {
  const emp = useAuthStore((s) => s.employee)
  const [days, setDays] = useState(0)
  const [actionFilter, setActionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['location-snapshots', 'self', emp?.id, days],
    queryFn: async () => {
      if (!emp?.id) return []
      const since = days === 0
        ? new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'
        : new Date(Date.now() - days * 86400000).toISOString()
      const { data, error } = await supabase
        .from('location_snapshots')
        .select('*, employee:employees!employee_id(first_name, last_name)')
        .eq('employee_id', emp.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as SnapshotRow[]
    },
    enabled: !!emp?.id,
  })

  const { data: geofences } = useQuery({
    queryKey: ['geofence-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geofence_config')
        .select('id, label, latitude, longitude, radius_meters')
        .eq('is_active', true)
      if (error) throw error
      console.log('[LocationMapCard] geofences loaded:', data)
      return (data ?? []) as GeofenceRow[]
    },
  })

  const filtered = useMemo(() => {
    if (!snapshots) return []
    return snapshots.filter((s) => {
      if (actionFilter !== 'all' && s.action !== actionFilter) return false
      if (statusFilter === 'successful' && !s.successful) return false
      if (statusFilter === 'blocked' && s.successful) return false
      return true
    })
  }, [snapshots, actionFilter, statusFilter])

  const center = useMemo(() => getMapCenter(filtered, geofences), [filtered, geofences])

  const total = filtered.length
  const successful = filtered.filter((s) => s.successful).length
  const blocked = filtered.filter((s) => !s.successful).length

  const hasCoords = (s: SnapshotRow) => s.latitude != null && s.longitude != null

  const DAYS_OPTIONS = [
    { value: 0, label: 'Today' },
    { value: 1, label: '1D' },
    { value: 7, label: '7D' },
    { value: 30, label: '30D' },
  ] as const

  const recent = useMemo(() => filtered.slice(0, 10), [filtered])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location History
            {geofences && geofences.length > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {geofences.length} geofence{geofences.length > 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {DAYS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={days === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDays(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="check_in">Check-In</SelectItem>
                <SelectItem value="check_out">Check-Out</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Activity className="h-3 w-3" /> Total
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <p className="text-lg font-bold text-green-600">{successful}</p>
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Success
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <p className="text-lg font-bold text-red-600">{blocked}</p>
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" /> Blocked
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            {isLoading ? (
              <Skeleton className="h-[300px] rounded-lg" />
            ) : (
              <div className="h-[300px] rounded-lg border overflow-hidden relative">
                <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom={true}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeofenceLayer geofences={geofences} />
                  {filtered.length > 0 && <MapBoundsFitter snapshots={filtered} />}
                  {filtered.filter(hasCoords).map((s) => (
                    <Marker
                      key={s.id}
                      position={[Number(s.latitude), Number(s.longitude)]}
                      icon={s.successful
                        ? (s.action === 'check_in' ? icons.checkIn : icons.checkOut)
                        : icons.failed}
                    >
                      <Tooltip direction="top">
                        {s.employee?.first_name} {s.employee?.last_name}
                      </Tooltip>
                      <Popup>
                        <div className="text-xs space-y-1 min-w-[140px]">
                          <p className="font-semibold">
                            {s.employee?.first_name} {s.employee?.last_name}
                          </p>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant={s.successful ? 'default' : 'destructive'} className="text-[10px] px-1 py-0">
                              {s.successful ? 'Successful' : s.error_code ?? 'Failed'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {s.action === 'check_in' ? 'Check-In' : 'Check-Out'}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{formatTime(s.created_at)}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {Number(s.latitude).toFixed(6)}, {Number(s.longitude).toFixed(6)}
                          </p>
                          {s.inside_geofence != null && (
                            <p className={s.inside_geofence ? 'text-green-600' : 'text-red-600'}>
                              {s.inside_geofence ? '✓ Inside geofence zone' : '✗ Outside geofence zone'}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
                <p className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/60 bg-background/80 px-2 py-0.5 rounded pointer-events-none z-[1000]">
                  Scroll to zoom · Drag to pan
                </p>
              </div>
            )}
            {geofences && geofences.length > 0 && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing geofence zone — no check-in/out data for this period
              </p>
            )}
          </div>

          <div className="hidden lg:block">
            <div className="h-[300px] rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                Recent ({recent.length})
              </div>
              <ScrollArea className="h-[calc(300px-33px)]">
                <div className="space-y-1 p-2">
                  {recent.map((s) => (
                    <div key={s.id} className="rounded border p-2 text-[11px] leading-tight">
                      <div className="flex items-center gap-1 mb-0.5">
                        {s.successful
                          ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          : <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                        }
                        <span className="font-medium">
                          {s.employee?.first_name}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                          {s.action === 'check_in' ? 'IN' : 'OUT'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{formatTime(s.created_at)}</p>
                      {!s.successful && s.error_code && (
                        <p className="text-red-500">{s.error_code}</p>
                      )}
                      {s.inside_geofence != null && (
                        <p className={s.inside_geofence ? 'text-green-600' : 'text-red-600'}>
                          {s.inside_geofence ? '✓ zone' : '✗ zone'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
