import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { syncAgent } from '@/lib/sync'
import { syncGmailAgent, syncCalendarAgent } from '@/lib/google-sync'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getSessionUserId()

    const agent = await prisma.agent.findFirst({
      where: { id: params.id, userId },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    let result: { created: number; skipped: number; error?: string }

    // Handle Google-connected agents
    if (agent.category === 'Gmail') {
      const account = await prisma.googleAccount.findUnique({ where: { userId } })
      if (!account) {
        return NextResponse.json({ error: 'Google account not connected. Go to Settings to connect.' }, { status: 400 })
      }
      result = await syncGmailAgent(agent.id, userId)
    } else if (agent.category === 'Calendar') {
      const account = await prisma.googleAccount.findUnique({ where: { userId } })
      if (!account) {
        return NextResponse.json({ error: 'Google account not connected. Go to Settings to connect.' }, { status: 400 })
      }
      result = await syncCalendarAgent(agent.id, userId)
    } else if (agent.externalUrl) {
      result = await syncAgent(agent.id)
    } else {
      return NextResponse.json(
        { error: 'Agent has no external URL or Google connection configured' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: result.created > 0 || !result.error,
      postsCreated: result.created,
      skipped: result.skipped,
      message: result.error || `${result.created} new, ${result.skipped} skipped`,
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Trigger POST error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger agent' },
      { status: 500 }
    )
  }
}
