import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const agentId = searchParams.get('agentId')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build where clause
    const where: Record<string, unknown> = {
      agent: { userId: userId },
    }

    if (agentId) {
      where.agentId = agentId
    }
    if (type) {
      where.type = type
    }
    if (category) {
      where.category = category
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { detail: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, unknown> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo)
      where.createdAt = createdAt
    }

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { agent: true },
      }),
      prisma.activityLog.count({ where }),
    ])

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Activity GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
