import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, ArrowLeft, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBulkImport, type BulkImportResult } from '@/features/employees/mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const CSV_TEMPLATE = `first_name,last_name,email,employment_type,join_date,phone,gender,date_of_birth,department_name,designation_name,reporting_manager_email,current_salary,probation_end_date`

export default function BulkImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const bulkImport = useBulkImport()

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'team-member-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleUpload() {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await bulkImport.mutateAsync(formData)
      setResult(res)
      if (res.success_count > 0) {
        toast.success(`${res.success_count} team member(s) imported`)
      }
      if (res.failure_count > 0) {
        toast.error(`${res.failure_count} row(s) had errors`)
      }
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Import failed')
    }
  }

  function reset() {
    setFile(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/team-members')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Bulk Import Team Members</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Step 1: Download Template</CardTitle>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />Download CSV Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Required columns: <code className="rounded bg-muted px-1">first_name</code>,{' '}
            <code className="rounded bg-muted px-1">last_name</code>,{' '}
            <code className="rounded bg-muted px-1">email</code>,{' '}
            <code className="rounded bg-muted px-1">employment_type</code>,{' '}
            <code className="rounded bg-muted px-1">join_date</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2: Upload Filled CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-primary-foreground"
            />
            <Button onClick={handleUpload} disabled={!file || bulkImport.isPending}>
              {bulkImport.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</> : 'Import'}
            </Button>
          </div>

          {file && !result && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Results</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700">{result.success_count} success</Badge>
                {result.failure_count > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-700">{result.failure_count} failed</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.success_count > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {result.success_count} of {result.total_rows} team member(s) imported successfully.
              </div>
            )}

            {result.failures.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-red-700 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> {result.failures.length} error(s):
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.failures.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span>
                        <strong>Row {f.row}:</strong> {f.error}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={reset}>
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
