import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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
      settings: JSON.stringify({}),
    },
  })
  console.log(`Created user: ${user.name} (${user.email})`)

  // Create news agent with real external URL
  await prisma.agent.create({
    data: {
      id: 'agent-echo',
      userId: user.id,
      name: 'Echo',
      icon: 'Newspaper',
      category: 'News',
      description: 'Monitors news feeds and surfaces articles for review.',
      status: 'active',
      externalUrl: 'https://news-agent-sigma-eight.vercel.app',
      scanInterval: 30,
    },
  })
  console.log('Created news agent (Echo)')

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
