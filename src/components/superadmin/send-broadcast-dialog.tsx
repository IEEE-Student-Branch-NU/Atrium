'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sendBroadcastMessage } from '@/app/superadmin/actions'

interface SendBroadcastDialogProps {
  branches?: { id: string; name: string }[]
  positions?: { id: string; name: string; branch_id: string }[]
}

export function SendBroadcastDialog({ branches = [], positions = [] }: SendBroadcastDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [type, setType] = useState('info')
  const [error, setError] = useState<string | null>(null)
  
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])

  const filteredPositions = selectedBranches.length > 0 
    ? positions.filter(p => selectedBranches.includes(p.branch_id))
    : positions

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('type', type)
    if (selectedBranches.length > 0) {
      formData.set('branches', JSON.stringify(selectedBranches))
    }
    if (selectedPositions.length > 0) {
      formData.set('positions', JSON.stringify(selectedPositions))
    }

    startTransition(async () => {
      const result = await sendBroadcastMessage(formData)
      if (result.error) {
        setError(result.error)
        toast.error('Failed to send broadcast', { description: result.error })
      } else {
        setOpen(false)
        toast.success('Broadcast sent', { description: 'The targeted active users have received the notification.' })
        router.refresh()
      }
    })
  }

  function toggleBranch(id: string) {
    setSelectedBranches(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
    // Clear selected positions that no longer match the branch filters
    setSelectedPositions(prev => {
      const remainingBranchIds = selectedBranches.includes(id) 
        ? selectedBranches.filter(b => b !== id) 
        : [...selectedBranches, id]
      
      if (remainingBranchIds.length === 0) return prev // If no branches selected, all positions are valid

      return prev.filter(posId => {
        const pos = positions.find(p => p.id === posId)
        return pos && remainingBranchIds.includes(pos.branch_id)
      })
    })
  }

  function togglePosition(id: string) {
    setSelectedPositions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Megaphone className="mr-2 h-4 w-4" />
          Send Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Broadcast Notification</DialogTitle>
            <DialogDescription>
              This message will appear in the inbox of the users who match your selected criteria.
              Leave filters empty to send to everyone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>1. Target Branches</Label>
                <div className="rounded-md border p-2 h-[160px]">
                  <ScrollArea className="h-full">
                    {branches.length === 0 && <span className="text-xs text-muted-foreground">No branches available</span>}
                    <div className="space-y-2 pr-4">
                      {branches.map(b => (
                        <div key={b.id} className="flex items-start space-x-2">
                          <Checkbox 
                            id={`branch-${b.id}`} 
                            checked={selectedBranches.includes(b.id)}
                            onCheckedChange={() => toggleBranch(b.id)}
                            className="mt-0.5"
                          />
                          <Label htmlFor={`branch-${b.id}`} className="text-sm font-normal cursor-pointer leading-tight">
                            {b.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                {selectedBranches.length > 0 && (
                  <p className="text-xs text-muted-foreground text-right">{selectedBranches.length} selected</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>2. Target Positions {selectedBranches.length > 0 ? '(Filtered)' : '(All Branches)'}</Label>
                <div className="rounded-md border p-2 h-[160px]">
                  <ScrollArea className="h-full">
                    {filteredPositions.length === 0 && <span className="text-xs text-muted-foreground">No positions available</span>}
                    <div className="space-y-2 pr-4">
                      {filteredPositions.map(p => {
                        const branchName = branches.find(b => b.id === p.branch_id)?.name || 'Unknown Branch'
                        return (
                          <div key={p.id} className="flex items-start space-x-2">
                            <Checkbox 
                              id={`pos-${p.id}`} 
                              checked={selectedPositions.includes(p.id)}
                              onCheckedChange={() => togglePosition(p.id)}
                              className="mt-0.5"
                            />
                            <Label htmlFor={`pos-${p.id}`} className="text-sm font-normal cursor-pointer leading-tight flex flex-col">
                              <span>{p.name}</span>
                              <span className="text-[10px] text-muted-foreground">{branchName}</span>
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
                {selectedPositions.length > 0 && (
                  <p className="text-xs text-muted-foreground text-right">{selectedPositions.length} selected</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Notification Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
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
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="e.g. System Maintenance"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                required
                placeholder="Type your message here..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Sending...' : 'Send Broadcast'}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
