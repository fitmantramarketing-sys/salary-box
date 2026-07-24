import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Users } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Employee = Database['public']['Tables']['employees']['Row']

type TreeNode = {
  employee: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_code' | 'photo_url' | 'role' | 'designation_id'>
  children: TreeNode[]
  depth: number
}

async function fetchOrgData() {
  const { data, error } = await supabase
    .from('employees')
    .select(`
      id, first_name, last_name, employee_code, photo_url, role,
      reporting_manager_id,
      designation:designations!designation_id(name)
    `)
    .eq('is_active', true)
    .order('first_name')
  if (error) throw error
  return data as unknown as (Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_code' | 'photo_url' | 'role' | 'reporting_manager_id'> & { designation: { name: string } | null })[]
}

function buildTree(
  employees: (Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_code' | 'photo_url' | 'role' | 'reporting_manager_id'> & { designation: { name: string } | null })[],
  parentId: string | null = null,
  depth = 0
): TreeNode[] {
  return employees
    .filter((e) => e.reporting_manager_id === parentId)
    .map((e) => ({
      employee: {
        id: e.id,
        first_name: e.first_name,
        last_name: e.last_name,
        employee_code: e.employee_code,
        photo_url: e.photo_url,
        role: e.role,
        designation_id: null as string | null,
      },
      children: buildTree(employees, e.id, depth + 1),
      depth,
    }))
}

function TreeNodeComponent({ node }: { node: TreeNode }) {
  const hasChildren = node.children.length > 0

  return (
    <div className="ml-6">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors">
        <Link to={`/team-members/${node.employee.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={node.employee.photo_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {node.employee.first_name[0]}{node.employee.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {node.employee.first_name} {node.employee.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{node.employee.employee_code}</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-xs">
            {node.employee.role}
          </Badge>
        </Link>
      </div>
      {hasChildren && (
        <div className="relative mt-2 space-y-2">
          <div className="absolute left-0 top-0 bottom-2 w-px bg-border" />
          {node.children.map((child) => (
            <TreeNodeComponent key={child.employee.id} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgChartPage() {
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', 'org-chart'],
    queryFn: fetchOrgData,
  })

  const tree = useMemo(() => buildTree(employees), [employees])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Organisation Chart</h1>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No team members found. Assign reporting managers to build the org chart.
          </CardContent>
        </Card>
      </div>
    )
  }

  const topLevel = tree.filter((n) => n.depth === 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Organisation Chart</h1>
      </div>
      <Card>
        <CardHeader>
            <CardTitle className="text-base">{employees.length} Active Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topLevel.map((node) => (
              <div key={node.employee.id}>
                <TreeNodeComponent node={node} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
