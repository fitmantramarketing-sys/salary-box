import { ok, cors, handleError } from '../_shared/response.ts'
import { checkIpWhitelist } from '../_shared/ip.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return cors()
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const result = await checkIpWhitelist(clientIp)
    return ok({ whitelisted: result.allowed })
  } catch (e) {
    return handleError(e)
  }
})
