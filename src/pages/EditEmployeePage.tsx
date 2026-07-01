import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useEmployee, useDepartments, useDesignations, useActiveManagers } from '@/features/employees/hooks'
import { useUpdateEmployee } from '@/features/employees/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { z } from 'zod'

const editEmployeeSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  personal_email: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  department_id: z.string().uuid().optional().or(z.literal('')),
  designation_id: z.string().uuid().optional().or(z.literal('')),
  reporting_manager_id: z.string().uuid().optional().or(z.literal('')),
  employment_type: z.enum(['full_time', 'part_time', 'contractor', 'intern']),
  join_date: z.string().min(1, 'Required'),
  probation_end_date: z.string().optional(),
  current_salary: z.number().positive().optional().or(z.literal('')),
})

type EditForm = z.infer<typeof editEmployeeSchema>

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: employee, isLoading: empLoading } = useEmployee(id!)
  const { data: departments = [] } = useDepartments()
  const { data: designations = [] } = useDesignations()
  const { data: managers = [] } = useActiveManagers()
  const { isOwner } = useRole()
  const updateEmployee = useUpdateEmployee()

  const form = useForm<EditForm>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
      gender: '' as EditForm['gender'], personal_email: '', address_line1: '', address_line2: '',
      city: '', state: '', pincode: '', emergency_contact_name: '', emergency_contact_phone: '',
      department_id: '', designation_id: '', reporting_manager_id: '',
      employment_type: 'full_time', join_date: '', probation_end_date: '', current_salary: '',
    },
  })

  useEffect(() => {
    if (employee) {
      form.reset({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        phone: employee.phone ?? '',
        date_of_birth: employee.date_of_birth ?? '',
        gender: (employee.gender as EditForm['gender']) ?? '',
        personal_email: employee.personal_email ?? '',
        address_line1: employee.address_line1 ?? '',
        address_line2: employee.address_line2 ?? '',
        city: employee.city ?? '',
        state: employee.state ?? '',
        pincode: employee.pincode ?? '',
        emergency_contact_name: employee.emergency_contact_name ?? '',
        emergency_contact_phone: employee.emergency_contact_phone ?? '',
        department_id: employee.department_id ?? '',
        designation_id: employee.designation_id ?? '',
        reporting_manager_id: employee.reporting_manager_id ?? '',
        employment_type: employee.employment_type,
        join_date: employee.join_date,
        probation_end_date: employee.probation_end_date ?? '',
        current_salary: employee.current_salary ?? '',
      })
    }
  }, [employee, form])

  if (empLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!employee) {
    return <p className="text-muted-foreground">Employee not found</p>
  }

  const empId = employee.id

  async function onSubmit(values: EditForm) {
    try {
      await updateEmployee.mutateAsync({
        employee_id: empId,
        ...values,
        gender: values.gender || null,
        department_id: values.department_id || null,
        designation_id: values.designation_id || null,
        reporting_manager_id: values.reporting_manager_id || null,
        date_of_birth: values.date_of_birth || null,
        probation_end_date: values.probation_end_date || null,
        current_salary: values.current_salary || null,
      })
      toast.success('Employee updated')
      navigate(`/employees/${empId}`)
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Failed to update employee')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/employees/${empId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Edit {employee.first_name} {employee.last_name}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem><FormLabel>First Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="last_name" render={({ field }) => (
                <FormItem><FormLabel>Last Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Work Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                <FormItem><FormLabel>DOB</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem><FormLabel>Gender</FormLabel><FormControl>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="personal_email" render={({ field }) => (
                <FormItem><FormLabel>Personal Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="emergency_contact_name" render={({ field }) => (
                <FormItem><FormLabel>Emergency Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="emergency_contact_phone" render={({ field }) => (
                <FormItem><FormLabel>Emergency Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="sm:col-span-2">
                <FormField control={form.control} name="address_line1" render={({ field }) => (
                  <FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="address_line2" render={({ field }) => (
                <FormItem><FormLabel>Address Line 2</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="pincode" render={({ field }) => (
                <FormItem><FormLabel>Pincode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="department_id" render={({ field }) => (
                <FormItem><FormLabel>Department</FormLabel><FormControl>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)}>
                    <option value="">Select...</option>
                    {departments.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="designation_id" render={({ field }) => (
                <FormItem><FormLabel>Designation</FormLabel><FormControl>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)}>
                    <option value="">Select...</option>
                    {designations.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="reporting_manager_id" render={({ field }) => (
                <FormItem><FormLabel>Reporting Manager</FormLabel><FormControl>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)}>
                    <option value="">Select...</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="employment_type" render={({ field }) => (
                <FormItem><FormLabel>Employment Type</FormLabel><FormControl>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="join_date" render={({ field }) => (
                <FormItem><FormLabel>Join Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="probation_end_date" render={({ field }) => (
                <FormItem><FormLabel>Probation End</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              {isOwner && (
                <FormField control={form.control} name="current_salary" render={({ field }) => (
                  <FormItem><FormLabel>Current Salary (₹)</FormLabel><FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')} />
                  </FormControl><FormMessage /></FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(`/employees/${empId}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
