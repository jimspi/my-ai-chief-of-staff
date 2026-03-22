import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { sendReplyToThread, getMessageHeaders } from '@/lib/google'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const { emailItemId, replyBody } = await request.json()

    if (!emailItemId || !replyBody?.trim()) {
      return NextResponse.json({ error: 'Missing emailItemId or replyBody' }, { status: 400 })
    }

    // Fetch the approval item
    const item = await prisma.approvalItem.findUnique({
      where: { id: emailItemId },
      include: { agent: { select: { userId: true } } },
    })

    if (!item || item.agent.userId !== userId) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Extract Gmail message ID from externalId
    const externalId = item.externalId || ''
    const gmailId = externalId
      .replace('gmail-unanswered-', '')
      .replace('gmail-followup-', '')
      .replace('gmail-', '')

    if (!gmailId) {
      return NextResponse.json({ error: 'Cannot determine Gmail message ID' }, { status: 400 })
    }

    // Get the original message headers for threading
    const headers = await getMessageHeaders(userId, gmailId)
    if (!headers) {
      return NextResponse.json({ error: 'Could not fetch original email headers' }, { status: 500 })
    }

    // Determine who to reply to (the sender of the original email)
    const replyTo = headers.from

    const sent = await sendReplyToThread(
      userId,
      headers.threadId,
      headers.messageId,
      replyTo,
      headers.subject,
      replyBody.trim()
    )

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send reply. You may need to reconnect Google.' }, { status: 500 })
    }

    // Mark the approval item as approved since the user acted on it
    await prisma.approvalItem.update({
      where: { id: emailItemId },
      data: { status: 'approved', resolvedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Send reply error:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
