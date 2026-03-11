import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/google/callback`
  )
}

export function getAuthUrl(state: string): string {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getAuthedClient(userId: string) {
  const account = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!account) return null

  const client = getOAuth2Client()
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt.getTime(),
  })

  // Refresh if expired
  if (account.expiresAt.getTime() < Date.now() + 60000) {
    try {
      const { credentials } = await client.refreshAccessToken()
      await prisma.googleAccount.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token!,
          expiresAt: new Date(credentials.expiry_date!),
        },
      })
      client.setCredentials(credentials)
    } catch (err) {
      console.error('Failed to refresh Google token:', err)
      return null
    }
  }

  return client
}

// --- Gmail ---

interface EmailItem {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
  isUnread: boolean
  labels: string[]
  threadId: string
}

export async function fetchUnreadEmails(userId: string, maxResults = 15): Promise<EmailItem[]> {
  const auth = await getAuthedClient(userId)
  if (!auth) return []

  const gmail = google.gmail({ version: 'v1', auth })

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const dateStr = `${twoDaysAgo.getFullYear()}/${twoDaysAgo.getMonth() + 1}/${twoDaysAgo.getDate()}`

  const res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX', 'UNREAD', 'CATEGORY_PRIMARY'],
    q: `after:${dateStr}`,
    maxResults,
  })

  const messages = res.data.messages || []
  const emails: EmailItem[] = []

  for (const msg of messages.slice(0, 10)) {
    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })

      const headers = detail.data.payload?.headers || []
      const getHeader = (name: string) => headers.find(h => h.name === name)?.value || ''

      emails.push({
        id: msg.id!,
        from: getHeader('From'),
        subject: getHeader('Subject') || '(no subject)',
        snippet: detail.data.snippet || '',
        date: getHeader('Date'),
        isUnread: true,
        labels: detail.data.labelIds || [],
        threadId: detail.data.threadId || '',
      })
    } catch {
      // skip individual message errors
    }
  }

  return emails
}

export async function fetchFollowUpEmails(userId: string): Promise<EmailItem[]> {
  const auth = await getAuthedClient(userId)
  if (!auth) return []

  const gmail = google.gmail({ version: 'v1', auth })

  // Emails sent by user in last 3 days with no reply
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const dateStr = `${threeDaysAgo.getFullYear()}/${threeDaysAgo.getMonth() + 1}/${threeDaysAgo.getDate()}`

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `in:sent after:${dateStr}`,
    maxResults: 20,
  })

  const sentMessages = res.data.messages || []
  const followUps: EmailItem[] = []

  for (const msg of sentMessages.slice(0, 10)) {
    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })

      const threadId = detail.data.threadId
      if (!threadId) continue

      // Check if there's a reply in this thread after our sent message
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'minimal',
      })

      const threadMessages = thread.data.messages || []
      const sentMsg = threadMessages.find(m => m.id === msg.id)
      if (!sentMsg) continue

      // If our sent message is the last in the thread, it needs follow-up
      const lastMessage = threadMessages[threadMessages.length - 1]
      if (lastMessage?.id === msg.id) {
        const headers = detail.data.payload?.headers || []
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value || ''

        followUps.push({
          id: msg.id!,
          from: getHeader('To'),
          subject: getHeader('Subject') || '(no subject)',
          snippet: detail.data.snippet || '',
          date: getHeader('Date'),
          isUnread: false,
          labels: ['FOLLOW_UP'],
          threadId,
        })
      }
    } catch {
      // skip
    }
  }

  return followUps
}

// --- Calendar ---

export interface CalendarEvent {
  id: string
  summary: string
  description: string
  start: string
  end: string
  location: string
  isAllDay: boolean
  status: string
  attendees: string[]
}

export async function fetchTodayEvents(userId: string): Promise<CalendarEvent[]> {
  const auth = await getAuthedClient(userId)
  if (!auth) return []

  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  return (res.data.items || []).map(event => ({
    id: event.id || '',
    summary: event.summary || '(no title)',
    description: event.description || '',
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    location: event.location || '',
    isAllDay: !event.start?.dateTime,
    status: event.status || 'confirmed',
    attendees: (event.attendees || []).map(a => a.email || '').filter(Boolean),
  }))
}

export async function fetchUpcomingEvents(userId: string, hours = 4): Promise<CalendarEvent[]> {
  const auth = await getAuthedClient(userId)
  if (!auth) return []

  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const later = new Date(now.getTime() + hours * 60 * 60 * 1000)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: later.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  return (res.data.items || []).map(event => ({
    id: event.id || '',
    summary: event.summary || '(no title)',
    description: event.description || '',
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    location: event.location || '',
    isAllDay: !event.start?.dateTime,
    status: event.status || 'confirmed',
    attendees: (event.attendees || []).map(a => a.email || '').filter(Boolean),
  }))
}
