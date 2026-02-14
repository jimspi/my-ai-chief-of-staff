'use client'

import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center animate-fade-in">
        <p className="font-mono text-6xl font-bold text-accent-teal mb-2">404</p>
        <h1 className="font-heading text-2xl text-text-primary mb-2">Page Not Found</h1>
        <p className="text-sm text-text-secondary mb-8 max-w-sm mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary text-sm inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            Command Center
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
