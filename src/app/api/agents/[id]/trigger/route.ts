import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'
import { syncAgent } from '@/lib/sync'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  let userId: string
  try {
    userId = await getSessionUserId()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const agent = await prisma.agent.findFirst({
      where: { id: params.id, userId },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.externalUrl) {
      return NextResponse.json(
        { error: 'Agent has no external URL configured' },
        { status: 400 }
      )
    }

    const result = await syncAgent(agent.id)

    return NextResponse.json({
      success: result.created > 0 || !result.error,
      postsCreated: result.created,
      skipped: result.skipped,
      message: result.error || `${result.created} new, ${result.skipped} skipped`,
    })
  } catch (error) {
    console.error('Trigger POST error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger agent' },
      { status: 500 }
    )
  }
}
