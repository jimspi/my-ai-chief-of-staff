import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { action, modifiedDetail } = body

    if (modifiedDetail) {
      await prisma.approvalItem.update({
        where: { id },
        data: { detail: modifiedDetail },
      })
    }

    const status = action === 'approve' ? 'approved' : 'denied'
    const item = await prisma.approvalItem.update({
      where: { id },
      data: { status, resolvedAt: new Date() },
      include: { agent: true },
    })

    await prisma.activityLog.create({
      data: {
        agentId: item.agentId,
        action: item.action,
        type: action === 'approve' ? 'approved' : 'denied',
        category: item.agent.category,
        detail: `${action === 'approve' ? 'Approved' : 'Dismissed'}: ${item.action}`,
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Approval PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
