import { getActor, assertRole } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { ok, err, cors, handleError } from '../_shared/response.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])

    const formData = await req.formData()
    const employeeId = formData.get('employee_id') as string
    const documentType = formData.get('document_type') as string
    const file = formData.get('file') as File | null
    const force = formData.get('force') === 'true'
    const overrideReason = formData.get('override_reason') as string | null

    if (!employeeId || !documentType || !file) {
      return err('VALIDATION_ERROR', 'employee_id, document_type, and file are required', 400)
    }

    const allowedTypes = ['aadhar', 'pan', 'passport_photo']
    if (!allowedTypes.includes(documentType)) {
      return err('VALIDATION_ERROR', `document_type must be one of: ${allowedTypes.join(', ')}`, 400)
    }

    if (actor.actorRole === 'employee' && employeeId !== actor.actorId) {
      return err('FORBIDDEN', 'Employees can only upload documents for themselves', 403)
    }

    const validMimes = ['application/pdf', 'image/jpeg', 'image/png']
    if (!validMimes.includes(file.type)) {
      return err('VALIDATION_ERROR', 'Only PDF, JPEG, and PNG files are allowed', 400)
    }

    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return err('VALIDATION_ERROR', 'File size must be under 5MB', 400)
    }

    const fileBytes = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBytes)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const documentHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    const supabase = getServiceClient()

    if (documentType === 'pan' || documentType === 'aadhar') {
      const { data: existing } = await supabase
        .from('employee_documents')
        .select('employee_id')
        .eq('document_type', documentType)
        .eq('document_hash', documentHash)
        .eq('is_active', true)
        .maybeSingle()

      if (existing) {
        if (actor.actorRole === 'owner' && force) {
          if (overrideReason) {
            await supabase.from('audit_logs').insert({
              action: 'PAN_DUPLICATE_OVERRIDE',
              actor_id: actor.actorId,
              target_type: 'employee_documents',
              details: { employee_id: employeeId, document_type: documentType, override_reason: overrideReason },
            })
          }
        } else {
          return err('DUPLICATE', `A ${documentType} document with the same content already exists for employee ${existing.employee_id}`, 409)
        }
      }
    }

    const ext = file.name.split('.').pop() ?? 'bin'
    const storagePath = `employee-documents/${employeeId}/${crypto.randomUUID()}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('employee-documents')
      .upload(storagePath, file)

    if (storageError) {
      console.error('Storage upload error:', storageError)
      return err('INTERNAL_ERROR', 'Failed to upload file to storage', 500)
    }

    const { data: doc, error: insertError } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: employeeId,
        document_type: documentType,
        file_name: file.name,
        storage_path: storagePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        document_hash: documentHash,
        uploaded_by: actor.actorId,
      })
      .select('id, storage_path')
      .single()

    if (insertError || !doc) {
      console.error('Document insert error:', insertError)
      await supabase.storage.from('employee-documents').remove([storagePath])
      return err('INTERNAL_ERROR', 'Failed to save document record', 500)
    }

    return ok({ document_id: doc.id, storage_path: doc.storage_path }, 201)
  } catch (e) {
    return handleError(e)
  }
})
