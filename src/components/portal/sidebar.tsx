'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Landmark,
  LayoutDashboard,
  Calendar,
  CalendarPlus,
  CheckSquare,
  Users,
  UserPlus,
  ShieldCheck,
  ScrollText,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  User,
  Briefcase,
  ChevronsUpDown,
  Check,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/app/auth/actions'
import { switchWorkspace } from '@/app/(portal)/actions'
import type { UserMembership } from '@/lib/queries'

// ── Navigation Config ────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  permission?: string // required permission to see this item
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Events',
    items: [
      { label: 'Events', href: '/events', icon: Calendar },
      { label: 'Event Management', href: '/events/management', icon: LayoutDashboard, permission: 'manage_events' },
      { label: 'Create Event', href: '/events/create', icon: CalendarPlus, permission: 'create_events' },
      { label: 'Approve Events', href: '/events/approvals', icon: CheckSquare, permission: 'approve_events' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Registrations', href: '/approvals', icon: UserPlus, permission: 'approve_registrations' },
      { label: 'Position Requests', href: '/position-requests', icon: Briefcase, permission: 'manage_positions' },
      { label: 'Pre-Approved', href: '/pre-approved', icon: ShieldCheck, permission: 'approve_registrations' },
      { label: 'Members', href: '/members', icon: Users },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'About Me', href: '/profile', icon: User },
      { label: 'My Positions', href: '/profile#positions', icon: Briefcase },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Audit Log', href: '/audit', icon: ScrollText, permission: 'view_audit_log' },
      { label: 'Analytics', href: '/analytics', icon: BarChart3, permission: 'approve_registrations' },
    ],
  },
]

// ── Props ────────────────────────────────────────────────────

interface SidebarProps {
  user: {
    name: string | null
    email: string
    avatar_url: string | null
    position: string | null
    branch: string | null
  }
  permissions: string[]
  memberships: UserMembership[]
  activeMembershipId: string | null
}

// ── Helper: check if user has permission ─────────────────────

function canSee(permissions: string[], required?: string): boolean {
  if (!required) return true
  return permissions.includes('*') || permissions.includes(required)
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

// ── Role Switcher ────────────────────────────────────────────

function RoleSwitcher({
  memberships,
  activeMembershipId,
  collapsed,
}: {
  memberships: UserMembership[]
  activeMembershipId: string | null
  collapsed: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const activeMembership = memberships.find((m) => m.id === activeMembershipId)

  function handleSwitch(m: UserMembership) {
    if (m.id === activeMembershipId) return
    setSwitchingId(m.id)
    startTransition(async () => {
      const result = await switchWorkspace(m.id)
      if (result.success) {
        toast.success(`Switched to ${m.position_name ?? 'Member'} · ${m.branch_name}`)
        router.push('/')
      } else {
        toast.error(result.error ?? 'Could not switch workspace')
      }
      setSwitchingId(null)
    })
  }

  if (memberships.length <= 1) return null

  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <Tooltip>
          <TooltipTrigger render={<div className="inline-flex" />}>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-sidebar-foreground/70"
                  disabled={isPending}
                />
              }>
                <ChevronsUpDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => handleSwitch(m)}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.position_name ?? 'Member'}</p>
                      <p className="text-xs text-muted-foreground">{m.branch_name}</p>
                    </div>
                    {switchingId === m.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : m.id === activeMembershipId ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          <TooltipContent side="right">Switch Workspace</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-left cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50 hover:border-sidebar-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isPending}
          />
        }>
          <div className="flex min-w-0 flex-col items-start">
            <span
              key={activeMembership?.id ?? 'none'}
              className="text-xs font-semibold truncate w-full text-sidebar-foreground animate-in fade-in slide-in-from-left-1 duration-300"
            >
              {activeMembership?.position_name ?? 'Member'}
            </span>
            <span
              key={`branch-${activeMembership?.id ?? 'none'}`}
              className="text-[10px] text-sidebar-foreground/50 truncate w-full animate-in fade-in slide-in-from-left-1 duration-500"
            >
              {activeMembership?.branch_name ?? 'IEEE SBNU'}
            </span>
          </div>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sidebar-foreground/40" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[232px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Switch Workspace
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {memberships.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => handleSwitch(m)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.position_name ?? 'Member'}</p>
                <p className="text-xs text-muted-foreground truncate">{m.branch_name}</p>
              </div>
              {switchingId === m.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : m.id === activeMembershipId ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ── Sidebar Content (shared between desktop and mobile) ──────

function SidebarContent({
  permissions,
  user,
  memberships,
  activeMembershipId,
  collapsed,
  onToggleCollapse,
}: SidebarProps & { collapsed: boolean; onToggleCollapse?: () => void }) {
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
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Atrium</span>
              <span className="text-[10px] text-sidebar-foreground/60">IEEE SBNU Portal</span>
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

      {/* Role Switcher */}
      <RoleSwitcher
        memberships={memberships}
        activeMembershipId={activeMembershipId}
        collapsed={collapsed}
      />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) =>
              canSee(permissions, item.permission)
            )
            if (visibleItems.length === 0) return null

            return (
              <div key={section.title}>
                {!collapsed && (
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {section.title}
                  </p>
                )}
                <ul className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href.split('#')[0])
                    const Icon = item.icon

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    )

                    if (collapsed) {
                      return (
                        <li key={item.href}>
                          <Tooltip>
                            <TooltipTrigger render={linkContent} />
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
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User Card */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.avatar_url ?? undefined} alt={user.name ?? ''} />
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name ?? 'User'}
              </span>
              <div className="flex items-center gap-1.5">
                {user.position && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-medium">
                    {user.position}
                  </Badge>
                )}
                {user.branch && (
                  <span className="truncate text-[10px] text-sidebar-foreground/50">
                    {user.branch}
                  </span>
                )}
              </div>
            </div>
          )}
          {!collapsed && (
            <form action={signOut}>
              <Tooltip>
                <TooltipTrigger render={
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                } />
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Desktop Sidebar ──────────────────────────────────────────

export function Sidebar({ user, permissions, memberships, activeMembershipId }: SidebarProps) {
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
          permissions={permissions}
          memberships={memberships}
          activeMembershipId={activeMembershipId}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet>
        <SheetTrigger render={
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-40 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        } />
        <SheetContent side="left" className="w-64 bg-sidebar p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent
            user={user}
            permissions={permissions}
            memberships={memberships}
            activeMembershipId={activeMembershipId}
            collapsed={false}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
