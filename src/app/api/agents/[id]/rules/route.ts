import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const rules = await prisma.governanceRule.findMany({
      where: { agentId: id },
      orderBy: { priority: 'asc' },
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Agent rules GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { condition, action, threshold, priority, isActive } = body

    const userId = await getSessionUserId()
    const rule = await prisma.governanceRule.create({
      data: {
        condition,
        action,
        threshold: threshold ?? null,
        priority: priority ?? 0,
        isActive: isActive ?? true,
        agentId: id,
        userId,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('Agent rules POST error:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
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
    console.error('Agent rules PUT error:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('ruleId')

    if (!ruleId) {
      return NextResponse.json({ error: 'ruleId is required' }, { status: 400 })
    }

    await prisma.governanceRule.delete({ where: { id: ruleId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Agent rules DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
