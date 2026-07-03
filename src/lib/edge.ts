import { supabase } from './supabase'

/**
 * Returns a fresh access token, refreshing the session if the current
 * token is expired or about to expire (within 60 seconds).
 */
async function getFreshToken(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session) throw { code: 'UNAUTHORIZED', message: 'Not authenticated' }

  // Check if token expires within the next 60 seconds
  const expiresAt = session.expires_at // unix timestamp in seconds
  const nowSec = Math.floor(Date.now() / 1000)

  if (expiresAt && expiresAt - nowSec < 60) {
    // Token expired or about to expire — force refresh
    const { data: refreshed, error } = await supabase.auth.refreshSession()
    if (error || !refreshed.session) {
      throw { code: 'UNAUTHORIZED', message: 'Session expired. Please sign in again.' }
    }
    return refreshed.session.access_token
  }

  return session.access_token
}

export async function callEdgeFunction<TBody, TResponse>(
  functionName: string,
  body: TBody
): Promise<TResponse> {
  const token = await getFreshToken()

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  )

  const json = await res.json()
  if (!res.ok) throw json.error
  return json.data as TResponse
}

export async function getPresignedUrl(storagePath: string, bucket: string = 'employee-documents') {
  return callEdgeFunction<{ storage_path: string; bucket: string }, { url: string; expires_at: string }>(
    'generate-presigned-url',
    { storage_path: storagePath, bucket }
  )
}

export async function callEdgeFunctionFormData<TResponse>(
  functionName: string,
  formData: FormData
): Promise<TResponse> {
  const token = await getFreshToken()

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  )

  const json = await res.json()
  if (!res.ok) throw json.error
  return json.data as TResponse
}
