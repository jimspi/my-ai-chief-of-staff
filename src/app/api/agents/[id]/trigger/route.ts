import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.externalUrl) {
      return NextResponse.json(
        { error: 'Agent has no external URL configured' },
        { status: 400 }
      )
    }

    const baseUrl = agent.externalUrl.replace(/\/$/, '')
    let posts: { action: string; detail: string }[] = []

    // Try /api/generate first (POST)
    try {
      const generateRes = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
      })

      if (generateRes.ok) {
        const data = await generateRes.json()
        if (Array.isArray(data)) {
          posts = data.map((p: { text?: string; content?: string; title?: string }) => ({
            action: 'Publish social media post',
            detail: p.text || p.content || String(p),
          }))
        } else if (data.posts && Array.isArray(data.posts)) {
          posts = data.posts.map((p: { text?: string; content?: string }) => ({
            action: 'Publish social media post',
            detail: p.text || p.content || String(p),
          }))
        } else if (data.text || data.content) {
          posts = [{ action: 'Publish social media post', detail: data.text || data.content }]
        }
      }
    } catch {
      // generate endpoint failed, will try scrape
    }

    // Fallback: try /api/scrape (GET) — returns {articles: [{title, url, summary}]}
    if (posts.length === 0) {
      try {
        const scrapeRes = await fetch(`${baseUrl}/api/scrape`, {
          signal: AbortSignal.timeout(30000),
        })
        if (scrapeRes.ok) {
          const data = await scrapeRes.json()
          const articles = data.articles || data
          if (Array.isArray(articles)) {
            posts = articles
              .filter((a: { title?: string }) => a.title)
              .map((a: { title: string; url?: string; summary?: string }) => ({
                action: `Share news: ${a.title}`,
                detail: a.summary
                  ? `${a.title}\n\n${a.summary}${a.url ? `\n\nSource: ${a.url}` : ''}`
                  : `${a.title}${a.url ? `\n\nSource: ${a.url}` : ''}`,
              }))
          }
        }
      } catch {
        // scrape also failed
      }
    }

    if (posts.length === 0) {
      await prisma.activityLog.create({
        data: {
          agentId: agent.id,
          action: 'News scan failed',
          type: 'alert',
          category: agent.category,
          detail: `Could not fetch content from ${baseUrl}. The agent may be temporarily unavailable.`,
        },
      })

      await prisma.agent.update({
        where: { id: agent.id },
        data: { lastScannedAt: new Date() },
      })

      return NextResponse.json({
        success: false,
        message: 'No content returned from agent',
        postsCreated: 0,
      })
    }

    // Create content items for each post
    const created = []
    for (const post of posts) {
      if (!post.detail?.trim()) continue
      const item = await prisma.approvalItem.create({
        data: {
          agentId: agent.id,
          action: post.action,
          detail: post.detail.trim(),
          urgency: 'medium',
          status: 'pending',
          reasoning: `Auto-generated from news scan at ${baseUrl}`,
        },
      })
      created.push(item)
    }

    await prisma.activityLog.create({
      data: {
        agentId: agent.id,
        action: 'News scan completed',
        type: 'auto',
        category: agent.category,
        detail: `Scanned and found ${created.length} article${created.length === 1 ? '' : 's'} for review.`,
      },
    })

    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastScannedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      postsCreated: created.length,
    })
  } catch (error) {
    console.error('Trigger POST error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger agent' },
      { status: 500 }
    )
  }
}
