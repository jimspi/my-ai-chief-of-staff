import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { getOpenAIClient } from '@/lib/openai'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const body = await request.json()

    // Get user settings for API key
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add it in Settings or set the OPENAI_API_KEY environment variable on Vercel.' },
        { status: 400 }
      )
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [agents, pendingContent, recentActivity] = await Promise.all([
      prisma.agent.findMany({
        where: { userId },
        select: { name: true, category: true, status: true },
      }),
      prisma.approvalItem.findMany({
        where: { status: 'pending', agent: { userId } },
        include: { agent: { select: { name: true } } },
      }),
      prisma.activityLog.findMany({
        where: { agent: { userId }, createdAt: { gte: since } },
        include: { agent: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const context = `
AGENTS: ${agents.map(a => `${a.name} (${a.category}, ${a.status})`).join(', ')}

PENDING CONTENT (${pendingContent.length} items):
${pendingContent.map(c => `- [${c.urgency.toUpperCase()}] ${c.agent.name}: ${c.action}`).join('\n')}

RECENT ACTIVITY (last 24h, ${recentActivity.length} events):
${recentActivity.slice(0, 15).map(a => `- ${a.agent.name}: ${a.action} (${a.type})`).join('\n')}

USER NAME: ${body.userName || 'there'}
    `.trim()

    const openai = getOpenAIClient(apiKey)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the Chief of Staff AI assistant. Generate a concise daily briefing for the user. Be direct, helpful, and actionable. Use a warm but professional tone. Structure your response with:
1. A greeting with a quick status summary (1-2 sentences)
2. Priority items that need attention (if any)
3. A brief summary of what agents have been doing
Keep it under 200 words. Do not use markdown headers.`,
        },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      max_tokens: 512,
    })

    const briefing = response.choices[0]?.message?.content || 'Unable to generate briefing.'

    return NextResponse.json({ briefing })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Briefing API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate briefing'
    // Surface OpenAI-specific errors
    if (message.includes('Incorrect API key') || message.includes('invalid_api_key')) {
      return NextResponse.json({ error: 'Invalid OpenAI API key. Check your key in Settings or Vercel environment variables.' }, { status: 401 })
    }
    if (message.includes('quota') || message.includes('rate_limit') || message.includes('insufficient_quota')) {
      return NextResponse.json({ error: 'OpenAI API quota exceeded or rate limited. Check your OpenAI billing.' }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
