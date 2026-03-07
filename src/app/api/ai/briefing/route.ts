import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { getOpenAIClient } from '@/lib/openai'
import { getUserGoals, formatGoalsForContext } from '@/lib/goals'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const body = await request.json()

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

    const [agents, pendingContent, recentApproved, recentDenied, recentActivity, weekActivity, goals] = await Promise.all([
      prisma.agent.findMany({
        where: { userId },
        select: { name: true, category: true, status: true, lastScannedAt: true, externalUrl: true },
      }),
      prisma.approvalItem.findMany({
        where: { status: 'pending', agent: { userId } },
        include: { agent: { select: { name: true, category: true } } },
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
      getUserGoals(userId),
    ])

    const highUrgency = pendingContent.filter(c => c.urgency === 'high')
    const escalated = pendingContent.filter(c => c.suggestedAction === 'escalate')
    const staleAgents = agents.filter(a => {
      if (!a.externalUrl || a.status !== 'active') return false
      if (!a.lastScannedAt) return true
      return (Date.now() - new Date(a.lastScannedAt).getTime()) > 24 * 60 * 60 * 1000
    })

    // Group pending content by suggested action for smarter briefing
    const autoApprove = pendingContent.filter(c => c.suggestedAction === 'approve')
    const needsReview = pendingContent.filter(c => c.suggestedAction === 'review' || !c.suggestedAction)
    const autoDismiss = pendingContent.filter(c => c.suggestedAction === 'dismiss')

    const context = `
CURRENT TIME: ${new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
USER: ${body.userName || 'Boss'}

${formatGoalsForContext(goals)}

AGENTS (${agents.length}):
${agents.map(a => `- ${a.name} (${a.category}) — ${a.status}${a.lastScannedAt ? `, last scanned ${Math.round((Date.now() - new Date(a.lastScannedAt).getTime()) / 3600000)}h ago` : ', never scanned'}${a.externalUrl ? ' [connected]' : ' [manual]'}`).join('\n')}

PENDING QUEUE (${pendingContent.length} items):
${pendingContent.length === 0 ? 'Queue is clear.' : ''}
${escalated.length > 0 ? `ESCALATED (${escalated.length}):\n${escalated.map(c => `  - [${c.urgency.toUpperCase()}] ${c.agent.name}: ${c.action} (Score: ${c.relevanceScore ?? '?'}/10)\n    AI says: ${c.reasoning || 'No reasoning'}\n    Goal: ${c.goalAlignment || 'unassessed'}`).join('\n')}` : ''}
${autoApprove.length > 0 ? `READY TO APPROVE (${autoApprove.length}):\n${autoApprove.map(c => `  - ${c.agent.name}: ${c.action} (Score: ${c.relevanceScore ?? '?'}/10) — ${c.goalAlignment || 'unassessed'}`).join('\n')}` : ''}
${needsReview.length > 0 ? `NEEDS JUDGMENT (${needsReview.length}):\n${needsReview.map(c => `  - [${c.urgency.toUpperCase()}] ${c.agent.name}: ${c.action}\n    Content: ${c.detail.slice(0, 200)}${c.detail.length > 200 ? '...' : ''}\n    AI reasoning: ${c.reasoning || 'Not triaged yet'}`).join('\n')}` : ''}
${autoDismiss.length > 0 ? `SUGGEST DISMISS (${autoDismiss.length}):\n${autoDismiss.map(c => `  - ${c.agent.name}: ${c.action} — ${c.reasoning || 'low relevance'}`).join('\n')}` : ''}

7-DAY STATS: ${recentApproved} approved, ${recentDenied} dismissed, ${weekActivity} total actions
APPROVAL RATE: ${recentApproved + recentDenied > 0 ? Math.round((recentApproved / (recentApproved + recentDenied)) * 100) : 0}%

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

You understand the user's GOALS and use them to filter signal from noise. Everything gets evaluated against what the user actually cares about.

Your briefing must include these sections (use these exact labels):

PRIORITY ACTIONS
What needs to be done RIGHT NOW. Reference the user's goals when recommending actions. If items have been AI-triaged, leverage the relevance scores and suggested actions. If escalated items exist, lead with those. If the queue is empty, suggest proactive moves aligned with goals.

AGENT STATUS
Which agents are working well, which are stale or offline. Call out quality issues — if an agent has a high denial rate, say so. If an agent's output doesn't align with goals, flag the mismatch. Recommend removing or reconfiguring underperforming agents.

DECISIONS NEEDED
Review pending content grouped by recommendation (approve/review/dismiss). For items ready to approve, explain why in one line. For items that need judgment, present the trade-off. For dismiss candidates, explain why they're noise. Be opinionated.

CROSS-AGENT INTELLIGENCE
Patterns across agents. Maybe multiple agents are surfacing the same topic — that's a signal. Maybe there's a blind spot — no agent covering an important goal. Maybe one agent is flooding the queue. Think strategically about the agent fleet as a whole.

STRATEGIC NOTE
One insight connecting the dots. What should the user be paying attention to that they might miss? What trend is emerging? What goal is being underserved?

Rules:
- Be direct and assertive, not deferential
- Use short punchy sentences
- No fluff, no "I hope you're having a great day"
- Reference specific goals by name when making recommendations
- If something looks wrong, say it plainly
- Address the user by name
- Keep the whole briefing under 500 words`,
        },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const briefing = response.choices[0]?.message?.content || 'Unable to generate briefing.'

    return NextResponse.json({ briefing })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Briefing API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate briefing'
    if (message.includes('Incorrect API key') || message.includes('invalid_api_key')) {
      return NextResponse.json({ error: 'Invalid OpenAI API key. Check your key in Settings or Vercel environment variables.' }, { status: 401 })
    }
    if (message.includes('quota') || message.includes('rate_limit') || message.includes('insufficient_quota')) {
      return NextResponse.json({ error: 'OpenAI API quota exceeded or rate limited. Check your OpenAI billing.' }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
