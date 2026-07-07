'use client'

import { useState } from 'react'
import { PreApprovedMember } from '@/lib/queries'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, UserPlus, ShieldCheck, Mail, Hash } from 'lucide-react'
import { addPreApprovedMember, removePreApprovedMember } from './actions'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface PreApprovedClientProps {
  members: PreApprovedMember[]
}

export function PreApprovedClient({ members }: PreApprovedClientProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ ieeeId: '', name: '', email: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await addPreApprovedMember(formData.ieeeId, formData.name, formData.email)
      toast.success('Member added to pre-approved list')
      setIsOpen(false)
      setFormData({ ieeeId: '', name: '', email: '' })
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name} from the pre-approved list?`)) return
    
    setDeletingId(id)
    try {
      await removePreApprovedMember(id)
      toast.success(`${name} removed from pre-approved list`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pre-Approved Members</h2>
          <p className="text-muted-foreground">
            Add IEEE IDs here to bypass manual registration approval.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={<Button />}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Pre-Approved ID
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Add Pre-Approved Member</DialogTitle>
                <DialogDescription>
                  Anyone signing up with this exact IEEE Membership ID will bypass the pending queue and gain instant portal access.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ieeeId">IEEE Membership ID <span className="text-red-500">*</span></Label>
                  <Input 
                    id="ieeeId" 
                    placeholder="e.g. 987654321" 
                    value={formData.ieeeId}
                    onChange={(e) => setFormData(p => ({ ...p, ieeeId: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Used to verify identity if needed.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address (Optional)</Label>
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="e.g. john@nirmauni.ac.in"
                    value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Pre-Approved Registry
          </CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'entry' : 'entries'} currently in the fast-track system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pre-approved members added yet.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IEEE ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono">{member.ieee_membership_id}</TableCell>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {member.is_claimed ? (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            Claimed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Waiting
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.added_by_name || 'System'}
                        <div className="text-[10px]">
                          {new Date(member.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => handleDelete(member.id, member.name)}
                          disabled={deletingId === member.id}
                          title="Remove from pre-approved"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
