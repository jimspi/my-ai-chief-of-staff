import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { fetchUnreadEmails, fetchTodayEvents } from '@/lib/google'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [activeAgents, contentReady, activityToday] = await Promise.all([
      prisma.agent.count({ where: { userId, status: 'active' } }),
      prisma.approvalItem.count({ where: { status: 'pending', agent: { userId } } }),
      prisma.activityLog.count({ where: { agent: { userId }, createdAt: { gte: todayStart } } }),
    ])

    const stats = { activeAgents, contentReady, activityToday }

    const content = await prisma.approvalItem.findMany({
      where: { status: 'pending', agent: { userId } },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
    })

    // Sort by urgency then time
    const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    content.sort((a, b) => {
      const d = (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1)
      if (d !== 0) return d
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const agents = await prisma.agent.findMany({
      where: { userId },
      include: {
        _count: { select: { content: true, activities: true } },
      },
    })

    const recentActivity = await prisma.activityLog.findMany({
      where: { agent: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { agent: true },
    })

    // Cross-agent insights
    const insights: string[] = []
    for (const agent of agents) {
      if (agent.approvalRate != null && agent.approvalRate < 0.3) {
        insights.push(`${agent.name} has a low approval rate (${Math.round(agent.approvalRate * 100)}%)`)
      }
      if (agent.avgRelevance != null && agent.avgRelevance < 4) {
        insights.push(`${agent.name} avg relevance is ${agent.avgRelevance.toFixed(1)}/10`)
      }
      if (agent.externalUrl && agent.status === 'active') {
        if (!agent.lastScannedAt || Date.now() - new Date(agent.lastScannedAt).getTime() > 48 * 60 * 60 * 1000) {
          insights.push(`${agent.name} hasn't been scanned in 48h+`)
        }
      }
    }
    const highUrgencyCount = content.filter(c => c.urgency === 'high').length
    if (highUrgencyCount >= 3) {
      insights.push(`${highUrgencyCount} high-urgency items building up`)
    }

    // Separate email and calendar items from other content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let emailItems: any[] = content.filter(c => c.agent?.category === 'Gmail')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let calendarItems: any[] = content.filter(c => c.agent?.category === 'Calendar')
    const otherContent = content.filter(c => c.agent?.category !== 'Gmail' && c.agent?.category !== 'Calendar')

    // If pipeline produced no email/calendar items but Google is connected,
    // fetch live data directly so the dashboard always shows something
    const googleAccount = await prisma.googleAccount.findUnique({ where: { userId } })
    let liveEmailCount = 0
    let liveCalendarCount = 0

    if (googleAccount) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
      const timezone = user?.timezone || 'America/Denver'

      // Always fetch live counts for the status bar
      const [liveEmails, liveEvents] = await Promise.all([
        fetchUnreadEmails(userId, 10).catch(() => []),
        fetchTodayEvents(userId, timezone).catch(() => []),
      ])
      liveEmailCount = liveEmails.length
      liveCalendarCount = liveEvents.length

      // If the pipeline has no calendar items, build them from live data
      if (calendarItems.length === 0 && liveEvents.length > 0) {
        const calendarAgent = agents.find(a => a.category === 'Calendar')
        calendarItems = liveEvents.map((event, i) => {
          const startTime = event.isAllDay
            ? 'All day'
            : new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })
          const endTime = event.isAllDay
            ? ''
            : ` - ${new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })}`
          const attendeeList = event.attendees.length > 0 ? `\nAttendees: ${event.attendees.join(', ')}` : ''

          let urgency = 'low'
          if (!event.isAllDay) {
            const hoursUntil = (new Date(event.start).getTime() - Date.now()) / (60 * 60 * 1000)
            if (hoursUntil <= 1 && hoursUntil > 0) urgency = 'high'
            else if (hoursUntil <= 3 && hoursUntil > 0) urgency = 'medium'
          }

          return {
            id: `live-cal-${i}`,
            agentId: calendarAgent?.id || '',
            externalId: `cal-live-${event.id}`,
            action: `Upcoming: ${event.summary}`,
            detail: [
              event.summary,
              `Time: ${startTime}${endTime}`,
              event.location ? `Location: ${event.location}` : null,
              attendeeList || null,
              event.description ? `\nNotes: ${event.description.slice(0, 300)}` : null,
            ].filter(Boolean).join('\n'),
            urgency,
            status: 'pending' as const,
            reasoning: null,
            relevanceScore: null,
            suggestedAction: null,
            goalAlignment: null,
            triaged: false,
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            agent: calendarAgent || null,
          }
        })
      }

      // If the pipeline has no email items, build them from live data
      if (emailItems.length === 0 && liveEmails.length > 0) {
        const gmailAgent = agents.find(a => a.category === 'Gmail')
        emailItems = liveEmails.map((email, i) => {
          const senderName = email.from.replace(/<.*>/, '').trim() || email.from
          return {
            id: `live-email-${i}`,
            agentId: gmailAgent?.id || '',
            externalId: `gmail-live-${email.id}`,
            action: `Unread email from ${senderName}`,
            detail: `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\n${email.snippet}`,
            urgency: email.labels.includes('IMPORTANT') ? 'high' : 'medium',
            status: 'pending' as const,
            reasoning: null,
            relevanceScore: null,
            suggestedAction: null,
            goalAlignment: null,
            triaged: false,
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            agent: gmailAgent || null,
          }
        })
      }
    }

    return NextResponse.json({
      stats,
      content: otherContent,
      emailItems,
      calendarItems,
      agents,
      recentActivity,
      insights,
      liveEmailCount,
      liveCalendarCount,
      googleConnected: !!googleAccount,
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
