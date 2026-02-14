import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const approval = await prisma.approvalItem.findUnique({
      where: { id },
      include: { agent: true },
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    return NextResponse.json(approval)
  } catch (error) {
    console.error('Approval GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch approval' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { action, modifiedDetail, modifiedAmount } = body

    // If there are modifications, update the approval first
    if (modifiedDetail || modifiedAmount !== undefined) {
      const updateData: Record<string, unknown> = {}
      if (modifiedDetail) updateData.detail = modifiedDetail
      if (modifiedAmount !== undefined) updateData.amount = modifiedAmount

      await prisma.approvalItem.update({
        where: { id },
        data: updateData,
      })
    }

    // Update status and resolvedAt
    const status = action === 'approve' ? 'approved' : 'denied'
    const approval = await prisma.approvalItem.update({
      where: { id },
      data: { status, resolvedAt: new Date() },
      include: { agent: true },
    })

    // Create activity log
    const detail = modifiedDetail
      ? `${action === 'approve' ? 'Approved' : 'Denied'} (modified): ${approval.action}`
      : `${action === 'approve' ? 'Approved' : 'Denied'}: ${approval.action}`

    await prisma.activityLog.create({
      data: {
        agentId: approval.agentId,
        action: approval.action,
        type: action === 'approve' ? 'approved' : 'denied',
        category: approval.agent.category,
        detail,
      },
    })

    return NextResponse.json(approval)
  } catch (error) {
    console.error('Approval PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 })
  }
}
