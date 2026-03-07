import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'
import { orchestrateSync } from '@/lib/orchestrator'

export const maxDuration = 60

export async function POST() {
  try {
    const userId = await getSessionUserId()

    // Get API key for triage
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY

    const result = await orchestrateSync(userId, apiKey)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Sync POST error:', error)
    return NextResponse.json({ error: 'Failed to sync agents' }, { status: 500 })
  }
}
