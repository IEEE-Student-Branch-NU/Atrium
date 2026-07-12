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
  Bell,
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
  { label: 'Notifications', href: '/superadmin/notifications', icon: Bell },
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
  onToggleCollapse,
}: {
  user: SuperAdminUser
  collapsed: boolean
  onToggleCollapse?: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div 
        className={`flex h-16 items-center gap-3 border-b border-sidebar-border px-4 ${onToggleCollapse ? 'cursor-pointer hover:bg-sidebar-accent/50 transition-colors' : ''}`}
        onClick={onToggleCollapse}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Landmark className="h-5 w-5" />
        </div>
        {!collapsed && (
          <>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-sidebar-foreground">Atrium</span>
              <Badge
                variant="destructive"
                className="h-4 w-fit px-1.5 text-[9px] font-semibold tracking-wide"
              >
                SUPER ADMIN
              </Badge>
            </div>
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse();
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </>
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

              const linkClassName = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`

              const iconEl = (
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
              )

              if (collapsed) {
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger render={<Link href={item.href} className={linkClassName} />}>
                        {iconEl}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                )
              }

              return (
                <li key={item.href}>
                  <Link href={item.href} className={linkClassName}>
                    {iconEl}
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </ScrollArea>

      {/* User Card */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.name ?? 'Super Admin'}
                </span>
                <span className="truncate text-[10px] text-sidebar-foreground/50">
                  {user.email}
                </span>
              </div>
              <form action={signOut}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                      />
                    }
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </form>
            </>
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
        <SidebarContent 
          user={user} 
          collapsed={collapsed} 
          onToggleCollapse={() => setCollapsed(!collapsed)} 
        />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-4 top-4 z-40 md:hidden"
            />
          }
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent user={user} collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  )
}
