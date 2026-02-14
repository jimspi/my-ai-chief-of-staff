import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const rules = await prisma.governanceRule.findMany({
      where: { agentId: null, userId },
      orderBy: { priority: 'asc' },
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Global rules GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch global rules' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { condition, action, threshold, priority } = body

    const userId = await getSessionUserId()
    const rule = await prisma.governanceRule.create({
      data: {
        condition,
        action,
        threshold: threshold ?? null,
        priority: priority ?? 0,
        agentId: null,
        userId,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('Global rules POST error:', error)
    return NextResponse.json({ error: 'Failed to create global rule' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...fields } = body

    const rule = await prisma.governanceRule.update({
      where: { id },
      data: fields,
    })

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Global rules PUT error:', error)
    return NextResponse.json({ error: 'Failed to update global rule' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.governanceRule.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Global rules DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete global rule' }, { status: 500 })
  }
}
