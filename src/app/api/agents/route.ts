import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const agents = await prisma.agent.findMany({
      where: { userId },
      include: {
        _count: { select: { content: true, activities: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(agents)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Agents GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = await getSessionUserId()
    const { name, icon, category, description, externalUrl } = body

    const agent = await prisma.agent.create({
      data: {
        name,
        icon,
        category,
        description,
        externalUrl: externalUrl || null,
        userId,
      },
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Agents POST error:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
