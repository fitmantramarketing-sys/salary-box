import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import type { LocationSnapshot } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { Clock, MapPin, Smartphone, XCircle, CheckCircle2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

const checkInIcon = L.divIcon({
  className: 'custom-marker-checkin',
  html: `<div style="background:#22c55e;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">CI</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const checkOutIcon = L.divIcon({
  className: 'custom-marker-checkout',
  html: `<div style="background:#3b82f6;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">CO</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const failedIcon = L.divIcon({
  className: 'custom-marker-failed',
  html: `<div style="background:#ef4444;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">!</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

interface SnapshotWithEmployee extends LocationSnapshot {
  employee?: { first_name: string; last_name: string } | null
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
    .limit(200)
  if (error) throw error
  return (data ?? []) as SnapshotWithEmployee[]
}

export default function LocationHistoryPage() {
  const actor = useAuthStore((s) => s.employee)
  const [days, setDays] = useState(7)

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['location-snapshots', days],
    queryFn: () => fetchSnapshots(days),
  })

  const hasCoords = (s: LocationSnapshot) => s.latitude != null && s.longitude != null
  const withCoords = snapshots?.filter(hasCoords) ?? []
  const allList = snapshots ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Location History</h1>
        <div className="flex gap-2">
          {[1, 3, 7, 30].map((d) => (
            <Button key={d} variant={days === d ? 'default' : 'outline'} size="sm" onClick={() => setDays(d)}>
              {d === 1 ? 'Today' : `${d}d`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Map View
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <Skeleton className="h-[400px] w-full rounded-none" />
            ) : withCoords.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
                No location snapshots in this period.
              </div>
            ) : (
              <div className="h-[400px] w-full">
                <MapContainer
                  center={[withCoords[0].latitude!, withCoords[0].longitude!]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {withCoords.map((s) => (
                    <Marker
                      key={s.id}
                      position={[s.latitude!, s.longitude!]}
                      icon={!s.successful ? failedIcon : s.action === 'check_in' ? checkInIcon : checkOutIcon}
                    >
                      <Tooltip>
                        {s.employee && 'employee' in s
                          ? `${(s as SnapshotWithEmployee).employee?.first_name ?? ''} ${(s as SnapshotWithEmployee).employee?.last_name ?? ''}`
                          : actor?.first_name} — {s.action === 'check_in' ? 'Check-In' : 'Check-Out'}
                      </Tooltip>
                      <Popup>
                        <div className="text-xs space-y-1">
                          <p className="font-medium">
                            {s.employee && 'employee' in s
                              ? `${(s as SnapshotWithEmployee).employee?.first_name ?? ''} ${(s as SnapshotWithEmployee).employee?.last_name ?? ''}`
                              : 'Unknown'}
                          </p>
                          <p>{s.action === 'check_in' ? 'Check-In' : 'Check-Out'}</p>
                          <p>{new Date(s.created_at).toLocaleString('en-IN')}</p>
                          <p>Lat: {Number(s.latitude).toFixed(5)}, Lng: {Number(s.longitude).toFixed(5)}</p>
                          {s.successful ? (
                            <span className="text-green-600 font-medium">Successful</span>
                          ) : (
                            <span className="text-red-600 font-medium">Blocked: {s.error_code}</span>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Attempts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : allList.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No snapshots.</p>
            ) : (
              <ScrollArea className="h-[352px]">
                <div className="divide-y">
                  {allList.map((s) => (
                    <div key={s.id} className="px-4 py-3 text-sm space-y-1 hover:bg-accent/50">
                      <div className="flex items-center gap-2">
                        {s.successful ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium">
                          {s.action === 'check_in' ? 'Check-In' : 'Check-Out'}
                        </span>
                        {!s.successful && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">{s.error_code}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Smartphone className="h-3 w-3" />
                        <span>{new Date(s.created_at).toLocaleString('en-IN')}</span>
                      </div>
                      {s.latitude != null && (
                        <p className="text-[11px] text-muted-foreground">
                          {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
                          {s.inside_geofence ? ' ✓ geofence' : ' ✗ geofence'}
                        </p>
                      )}
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
