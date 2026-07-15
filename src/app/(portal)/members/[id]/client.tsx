'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, Hash, Calendar, Building2, Briefcase, BookOpen, Sparkles, Pencil, MoreVertical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { FullUserProfile, DirectoryMember } from '@/lib/queries'
import { EditExpiryModal } from '../EditExpiryModal'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function MemberProfileView({ profile, canViewPrivateDetails = false }: { profile: FullUserProfile, canViewPrivateDetails?: boolean }) {
  const [isEditExpiryOpen, setIsEditExpiryOpen] = useState(false)
  const activeMemberships = profile.memberships.filter(m => m.is_active)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back button */}
      <div>
        <Link href="/members">
          <Button variant="ghost" size="sm" className="gap-2 -ml-3 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Button>
        </Link>
      </div>

      {/* Profile Header Card */}
      <Card className="relative">
        {canViewPrivateDetails && (
          <div className="absolute top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditExpiryOpen(true)} className="cursor-pointer">
                  <Calendar className="mr-2 h-4 w-4" />
                  Edit Expiry Date
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5 pr-10">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ''} />
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {profile.full_name ?? 'Unnamed Member'}
              </h2>

              {/* Position badges */}
              <div className="flex flex-wrap gap-1.5">
                {activeMemberships.map(m => (
                  <div key={m.id} className="flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {m.position_name ?? 'Member'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {m.branch_name}
                    </Badge>
                  </div>
                ))}
                {activeMemberships.length === 0 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Member
                  </Badge>
                )}
              </div>

              {/* Contact info */}
              <div className="space-y-1 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.ieee_membership_id && canViewPrivateDetails && (
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono">IEEE: {profile.ieee_membership_id}</span>
                  </div>
                )}
                {canViewPrivateDetails && (
                  <div className="flex items-center gap-2 group">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Expiry:{' '}
                      {profile.membership_expiry ? (
                        new Date(profile.membership_expiry).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', day: 'numeric' })
                      ) : (
                        <span className="text-destructive font-medium cursor-pointer hover:underline" onClick={() => setIsEditExpiryOpen(true)}>
                          Set Expiry Date
                        </span>
                      )}
                    </span>
                    {profile.membership_expiry && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setIsEditExpiryOpen(true)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
                {profile.section && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Section: {profile.section}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Joined {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      {profile.bio && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {profile.bio}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Skills */}
      {profile.skills && profile.skills.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions & Roles */}
      {profile.memberships.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Positions & Roles
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {profile.memberships.map(m => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                    m.is_active
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-border/50 bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {m.position_name ?? 'Member'}
                      <span className="text-muted-foreground font-normal"> · {m.branch_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Since {new Date(m.assigned_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      {m.ended_at && ` — ${new Date(m.ended_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <Badge variant={m.is_active ? 'default' : 'outline'} className="text-[10px] shrink-0">
                    {m.is_active ? 'Active' : 'Past'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canViewPrivateDetails && (
        <EditExpiryModal
          member={profile as unknown as DirectoryMember}
          isOpen={isEditExpiryOpen}
          onClose={() => setIsEditExpiryOpen(false)}
        />
      )}
    </div>
  )
}
