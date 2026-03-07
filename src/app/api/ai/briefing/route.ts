import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { getOpenAIClient } from '@/lib/openai'
import { getGoalsSummary } from '@/lib/goals'

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

    const [agents, pendingContent, recentApproved, recentDenied, recentActivity, weekActivity, goalsSummary] = await Promise.all([
      prisma.agent.findMany({
        where: { userId },
        select: { name: true, category: true, status: true, lastScannedAt: true, externalUrl: true, approvalRate: true, avgRelevance: true },
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
      getGoalsSummary(userId),
    ])

    const highUrgency = pendingContent.filter(c => c.urgency === 'high')
    const staleAgents = agents.filter(a => {
      if (!a.externalUrl || a.status !== 'active') return false
      if (!a.lastScannedAt) return true
      return (Date.now() - new Date(a.lastScannedAt).getTime()) > 24 * 60 * 60 * 1000
    })

    // Group triaged items by suggested action
    const byAction = { approve: [] as string[], review: [] as string[], dismiss: [] as string[], escalate: [] as string[] }
    for (const c of pendingContent) {
      const sa = (c.suggestedAction || 'review') as keyof typeof byAction
      if (byAction[sa]) {
        byAction[sa].push(`${c.agent.name}: ${c.action} (relevance: ${c.relevanceScore ?? '?'}/10${c.goalAlignment && c.goalAlignment !== 'none' ? `, goal: ${c.goalAlignment}` : ''})`)
      }
    }

    // Cross-agent patterns
    const crossAgentPatterns: string[] = []
    const agentsByCategory: Record<string, string[]> = {}
    for (const a of agents) {
      if (!agentsByCategory[a.category]) agentsByCategory[a.category] = []
      agentsByCategory[a.category].push(a.name)
    }
    for (const cat of Object.keys(agentsByCategory)) {
      const names = agentsByCategory[cat]
      if (names.length > 1) {
        crossAgentPatterns.push(`Multiple agents in ${cat}: ${names.join(', ')} — check for overlap`)
      }
    }

    const approvalRate = recentApproved + recentDenied > 0
      ? Math.round((recentApproved / (recentApproved + recentDenied)) * 100)
      : null

    const context = `
CURRENT TIME: ${new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
USER: ${body.userName || 'Boss'}

YOUR GOALS:
${goalsSummary}

AGENTS (${agents.length}):
${agents.map(a => `- ${a.name} (${a.category}) — ${a.status}${a.lastScannedAt ? `, last scanned ${Math.round((Date.now() - new Date(a.lastScannedAt).getTime()) / 3600000)}h ago` : ', never scanned'}${a.externalUrl ? ' [connected]' : ' [manual]'}${a.approvalRate != null ? ` | approval: ${Math.round(a.approvalRate * 100)}%` : ''}${a.avgRelevance != null ? ` | relevance: ${a.avgRelevance.toFixed(1)}/10` : ''}`).join('\n')}

PENDING QUEUE (${pendingContent.length} items) — BY SUGGESTED ACTION:
${byAction.escalate.length > 0 ? `ESCALATE:\n${byAction.escalate.map(s => `  ! ${s}`).join('\n')}` : ''}
${byAction.approve.length > 0 ? `APPROVE:\n${byAction.approve.map(s => `  + ${s}`).join('\n')}` : ''}
${byAction.review.length > 0 ? `REVIEW:\n${byAction.review.map(s => `  ? ${s}`).join('\n')}` : ''}
${byAction.dismiss.length > 0 ? `DISMISS:\n${byAction.dismiss.map(s => `  - ${s}`).join('\n')}` : ''}
${pendingContent.length === 0 ? 'Queue is clear.' : ''}

7-DAY STATS: ${recentApproved} approved, ${recentDenied} dismissed${approvalRate !== null ? ` (${approvalRate}% approval rate)` : ''}, ${weekActivity} total agent actions

CROSS-AGENT INTELLIGENCE:
${crossAgentPatterns.length > 0 ? crossAgentPatterns.join('\n') : 'No cross-agent patterns detected.'}

LAST 24H ACTIVITY (${recentActivity.length} events):
${recentActivity.length === 0 ? 'No activity.' : recentActivity.slice(0, 15).map(a => `- ${a.agent.name}: ${a.action} (${a.type})`).join('\n')}

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
What needs to be done RIGHT NOW. Be specific. Reference the user's goals when recommending actions. If there are high-urgency or escalated items, say what they are and recommend approve/dismiss with a reason. If the queue is empty, suggest proactive moves aligned with their goals.

AGENT STATUS
Which agents are working well, which are stale or offline. Include approval rates and relevance scores when available. Call out agents that aren't serving the user's goals.

CROSS-AGENT INTELLIGENCE
Patterns you see across agents. Overlapping content, gaps in coverage, agents that might be redundant. Surface insights the user wouldn't see looking at agents individually.

DECISIONS NEEDED
Review pending content grouped by suggested action. For each item, give your recommendation and explain why in one line. Be opinionated. Flag items that don't align with any goal.

GOAL ALIGNMENT CHECK
Are the agents collectively serving the user's stated goals? Any goals with no agent coverage? Any agents producing content that doesn't serve any goal? Recommend adjustments.

STRATEGIC NOTE
One insight or pattern. Think like a strategist — what should the user be doing differently?

Rules:
- Be direct and assertive, not deferential
- Use short punchy sentences
- No fluff, no "I hope you're having a great day"
- If something looks wrong, say it plainly
- Address the user by name
- Reference specific goals when making recommendations
- Keep the whole briefing under 450 words`,
        },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      max_tokens: 1200,
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
