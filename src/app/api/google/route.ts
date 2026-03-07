import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { getAuthUrl } from '@/lib/google'

// GET: check connection status
export async function GET() {
  try {
    const userId = await getSessionUserId()
    const account = await prisma.googleAccount.findUnique({
      where: { userId },
      select: { email: true, createdAt: true, scopes: true },
    })

    return NextResponse.json({ connected: !!account, account })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}

// POST: start OAuth flow
export async function POST() {
  try {
    const userId = await getSessionUserId()

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.' },
        { status: 400 }
      )
    }

    const url = getAuthUrl(userId)
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Failed to start OAuth' }, { status: 500 })
  }
}

// DELETE: disconnect Google account
export async function DELETE() {
  try {
    const userId = await getSessionUserId()
    await prisma.googleAccount.deleteMany({ where: { userId } })

    // Also remove Gmail/Calendar agents
    const googleAgents = await prisma.agent.findMany({
      where: { userId, category: { in: ['Gmail', 'Calendar'] } },
    })
    for (const agent of googleAgents) {
      await prisma.approvalItem.deleteMany({ where: { agentId: agent.id } })
      await prisma.activityLog.deleteMany({ where: { agentId: agent.id } })
    }
    await prisma.agent.deleteMany({
      where: { userId, category: { in: ['Gmail', 'Calendar'] } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
