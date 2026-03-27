'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DigestRun = {
  id: string
  run_at: string
  status: 'success' | 'failed'
  error_message: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [runs, setRuns] = useState<DigestRun[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      // Find the org whose owner_email matches the logged-in user
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('owner_email', user.email)
        .single()

      if (orgErr || !org) {
        setError('No organization found for this account.')
        setLoading(false)
        return
      }

      setOrgName(org.name)

      const { data: digestRuns, error: runsErr } = await supabase
        .from('digest_runs')
        .select('id, run_at, status, error_message')
        .eq('org_id', org.id)
        .order('run_at', { ascending: false })

      if (runsErr) {
        setError('Failed to load digest runs.')
      } else {
        setRuns(digestRuns ?? [])
      }

      setLoading(false)
    }

    load()
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Digest runs
            </h1>
            {orgName && (
              <p className="text-sm text-zinc-500 mt-1">{orgName}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {runs.length === 0 && !error ? (
          <p className="text-sm text-zinc-500">No runs yet.</p>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/digest/${run.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      run.status === 'success'
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm text-zinc-900 dark:text-zinc-50">
                    {new Date(run.run_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  {run.status === 'failed' && run.error_message && (
                    <span className="text-xs text-zinc-400 truncate max-w-xs">
                      {run.error_message}
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-400 capitalize">{run.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
