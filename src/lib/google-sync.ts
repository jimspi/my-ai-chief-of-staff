import { prisma } from '@/lib/prisma'
import { fetchUnreadEmails, fetchFollowUpEmails, fetchUnansweredEmails, fetchTodayEvents } from '@/lib/google'

async function getUserTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
  return user?.timezone || 'America/Denver'
}

// Delete old resolved items for an externalId so we can create a fresh pending one
async function clearResolvedItem(agentId: string, externalId: string) {
  await prisma.approvalItem.deleteMany({
    where: { agentId, externalId, status: { in: ['approved', 'denied'] } },
  })
}

export async function syncGmailAgent(agentId: string, userId: string) {
  const [unread, followUps, unanswered] = await Promise.all([
    fetchUnreadEmails(userId),
    fetchFollowUpEmails(userId),
    fetchUnansweredEmails(userId),
  ])

  let created = 0
  let skipped = 0

  // Unread emails — only skip if a PENDING item already exists for this email.
  // If the user already approved/denied it, allow re-creation so it shows up again
  // on next visit (the email is still unread in Gmail, so it's still relevant).
  for (const email of unread) {
    const externalId = `gmail-${email.id}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId, status: 'pending' },
    })
    if (existing) { skipped++; continue }

    const senderName = email.from.replace(/<.*>/, '').trim() || email.from

    try {
      // Clear old resolved items so we can re-create fresh
      await clearResolvedItem(agentId, externalId)
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

  // Follow-up emails — same logic, only skip if pending item exists
  for (const email of followUps) {
    const externalId = `gmail-followup-${email.threadId}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId, status: 'pending' },
    })
    if (existing) { skipped++; continue }

    try {
      await clearResolvedItem(agentId, externalId)
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

  // Unanswered received emails — emails received 3+ days ago with no reply from user
  for (const email of unanswered) {
    const externalId = `gmail-unanswered-${email.threadId}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId, status: 'pending' },
    })
    if (existing) { skipped++; continue }

    const senderName = email.from.replace(/<.*>/, '').trim() || email.from

    try {
      await clearResolvedItem(agentId, externalId)
      await prisma.approvalItem.create({
        data: {
          agentId,
          externalId,
          action: `Suggest follow up: reply to ${senderName}`,
          detail: `You received an email from ${senderName} about "${email.subject}" ${email.date ? `on ${email.date}` : ''} and haven't replied.\n\nPreview: ${email.snippet}\n\nConsider replying or archiving if no response is needed.`,
          urgency: 'medium',
          status: 'pending',
          reasoning: 'Received email with no reply in 3+ days',
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
      detail: `Found ${unread.length} unread, ${followUps.length} awaiting reply, ${unanswered.length} unanswered.`,
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

  // Get current time in user's timezone reliably
  const now = new Date()
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const getPart = (type: string) => tzParts.find(p => p.type === type)?.value || ''
  const currentHour = parseInt(getPart('hour'), 10)
  const isEvening = currentHour >= 17
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now)

  for (const event of events) {
    const externalId = `cal-${event.id}-${todayStr}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId, status: 'pending' },
    })
    if (existing) { skipped++; continue }

    // Format times in the user's timezone
    const startTime = event.isAllDay
      ? 'All day'
      : new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })
    const endTime = event.isAllDay
      ? ''
      : ` - ${new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })}`

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

    // Determine urgency based on timing (compare in real UTC)
    let urgency = 'low'
    if (!event.isAllDay) {
      const eventStart = new Date(event.start)
      const hoursUntil = (eventStart.getTime() - now.getTime()) / (60 * 60 * 1000)
      if (hoursUntil <= 1 && hoursUntil > 0) urgency = 'high'
      else if (hoursUntil <= 3 && hoursUntil > 0) urgency = 'medium'
    }

    try {
      await clearResolvedItem(agentId, externalId)
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
    const summaryId = `cal-summary-${todayStr}`
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId, externalId: summaryId, status: 'pending' },
    })
    if (!existing) {
      const summary = events.map(e => {
        const time = e.isAllDay ? 'All day' : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })
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
