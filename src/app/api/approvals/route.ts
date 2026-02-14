import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') ?? 'pending'
    const urgency = searchParams.get('urgency')
    const category = searchParams.get('category')
    const sort = searchParams.get('sort') ?? 'urgency'
    const search = searchParams.get('search')
    const count = searchParams.get('count')

    // Build where clause
    const where: Record<string, unknown> = {
      status,
      agent: { userId: userId } as Record<string, unknown>,
    }

    if (urgency) {
      where.urgency = urgency
    }

    if (category) {
      (where.agent as Record<string, unknown>).category = category
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { detail: { contains: search, mode: 'insensitive' } },
      ]
    }

    // If count=true, just return the count
    if (count === 'true') {
      const total = await prisma.approvalItem.count({ where })
      return NextResponse.json({ count: total })
    }

    // Fetch approvals
    const approvals = await prisma.approvalItem.findMany({
      where,
      include: { agent: true },
      orderBy: sort === 'amount'
        ? { amount: 'desc' }
        : { createdAt: 'desc' },
    })

    // Sort by urgency in JS if sort='urgency'
    if (sort === 'urgency') {
      const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      approvals.sort((a, b) => {
        const urgencyDiff = (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1)
        if (urgencyDiff !== 0) return urgencyDiff
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    }

    return NextResponse.json(approvals)
  } catch (error) {
    console.error('Approvals GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ids, action }: { ids: string[]; action: 'approve' | 'deny' } = body

    const status = action === 'approve' ? 'approved' : 'denied'

    // Update all approvals
    await prisma.approvalItem.updateMany({
      where: { id: { in: ids } },
      data: { status, resolvedAt: new Date() },
    })

    // Create activity logs for each approval
    const approvals = await prisma.approvalItem.findMany({
      where: { id: { in: ids } },
      include: { agent: true },
    })

    for (const approval of approvals) {
      await prisma.activityLog.create({
        data: {
          agentId: approval.agentId,
          action: approval.action,
          type: action === 'approve' ? 'approved' : 'denied',
          category: approval.agent.category,
          detail: `Batch ${action}: ${approval.action}`,
        },
      })
    }

    return NextResponse.json({ updated: ids.length })
  } catch (error) {
    console.error('Approvals POST error:', error)
    return NextResponse.json({ error: 'Failed to process batch action' }, { status: 500 })
  }
}
