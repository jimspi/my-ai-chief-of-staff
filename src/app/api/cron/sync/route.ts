import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncAgent } from '@/lib/sync'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agents = await prisma.agent.findMany({
    where: {
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

  // Delete pending items older than 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const { count: expired } = await prisma.approvalItem.deleteMany({
    where: {
      status: 'pending',
      createdAt: { lt: cutoff },
    },
  })

  return NextResponse.json({ synced: agents.length, results, expired })
}
