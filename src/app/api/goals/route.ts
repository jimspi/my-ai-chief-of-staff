import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { priority: 'desc' },
    })
    return NextResponse.json(goals)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const body = await request.json()
    const { title, description, priority } = body

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    const goal = await prisma.goal.create({
      data: {
        userId,
        title: title.trim(),
        description: description.trim(),
        priority: Math.min(10, Math.max(1, Number(priority) || 5)),
      },
    })

    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}
