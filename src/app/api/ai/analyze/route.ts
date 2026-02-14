import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { analyzeRisk, generateApprovalSuggestion } from '@/lib/openai'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { approvalId, action: analysisType } = body

  if (!approvalId) {
    return NextResponse.json({ error: 'approvalId required' }, { status: 400 })
  }

  // Get user's API key from settings
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  let apiKey: string | undefined
  try {
    const settings = JSON.parse(user?.settings || '{}')
    apiKey = settings.openaiApiKey
  } catch {
    // use env fallback
  }

  const approval = await prisma.approvalItem.findUnique({
    where: { id: approvalId },
    include: { agent: true },
  })

  if (!approval) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
  }

  try {
    if (analysisType === 'risk') {
      const result = await analyzeRisk(approval.action, approval.detail, apiKey)
      return NextResponse.json(result)
    }

    if (analysisType === 'suggest') {
      const result = await generateApprovalSuggestion(
        approval.action,
        approval.detail,
        approval.agent?.name || 'Unknown Agent',
        apiKey
      )
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action. Use "risk" or "suggest".' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
