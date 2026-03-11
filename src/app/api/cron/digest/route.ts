import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOpenAIClient } from '@/lib/openai'
import { getGoalsSummary } from '@/lib/goals'
import { fetchUnreadEmails, fetchTodayEvents, sendEmailToSelf } from '@/lib/google'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all users with Google connected and digest enabled
  const googleAccounts = await prisma.googleAccount.findMany({
    include: { user: true },
  })

  let sent = 0

  for (const account of googleAccounts) {
    const userId = account.userId
    const settings = account.user.settings ? JSON.parse(account.user.settings) : {}

    // Check if digest is enabled (default: true for all connected users)
    if (settings.digestEnabled === false) continue

    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY
    if (!apiKey) continue

    try {
      // Gather data
      const timezone = account.user.timezone || 'America/Denver'
      const [emails, events, goalsSummary, pendingCount] = await Promise.all([
        fetchUnreadEmails(userId, 10),
        fetchTodayEvents(userId, timezone),
        getGoalsSummary(userId),
        prisma.approvalItem.count({ where: { status: 'pending', agent: { userId } } }),
      ])

      const emailSummary = emails.length > 0
        ? emails.map(e => `- From: ${e.from.replace(/<.*>/, '').trim()} | Subject: ${e.subject}`).join('\n')
        : 'No unread emails in primary inbox.'

      const calendarSummary = events.length > 0
        ? events.map(e => {
            const time = e.isAllDay ? 'All day' : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            const attendeeCount = e.attendees.length
            return `- ${time}: ${e.summary}${attendeeCount > 0 ? ` (${attendeeCount} attendees)` : ''}`
          }).join('\n')
        : 'No events today.'

      const context = `
USER: ${account.user.name}
DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

GOALS:
${goalsSummary}

TODAY'S CALENDAR (${events.length} events):
${calendarSummary}

UNREAD EMAILS (${emails.length}):
${emailSummary}

PENDING ITEMS IN QUEUE: ${pendingCount}
      `.trim()

      const openai = getOpenAIClient(apiKey)
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a Chief of Staff writing a morning briefing email. Be direct, concise, and actionable.

Format your response in these sections:
- TODAY'S PRIORITIES — What needs attention first, based on calendar and emails
- SCHEDULE — Quick rundown of today's events with any prep notes
- EMAIL HIGHLIGHTS — Key emails that need a response, with suggested action
- HEADS UP — Anything worth noting (pending items, follow-ups due)

Rules:
- Address the user by first name
- Keep it scannable — short bullets, not paragraphs
- Be opinionated about what matters
- Total under 300 words`,
          },
          { role: 'user', content: context },
        ],
        temperature: 0.7,
        max_tokens: 800,
      })

      const briefing = response.choices[0]?.message?.content || ''
      if (!briefing) continue

      // Format as HTML email
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      const htmlBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
  <div style="background: linear-gradient(135deg, #0d9488, #0f766e); padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Your Morning Briefing</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">${dateStr}</p>
  </div>
  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <div style="white-space: pre-wrap; line-height: 1.7; font-size: 14px;">${briefing.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^- /gm, '&bull; ')}</div>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">AI Chief of Staff &bull; <a href="${process.env.NEXTAUTH_URL || 'https://my-ai-chief-of-staff.vercel.app'}" style="color: #0d9488;">Open Dashboard</a></p>
  </div>
</div>`

      await sendEmailToSelf(userId, `Morning Briefing — ${dateStr}`, htmlBody)
      sent++
    } catch (err) {
      console.error(`Digest failed for user ${userId}:`, err)
    }
  }

  return NextResponse.json({ sent, total: googleAccounts.length })
}
