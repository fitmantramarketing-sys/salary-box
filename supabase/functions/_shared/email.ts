const RESEND_API_URL = 'https://api.resend.com/emails'

export async function sendEmail({
  to,
  subject,
  html,
  from = 'HR Tool <noreply@hr.fitmantra.co.in>',
}: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}
