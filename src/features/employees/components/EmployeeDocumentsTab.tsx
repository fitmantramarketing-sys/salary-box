import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Upload, Loader2, FileText, Eye, Trash2 } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/hooks/useAuth'
import { useEmployeeDocuments } from '@/features/employees/hooks'
import { useUploadDocument, useDeleteDocument } from '@/features/employees/mutations'
import { callEdgeFunction } from '@/lib/edge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PresignedUrlResponse, EmployeeDocument } from '@/types'

type Props = { employeeId: string }

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const docTypeLabels: Record<string, string> = {
  aadhar: 'Aadhar',
  pan: 'PAN',
  passport_photo: 'Passport Size Photo',
}

export function EmployeeDocumentsTab({ employeeId }: Props) {
  const { data: documents, isLoading } = useEmployeeDocuments(employeeId)
  const { isOwner, isHR } = useRole()
  const currentEmployee = useAuthStore((s) => s.employee)
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [docType, setDocType] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [deleteDoc, setDeleteDoc] = useState<EmployeeDocument | null>(null)

  const canUpload = isOwner || isHR || currentEmployee?.id === employeeId
  const canDelete = isOwner || isHR

  const uploadedTypes = new Set((documents ?? []).map((d) => d.document_type))
  const pendingTypes = Object.entries(docTypeLabels).filter(([value]) => !uploadedTypes.has(value))

  async function handlePreview(doc: EmployeeDocument) {
    setPreviewDoc(doc)
    setPreviewUrl('')
    setPreviewLoading(true)
    try {
      const result = await callEdgeFunction<{ storage_path: string; bucket: string }, PresignedUrlResponse>('generate-presigned-url', {
        storage_path: doc.storage_path,
        bucket: 'employee-documents',
      })
      setPreviewUrl(result.url)
    } catch {
      toast.error('Failed to load preview')
      setPreviewDoc(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  function closePreview() {
    setPreviewDoc(null)
    setPreviewUrl('')
  }

  async function handleDownload(doc: NonNullable<typeof documents>[number]) {
    setDownloading(doc.id)
    try {
      const result = await callEdgeFunction<{ storage_path: string; bucket: string }, PresignedUrlResponse>('generate-presigned-url', {
        storage_path: doc.storage_path,
        bucket: 'employee-documents',
      })
      window.open(result.url, '_blank')
    } catch {
      toast.error('Failed to download document')
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete() {
    if (!deleteDoc) return
    try {
      await deleteMutation.mutateAsync({ document_id: deleteDoc.id, employee_id: employeeId })
      toast.success('Document deleted')
      setDeleteDoc(null)
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Failed to delete document')
    }
  }

  async function handleUpload() {
    if (!file || !docType) return
    const formData = new FormData()
    formData.append('employee_id', employeeId)
    formData.append('document_type', docType)
    formData.append('file', file)
    try {
      await uploadMutation.mutateAsync(formData)
      toast.success('Document uploaded')
      setUploadOpen(false)
      setFile(null)
      setDocType('')
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message ?? 'Failed to upload')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Documents</CardTitle>
        {canUpload && pendingTypes.length > 0 && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Upload className="mr-2 h-4 w-4" />Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Document Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {pendingTypes.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>File (PDF, JPEG, PNG max 5MB)</Label>
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept=".pdf,.jpg,.jpeg,.png" />
                </div>
                <Button className="w-full" onClick={handleUpload} disabled={!file || !docType || uploadMutation.isPending}>
                  {uploadMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : 'Upload'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents…</p>
        ) : documents?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {documents?.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {docTypeLabels[doc.document_type] ?? doc.document_type} &middot; {formatFileSize(doc.file_size_bytes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handlePreview(doc)} disabled={previewLoading}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} disabled={downloading === doc.id}>
                    {downloading === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                  {canDelete && (
                    <AlertDialog open={deleteDoc?.id === doc.id} onOpenChange={(open) => { if (!open) setDeleteDoc(null) }}>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteDoc(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove &ldquo;{doc.file_name}&rdquo;. After deletion, this document type can be uploaded again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) closePreview() }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">
              {previewDoc ? `${docTypeLabels[previewDoc.document_type] ?? previewDoc.document_type} — ${previewDoc.file_name}` : 'Preview'}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto rounded border bg-muted/30">
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl && previewDoc?.mime_type?.startsWith('image/') ? (
              <img src={previewUrl} alt={previewDoc.file_name} className="w-full object-contain" />
            ) : previewUrl ? (
              <iframe title="Document preview" src={previewUrl} className="h-[70vh] w-full" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}