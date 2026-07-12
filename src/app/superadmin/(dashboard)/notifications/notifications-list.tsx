'use client'

import { useState, useTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Megaphone, AlertTriangle, CheckCircle, XCircle, 
  Info, Clock, ExternalLink, MoreHorizontal, Pencil, Trash2, Bell, CheckCircle2, Edit 
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { editBroadcast, deleteBroadcast } from '@/app/superadmin/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface NotificationsListProps {
  notifications: any[]
  branches?: { id: string; name: string }[]
  positions?: { id: string; name: string; branch_id: string }[]
}

function getTypeConfig(type: string) {
  switch (type?.toLowerCase()) {
    case 'info':
      return { icon: Info, className: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20' }
    case 'warning':
      return { icon: AlertTriangle, className: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20' }
    case 'error':
      return { icon: XCircle, className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20' }
    case 'success':
      return { icon: CheckCircle2, className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20' }
    default:
      return { icon: Bell, className: 'bg-slate-500/10 text-slate-500 hover:bg-slate-500/20 border-slate-500/20' }
  }
}

export function NotificationsList({ notifications, branches = [], positions = [] }: NotificationsListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Edit Dialog State
  const [editingBroadcast, setEditingBroadcast] = useState<any | null>(null)
  const [editType, setEditType] = useState('info')
  const [editTitle, setEditTitle] = useState('')
  const [editMessage, setEditMessage] = useState('')

  function openEditDialog(notification: any) {
    setEditingBroadcast(notification)
    setEditType(notification.type)
    setEditTitle(notification.title)
    setEditMessage(notification.message)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBroadcast) return

    startTransition(async () => {
      const formData = new FormData()
      formData.set('broadcast_id', editingBroadcast.broadcast_id)
      formData.set('title', editTitle)
      formData.set('message', editMessage)
      formData.set('type', editType)

      const result = await editBroadcast(formData)
      if (result.error) {
        toast.error('Failed to edit broadcast', { description: result.error })
      } else {
        toast.success('Broadcast updated', { description: 'The changes have been applied.' })
        setEditingBroadcast(null)
      }
    })
  }

  function handleDelete(broadcast_id: string) {
    if (!confirm('Are you sure you want to delete this broadcast? It will be removed from all users inboxes.')) return

    startTransition(async () => {
      const result = await deleteBroadcast(broadcast_id)
      if (result.error) {
        toast.error('Failed to delete broadcast', { description: result.error })
      } else {
        toast.success('Broadcast deleted')
      }
    })
  }

  if (notifications.length === 0) {
    return (
      <Card className="border-dashed bg-card/30">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Info className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No notifications have been sent yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-0 sm:p-4">
          <Table>
            <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Notification</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((n) => {
              const isBroadcast = !!n.broadcast_id
              const config = getTypeConfig(n.type)
              const Icon = config.icon

              return (
                <TableRow key={n.id}>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize flex items-center gap-1.5 w-fit -ml-1 ${config.className}`}>
                      <Icon className="h-3 w-3" />
                      {n.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {n.title}
                      {n.is_edited && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">Edited</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate max-w-[300px]" title={n.message}>
                      {n.message}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isBroadcast ? (
                      <div className="flex flex-col gap-1.5">
                        {(n.target_filters && (n.target_filters.branches?.length > 0 || n.target_filters.positions?.length > 0)) ? (
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const bIds = n.target_filters.branches || []
                              const pIds = n.target_filters.positions || []
                              
                              const bNames = bIds.map((id: string) => branches.find(b => b.id === id)?.name).filter(Boolean) as string[]
                              const pNames = Array.from(new Set(pIds.map((id: string) => positions.find(p => p.id === id)?.name).filter(Boolean))) as string[]
                              
                              return (
                                <>
                                  {bNames.length > 0 && bNames.map((name: string) => (
                                    <Badge key={name} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 font-normal">
                                      {name}
                                    </Badge>
                                  ))}
                                  {bNames.length === 0 && pNames.length > 0 && (
                                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 font-normal">
                                      All Branches
                                    </Badge>
                                  )}
                                  {pNames.length > 0 && pNames.map((name: string) => (
                                    <Badge key={name} variant="outline" className="font-normal border-primary/20 text-primary">
                                      {name}
                                    </Badge>
                                  ))}
                                  {pNames.length === 0 && bNames.length > 0 && (
                                    <Badge variant="outline" className="font-normal border-primary/20 text-primary">
                                      All Positions
                                    </Badge>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        ) : (
                           <Badge variant="secondary" className="w-fit">Global Broadcast</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{n.recipient_count} total users</span>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{n.profiles?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{n.profiles?.email}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {isBroadcast ? (
                      <div className="text-xs text-muted-foreground">
                        {n.read_count} / {n.recipient_count} read
                      </div>
                    ) : (
                      n.is_read ? (
                        <span className="text-xs text-muted-foreground">Read</span>
                      ) : (
                        <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 shadow-none border-none">
                          Unread
                        </Badge>
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="flex flex-col">
                      <span>{new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-xs">{new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isBroadcast ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(n)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Broadcast
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDelete(n.broadcast_id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Broadcast
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-muted-foreground ml-2">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

      {/* Edit Broadcast Dialog */}
      <Dialog open={!!editingBroadcast} onOpenChange={(v) => !v && setEditingBroadcast(null)}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Broadcast</DialogTitle>
              <DialogDescription>
                Updates to this broadcast will instantly reflect in all recipients inboxes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Notification Type</Label>
                <Select value={editType} onValueChange={(val) => val && setEditType(val)}>
                  <SelectTrigger id="edit-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Default)</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  required
                  placeholder="e.g. System Maintenance"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-message">Message</Label>
                <Textarea
                  id="edit-message"
                  required
                  placeholder="Type your message here..."
                  className="min-h-[100px]"
                  value={editMessage}
                  onChange={e => setEditMessage(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingBroadcast(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
