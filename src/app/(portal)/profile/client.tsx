'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  User,
  Mail,
  Phone,
  CreditCard,
  Building2,
  Calendar,
  Briefcase,
  Shield,
  Edit3,
  Lock,
  Plus,
  Check,
  X,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { updateProfile, changePassword, requestPosition } from './actions'
import type { FullUserProfile, PositionRequest, BranchOption, PositionOption } from '@/lib/queries'

// ── Types ────────────────────────────────────────────────────

interface ProfileClientProps {
  profile: FullUserProfile
  myRequests: PositionRequest[]
  branches: BranchOption[]
  activeMembershipId: string | null
  hasPasswordAuth: boolean
}

// ── Helpers ──────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    under_review: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
    cancelled: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  }
  return (
    <Badge variant="outline" className={styles[status] ?? styles.pending}>
      {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
    </Badge>
  )
}

// ── Edit Profile Dialog ──────────────────────────────────────

function EditProfileDialog({ profile }: { profile: FullUserProfile }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Edit3 className="h-3.5 w-3.5" />
        Edit Profile
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your personal information</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" defaultValue={profile.full_name ?? ''} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" name="phone" defaultValue={profile.phone ?? ''} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ''} placeholder="A short description about yourself..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skills">Skills</Label>
            <Input id="skills" name="skills" defaultValue={profile.skills?.join(', ') ?? ''} placeholder="React, TypeScript, Python (comma-separated)" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Change Password Dialog ───────────────────────────────────

function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await changePassword(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setOpen(false), 1500)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); setSuccess(false) }}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Lock className="h-3.5 w-3.5" />
        Change Password
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Enter your current and new password</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Password changed successfully!</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Request Position Dialog ──────────────────────────────────

function RequestPositionDialog({ branches }: { branches: BranchOption[] }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [positions, setPositions] = useState<PositionOption[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)

  useEffect(() => {
    if (!selectedBranch) {
      setPositions([])
      return
    }
    setLoadingPositions(true)
    // Fetch positions for the selected branch via a simple API call
    fetch(`/api/positions?branchId=${selectedBranch}`)
      .then(res => res.json())
      .then(data => setPositions(data))
      .catch(() => setPositions([]))
      .finally(() => setLoadingPositions(false))
  }, [selectedBranch])

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await requestPosition(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => { setOpen(false); setSuccess(false) }, 1500)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); setSuccess(false) }}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="h-4 w-4" />
        Request New Position
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a New Position</DialogTitle>
          <DialogDescription>
            Submit a request to be assigned an additional position. An admin will review your request.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Organization / Branch</Label>
            <Select name="branchId" value={selectedBranch} onValueChange={(val) => setSelectedBranch(val || '')} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Desired Position</Label>
            <Select name="positionId" required disabled={!selectedBranch || loadingPositions}>
              <SelectTrigger>
                <SelectValue placeholder={loadingPositions ? 'Loading...' : 'Select a position'} />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Request *</Label>
            <Textarea id="reason" name="reason" required minLength={10} placeholder="Why do you want this position?" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Additional context about your experience or qualifications..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportingNotes">Supporting Notes (Optional)</Label>
            <Input id="supportingNotes" name="supportingNotes" placeholder="Any additional notes..." />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Request submitted successfully!</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Component ───────────────────────────────────────────

export function ProfileClient({
  profile,
  myRequests,
  branches,
  activeMembershipId,
  hasPasswordAuth,
}: ProfileClientProps) {
  const activePositions = profile.memberships.filter((m) => m.is_active)
  const pastPositions = profile.memberships.filter((m) => !m.is_active)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 border-2 border-border">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ''} />
            <AvatarFallback className="text-2xl font-bold">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{profile.full_name ?? 'User'}</h2>
            <p className="text-muted-foreground">{profile.email}</p>
            {profile.bio && (
              <p className="mt-1 text-sm text-muted-foreground/80 max-w-md">{profile.bio}</p>
            )}
            {profile.skills && profile.skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <EditProfileDialog profile={profile} />
          {hasPasswordAuth && <ChangePasswordDialog />}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{profile.email}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">{profile.phone ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">IEEE Membership ID</p>
              <p className="text-sm font-medium">{profile.ieee_membership_id ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Section</p>
              <p className="text-sm font-medium">{profile.section ?? 'Gujarat Section'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Date Joined</p>
              <p className="text-sm font-medium">{formatDate(profile.created_at)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Account Status</p>
              <Badge variant="outline" className={
                profile.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                profile.status === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                'bg-red-500/10 text-red-600 border-red-500/20'
              }>
                {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Positions */}
      <div id="positions">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">My Positions</h3>
            <p className="text-sm text-muted-foreground">Your currently active and historical positions</p>
          </div>
          <RequestPositionDialog branches={branches} />
        </div>

        {activePositions.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">No active positions assigned.</p>
              <p className="text-xs text-muted-foreground/60">Request a position to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activePositions.map((m) => (
              <Card
                key={m.id}
                className={`border-border/50 transition-all ${
                  m.id === activeMembershipId
                    ? 'ring-2 ring-sidebar-primary/50 bg-sidebar-primary/5'
                    : 'bg-card/50'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{m.position_name ?? 'Member'}</CardTitle>
                    <div className="flex items-center gap-2">
                      {m.id === activeMembershipId && (
                        <Badge className="bg-sidebar-primary/10 text-sidebar-primary border-sidebar-primary/20 text-[10px]">
                          Active Workspace
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                        Active
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{m.branch_name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Assigned: {formatDate(m.assigned_at)}</span>
                  </div>
                  {m.assigned_by_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      <span>By: {m.assigned_by_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Positions */}
      {pastPositions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Position History</h3>
          <div className="space-y-2">
            {pastPositions.map((m) => (
              <Card key={m.id} className="border-border/30 bg-card/30">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium">{m.position_name ?? 'Member'}</p>
                    <p className="text-xs text-muted-foreground">{m.branch_name}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{formatDate(m.assigned_at)} — {formatDate(m.ended_at)}</p>
                    <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20 text-[10px]">
                      Ended
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Position Requests */}
      {myRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">My Position Requests</h3>
          <div className="space-y-2">
            {myRequests.map((req) => (
              <Card key={req.id} className="border-border/50 bg-card/50">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{req.position_name}</p>
                      {statusBadge(req.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{req.branch_name}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 truncate">{req.reason}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0 ml-4">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(req.created_at)}
                    </div>
                    {req.admin_comment && (
                      <p className="mt-1 text-xs italic max-w-[200px] truncate">
                        Admin: {req.admin_comment}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
