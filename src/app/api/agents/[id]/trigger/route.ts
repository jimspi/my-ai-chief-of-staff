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

    // Call the external agent's generate endpoint
    const baseUrl = agent.externalUrl.replace(/\/$/, '')
    let posts: string[] = []

    try {
      const generateRes = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
      })

      if (generateRes.ok) {
        const data = await generateRes.json()
        // The generate endpoint returns posts in various formats
        if (Array.isArray(data)) {
          posts = data.map((p: { text?: string; content?: string }) => p.text || p.content || String(p))
        } else if (data.posts && Array.isArray(data.posts)) {
          posts = data.posts.map((p: { text?: string; content?: string }) => p.text || p.content || String(p))
        } else if (data.text) {
          posts = [data.text]
        } else if (data.content) {
          posts = [data.content]
        } else if (typeof data === 'string') {
          posts = [data]
        }
      } else {
        // Fallback: try the scrape endpoint
        const scrapeRes = await fetch(`${baseUrl}/api/scrape`, {
          signal: AbortSignal.timeout(30000),
        })
        if (scrapeRes.ok) {
          const scrapeData = await scrapeRes.json()
          const headline = scrapeData.text || scrapeData.headline || scrapeData.title || 'News content scraped'
          posts = [`[Scraped] ${headline}`]
        }
      }
    } catch (fetchError) {
      console.error('External agent call failed:', fetchError)
      // Log the failed scan attempt
      await prisma.activityLog.create({
        data: {
          agentId: agent.id,
          action: 'News scan failed',
          type: 'alert',
          category: agent.category,
          detail: `Failed to reach external agent at ${baseUrl}. The agent may be temporarily unavailable.`,
        },
      })

      await prisma.agent.update({
        where: { id: agent.id },
        data: { lastScannedAt: new Date() },
      })

      return NextResponse.json({
        success: false,
        message: 'External agent unreachable',
        postsCreated: 0,
      })
    }

    // Create approval items for each generated post
    const createdApprovals = []
    for (const post of posts) {
      if (!post || !post.trim()) continue
      const approval = await prisma.approvalItem.create({
        data: {
          agentId: agent.id,
          action: 'Publish social media post',
          detail: post.trim(),
          urgency: 'medium',
          status: 'pending',
          reasoning: 'Auto-generated from KUTV news scan',
        },
      })
      createdApprovals.push(approval)
    }

    // Log the scan activity
    await prisma.activityLog.create({
      data: {
        agentId: agent.id,
        action: `News scan completed`,
        type: 'auto',
        category: agent.category,
        detail: `Scanned news and generated ${createdApprovals.length} post${createdApprovals.length === 1 ? '' : 's'} for approval.`,
      },
    })

    // Update lastScannedAt
    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastScannedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      postsCreated: createdApprovals.length,
      approvals: createdApprovals,
    })
  } catch (error) {
    console.error('Trigger POST error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger agent' },
      { status: 500 }
    )
  }
}
