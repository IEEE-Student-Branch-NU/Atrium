'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Users, Copy, Check, Mail, Phone, Hash, Building2, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DirectoryMember } from '@/lib/queries'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault()  // Prevent card navigation
    e.stopPropagation()
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 text-muted-foreground/60 hover:text-foreground"
      onClick={handleCopy}
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

export function MembersDirectoryClient({ members }: { members: DirectoryMember[] }) {
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string | null>(null)

  // Collect unique branches for filter dropdown
  const branches = useMemo(() => {
    const set = new Set<string>()
    for (const m of members) {
      if (m.branch_name) set.add(m.branch_name)
    }
    return Array.from(set).sort()
  }, [members])

  // Filter members
  const filtered = useMemo(() => {
    let result = members

    if (branchFilter) {
      result = result.filter(m => m.branch_name === branchFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(m =>
        (m.full_name?.toLowerCase().includes(q)) ||
        (m.email.toLowerCase().includes(q)) ||
        (m.ieee_membership_id?.toLowerCase().includes(q)) ||
        (m.position_name?.toLowerCase().includes(q)) ||
        (m.branch_name?.toLowerCase().includes(q))
      )
    }

    return result
  }, [members, search, branchFilter])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Members Directory</h2>
        <p className="text-muted-foreground">
          Browse and search all approved members of IEEE SBNU.
        </p>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, IEEE ID, position, or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" className="gap-2 shrink-0">
              <Building2 className="h-4 w-4" />
              {branchFilter ?? 'All Branches'}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setBranchFilter(null)}>
              All Branches
            </DropdownMenuItem>
            {branches.map(b => (
              <DropdownMenuItem key={b} onClick={() => setBranchFilter(b)}>
                {b}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
          {search || branchFilter ? ' found' : ' total'}
        </span>
      </div>

      {/* Members Grid */}
      {filtered.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No members found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your search or filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <Link key={member.id} href={`/members/${member.id}`} className="block">
              <Card className="group hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 space-y-3">
                  {/* Top: Avatar + Name + Position */}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name ?? ''} />
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                        {member.full_name ?? 'Unnamed'}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {member.position_name && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {member.position_name}
                          </Badge>
                        )}
                        {member.branch_name && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {member.branch_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {/* Email */}
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate flex-1">{member.email}</span>
                      <CopyButton value={member.email} label="email" />
                    </div>

                    {/* Phone */}
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate flex-1">{member.phone}</span>
                        <CopyButton value={member.phone} label="phone" />
                      </div>
                    )}

                    {/* IEEE ID */}
                    {member.ieee_membership_id && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-3 w-3 shrink-0" />
                        <span className="truncate flex-1 font-mono">
                          IEEE: {member.ieee_membership_id}
                        </span>
                        <CopyButton value={member.ieee_membership_id} label="IEEE ID" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
