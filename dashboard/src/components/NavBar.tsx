'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthed(!!user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function navLink(href: string, label: string) {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`text-sm transition-colors ${
          active
            ? 'text-foreground'
            : 'text-foreground/50 hover:text-foreground'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-foreground/10 bg-background sticky top-0 z-10">
      <Link
        href="/"
        className="text-sm font-medium tracking-tight opacity-80 hover:opacity-100 transition-opacity"
      >
        Limina
      </Link>

      <div className="flex items-center gap-6">
        {authed === null ? (
          <span className="text-sm text-foreground/20">·</span>
        ) : authed ? (
          <>
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/settings', 'Settings')}
            <button
              onClick={handleSignOut}
              className="text-sm text-foreground/50 hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            {navLink('/about', 'About')}
            {navLink('/login', 'Sign in →')}
          </>
        )}
      </div>
    </nav>
  )
}
