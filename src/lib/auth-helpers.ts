import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function getSessionUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new AuthError('Not authenticated')
  }

  // Verify user still exists in DB (could have been deleted by re-seed)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  })
  if (!user) {
    throw new AuthError('Account not found — please register again')
  }

  return session.user.id
}
