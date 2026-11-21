'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { TrackerLayout } from '@/components/tracker-layout'
import { Providers } from '@/app/providers'
import { isSupabaseConfigured } from '@/lib/supabase-client'
import Link from 'next/link'

export default function TrackerRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Providers><TrackerAuthGate>{children}</TrackerAuthGate></Providers>
}

function TrackerAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { session, isLoading } = useAuth()

  useEffect(() => {
    if (isSupabaseConfigured && !isLoading && !session) {
      router.push('/sign-in')
    }
  }, [session, isLoading, router])

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">Account features aren’t configured</h1>
          <p className="text-gray-600">Your existing task workspace is preserved. Free guided meditations are available without an account.</p>
          <Link href="/" className="inline-block rounded-full bg-teal-800 px-6 py-3 text-white">Explore meditations</Link>
        </div>
      </main>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return <TrackerLayout>{children}</TrackerLayout>
}
