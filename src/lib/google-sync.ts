import { prisma } from '@/lib/prisma'
import { fetchUnreadEmails, fetchFollowUpEmails, fetchTodayEvents } from '@/lib/google'

async function getUserTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
  return user?.timezone || 'America/Denver'
}

export async function syncGmailAgent(agentId: string, userId: string) {
  const [unread, followUps] = await Promise.all([
    fetchUnreadEmails(userId),
    fetchFollowUpEmails(userId),
  ])

  let created = 0
  let skipped = 0

  // Unread emails
  for (const email of unread) {
    const externalId = `gmail-${email.id}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId },
    })
    if (existing) { skipped++; continue }

    const senderName = email.from.replace(/<.*>/, '').trim() || email.from

    try {
      await prisma.approvalItem.create({
        data: {
          agentId,
          externalId,
          action: `Unread email from ${senderName}`,
          detail: `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\n${email.snippet}`,
          urgency: email.labels.includes('IMPORTANT') ? 'high' : 'medium',
          status: 'pending',
          reasoning: 'Unread email in primary inbox',
        },
      })
      created++
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        skipped++
      } else throw err
    }
  }

  // Follow-up emails
  for (const email of followUps) {
    const externalId = `gmail-followup-${email.threadId}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId },
    })
    if (existing) { skipped++; continue }

    try {
      await prisma.approvalItem.create({
        data: {
          agentId,
          externalId,
          action: `Follow up needed: ${email.subject}`,
          detail: `You sent an email to ${email.from} about "${email.subject}" and haven't received a reply.\n\nOriginal snippet: ${email.snippet}\nSent: ${email.date}`,
          urgency: 'medium',
          status: 'pending',
          reasoning: 'Sent email with no reply in 3+ days',
        },
      })
      created++
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        skipped++
      } else throw err
    }
  }

  await prisma.activityLog.create({
    data: {
      agentId,
      action: `Gmail scan: ${created} new, ${skipped} skipped`,
      type: 'auto',
      category: 'Communication',
      detail: `Found ${unread.length} unread emails, ${followUps.length} needing follow-up.`,
    },
  })

  await prisma.agent.update({
    where: { id: agentId },
    data: { lastScannedAt: new Date() },
  })

  return { created, skipped }
}

export async function syncCalendarAgent(agentId: string, userId: string) {
  const timezone = await getUserTimezone(userId)
  const events = await fetchTodayEvents(userId, timezone)

  let created = 0
  let skipped = 0

  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const isEvening = nowInTz.getHours() >= 17

  for (const event of events) {
    const externalId = `cal-${event.id}-${now.toISOString().slice(0, 10)}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId },
    })
    if (existing) { skipped++; continue }

    const startTime = event.isAllDay
      ? 'All day'
      : new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const endTime = event.isAllDay
      ? ''
      : ` - ${new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

    const attendeeList = event.attendees.length > 0
      ? `\nAttendees: ${event.attendees.join(', ')}`
      : ''

    const detail = [
      `${event.summary}`,
      `Time: ${startTime}${endTime}`,
      event.location ? `Location: ${event.location}` : null,
      attendeeList || null,
      event.description ? `\nNotes: ${event.description.slice(0, 300)}` : null,
    ].filter(Boolean).join('\n')

    // Determine urgency based on timing
    let urgency = 'low'
    if (!event.isAllDay) {
      const eventStart = new Date(event.start)
      const hoursUntil = (eventStart.getTime() - now.getTime()) / (60 * 60 * 1000)
      if (hoursUntil <= 1 && hoursUntil > 0) urgency = 'high'
      else if (hoursUntil <= 3 && hoursUntil > 0) urgency = 'medium'
    }

    try {
      await prisma.approvalItem.create({
        data: {
          agentId,
          externalId,
          action: isEvening ? `Today's event: ${event.summary}` : `Upcoming: ${event.summary}`,
          detail,
          urgency,
          status: 'pending',
          reasoning: isEvening
            ? 'End-of-day calendar review'
            : `Calendar event ${urgency === 'high' ? 'starting soon' : 'today'}`,
        },
      })
      created++
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        skipped++
      } else throw err
    }
  }

  // End-of-day summary if evening
  if (isEvening && events.length > 0) {
    const summaryId = `cal-summary-${now.toISOString().slice(0, 10)}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId: summaryId },
    })
    if (!existing) {
      const summary = events.map(e => {
        const time = e.isAllDay ? 'All day' : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        return `- ${time}: ${e.summary}`
      }).join('\n')

      await prisma.approvalItem.create({
        data: {
          agentId,
          externalId: summaryId,
          action: 'End-of-day calendar recap',
          detail: `Here's what was on your calendar today:\n\n${summary}\n\nTotal: ${events.length} events`,
          urgency: 'low',
          status: 'pending',
          reasoning: 'Daily calendar recap for reflection and planning',
        },
      })
      created++
    }
  }

  await prisma.activityLog.create({
    data: {
      agentId,
      action: `Calendar scan: ${created} new, ${skipped} skipped`,
      type: 'auto',
      category: 'Scheduling',
      detail: `Found ${events.length} events today.`,
    },
  })

  await prisma.agent.update({
    where: { id: agentId },
    data: { lastScannedAt: new Date() },
  })

  return { created, skipped }
}
