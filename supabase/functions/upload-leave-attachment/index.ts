import { getActor, assertRole } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { ok, err, cors, handleError } from '../_shared/response.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()

  try {
    const actor = await getActor(req)
    assertRole(actor, ['owner', 'hr', 'employee'])

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return err('VALIDATION_ERROR', 'file is required', 400)
    }

    if (file.size > 5 * 1024 * 1024) {
      return err('VALIDATION_ERROR', 'File size must be under 5MB', 400)
    }

    const validMimes = ['application/pdf', 'image/jpeg', 'image/png']
    if (!validMimes.includes(file.type)) {
      return err('VALIDATION_ERROR', 'Only PDF, JPEG, and PNG files are allowed', 400)
    }

    const ext = file.name.split('.').pop() ?? 'bin'
    const storagePath = `leave-attachments/${actor.actorId}/${crypto.randomUUID()}.${ext}`



    const supabase = getServiceClient()

    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(storagePath, file)

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return err('INTERNAL_ERROR', 'Failed to upload file', 500)
    }

    return ok({ storage_path: storagePath, file_name: file.name }, 201)
  } catch (e) {
    return handleError(e)
  }
})
