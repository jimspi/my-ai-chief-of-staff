import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { getOpenAIClient } from '@/lib/openai'
import { fetchEmailsFromSenders } from '@/lib/google'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const { calendarItemId } = await request.json()

    if (!calendarItemId) {
      return NextResponse.json({ error: 'Missing calendarItemId' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 400 })
    }

    // Fetch the calendar approval item
    const item = await prisma.approvalItem.findUnique({
      where: { id: calendarItemId },
      include: { agent: { select: { userId: true } } },
    })

    if (!item || item.agent.userId !== userId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Extract attendees from the item detail
    const attendeesMatch = item.detail.match(/Attendees: (.+)/)
    const attendees = attendeesMatch
      ? attendeesMatch[1].split(',').map(e => e.trim()).filter(Boolean)
      : []

    // Fetch recent emails from attendees
    let emailContext = 'No recent email history with attendees.'
    if (attendees.length > 0) {
      const emails = await fetchEmailsFromSenders(userId, attendees, 15)
      if (emails.length > 0) {
        emailContext = emails
          .map(e => `From: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nSnippet: ${e.snippet}`)
          .join('\n---\n')
      }
    }

    const openai = getOpenAIClient(apiKey)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a meeting prep assistant. Create a concise briefing for an upcoming meeting.

Your briefing should include:
1. **Context** — What this meeting is likely about based on the title, description, and email history
2. **Key threads** — Summary of recent email conversations with attendees (what was discussed, any open items)
3. **Talking points** — 3-5 suggested topics or questions to bring up
4. **Action items** — Any unresolved items from emails that should be addressed

Rules:
- Be concise, use bullet points
- If there's no email history, focus on the meeting details and suggest general prep
- Keep it under 300 words`,
        },
        {
          role: 'user',
          content: `Meeting details:\n${item.detail}\n\nRecent email history with attendees:\n${emailContext}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const prep = response.choices[0]?.message?.content || 'Unable to generate meeting prep.'

    return NextResponse.json({ prep })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Meeting prep error:', error)
    return NextResponse.json({ error: 'Failed to generate meeting prep' }, { status: 500 })
  }
}
