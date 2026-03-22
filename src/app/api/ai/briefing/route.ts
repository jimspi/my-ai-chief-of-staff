import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { getOpenAIClient } from '@/lib/openai'
import { getGoalsSummary } from '@/lib/goals'
import { fetchUnreadEmails, fetchTodayEvents } from '@/lib/google'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const body = await request.json()

    // Get user settings for API key
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add it in Settings or set the OPENAI_API_KEY environment variable on Vercel.' },
        { status: 400 }
      )
    }

    const timezone = user?.timezone || 'America/Denver'
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Fetch everything in parallel — including live Google data for reliability
    const [
      agents,
      pendingContent,
      recentApproved,
      recentDenied,
      weekActivity,
      goalsSummary,
      liveEmails,
      liveEvents,
    ] = await Promise.all([
      prisma.agent.findMany({
        where: { userId },
        select: { name: true, category: true, status: true, lastScannedAt: true, externalUrl: true, approvalRate: true, avgRelevance: true },
      }),
      prisma.approvalItem.findMany({
        where: { status: 'pending', agent: { userId } },
        include: { agent: { select: { name: true } } },
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.approvalItem.count({
        where: { status: 'approved', agent: { userId }, resolvedAt: { gte: since7d } },
      }),
      prisma.approvalItem.count({
        where: { status: 'denied', agent: { userId }, resolvedAt: { gte: since7d } },
      }),
      prisma.activityLog.count({
        where: { agent: { userId }, createdAt: { gte: since7d } },
      }),
      getGoalsSummary(userId),
      // Live Google data — always fetch so briefing has real data even if sync pipeline failed
      fetchUnreadEmails(userId, 15).catch(() => []),
      fetchTodayEvents(userId, timezone).catch(() => []),
    ])

    const highUrgency = pendingContent.filter(c => c.urgency === 'high')
    const staleAgents = agents.filter(a => {
      if (!a.externalUrl || a.status !== 'active') return false
      if (!a.lastScannedAt) return true
      return (Date.now() - new Date(a.lastScannedAt).getTime()) > 24 * 60 * 60 * 1000
    })

    // Group triaged items by suggested action
    const byAction = { approve: [] as string[], review: [] as string[], dismiss: [] as string[], escalate: [] as string[] }
    for (const c of pendingContent) {
      const sa = (c.suggestedAction || 'review') as keyof typeof byAction
      if (byAction[sa]) {
        byAction[sa].push(`${c.agent.name}: ${c.action} (relevance: ${c.relevanceScore ?? '?'}/10${c.goalAlignment && c.goalAlignment !== 'none' ? `, goal: ${c.goalAlignment}` : ''})`)
      }
    }

    const approvalRate = recentApproved + recentDenied > 0
      ? Math.round((recentApproved / (recentApproved + recentDenied)) * 100)
      : null

    // Use live Google data for email/calendar context (most reliable source)
    const emailDetails = liveEmails.length > 0
      ? liveEmails.slice(0, 10).map(e => {
          const senderName = e.from.replace(/<.*>/, '').trim()
          return `- From: ${senderName} | Subject: ${e.subject} | Preview: ${e.snippet.slice(0, 100)}`
        }).join('\n')
      : 'No unread emails in inbox.'

    const calendarDetails = liveEvents.length > 0
      ? liveEvents.map(e => {
          const time = e.isAllDay ? 'All day' : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })
          const endTime = e.isAllDay ? '' : ` - ${new Date(e.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })}`
          const attendeeCount = e.attendees.length
          return `- ${time}${endTime}: ${e.summary}${e.location ? ` @ ${e.location}` : ''}${attendeeCount > 0 ? ` (${attendeeCount} attendees)` : ''}`
        }).join('\n')
      : 'No events on calendar today.'

    // Also include pipeline items for richer context (other agents beyond email/calendar)
    const otherItems = pendingContent.filter(c => {
      const name = c.agent.name.toLowerCase()
      return !name.includes('gmail') && !name.includes('calendar')
    })

    const context = `
CURRENT TIME: ${new Date().toLocaleString('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
USER: ${body.userName || 'Boss'}

YOUR GOALS:
${goalsSummary}

TODAY'S CALENDAR (${liveEvents.length} events):
${calendarDetails}

UNREAD EMAILS (${liveEmails.length}):
${emailDetails}

${otherItems.length > 0 ? `OTHER PENDING ITEMS (${otherItems.length}):\n${otherItems.map(c => `- [${c.agent.name}] ${c.action}: ${c.detail.slice(0, 150)}`).join('\n')}` : ''}

${pendingContent.length > 0 ? `TRIAGED QUEUE SUMMARY (${pendingContent.length} items):
${byAction.escalate.length > 0 ? `ESCALATE (${byAction.escalate.length}):\n${byAction.escalate.map(s => `  ! ${s}`).join('\n')}` : ''}
${byAction.approve.length > 0 ? `APPROVE (${byAction.approve.length}):\n${byAction.approve.map(s => `  + ${s}`).join('\n')}` : ''}
${byAction.review.length > 0 ? `REVIEW (${byAction.review.length}):\n${byAction.review.map(s => `  ? ${s}`).join('\n')}` : ''}
${byAction.dismiss.length > 0 ? `DISMISS (${byAction.dismiss.length}):\n${byAction.dismiss.map(s => `  - ${s}`).join('\n')}` : ''}` : ''}

7-DAY STATS: ${recentApproved} approved, ${recentDenied} dismissed${approvalRate !== null ? ` (${approvalRate}% approval rate)` : ''}, ${weekActivity} total agent actions

${staleAgents.length > 0 ? `STALE AGENTS (not scanned in 24h+): ${staleAgents.map(a => a.name).join(', ')}` : ''}
${highUrgency.length > 0 ? `HIGH URGENCY ITEMS: ${highUrgency.length} need immediate attention` : ''}
    `.trim()

    const openai = getOpenAIClient(apiKey)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a sharp, decisive Chief of Staff. Your job: tell the boss exactly what to do today, in what order, and why.

Your briefing must include these sections (use these exact labels):

RIGHT NOW
The 1-3 most important things to do in the next 2 hours. Be hyper-specific: "Reply to Sarah's email about the Q2 budget — she needs a number by EOD" not "Review emails." If there's a meeting soon, tell them what to prepare. Connect every action to a goal or deadline.

TODAY'S GAME PLAN
A time-blocked plan for the day based on their calendar, emails, and goals. Example: "9am: Prep for 10am standup — review the deploy status. 10am-10:30am: Standup. 10:30am: Reply to 3 urgent emails (Sarah, Mike, recruiter). 11am: Deep work on [goal]." Be specific with names and subjects.

EMAILS THAT MATTER
List the 3-5 most important unread emails by name and subject. For each one, say what to do: reply, forward, archive, or flag for later. If an email connects to a goal, say which one. Skip newsletters and notifications — only surface emails that need human judgment.

WATCH LIST
Things that don't need action now but could become problems: unanswered follow-ups, meetings without agendas, goals with no recent progress, patterns you notice. Be specific.

Rules:
- Reference people by name, meetings by title, emails by subject
- Every recommendation must connect to a goal, deadline, or consequence
- No generic advice ("stay focused", "prioritize well") — only specific actions
- Use bullet points, not paragraphs
- Address the user by name
- If their calendar is empty, tell them to use the time for their top goal
- If they have no goals set, call that out as the first priority
- If there are no emails or events, give them a proactive plan based on their goals
- Keep the whole briefing under 500 words`,
        },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const briefing = response.choices[0]?.message?.content || 'Unable to generate briefing.'

    return NextResponse.json({ briefing })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Briefing API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate briefing'
    if (message.includes('Incorrect API key') || message.includes('invalid_api_key')) {
      return NextResponse.json({ error: 'Invalid OpenAI API key. Check your key in Settings or Vercel environment variables.' }, { status: 401 })
    }
    if (message.includes('quota') || message.includes('rate_limit') || message.includes('insufficient_quota')) {
      return NextResponse.json({ error: 'OpenAI API quota exceeded or rate limited. Check your OpenAI billing.' }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
