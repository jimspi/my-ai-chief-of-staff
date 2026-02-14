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

  // Clean existing data in reverse dependency order
  await prisma.conflictAgent.deleteMany()
  await prisma.conflict.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.approvalItem.deleteMany()
  await prisma.governanceRule.deleteMany()
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
      settings: JSON.stringify({
        notifications: { email: true, push: true, inApp: true, urgencyThreshold: 'medium' },
        dataRetention: '90',
        onboardingComplete: false,
      }),
    },
  })
  console.log(`Created user: ${user.name} (${user.email})`)

  // Create 7 diverse agents
  const [echo, hermes, vault, chronos, sentinel, pulse, scout] = await Promise.all([
    prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Echo',
        icon: 'Newspaper',
        category: 'News',
        description: 'Monitors RSS feeds and news APIs for breaking stories. Drafts social media posts and summaries for review before publishing.',
        status: 'active',
        autonomyLevel: 'medium',
        budget: 150,
        budgetUsed: 87.50,
        budgetPeriod: 'monthly',
        externalUrl: 'https://news-agent-sigma-eight.vercel.app',
        lastScannedAt: ago(45 * 60 * 1000),
        scanInterval: 30,
      },
    }),
    prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Hermes',
        icon: 'Mail',
        category: 'Communication',
        description: 'Manages email inbox — drafts replies, categorizes messages, flags urgent items, and auto-responds to routine queries.',
        status: 'active',
        autonomyLevel: 'low',
        budget: 75,
        budgetUsed: 32.10,
        budgetPeriod: 'monthly',
      },
    }),
    prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Vault',
        icon: 'ShoppingCart',
        category: 'Finance',
        description: 'Tracks expenses, categorizes transactions, alerts on unusual spending, and generates weekly financial summaries.',
        status: 'active',
        autonomyLevel: 'low',
        budget: 500,
        budgetUsed: 215.80,
        budgetPeriod: 'monthly',
      },
    }),
    prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Chronos',
        icon: 'Calendar',
        category: 'Scheduling',
        description: 'Optimizes your calendar — suggests meeting times, blocks focus periods, and resolves scheduling conflicts automatically.',
        status: 'active',
        autonomyLevel: 'high',
        budget: 50,
        budgetUsed: 18.20,
        budgetPeriod: 'monthly',
      },
    }),
    prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Sentinel',
        icon: 'Scale',
        category: 'Legal',
        description: 'Reviews contracts and legal documents, highlighting key terms, risks, and deadlines. Flags clauses requiring human review.',
        status: 'paused',
        autonomyLevel: 'low',
        budget: 300,
        budgetUsed: 0,
        budgetPeriod: 'monthly',
      },
    }),
    prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Pulse',
        icon: 'Heart',
        category: 'Health',
        description: 'Tracks wellness data from connected devices, suggests routines, and monitors health trends over time.',
        status: 'active',
        autonomyLevel: 'medium',
        budget: 25,
        budgetUsed: 12.40,
        budgetPeriod: 'monthly',
      },
    }),
    prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Scout',
        icon: 'Search',
        category: 'Research',
        description: 'Deep-dives into topics on demand — compiles research briefs with sources and key findings from papers and reports.',
        status: 'active',
        autonomyLevel: 'medium',
        budget: 200,
        budgetUsed: 94.60,
        budgetPeriod: 'monthly',
      },
    }),
  ])
  console.log('Created 7 agents')

  // Pending approvals — varied urgency and types
  await Promise.all([
    prisma.approvalItem.create({
      data: {
        agentId: echo.id,
        action: 'Publish Twitter thread on AI regulation',
        detail: 'Thread: The EU AI Act just passed its final vote. Here\'s what it means for developers:\n\n1/ Risk-based framework with 4 tiers.\n2/ High-risk AI (healthcare, hiring) needs conformity assessments.\n3/ General-purpose AI faces new transparency requirements.\n4/ Fines up to 7% of global revenue for violations.',
        amount: 2.50,
        urgency: 'high',
        riskTag: 'content-sensitive',
        reasoning: 'Breaking regulatory news. Flagged for review due to political sensitivity.',
      },
    }),
    prisma.approvalItem.create({
      data: {
        agentId: hermes.id,
        action: 'Send follow-up email to investor',
        detail: 'Subject: Re: Q1 Partnership Discussion\n\nHi Sarah,\n\nThank you for the productive call last Tuesday. I\'d love to schedule a follow-up to dive deeper into partnership terms. Would Thursday at 2pm ET work?\n\nI\'ve attached the preliminary proposal.\n\nBest regards,\nAlex',
        amount: 0.15,
        urgency: 'high',
        riskTag: 'financial-communication',
        reasoning: 'Follow-up to investor meeting. Flagged due to financial stakeholder involvement.',
      },
    }),
    prisma.approvalItem.create({
      data: {
        agentId: vault.id,
        action: 'Flag unusual transaction pattern',
        detail: 'Detected 3 recurring charges from "CloudServe Pro" totaling $847 this month — 240% above the $250 average. Two new subscription tiers added Feb 3rd. Recommend reviewing cloud spending.',
        amount: 847.00,
        urgency: 'high',
        riskTag: 'financial-alert',
        reasoning: 'Spending anomaly. Monthly cloud costs significantly exceed baseline.',
      },
    }),
    prisma.approvalItem.create({
      data: {
        agentId: echo.id,
        action: 'Publish LinkedIn article on remote work',
        detail: 'Title: "Remote Work in 2026: The Data Behind the Debate"\n\nKey findings from 50+ companies:\n- Hybrid models dominate at 63%\n- Fully remote teams report 12% higher productivity\n- The RTO push has slowed\n\n1,200 words with 4 data visualizations.',
        amount: 3.20,
        urgency: 'medium',
        reasoning: 'Data-driven piece. No sensitive claims detected.',
      },
    }),
    prisma.approvalItem.create({
      data: {
        agentId: chronos.id,
        action: 'Reschedule team standup to resolve conflict',
        detail: 'Conflict: "Team Standup" and "Client Demo Prep" both at 10 AM Monday. Proposing standup at 9:30 AM. 4 of 5 members confirmed availability.',
        urgency: 'medium',
        reasoning: 'Calendar conflict. Most participants available at new time.',
      },
    }),
    prisma.approvalItem.create({
      data: {
        agentId: scout.id,
        action: 'Purchase research paper access',
        detail: 'Requesting access to "Advances in Multi-Agent Systems: A Comprehensive Survey" (2025, IEEE). Cost: $39.99. 847 citations, directly relevant to agent orchestration brief.',
        amount: 39.99,
        urgency: 'low',
        reasoning: 'Academic paper purchase. High citation count. Relevant to active research.',
      },
    }),
    prisma.approvalItem.create({
      data: {
        agentId: pulse.id,
        action: 'Share weekly health summary with Dr. Martinez',
        detail: 'Weekly report:\n- Avg sleep: 7.2 hrs (up from 6.8)\n- Steps: 9,400/day\n- Resting HR: 62 bpm\n- Stress: moderate (3.2/5)\n\nContains personal health data. Dr. Martinez is authorized.',
        urgency: 'low',
        riskTag: 'privacy-sensitive',
        reasoning: 'PII sharing requires explicit approval per governance rules.',
      },
    }),
    prisma.approvalItem.create({
      data: {
        agentId: hermes.id,
        action: 'Auto-reply to sales inquiry',
        detail: 'From: TechVentures Corp — requesting Enterprise pricing.\n\nDraft: "Thank you for your interest. I\'d be happy to schedule a demo. Could you share your team size and use case? Available times: [calendar link]"',
        amount: 0.10,
        urgency: 'low',
        reasoning: 'Routine sales inquiry. Template-based reply.',
      },
    }),
  ])
  console.log('Created 8 pending approvals')

  // Activity logs — rich history across agents
  await Promise.all([
    // Today
    prisma.activityLog.create({
      data: {
        agentId: echo.id,
        action: 'Published Twitter post: "5 AI tools reshaping content creation"',
        type: 'approved', category: 'News',
        detail: 'Thread published. 234 likes, 89 retweets within first hour.',
        metadata: JSON.stringify({ platform: 'twitter', likes: 234, retweets: 89 }),
        createdAt: ago(2 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: chronos.id,
        action: 'Auto-scheduled focus block: Deep Work 2-4pm',
        type: 'auto', category: 'Scheduling',
        detail: 'Blocked 2-hour focus period based on productivity patterns.',
        metadata: JSON.stringify({ duration: 120 }),
        createdAt: ago(3 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: vault.id,
        action: 'Generated weekly expense report',
        type: 'auto', category: 'Finance',
        detail: 'Total: $1,247.30. Top: Cloud Services ($623). 2 anomalies flagged.',
        metadata: JSON.stringify({ total: 1247.30, anomalies: 2 }),
        createdAt: ago(4 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: hermes.id,
        action: 'Categorized 47 emails: 12 urgent, 23 routine, 12 spam',
        type: 'auto', category: 'Communication',
        detail: 'Morning inbox triage complete. 12 emails flagged as urgent.',
        metadata: JSON.stringify({ total: 47, urgent: 12, routine: 23, spam: 12 }),
        createdAt: ago(5 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: echo.id,
        action: 'Denied: Repost competitor product announcement',
        type: 'denied', category: 'News',
        detail: 'Blocked by rule: "Post mentions competitor brand".',
        metadata: JSON.stringify({ rule: 'competitor-mention' }),
        createdAt: ago(6 * hour),
      },
    }),
    // Yesterday
    prisma.activityLog.create({
      data: {
        agentId: scout.id,
        action: 'Completed brief: Multi-Agent Orchestration Patterns',
        type: 'approved', category: 'Research',
        detail: '23 sources compiled into 8-page report with architecture diagrams.',
        metadata: JSON.stringify({ sources: 23, pages: 8 }),
        createdAt: ago(1 * day + 2 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: pulse.id,
        action: 'Alert: Below-average sleep 3 consecutive nights',
        type: 'alert', category: 'Health',
        detail: 'Sleep dropped to 5.8 hrs avg (baseline 7.1). Stress elevated.',
        metadata: JSON.stringify({ sleepAvg: 5.8, baseline: 7.1 }),
        createdAt: ago(1 * day + 4 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: vault.id,
        action: 'Auto-categorized 15 transactions',
        type: 'auto', category: 'Finance',
        detail: '7 SaaS, 4 meals, 2 travel, 2 office supplies.',
        createdAt: ago(1 * day + 6 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: chronos.id,
        action: 'Resolved scheduling conflict between 3 meetings',
        type: 'approved', category: 'Scheduling',
        detail: 'Moved "1:1 with Sarah" to 3pm, "Design Review" to Friday.',
        createdAt: ago(1 * day + 8 * hour),
      },
    }),
    // 2 days ago
    prisma.activityLog.create({
      data: {
        agentId: hermes.id,
        action: 'Alert: Potential phishing email detected',
        type: 'alert', category: 'Communication',
        detail: 'From "supprt@bankofarneria.com" — suspicious link. Quarantined.',
        metadata: JSON.stringify({ sender: 'supprt@bankofarneria.com', confidence: 0.97 }),
        createdAt: ago(2 * day + 3 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: echo.id,
        action: 'Published newsletter: Weekly AI Digest #47',
        type: 'approved', category: 'News',
        detail: 'Sent to 2,847 subscribers. Open rate: 34.2%.',
        metadata: JSON.stringify({ subscribers: 2847, openRate: 0.342 }),
        createdAt: ago(2 * day + 5 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: vault.id,
        action: 'Alert: Budget threshold 85% for Cloud Services',
        type: 'alert', category: 'Finance',
        detail: '$425 of $500 spent. At current rate, exceeds budget by Feb 22.',
        metadata: JSON.stringify({ spent: 425, budget: 500 }),
        createdAt: ago(2 * day + 7 * hour),
      },
    }),
    // 3 days ago
    prisma.activityLog.create({
      data: {
        agentId: scout.id,
        action: 'Started research: AI Governance Frameworks',
        type: 'auto', category: 'Research',
        detail: 'Initiated deep research on EU, US, UK, China frameworks.',
        createdAt: ago(3 * day + 1 * hour),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: chronos.id,
        action: 'Auto-declined 3 meetings during focus time',
        type: 'auto', category: 'Scheduling',
        detail: 'Politely declined non-priority requests. Suggested alternatives.',
        createdAt: ago(3 * day + 4 * hour),
      },
    }),
  ])
  console.log('Created 14 activity logs')

  // Governance rules — global + agent-specific
  await Promise.all([
    // Global rules
    prisma.governanceRule.create({
      data: { userId: user.id, condition: 'Post contains sensitive keywords', action: 'require-approval', threshold: 'political, legal, financial advice', isActive: true, priority: 10 },
    }),
    prisma.governanceRule.create({
      data: { userId: user.id, condition: 'Post mentions competitor brand', action: 'block', isActive: true, priority: 9 },
    }),
    prisma.governanceRule.create({
      data: { userId: user.id, condition: 'Amount exceeds threshold', action: 'require-approval', threshold: '$100', isActive: true, priority: 8 },
    }),
    prisma.governanceRule.create({
      data: { userId: user.id, condition: 'Time is outside hours', action: 'block', threshold: '11pm-6am', isActive: true, priority: 7 },
    }),
    // Agent-specific
    prisma.governanceRule.create({
      data: { userId: user.id, agentId: echo.id, condition: 'Scan finds breaking news', action: 'require-approval', isActive: true, priority: 5 },
    }),
    prisma.governanceRule.create({
      data: { userId: user.id, agentId: vault.id, condition: 'Amount exceeds threshold', action: 'notify', threshold: '$50', isActive: true, priority: 5 },
    }),
    prisma.governanceRule.create({
      data: { userId: user.id, agentId: hermes.id, condition: 'Action involves external service', action: 'require-approval', isActive: true, priority: 5 },
    }),
    prisma.governanceRule.create({
      data: { userId: user.id, agentId: chronos.id, condition: 'Frequency exceeds limit', action: 'auto-approve', threshold: '5 per day', isActive: true, priority: 3 },
    }),
  ])
  console.log('Created 8 governance rules')

  // Transactions — spread across agents and days for chart data
  await Promise.all([
    // Echo
    prisma.transaction.create({ data: { agentId: echo.id, description: 'Twitter API usage', amount: 12.50, createdAt: ago(1 * hour) } }),
    prisma.transaction.create({ data: { agentId: echo.id, description: 'News API subscription', amount: 29.99, createdAt: ago(1 * day) } }),
    prisma.transaction.create({ data: { agentId: echo.id, description: 'Content generation (GPT-4)', amount: 18.40, createdAt: ago(2 * day) } }),
    prisma.transaction.create({ data: { agentId: echo.id, description: 'Image generation', amount: 8.20, createdAt: ago(3 * day) } }),
    prisma.transaction.create({ data: { agentId: echo.id, description: 'RSS aggregation', amount: 5.00, createdAt: ago(4 * day) } }),
    prisma.transaction.create({ data: { agentId: echo.id, description: 'LinkedIn API', amount: 13.41, createdAt: ago(5 * day) } }),
    // Hermes
    prisma.transaction.create({ data: { agentId: hermes.id, description: 'Email API usage', amount: 8.50, createdAt: ago(2 * hour) } }),
    prisma.transaction.create({ data: { agentId: hermes.id, description: 'GPT-4 email drafting', amount: 15.20, createdAt: ago(1 * day) } }),
    prisma.transaction.create({ data: { agentId: hermes.id, description: 'Spam classification', amount: 4.80, createdAt: ago(3 * day) } }),
    prisma.transaction.create({ data: { agentId: hermes.id, description: 'Sentiment analysis', amount: 3.60, createdAt: ago(5 * day) } }),
    // Vault
    prisma.transaction.create({ data: { agentId: vault.id, description: 'Plaid API', amount: 25.00, createdAt: ago(1 * day) } }),
    prisma.transaction.create({ data: { agentId: vault.id, description: 'GPT-4 categorization', amount: 12.30, createdAt: ago(2 * day) } }),
    prisma.transaction.create({ data: { agentId: vault.id, description: 'Report generation', amount: 8.50, createdAt: ago(3 * day) } }),
    prisma.transaction.create({ data: { agentId: vault.id, description: 'Anomaly detection', amount: 45.00, createdAt: ago(4 * day) } }),
    prisma.transaction.create({ data: { agentId: vault.id, description: 'Bank feed sync', amount: 15.00, createdAt: ago(5 * day) } }),
    prisma.transaction.create({ data: { agentId: vault.id, description: 'Forecast computation', amount: 110.00, createdAt: ago(6 * day) } }),
    // Chronos
    prisma.transaction.create({ data: { agentId: chronos.id, description: 'Calendar API', amount: 5.00, createdAt: ago(1 * day) } }),
    prisma.transaction.create({ data: { agentId: chronos.id, description: 'Meeting optimization', amount: 8.20, createdAt: ago(3 * day) } }),
    prisma.transaction.create({ data: { agentId: chronos.id, description: 'Availability polling', amount: 5.00, createdAt: ago(5 * day) } }),
    // Scout
    prisma.transaction.create({ data: { agentId: scout.id, description: 'Academic DB access', amount: 39.99, createdAt: ago(1 * day) } }),
    prisma.transaction.create({ data: { agentId: scout.id, description: 'GPT-4 synthesis', amount: 28.40, createdAt: ago(2 * day) } }),
    prisma.transaction.create({ data: { agentId: scout.id, description: 'Web scraping API', amount: 15.00, createdAt: ago(4 * day) } }),
    prisma.transaction.create({ data: { agentId: scout.id, description: 'Citation analysis', amount: 11.21, createdAt: ago(6 * day) } }),
    // Pulse
    prisma.transaction.create({ data: { agentId: pulse.id, description: 'Health API', amount: 5.00, createdAt: ago(2 * day) } }),
    prisma.transaction.create({ data: { agentId: pulse.id, description: 'Data analysis', amount: 7.40, createdAt: ago(5 * day) } }),
  ])
  console.log('Created 25 transactions')

  // Conflicts
  const [c1, c2, c3] = await Promise.all([
    prisma.conflict.create({
      data: {
        description: 'Echo wants to publish a competitor pricing post while Vault flagged the same competitor as a potential partner.',
        status: 'active',
      },
    }),
    prisma.conflict.create({
      data: {
        description: 'Chronos scheduled a meeting during a focus block that Pulse recommended for stress recovery.',
        status: 'active',
      },
    }),
    prisma.conflict.create({
      data: {
        description: 'Scout and Echo both hitting the same research API, causing rate limits.',
        status: 'resolved',
        resolution: 'Implemented request queuing. Echo gets priority 6-10 AM, Scout gets priority otherwise.',
        resolvedAt: ago(2 * day),
      },
    }),
  ])

  await Promise.all([
    prisma.conflictAgent.create({ data: { conflictId: c1.id, agentId: echo.id } }),
    prisma.conflictAgent.create({ data: { conflictId: c1.id, agentId: vault.id } }),
    prisma.conflictAgent.create({ data: { conflictId: c2.id, agentId: chronos.id } }),
    prisma.conflictAgent.create({ data: { conflictId: c2.id, agentId: pulse.id } }),
    prisma.conflictAgent.create({ data: { conflictId: c3.id, agentId: scout.id } }),
    prisma.conflictAgent.create({ data: { conflictId: c3.id, agentId: echo.id } }),
  ])
  console.log('Created 3 conflicts (2 active, 1 resolved)')

  console.log('\nSeed complete!')
  console.log('Login: alex@example.com / demo1234')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
