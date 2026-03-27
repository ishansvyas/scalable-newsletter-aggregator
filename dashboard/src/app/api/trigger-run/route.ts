import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO // e.g. "username/scalable-newsletter-aggregator"

  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GitHub credentials not configured on server.' },
      { status: 500 }
    )
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/daily.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  // GitHub returns 204 No Content on success
  return NextResponse.json({ ok: true })
}
