import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function getSessionUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}
