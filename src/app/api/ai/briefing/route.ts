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

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [agents, pendingContent, recentApproved, recentDenied, recentActivity, weekActivity] = await Promise.all([
      prisma.agent.findMany({
        where: { userId },
        select: { name: true, category: true, status: true, lastScannedAt: true, externalUrl: true },
      }),
      prisma.approvalItem.findMany({
        where: { status: 'pending', agent: { userId } },
        include: { agent: { select: { name: true } } },
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.approvalItem.count({
        where: { status: 'approved', agent: { userId }, resolvedAt: { gte: since7d } },
      }),
      prisma.approvalItem.count({
        where: { status: 'denied', agent: { userId }, resolvedAt: { gte: since7d } },
      }),
      prisma.activityLog.findMany({
        where: { agent: { userId }, createdAt: { gte: since24h } },
        include: { agent: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count({
        where: { agent: { userId }, createdAt: { gte: since7d } },
      }),
    ])

    const highUrgency = pendingContent.filter(c => c.urgency === 'high')
    const staleAgents = agents.filter(a => {
      if (!a.externalUrl || a.status !== 'active') return false
      if (!a.lastScannedAt) return true
      return (Date.now() - new Date(a.lastScannedAt).getTime()) > 24 * 60 * 60 * 1000
    })

    const context = `
CURRENT TIME: ${new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
USER: ${body.userName || 'Boss'}

AGENTS (${agents.length}):
${agents.map(a => `- ${a.name} (${a.category}) — ${a.status}${a.lastScannedAt ? `, last scanned ${Math.round((Date.now() - new Date(a.lastScannedAt).getTime()) / 3600000)}h ago` : ', never scanned'}${a.externalUrl ? ' [connected]' : ' [manual]'}`).join('\n')}

PENDING QUEUE (${pendingContent.length} items awaiting your decision):
${pendingContent.length === 0 ? 'Queue is clear.' : pendingContent.map(c => `- [${c.urgency.toUpperCase()}] ${c.agent.name}: ${c.action}\n  Content: ${c.detail.slice(0, 200)}${c.detail.length > 200 ? '...' : ''}`).join('\n')}

7-DAY STATS: ${recentApproved} approved, ${recentDenied} dismissed, ${weekActivity} total agent actions

LAST 24H ACTIVITY (${recentActivity.length} events):
${recentActivity.length === 0 ? 'No activity.' : recentActivity.slice(0, 20).map(a => `- ${a.agent.name}: ${a.action} (${a.type})`).join('\n')}

${staleAgents.length > 0 ? `STALE AGENTS (not scanned in 24h+): ${staleAgents.map(a => a.name).join(', ')}` : ''}
${highUrgency.length > 0 ? `HIGH URGENCY ITEMS: ${highUrgency.length} need immediate attention` : ''}
    `.trim()

    const openai = getOpenAIClient(apiKey)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a sharp, decisive Chief of Staff. Not a summarizer — an operator. Your job is to look at the data, think critically, and tell the boss exactly what they need to know and do.

Your briefing must include these sections (use these exact labels):

PRIORITY ACTIONS
What needs to be done RIGHT NOW. Be specific. If there are high-urgency items, say what they are and recommend approve/dismiss with a reason. If the queue is empty, say so and suggest what to do next (scan agents, review strategy, etc). If agents haven't been scanned recently, flag it.

AGENT STATUS
Which agents are working well, which are stale or offline. Call out any agent that hasn't checked in. If an agent is producing low-quality or irrelevant content, say so.

DECISIONS NEEDED
Review pending content and give your recommendation on each — approve, dismiss, or edit. Explain why in one line. Be opinionated. The boss wants your judgment, not a list.

STRATEGIC NOTE
One insight or pattern you notice. Maybe an agent is producing too much noise. Maybe there's a gap — no agent covering an important area. Maybe the approval rate is low, suggesting content quality issues. Think like a strategist.

Rules:
- Be direct and assertive, not deferential
- Use short punchy sentences
- No fluff, no "I hope you're having a great day"
- If something looks wrong, say it plainly
- Address the user by name
- Keep the whole briefing under 350 words`,
        },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      max_tokens: 1024,
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
