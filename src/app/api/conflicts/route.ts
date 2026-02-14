import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const conflicts = await prisma.conflict.findMany({
      include: {
        agents: {
          include: { agent: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(conflicts)
  } catch (error) {
    console.error('Conflicts GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, resolution } = body

    const conflict = await prisma.conflict.update({
      where: { id },
      data: {
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
      },
      include: {
        agents: {
          include: { agent: true },
        },
      },
    })

    return NextResponse.json(conflict)
  } catch (error) {
    console.error('Conflicts PATCH error:', error)
    return NextResponse.json({ error: 'Failed to resolve conflict' }, { status: 500 })
  }
}
