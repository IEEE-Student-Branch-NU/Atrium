import { useState } from 'react'
import { Mail, Phone, Hash, Building2, User as UserIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PositionRequest } from '@/lib/queries'

export function RequesterProfileDialog({ request, children }: { request: PositionRequest, children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            {request.profile_name ?? 'Unknown User'}
          </DialogTitle>
          <DialogDescription>Requester Profile Details</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div className="col-span-3 text-sm">{request.profile_email}</div>
          </div>
          
          {request.profile_phone && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="col-span-3 text-sm">{request.profile_phone}</div>
            </div>
          )}

          {request.profile_ieee_membership_id && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div className="col-span-3 text-sm">{request.profile_ieee_membership_id}</div>
            </div>
          )}

          {request.profile_section && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="col-span-3 text-sm">{request.profile_section}</div>
            </div>
          )}

          {request.profile_skills && request.profile_skills.length > 0 && (
            <div className="grid grid-cols-4 items-start gap-4">
              <span className="text-sm font-medium text-muted-foreground mt-1 text-right">Skills</span>
              <div className="col-span-3 flex flex-wrap gap-1.5">
                {request.profile_skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="font-normal">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {request.profile_bio && (
            <div className="grid grid-cols-4 items-start gap-4 mt-2">
              <span className="text-sm font-medium text-muted-foreground mt-1 text-right">Bio</span>
              <div className="col-span-3 text-sm text-foreground/80 leading-relaxed bg-muted/30 p-3 rounded-md">
                {request.profile_bio}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
