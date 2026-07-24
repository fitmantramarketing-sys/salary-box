import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, ArrowLeft, Copy, Check, Upload, Banknote, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateEmployee, useUploadDocument } from '@/features/employees/mutations'
import { supabase } from '@/lib/supabase'
import type { CreateEmployeeResponse } from '@/types'
import { useDepartments, useDesignations, useActiveManagers } from '@/features/employees/hooks'
import { createEmployeeSchema, type CreateEmployeeForm } from '@/features/employees/schemas'
import { useLeaveTypes } from '@/features/leave/hooks'

const DOC_TYPES = [
  { value: 'aadhar', label: 'Aadhar' },
  { value: 'pan', label: 'PAN' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'appointment_letter', label: 'Appointment Letter' },
  { value: 'experience_letter', label: 'Experience Letter' },
  { value: 'other', label: 'Other' },
] as const

export default function NewEmployeePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [successData, setSuccessData] = useState<CreateEmployeeResponse | null>(null)
  const [copied, setCopied] = useState(false)

  // Step 3 — Document
  const [docType, setDocType] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)

  // Step 4 — Bank details
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [bankName, setBankName] = useState('')

  // Step 5 — Leave allocations
  const { data: leaveTypes = [] } = useLeaveTypes()
  const [leaveAllocations, setLeaveAllocations] = useState<Record<string, number>>({})

  const queryClient = useQueryClient()
  const createEmployee = useCreateEmployee()
  const uploadDocument = useUploadDocument()
  const { data: departments = [] } = useDepartments()
  const { data: designations = [] } = useDesignations()
  const { data: managers = [] } = useActiveManagers()

  const form = useForm<CreateEmployeeForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: undefined,
      personal_email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      guardian_name: '',
      guardian_phone: '',
      guardian_email: '',
      department_id: undefined,
      designation_id: undefined,
      reporting_manager_id: undefined,
      role: 'employee',
      employment_type: 'full_time',
      join_date: '',
      probation_end_date: '',
      current_salary: undefined,
    },
  })

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function onSubmit(values: CreateEmployeeForm) {
    try {
      const leaveAllocPayload = Object.entries(leaveAllocations)
        .filter(([, days]) => days > 0)
        .map(([leave_type_id, days]) => ({ leave_type_id, days }))
      const payload = {
        ...values,
        emergency_contact_name: values.guardian_name,
        emergency_contact_phone: values.guardian_phone,
        leave_allocations: leaveAllocPayload,
      } as CreateEmployeeForm & { emergency_contact_name: string; emergency_contact_phone: string }
      const result = await createEmployee.mutateAsync(payload) as CreateEmployeeResponse

      // Upload document if one was chosen
      if (docFile && docType && result.employee_id) {
        const fd = new FormData()
        fd.append('employee_id', result.employee_id)
        fd.append('document_type', docType)
        fd.append('file', docFile)
        try {
          await uploadDocument.mutateAsync(fd)
        } catch {
          toast.error('Team member created but document upload failed')
        }
      }

      // Save bank details if provided
      if (accountNumber && accountHolder && ifscCode && bankName && result.employee_id) {
        const { error: bankError } = await supabase
          .from('employee_bank_details')
          .upsert({
            employee_id: result.employee_id,
            account_number_encrypted: accountNumber,
            account_number_last4: accountNumber.slice(-4),
            ifsc_code: ifscCode.toUpperCase(),
            bank_name: bankName,
            account_holder_name: accountHolder,
            is_active: true,
          })
        if (bankError) {
          toast.error('Team member created but bank details failed to save')
        } else {
          queryClient.invalidateQueries({ queryKey: ['employees', 'bank', result.employee_id] })
          queryClient.invalidateQueries({ queryKey: ['employees', 'detail', result.employee_id] })
        }
      }

      setSuccessData(result)
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Failed to create employee')
    }
  }

  const steps = ['Personal Info', 'Job Details', 'Documents', 'Bank Details', 'Leave Allocations']
  const isLastStep = step === steps.length - 1

  function nextStep() {
    if (step === 0) {
      form.trigger(['first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender', 'personal_email', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'guardian_name', 'guardian_phone', 'guardian_email'] as const).then((v) => { if (v) setStep(step + 1) })
    } else if (step === 1) {
      form.trigger(['department_id', 'designation_id', 'reporting_manager_id', 'role', 'employment_type', 'join_date', 'probation_end_date', 'current_salary'] as const).then((v) => { if (v) setStep(step + 1) })
    } else if (step < steps.length - 1) {
      setStep(step + 1)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/team-members')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Add Team Member</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Step {step + 1} of {steps.length}: {steps[step]}
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
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
                  <FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender *</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || undefined)}>
                        <option value="">Select...</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="personal_email" render={({ field }) => (
                  <FormItem><FormLabel>Personal Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guardian_name" render={({ field }) => (
                  <FormItem><FormLabel>Guardian Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guardian_phone" render={({ field }) => (
                  <FormItem><FormLabel>Guardian Contact Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guardian_email" render={({ field }) => (
                  <FormItem><FormLabel>Guardian Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
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
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="department_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || undefined)}>
                        <option value="">Select...</option>
                        {departments.filter(d => d.is_active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="designation_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || undefined)}>
                        <option value="">Select...</option>
                        {designations.filter(d => d.is_active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reporting_manager_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reporting Manager</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || undefined)}>
                        <option value="">Select...</option>
                        {managers.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                        <option value="employee">Team Member</option>
                        <option value="hr">HR</option>
                        <option value="owner">Owner</option>
                        <option value="system_admin">System Admin</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="employment_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Type</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                        <option value="full_time">Full Time</option>
                        <option value="part_time">Part Time</option>
                        <option value="contractor">Contractor</option>
                        <option value="intern">Intern</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="join_date" render={({ field }) => (
                  <FormItem><FormLabel>Join Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="probation_end_date" render={({ field }) => (
                  <FormItem><FormLabel>Probation End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="current_salary" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Salary (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle><Upload className="mr-2 inline h-5 w-5" />Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload an initial document for the employee (optional). More documents can be added later.
                </p>
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger><SelectValue placeholder="Select type (optional)" /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File (PDF, JPEG, PNG max 5MB)</Label>
                  <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} accept=".pdf,.jpg,.jpeg,.png" />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle><Banknote className="mr-2 inline h-5 w-5" />Bank Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add bank details for salary processing (optional). Can be added later.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank-holder">Account Holder Name</Label>
                    <Input id="bank-holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-number">Account Number</Label>
                    <Input id="bank-number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-number-confirm">Confirm Account Number</Label>
                    <Input id="bank-number-confirm" value={confirmAccountNumber} onChange={(e) => setConfirmAccountNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-ifsc">IFSC Code</Label>
                    <Input id="bank-ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} placeholder="e.g. HDFC0001234" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle><Calendar className="mr-2 inline h-5 w-5" />Leave Allocations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set the yearly paid leave allocation for this employee. These days will be available for the current calendar year.
                </p>
                {leaveTypes.filter((lt) => !lt.is_lwp).length === 0 && (
                  <p className="text-sm text-muted-foreground">No paid leave types configured yet. Create leave types in Settings first.</p>
                )}
                {leaveTypes.filter((lt) => !lt.is_lwp).map((lt) => (
                  <div key={lt.id} className="flex items-center gap-4 rounded-md border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{lt.name} ({lt.code})</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        className="w-20 text-center"
                        placeholder="Days"
                        value={leaveAllocations[lt.id] ?? ''}
                        onChange={(e) =>
                          setLeaveAllocations((prev) => ({
                            ...prev,
                            [lt.id]: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">days/year</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate('/team-members')}>
              {step > 0 ? 'Previous' : 'Cancel'}
            </Button>

            {isLastStep ? (
              <Button type="button" disabled={createEmployee.isPending} onClick={form.handleSubmit(onSubmit)}>
                {createEmployee.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                ) : 'Create Team Member'}
              </Button>
            ) : (
              <Button type="button" onClick={nextStep}>Next</Button>
            )}
          </div>
        </form>
      </Form>

      <Dialog open={!!successData} onOpenChange={(open) => { if (!open) { setSuccessData(null); navigate('/team-members') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Team Member Created</DialogTitle>
            <DialogDescription>
              {successData?.employee_code} has been created successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-1 text-sm font-medium text-muted-foreground">Temporary Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono">
                  {successData?.temporary_password}
                </code>
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(successData!.temporary_password)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this password with the employee. They will be prompted to set a new password on first login.
            </p>
            <Button className="w-full" onClick={() => { setSuccessData(null); navigate('/team-members') }}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
