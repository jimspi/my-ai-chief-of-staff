import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeCode } from '@/lib/google'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/settings?google=error&reason=' + error, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?google=error&reason=missing_params', request.url))
  }

  try {
    const tokens = await exchangeCode(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/settings?google=error&reason=no_tokens', request.url))
    }

    // Get the user's Google email
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: tokens.access_token })
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()
    const googleEmail = userInfo.data.email || 'unknown'

    // Verify the user exists
    const user = await prisma.user.findUnique({ where: { id: state } })
    if (!user) {
      return NextResponse.redirect(new URL('/settings?google=error&reason=invalid_user', request.url))
    }

    // Upsert Google account
    await prisma.googleAccount.upsert({
      where: { userId: state },
      create: {
        userId: state,
        email: googleEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        scopes: tokens.scope || '',
      },
      update: {
        email: googleEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        scopes: tokens.scope || '',
      },
    })

    // Auto-create Gmail and Calendar agents if they don't exist
    const existingGmail = await prisma.agent.findFirst({
      where: { userId: state, category: 'Gmail' },
    })
    if (!existingGmail) {
      await prisma.agent.create({
        data: {
          userId: state,
          name: 'Gmail',
          icon: 'Mail',
          category: 'Gmail',
          description: `Monitors ${googleEmail} for unread emails and follow-ups`,
          status: 'active',
        },
      })
    }

    const existingCal = await prisma.agent.findFirst({
      where: { userId: state, category: 'Calendar' },
    })
    if (!existingCal) {
      await prisma.agent.create({
        data: {
          userId: state,
          name: 'Calendar',
          icon: 'Calendar',
          category: 'Calendar',
          description: `Tracks your Google Calendar events and reminders`,
          status: 'active',
        },
      })
    }

    return NextResponse.redirect(new URL('/settings?google=connected', request.url))
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?google=error&reason=exchange_failed', request.url))
  }
}
