import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Upsert demo user (won't delete other registered users)
  const hashedPassword = await bcrypt.hash('demo1234', 12)
  const user = await prisma.user.upsert({
    where: { email: 'alex@example.com' },
    update: {},
    create: {
      id: 'demo-user-001',
      name: 'Alex Chen',
      email: 'alex@example.com',
      password: hashedPassword,
      timezone: 'America/New_York',
      settings: JSON.stringify({}),
    },
  })
  console.log(`Ensured user: ${user.name} (${user.email})`)

  // Upsert news agent
  await prisma.agent.upsert({
    where: { id: 'agent-echo' },
    update: { externalUrl: 'https://news-agent-sigma-eight.vercel.app' },
    create: {
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
  console.log('Ensured news agent (Echo)')

  // Upsert DeepCut research agent
  await prisma.agent.upsert({
    where: { id: 'agent-deepcut' },
    update: { externalUrl: 'https://deepcut-five.vercel.app' },
    create: {
      id: 'agent-deepcut',
      userId: user.id,
      name: 'DeepCut',
      icon: 'Search',
      category: 'Research',
      description: 'Surfaces research ideas and deep-dive topics for review.',
      status: 'active',
      externalUrl: 'https://deepcut-five.vercel.app',
      scanInterval: 30,
    },
  })
  console.log('Ensured research agent (DeepCut)')

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
