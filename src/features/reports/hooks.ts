import { useQuery } from '@tanstack/react-query'
import {
  fetchAttendanceReport,
  fetchHeatmapData,
  fetchHeadcountReport,
  fetchRegularizationLog,
  fetchSelfAttendance,
  fetchAbsenteeismData,
  fetchDepartments,
} from './api'

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  })
}

export function useAttendanceReport(year: number, month: number, departmentId?: string) {
  return useQuery({
    queryKey: ['reports', 'attendance', year, month, departmentId],
    queryFn: () => fetchAttendanceReport(year, month, departmentId),
  })
}

export function useHeatmapData(year: number, month: number, departmentIds?: string[]) {
  return useQuery({
    queryKey: ['reports', 'heatmap', year, month, departmentIds],
    queryFn: () => fetchHeatmapData(year, month, departmentIds),
  })
}

export function useHeadcountReport(departmentId?: string, employmentStatus?: string, employmentType?: string) {
  return useQuery({
    queryKey: ['reports', 'headcount', departmentId, employmentStatus, employmentType],
    queryFn: () => fetchHeadcountReport(departmentId, employmentStatus, employmentType),
  })
}

export function useRegularizationLog(dateFrom?: string, dateTo?: string, departmentId?: string, status?: string) {
  return useQuery({
    queryKey: ['reports', 'regularization', dateFrom, dateTo, departmentId, status],
    queryFn: () => fetchRegularizationLog(dateFrom, dateTo, departmentId, status),
  })
}

export function useAbsenteeismData(year: number, month: number, departmentId?: string) {
  return useQuery({
    queryKey: ['reports', 'absenteeism', year, month, departmentId],
    queryFn: () => fetchAbsenteeismData(year, month, departmentId),
  })
}

export function useSelfAttendance(employeeId: string, year: number, month: number) {
  return useQuery({
    queryKey: ['reports', 'self-attendance', employeeId, year, month],
    queryFn: () => fetchSelfAttendance(employeeId, year, month),
    enabled: !!employeeId,
  })
}
