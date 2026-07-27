'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Copy, Check, Mail, Phone, Hash, Building2, ChevronDown, Calendar, MoreVertical } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import type { DirectoryMember } from '@/lib/queries'
import { createClient } from '@/utils/supabase/client'
import { EditExpiryModal } from './EditExpiryModal'

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

export function MembersDirectoryClient({ 
  members, 
  branches,
  canManageMembers = false
}: { 
  members: DirectoryMember[]
  branches: string[]
  canManageMembers?: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  
  const [editingMember, setEditingMember] = useState<DirectoryMember | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Setup Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('members-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships' }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  // Filter members
  const filtered = useMemo(() => {
    let result = members

    if (selectedBranches.length > 0) {
      result = result.filter(m => m.branch_name && selectedBranches.includes(m.branch_name))
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
  }, [members, search, selectedBranches])

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
          <DropdownMenuTrigger render={
            <Button variant="outline" className="gap-2 shrink-0" />
          }>
              <Building2 className="h-4 w-4" />
              {selectedBranches.length === 0 
                ? 'All Branches' 
                : `${selectedBranches.length} Selected`}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem 
              closeOnClick={false}
              onClick={() => setSelectedBranches([])}
              className="gap-2 cursor-pointer"
            >
              <Checkbox checked={selectedBranches.length === 0} onCheckedChange={() => setSelectedBranches([])} />
              All Branches
            </DropdownMenuItem>
            {branches.map(b => (
              <DropdownMenuItem 
                key={b} 
                closeOnClick={false}
                onClick={() => {
                  if (selectedBranches.includes(b)) {
                    setSelectedBranches(prev => prev.filter(x => x !== b))
                  } else {
                    setSelectedBranches(prev => [...prev, b])
                  }
                }}
                className="gap-2 cursor-pointer"
              >
                <Checkbox 
                  checked={selectedBranches.includes(b)} 
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedBranches(prev => [...prev, b])
                    } else {
                      setSelectedBranches(prev => prev.filter(x => x !== b))
                    }
                  }} 
                />
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
          {search || selectedBranches.length > 0 ? ' found' : ' total'}
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
          {filtered.map((member) => {
            return (
              <Card 
                key={member.id}
                className="group hover:border-primary/30 transition-colors cursor-pointer h-full relative"
                onClick={() => router.push(`/members/${member.id}`)}
              >
                {canManageMembers && (
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()} />
                      }>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setEditingMember(member)
                          setIsModalOpen(true)
                        }}>
                          <Calendar className="mr-2 h-4 w-4" />
                          Edit Expiry Date
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                <CardContent className="p-4 space-y-3">
                  {/* Top: Avatar + Name + Position */}
                  <div className="flex items-start gap-3 pr-8">
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
            )
          })}
        </div>
      )}
      <EditExpiryModal 
        member={editingMember} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  )
}
