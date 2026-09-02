'use client'

import { useTheme } from '@teispace/next-themes'
import { Moon, Sun, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface TopBarProps {
  user: {
    name: string | null
    email: string
    avatar_url: string | null
    position: string | null
    branch: string | null
  }
  title?: string
  unreadCount?: number
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TopBar({ user, title, unreadCount = 0 }: TopBarProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      {/* Left: Page Title + Active Workspace Info */}
      <div className="flex items-center gap-4">
        <div className="w-10 md:hidden" /> {/* spacer for mobile hamburger */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {title ?? 'Dashboard'}
          </h1>
          {user.position && (
            <p className="text-xs text-muted-foreground">
              {user.position} · {user.branch}
            </p>
          )}
        </div>
      </div>

      {/* Right: Notifications + Theme Toggle + User Menu */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link href="/notifications">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
            <span className="sr-only">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            </span>
          </Button>
        </Link>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* User Pill (non-clickable) */}
        <div className="flex h-9 items-center gap-2 rounded-full px-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.avatar_url ?? undefined} alt={user.name ?? ''} />
            <AvatarFallback className="text-xs font-medium">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:inline-block">
            {user.name?.split(' ')[0] ?? 'User'}
          </span>
        </div>
      </div>
    </header>
  )
}
