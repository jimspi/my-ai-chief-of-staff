import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { getOpenAIClient } from '@/lib/openai'
import { fetchEmailBody } from '@/lib/google'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const { emailItemId } = await request.json()

    if (!emailItemId) {
      return NextResponse.json({ error: 'Missing emailItemId' }, { status: 400 })
    }

    // Get user settings for API key
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 400 })
    }

    // Fetch the approval item
    const item = await prisma.approvalItem.findUnique({
      where: { id: emailItemId },
      include: { agent: { select: { userId: true } } },
    })

    if (!item || item.agent.userId !== userId) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Extract Gmail message ID from externalId (format: "gmail-{id}")
    const gmailId = item.externalId?.replace('gmail-', '').replace('gmail-followup-', '')
    let emailBody = ''
    if (gmailId) {
      try {
        emailBody = await fetchEmailBody(userId, gmailId)
      } catch {
        // Fall back to snippet from detail
      }
    }

    const emailContent = emailBody || item.detail

    // Generate reply draft with AI
    const openai = getOpenAIClient(apiKey)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional email assistant. Draft a reply to this email on behalf of the user.
- Be concise and professional
- Match the tone of the original email
- Include a greeting and sign-off
- If the email requires a specific action, acknowledge it
- Keep it under 150 words
- Output ONLY the reply text, no metadata or explanations`,
        },
        {
          role: 'user',
          content: `Original email:\n${emailContent}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 512,
    })

    const draft = response.choices[0]?.message?.content || ''

    if (!draft) {
      return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
    }

    return NextResponse.json({ success: true, draft })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Reply draft error:', error)
    return NextResponse.json({ error: 'Failed to generate reply draft' }, { status: 500 })
  }
}
