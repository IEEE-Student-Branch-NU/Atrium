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
  Hash,
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
  CardFooter,
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
import { updateProfile, changePassword, requestPosition, updateMembershipDetails } from './actions'
import { switchWorkspace } from '@/app/(portal)/actions'
import type { FullUserProfile, PositionRequest, BranchOption, PositionOption } from '@/lib/queries'

// ── Types ────────────────────────────────────────────────────

interface ProfileClientProps {
  profile: FullUserProfile
  myRequests: PositionRequest[]
  branches: BranchOption[]
  activeMembershipId: string | null
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
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
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
            <div className="flex">
              <div className="flex items-center px-3 border border-r-0 border-input bg-muted rounded-l-md text-sm text-muted-foreground font-medium">
                +91
              </div>
              <Input 
                id="phone" 
                name="phone" 
                defaultValue={
                  (() => {
                    const val = profile.phone?.replace(/[^\d]/g, '').replace(/^91/, '') ?? '';
                    if (val.length > 5) return val.substring(0, 5) + ' ' + val.substring(5);
                    return val;
                  })()
                } 
                placeholder="98765 43210"
                pattern="\d{5}\s\d{5}"
                title="Format: 10 digit mobile number"
                maxLength={11}
                className="rounded-l-none"
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d]/g, '').substring(0, 10);
                  if (val.length > 5) {
                    val = val.substring(0, 5) + ' ' + val.substring(5);
                  }
                  e.target.value = val;
                }}
              />
            </div>
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

// ── Edit Membership Details Dialog ───────────────────────────

function EditMembershipDialog({ profile }: { profile: FullUserProfile }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateMembershipDetails(formData)
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
        <Edit3 className="h-3.5 w-3.5" />
        Edit Membership
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Membership Details</DialogTitle>
          <DialogDescription>Update your IEEE membership ID.</DialogDescription>
        </DialogHeader>
        {!profile.has_password ? (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Password Required</p>
                  <p>You must set a password for your account before you can edit your membership details. Please use the Security section to set a password first.</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ieeeMembershipId">IEEE Membership ID</Label>
              <Input
                id="ieeeMembershipId"
                name="ieeeMembershipId"
                defaultValue={profile.ieee_membership_id ?? ''}
                pattern="\d{9}"
                title="Must be exactly 9 digits"
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/[^\d]/g, '').substring(0, 9);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password (Required)</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-emerald-600">Membership details updated successfully!</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Change Password Dialog ───────────────────────────────────

function ChangePasswordDialog({ hasPassword }: { hasPassword: boolean }) {
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

  const title = hasPassword ? 'Change Password' : 'Set Password'
  const description = hasPassword ? 'Enter your current and new password' : 'Create a password for your account'

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); setSuccess(false) }}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Lock className="h-3.5 w-3.5" />
        {title}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Password {hasPassword ? 'changed' : 'set'} successfully!</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (hasPassword ? 'Changing...' : 'Setting...') : title}
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
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [positions, setPositions] = useState<PositionOption[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)

  useEffect(() => {
    setSelectedPosition('')
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
    <Dialog open={open} onOpenChange={(v) => { 
      setOpen(v); 
      setError(null); 
      setSuccess(false); 
      if (!v) {
        setSelectedBranch('');
        setSelectedPosition('');
      }
    }}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="h-4 w-4" />
        Request New Position
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
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
                <SelectValue placeholder="Select a branch">
                  {selectedBranch && branches.find(b => b.id === selectedBranch)?.name}
                </SelectValue>
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
            <Select 
              name="positionId" 
              required 
              disabled={!selectedBranch || loadingPositions}
              value={selectedPosition}
              onValueChange={(val) => setSelectedPosition(val || '')}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingPositions ? 'Loading...' : 'Select a position'}>
                  {selectedPosition && positions.find(p => p.id === selectedPosition)?.name}
                </SelectValue>
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
          <ChangePasswordDialog hasPassword={profile.has_password ?? false} />
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Mail, label: 'Email', value: profile.email },
          { icon: Phone, label: 'Phone', value: profile.phone ?? '—' },
          { icon: CreditCard, label: 'IEEE Membership ID', value: profile.ieee_membership_id ?? '—' },
          { icon: Building2, label: 'Section', value: profile.section ?? 'Gujarat Section' },
          { icon: Calendar, label: 'Date Joined', value: formatDate(profile.created_at) },
        ].map((item) => (
          <Card key={item.label} className="border-border/50 bg-card/50 h-full">
            <CardContent className="flex items-center gap-3 p-4 h-full">
              <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium truncate">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="border-border/50 bg-card/50 h-full">
          <CardContent className="flex items-center gap-3 p-4 h-full">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
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

      {/* Membership Details */}
      <div id="membership">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Membership Details</h3>
            <p className="text-sm text-muted-foreground">Your IEEE membership information</p>
          </div>
          <EditMembershipDialog profile={profile} />
        </div>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">IEEE Membership ID</p>
              <div className="flex items-center gap-2 mt-1">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="font-mono text-sm">{profile.ieee_membership_id || 'Not set'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Membership Expiry</p>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm">
                  {profile.membership_expiry 
                    ? new Date(profile.membership_expiry).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', day: 'numeric' }) 
                    : 'Not set'}
                </p>
              </div>
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
                className={`border-border/50 transition-all duration-200 hover:shadow-md hover:border-border/80 ${
                  m.id === activeMembershipId
                    ? 'ring-2 ring-sidebar-primary/50 bg-sidebar-primary/5 cursor-default'
                    : 'bg-card/50 cursor-pointer hover:bg-card/80'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-base font-semibold">{m.position_name ?? 'Member'}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{m.branch_name}</p>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {m.id === activeMembershipId && (
                        <Badge variant="secondary" className="bg-sidebar-primary/10 text-sidebar-primary border-sidebar-primary/20 text-[10px]">
                          Active Workspace
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                        Active
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/30">
                    <span>Assigned: {formatDate(m.assigned_at)}</span>
                    {m.assigned_by_name && <span>By: {m.assigned_by_name}</span>}
                  </div>

                  {m.id !== activeMembershipId && (
                    <form action={async () => { await switchWorkspace(m.id) }} className="mt-3">
                      <Button variant="outline" size="sm" type="submit" className="w-full h-8 text-xs cursor-pointer hover:bg-sidebar-primary/10 hover:text-sidebar-primary hover:border-sidebar-primary/30 transition-all duration-200 active:scale-[0.98]">
                        Switch to Workspace
                      </Button>
                    </form>
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
          <div className="space-y-3">
            {pastPositions.map((m) => (
              <Card key={m.id} className="border-border/30 bg-card/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-base font-semibold">{m.position_name ?? 'Member'}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{m.branch_name}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Past Position
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/20">
                    <span>Assigned: {formatDate(m.assigned_at)}</span>
                    {m.ended_at && <span>Ended: {formatDate(m.ended_at)}</span>}
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
