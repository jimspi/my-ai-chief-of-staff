import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { executeAction, type ExecutionType } from '@/lib/executor'

const VALID_TYPES: ExecutionType[] = ['draft_response', 'research', 'summarize', 'rewrite']

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    const body = await req.json()
    const { itemId, executionType, customPrompt } = body

    if (!itemId || !executionType) {
      return NextResponse.json({ error: 'itemId and executionType are required' }, { status: 400 })
    }

    if (!VALID_TYPES.includes(executionType)) {
      return NextResponse.json(
        { error: `Invalid executionType. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify item belongs to user
    const item = await prisma.approvalItem.findUnique({
      where: { id: itemId },
      include: { agent: { select: { userId: true } } },
    })

    if (!item || item.agent.userId !== userId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get user's API key
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured.' },
        { status: 400 }
      )
    }

    const result = await executeAction(itemId, executionType, userId, customPrompt, apiKey)

    return NextResponse.json({
      success: true,
      ...result,
      message: `${executionType} completed and sent to approval queue.`,
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Execute API error:', error)
    const message = error instanceof Error ? error.message : 'Execution failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
