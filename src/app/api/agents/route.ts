import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const agents = await prisma.agent.findMany({
      where: { userId: userId },
      include: {
        _count: {
          select: {
            approvals: { where: { status: 'pending' } },
            activities: true,
            conflicts: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(agents)
  } catch (error) {
    console.error('Agents GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = await getSessionUserId()
    const { name, icon, category, description, autonomyLevel, budget, externalUrl } = body

    const agent = await prisma.agent.create({
      data: {
        name,
        icon,
        category,
        description,
        autonomyLevel: autonomyLevel ?? 'medium',
        budget: budget ?? null,
        externalUrl: externalUrl ?? null,
        userId: userId,
      },
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error('Agents POST error:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
