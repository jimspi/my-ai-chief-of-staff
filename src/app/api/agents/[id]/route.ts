import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            approvals: { where: { status: 'pending' } },
            activities: true,
            conflicts: true,
          },
        },
        rules: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Agent GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const agent = await prisma.agent.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Agent PUT error:', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Delete related records first
    await prisma.approvalItem.deleteMany({ where: { agentId: id } })
    await prisma.activityLog.deleteMany({ where: { agentId: id } })
    await prisma.governanceRule.deleteMany({ where: { agentId: id } })
    await prisma.transaction.deleteMany({ where: { agentId: id } })
    await prisma.conflictAgent.deleteMany({ where: { agentId: id } })

    // Delete the agent
    await prisma.agent.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Agent DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
