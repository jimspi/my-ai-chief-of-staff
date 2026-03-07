import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { triageBatch } from '@/lib/triage'

export const maxDuration = 60

export async function POST() {
  try {
    const userId = await getSessionUserId()

    // Get API key
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
    }

    // Get untriaged pending items
    const items = await prisma.approvalItem.findMany({
      where: {
        agent: { userId },
        status: 'pending',
        triaged: false,
      },
      include: { agent: { select: { name: true } } },
      take: 20,
    })

    if (items.length === 0) {
      return NextResponse.json({ triaged: 0, message: 'No items to triage' })
    }

    const itemsForTriage = items.map((item) => ({
      id: item.id,
      action: item.action,
      detail: item.detail,
      agentName: item.agent.name,
    }))

    await triageBatch(itemsForTriage, userId, apiKey)

    return NextResponse.json({ triaged: items.length })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Triage API error:', error)
    return NextResponse.json({ error: 'Triage failed' }, { status: 500 })
  }
}
