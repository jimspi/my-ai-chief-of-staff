import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const hour = 60 * 60 * 1000
const day = 24 * hour

function ago(ms: number): Date {
  return new Date(Date.now() - ms)
}

async function main() {
  console.log('Seeding database...')

  // Clean existing data
  await prisma.activityLog.deleteMany()
  await prisma.approvalItem.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.user.deleteMany()
  console.log('Cleaned existing data.')

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo1234', 12)
  const user = await prisma.user.create({
    data: {
      id: 'demo-user-001',
      name: 'Alex Chen',
      email: 'alex@example.com',
      password: hashedPassword,
      timezone: 'America/New_York',
      settings: JSON.stringify({ onboardingComplete: false }),
    },
  })
  console.log(`Created user: ${user.name} (${user.email})`)

  // Create 3 agents
  const echo = await prisma.agent.create({
    data: {
      id: 'agent-echo',
      userId: user.id,
      name: 'Echo',
      icon: 'Newspaper',
      category: 'News',
      description: 'Monitors news feeds and drafts social media posts about trending topics in your industry.',
      status: 'active',
      externalUrl: 'https://news-agent-sigma-eight.vercel.app',
      lastScannedAt: ago(2 * hour),
      scanInterval: 30,
    },
  })

  const hermes = await prisma.agent.create({
    data: {
      id: 'agent-hermes',
      userId: user.id,
      name: 'Hermes',
      icon: 'Mail',
      category: 'Communication',
      description: 'Drafts and manages email communications, follow-ups, and auto-responses.',
      status: 'active',
    },
  })

  const scout = await prisma.agent.create({
    data: {
      id: 'agent-scout',
      userId: user.id,
      name: 'Scout',
      icon: 'Search',
      category: 'Research',
      description: 'Conducts deep research on topics, compiles reports, and aggregates sources.',
      status: 'active',
    },
  })

  console.log('Created 3 agents')

  // Create 5 pending content items
  await prisma.approvalItem.createMany({
    data: [
      {
        agentId: echo.id,
        action: 'Publish Twitter thread on AI regulation',
        detail: 'New EU AI Act enforcement begins next month. Thread covers: key compliance requirements, impact on startups, and what founders need to do now. 6 tweets drafted with sources.',
        urgency: 'high',
        reasoning: 'Breaking regulatory news with high engagement potential. Time-sensitive as enforcement date approaches.',
        createdAt: ago(1 * hour),
      },
      {
        agentId: echo.id,
        action: 'Post LinkedIn article on remote work trends',
        detail: 'Analysis of 2026 remote work data showing hybrid models outperforming full-remote by 23% in employee satisfaction. Article includes 3 charts and expert quotes.',
        urgency: 'medium',
        reasoning: 'Trending topic in your network. Multiple connections have shared related content this week.',
        createdAt: ago(3 * hour),
      },
      {
        agentId: hermes.id,
        action: 'Send follow-up email to investor',
        detail: 'Draft follow-up to Sarah Kim (Vertex Ventures) regarding Series A conversation from last Tuesday. Includes updated traction metrics and asks for next meeting.',
        urgency: 'high',
        reasoning: 'No response in 5 days. Best practice is to follow up within a week of initial meeting.',
        createdAt: ago(2 * hour),
      },
      {
        agentId: hermes.id,
        action: 'Auto-reply template for partnership inquiries',
        detail: 'Professional auto-response acknowledging receipt of partnership proposals. Includes timeline expectation (5 business days) and links to partnership criteria page.',
        urgency: 'low',
        reasoning: 'You received 3 partnership inquiries this week with no response template configured.',
        createdAt: ago(6 * hour),
      },
      {
        agentId: scout.id,
        action: 'Research brief: Competitor product launches Q1 2026',
        detail: 'Compiled analysis of 4 competitor launches this quarter. Covers feature comparisons, pricing changes, and market positioning shifts. 12 sources cited.',
        urgency: 'medium',
        reasoning: 'Quarterly competitive intelligence refresh. Two competitors announced major updates this week.',
        createdAt: ago(4 * hour),
      },
    ],
  })
  console.log('Created 5 content items')

  // Create 8 activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        agentId: echo.id,
        action: 'Scanned news feeds',
        type: 'auto',
        category: 'News',
        detail: 'Found 12 relevant articles across 5 RSS feeds. Generated 2 draft posts.',
        createdAt: ago(1 * hour),
      },
      {
        agentId: echo.id,
        action: 'Published tweet about AI funding trends',
        type: 'approved',
        category: 'News',
        detail: 'Tweet published with 47 impressions in first hour.',
        metadata: JSON.stringify({ impressions: 47, likes: 5 }),
        createdAt: ago(5 * hour),
      },
      {
        agentId: hermes.id,
        action: 'Categorized 23 incoming emails',
        type: 'auto',
        category: 'Communication',
        detail: 'Sorted into: 8 important, 11 informational, 4 spam. Flagged 2 requiring response.',
        createdAt: ago(2 * hour),
      },
      {
        agentId: hermes.id,
        action: 'Sent meeting confirmation to team',
        type: 'approved',
        category: 'Communication',
        detail: 'Confirmed Q1 planning session for Friday 2pm with 6 attendees.',
        createdAt: ago(8 * hour),
      },
      {
        agentId: scout.id,
        action: 'Compiled market research report',
        type: 'auto',
        category: 'Research',
        detail: 'Aggregated data from 15 sources on AI SaaS market trends. Report ready for review.',
        createdAt: ago(3 * hour),
      },
      {
        agentId: scout.id,
        action: 'Flagged conflicting market data',
        type: 'alert',
        category: 'Research',
        detail: 'Two sources report contradicting growth figures for AI market (Gartner vs IDC). Needs human review.',
        createdAt: ago(4 * hour),
      },
      {
        agentId: echo.id,
        action: 'Dismissed draft about cryptocurrency regulation',
        type: 'denied',
        category: 'News',
        detail: 'Content flagged as off-topic for your audience. Draft archived.',
        createdAt: ago(1 * day),
      },
      {
        agentId: hermes.id,
        action: 'Drafted weekly newsletter',
        type: 'auto',
        category: 'Communication',
        detail: 'Weekly update compiled with 5 highlights from this week. Ready for review.',
        createdAt: ago(6 * hour),
      },
    ],
  })
  console.log('Created 8 activity logs')

  console.log('\nSeed complete!')
  console.log('Login: alex@example.com / demo1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
