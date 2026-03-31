'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DigestPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [html, setHtml] = useState<string | null>(null)
  const [runAt, setRunAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: run, error: runErr } = await supabase
        .from('digest_runs')
        .select('output_html, run_at')
        .eq('id', params.id)
        .single()

      if (runErr || !run) {
        setError('Digest not found.')
      } else {
        setHtml(run.output_html ?? '')
        setRunAt(run.run_at)
      }

      setLoading(false)
    }

    load()
  }, [params.id, router])

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
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Digest
          </h1>
          {runAt && (
            <p className="text-sm text-zinc-500 mt-1">
              {new Date(runAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : html ? (
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 prose prose-zinc dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-zinc-500">No content for this digest.</p>
        )}
      </div>
    </div>
  )
}
