'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Landmark,
  LayoutDashboard,
  Building2,
  Users,
  BadgeCheck,
  Inbox,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { signOut } from '@/app/auth/actions'

// ── Navigation Config ────────────────────────────────────────
// Static — every super admin sees every item, no permission gating.

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/superadmin', icon: LayoutDashboard },
  { label: 'Organizations', href: '/superadmin/organizations', icon: Building2 },
  { label: 'Users', href: '/superadmin/users', icon: Users },
  { label: 'Positions', href: '/superadmin/positions', icon: BadgeCheck },
  { label: 'Position Requests', href: '/superadmin/position-requests', icon: Inbox },
  { label: 'Audit Logs', href: '/superadmin/audit', icon: ScrollText },
  { label: 'Settings', href: '/superadmin/settings', icon: Settings },
]

// ── Props ────────────────────────────────────────────────────

interface SuperAdminUser {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
}

interface SuperAdminSidebarProps {
  user: SuperAdminUser
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Sidebar Content (shared between desktop and mobile) ──────

function SidebarContent({
  user,
  collapsed,
}: {
  user: SuperAdminUser
  collapsed: boolean
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Landmark className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-sidebar-foreground">Atrium</span>
            <Badge
              variant="destructive"
              className="h-4 w-fit px-1.5 text-[9px] font-semibold tracking-wide"
            >
              SUPER ADMIN
            </Badge>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav>
          <ul className="space-y-1">
            {NAV.map((item) => {
              const isActive =
                item.href === '/superadmin'
                  ? pathname === '/superadmin'
                  : pathname.startsWith(item.href)
              const Icon = item.icon

              const linkContent = (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )

              if (collapsed) {
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                )
              }

              return <li key={item.href}>{linkContent}</li>
            })}
          </ul>
        </nav>
      </ScrollArea>

      {/* User Card */}
      <div className="border-t border-sidebar-border p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name ?? 'Super Admin'}
              </span>
              <span className="truncate text-[10px] text-sidebar-foreground/50">
                {user.email}
              </span>
            </div>
          )}
          {!collapsed && (
            <form action={signOut}>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Desktop Sidebar + Mobile Sheet ────────────────────────────

export function SuperAdminSidebar({ user }: SuperAdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        <SidebarContent user={user} collapsed={collapsed} />

        {/* Collapse Toggle */}
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="mx-auto flex h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet>
        <SheetTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-40 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent user={user} collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  )
}
