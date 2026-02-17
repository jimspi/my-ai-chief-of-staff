import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'

interface SyncResult {
  created: number
  skipped: number
  error?: string
}

interface RawItem {
  action: string
  detail: string
  externalId: string
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

/**
 * Probe an agent's external URL and return normalized items.
 * Tries endpoints in order: /api/ideas (DeepCut), /api/generate, /api/scrape
 */
async function fetchItems(baseUrl: string): Promise<RawItem[]> {
  // 1. Try GET /api/ideas (DeepCut pattern)
  try {
    const res = await fetch(`${baseUrl}/api/ideas`, {
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      const data = await res.json()
      const ideas = Array.isArray(data) ? data : data.ideas
      if (Array.isArray(ideas) && ideas.length > 0) {
        return ideas.map(
          (idea: {
            id?: string
            topic?: string
            top_title?: string
            research_data?: string
          }) => ({
            action: `Research: ${idea.top_title || idea.topic || 'Untitled'}`,
            detail: [
              idea.top_title || idea.topic,
              idea.research_data,
            ]
              .filter(Boolean)
              .join('\n\n'),
            externalId: idea.id || `idea-${sha256(idea.top_title || idea.topic || '')}`,
          })
        )
      }
    }
  } catch {
    // ideas endpoint not available, continue
  }

  // 2. Try POST /api/generate (legacy social-post pattern)
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000),
    })
    if (res.ok) {
      const data = await res.json()
      let posts: { text?: string; content?: string; title?: string }[] = []

      if (Array.isArray(data)) {
        posts = data
      } else if (Array.isArray(data.posts)) {
        posts = data.posts
      } else if (data.text || data.content) {
        posts = [data]
      }

      if (posts.length > 0) {
        return posts.map((p) => {
          const text = p.text || p.content || String(p)
          return {
            action: 'Publish social media post',
            detail: text,
            externalId: `gen-${sha256(text)}`,
          }
        })
      }
    }
  } catch {
    // generate endpoint failed, continue
  }

  // 3. Try GET /api/scrape (News Agent pattern)
  try {
    const res = await fetch(`${baseUrl}/api/scrape`, {
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      const data = await res.json()
      const articles = data.articles || data
      if (Array.isArray(articles)) {
        return articles
          .filter((a: { title?: string }) => a.title)
          .map((a: { title: string; url?: string; summary?: string }) => ({
            action: `Share news: ${a.title}`,
            detail: [
              a.title,
              a.summary,
              a.url ? `Source: ${a.url}` : null,
            ]
              .filter(Boolean)
              .join('\n\n'),
            externalId: `news-${sha256(a.url || a.title)}`,
          }))
      }
    }
  } catch {
    // scrape also failed
  }

  return []
}

/**
 * Sync a single agent: fetch external items, deduplicate, persist.
 */
export async function syncAgent(agentId: string): Promise<SyncResult> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent?.externalUrl) {
    return { created: 0, skipped: 0, error: 'Agent has no external URL' }
  }

  const baseUrl = agent.externalUrl.replace(/\/$/, '')
  const items = await fetchItems(baseUrl)

  if (items.length === 0) {
    await prisma.activityLog.create({
      data: {
        agentId: agent.id,
        action: 'Scan completed — no content',
        type: 'alert',
        category: agent.category,
        detail: `Could not fetch content from ${baseUrl}. The agent may be temporarily unavailable.`,
      },
    })
    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastScannedAt: new Date() },
    })
    return { created: 0, skipped: 0 }
  }

  let created = 0
  let skipped = 0

  for (const item of items) {
    if (!item.detail?.trim()) {
      skipped++
      continue
    }

    // Deduplication: check if this externalId already exists for this agent
    const existing = await prisma.approvalItem.findFirst({
      where: { agentId: agent.id, externalId: item.externalId },
    })
    if (existing) {
      skipped++
      continue
    }

    try {
      await prisma.approvalItem.create({
        data: {
          agentId: agent.id,
          externalId: item.externalId,
          action: item.action,
          detail: item.detail.trim(),
          urgency: 'medium',
          status: 'pending',
          reasoning: `Auto-synced from ${baseUrl}`,
        },
      })
      created++
    } catch (err: unknown) {
      // P2002 = unique constraint violation (race condition)
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        skipped++
      } else {
        throw err
      }
    }
  }

  await prisma.activityLog.create({
    data: {
      agentId: agent.id,
      action: 'Scan completed',
      type: 'auto',
      category: agent.category,
      detail: `Found ${created} new item${created === 1 ? '' : 's'}, ${skipped} skipped.`,
    },
  })

  await prisma.agent.update({
    where: { id: agent.id },
    data: { lastScannedAt: new Date() },
  })

  return { created, skipped }
}
