import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { executeAction, type ExecutionAction, getActionLabel } from '@/lib/executor'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const body = await request.json()
    const { itemId, action } = body as { itemId: string; action: ExecutionAction }

    if (!itemId || !action) {
      return NextResponse.json({ error: 'itemId and action are required' }, { status: 400 })
    }

    const validActions: ExecutionAction[] = ['draft_response', 'deep_dive', 'summarize', 'rewrite']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 })
    }

    // Get the item and verify ownership
    const item = await prisma.approvalItem.findFirst({
      where: { id: itemId, agent: { userId } },
      include: { agent: { select: { name: true, category: true } } },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get API key
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
    }

    const context = `From agent: ${item.agent.name} (${item.agent.category})\nOriginal action: ${item.action}`
    const result = await executeAction(action, item.detail, context, apiKey)

    // Log the execution
    await prisma.activityLog.create({
      data: {
        agentId: item.agentId,
        action: `${getActionLabel(action)} executed`,
        type: 'auto',
        category: item.agent.category,
        detail: `AI ${getActionLabel(action).toLowerCase()} generated for: ${item.action.slice(0, 80)}`,
        metadata: JSON.stringify({ itemId, action }),
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Execute API error:', error)
    const message = error instanceof Error ? error.message : 'Execution failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
