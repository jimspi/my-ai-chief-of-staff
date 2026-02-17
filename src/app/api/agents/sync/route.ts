import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { syncAgent } from '@/lib/sync'

export const maxDuration = 60

export async function POST() {
  try {
    const userId = await getSessionUserId()

    const agents = await prisma.agent.findMany({
      where: {
        userId,
        status: 'active',
        externalUrl: { not: null },
      },
    })

    const results: Record<string, { created: number; skipped: number; error?: string }> = {}

    for (const agent of agents) {
      try {
        results[agent.name] = await syncAgent(agent.id)
      } catch (err) {
        results[agent.name] = { created: 0, skipped: 0, error: String(err) }
      }
    }

    const totalCreated = Object.values(results).reduce((sum, r) => sum + r.created, 0)

    return NextResponse.json({ synced: agents.length, totalCreated, results })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Sync POST error:', error)
    return NextResponse.json({ error: 'Failed to sync agents' }, { status: 500 })
  }
}
