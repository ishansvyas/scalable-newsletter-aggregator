'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type OrgConfig = {
  id: string
  source_email: string | null
  recipients: string[] | null
  system_prompt: string | null
  llm_model: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [config, setConfig] = useState<OrgConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [sourceEmail, setSourceEmail] = useState('')
  const [recipients, setRecipients] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [llmModel, setLlmModel] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_email', user.email)
        .single()

      if (orgErr || !org) {
        setError('No organization found for this account.')
        setLoading(false)
        return
      }

      const { data: cfg, error: cfgErr } = await supabase
        .from('org_configs')
        .select('id, source_email, recipients, system_prompt, llm_model')
        .eq('org_id', org.id)
        .single()

      if (cfgErr || !cfg) {
        setError('No config found for this organization.')
        setLoading(false)
        return
      }

      setConfig(cfg)
      setSourceEmail(cfg.source_email ?? '')
      setRecipients((cfg.recipients ?? []).join(', '))
      setSystemPrompt(cfg.system_prompt ?? '')
      setLlmModel(cfg.llm_model ?? '')
      setLoading(false)
    }

    load()
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!config) return

    setSaving(true)
    setSaved(false)
    setError(null)

    const recipientList = recipients
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)

    const { error: updateErr } = await supabase
      .from('org_configs')
      .update({
        source_email: sourceEmail,
        recipients: recipientList,
        system_prompt: systemPrompt,
        llm_model: llmModel || null,
      })
      .eq('id', config.id)

    if (updateErr) {
      setError('Failed to save settings.')
    } else {
      setSaved(true)
    }

    setSaving(false)
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
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Settings
          </h1>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-6">{error}</p>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Source email
              </label>
              <input
                type="email"
                value={sourceEmail}
                onChange={(e) => setSourceEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="newsletters@gmail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Recipients
              </label>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="alice@example.com, bob@example.com"
              />
              <p className="mt-1 text-xs text-zinc-400">Comma-separated list of email addresses.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                System prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-y"
                placeholder="You are a newsletter summarizer…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                LLM model
              </label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="gemini-2.0-flash"
              />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 text-sm text-amber-800 dark:text-amber-300">
            <strong>Reminder:</strong> These settings update the database only. Your GitHub Actions workflow reads credentials from the <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">ORG_CONFIG</code> GitHub Secret — you must also update that secret manually for changes to take effect on the next run.
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-50 dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {saved && (
              <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
