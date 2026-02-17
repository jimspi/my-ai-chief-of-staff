import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') ?? 'pending'
    const count = searchParams.get('count')

    if (count === 'true') {
      const total = await prisma.approvalItem.count({
        where: { status, agent: { userId } },
      })
      return NextResponse.json({ count: total })
    }

    const items = await prisma.approvalItem.findMany({
      where: { status, agent: { userId } },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
    })

    // Sort by urgency then time
    const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    items.sort((a, b) => {
      const d = (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1)
      if (d !== 0) return d
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json(items)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Approvals GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}
