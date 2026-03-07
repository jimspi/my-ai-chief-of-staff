import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getSessionUserId()
    const body = await request.json()

    const result = await prisma.goal.updateMany({
      where: { id: params.id, userId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.priority !== undefined && { priority: Math.min(10, Math.max(1, Number(body.priority))) }),
        ...(body.active !== undefined && { active: body.active }),
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getSessionUserId()
    const result = await prisma.goal.deleteMany({
      where: { id: params.id, userId },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
