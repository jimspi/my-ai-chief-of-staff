import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'
import { syncAgent } from '@/lib/sync'

export const maxDuration = 60

export async function POST() {
  let userId: string
  try {
    userId = await getSessionUserId()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

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
}
