'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { updateEvent, submitEvent, deleteEvent } from '@/app/(portal)/events/actions'
import { toast } from 'sonner'
import { CalendarIcon, MapPin, Users, Mail, Image as ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function EditEventForm({ event, branches, eventTypes }: { event: any, branches: any[], eventTypes: any[] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // format date helper
  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    // Local time string "YYYY-MM-DDThh:mm"
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const bannerFile = formData.get('banner_file') as File | null
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      event_date: formData.get('event_date') as string,
      end_date: formData.get('end_date') as string,
      location: formData.get('location') as string,
      capacity: parseInt(formData.get('capacity') as string) || 0,
      organizer_email: formData.get('organizer_email') as string,
      branch_id: formData.get('branch_id') as string,
      event_type_id: formData.get('event_type_id') as string,
      is_free: formData.get('is_free') === 'true',
      registration_url: formData.get('registration_url') as string,
      banner: formData.get('banner') as string || null,
      banner_file: bannerFile?.size ? bannerFile : null,
    }

    if (!data.branch_id || !data.event_type_id) {
      toast.error('Please select a branch and an event type.')
      setIsSubmitting(false)
      return
    }

    try {
      await updateEvent(event.id, data)
      toast.success('Event updated successfully.')
      router.push('/events/management')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update event.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFreeDefault = event.banner?.is_free ?? true
  const initialBannerUrl = typeof event.banner === 'string' ? event.banner : event.banner?.url || ''

  const [preview, setPreview] = useState({
    name: event.name || '',
    description: event.description || '',
    date: event.event_date || '',
    location: event.location || '',
    bannerUrl: initialBannerUrl,
    is_free: isFreeDefault,
    eventType: eventTypes.find((et: any) => et.id === event.event_type_id)?.name || ''
  })

  function handleFormChange(e: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(e.currentTarget)
    
    let newBannerUrl = preview.bannerUrl
    const file = formData.get('banner_file') as File | null
    if (file && file.size > 0) {
      // Create local object URL for preview
      newBannerUrl = URL.createObjectURL(file)
    } else {
      const urlInput = formData.get('banner') as string
      if (urlInput !== undefined && urlInput !== preview.bannerUrl && !file?.size) {
        newBannerUrl = urlInput
      }
    }

    setPreview(prev => ({
      ...prev,
      name: (formData.get('name') as string) || prev.name,
      description: (formData.get('description') as string) || prev.description,
      date: (formData.get('event_date') as string) || prev.date,
      location: (formData.get('location') as string) || prev.location,
      bannerUrl: newBannerUrl,
    }))
  }

  // Handle Shadcn Select changes manually for preview since hidden input onChange doesn't bubble in React
  const handleEventTypeChange = (val: string | null) => {
    setPreview(prev => ({ ...prev, eventType: eventTypes.find((et: any) => et.id === String(val))?.name || '' }))
  }
  const handleIsFreeChange = (val: string | null) => {
    setPreview(prev => ({ ...prev, is_free: String(val) === 'true' }))
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
      <Card className="xl:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Edit Event</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} onChange={handleFormChange} className="space-y-6">
            
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input id="name" name="name" defaultValue={event.name} placeholder="E.g., Annual Tech Symposium" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch_id">Organizing Branch *</Label>
                <Select name="branch_id" defaultValue={event.branch_id} required>
                  <SelectTrigger id="branch_id">
                    <SelectValue placeholder="Select a branch">
                      {(value: any) => value ? branches.find((b: any) => b.id === value)?.name || value : "Select a branch"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id} label={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_type_id">Event Type *</Label>
                <Select name="event_type_id" defaultValue={event.event_type_id} onValueChange={handleEventTypeChange} required>
                  <SelectTrigger id="event_type_id">
                    <SelectValue placeholder="Select type">
                      {(value: any) => value ? eventTypes.find((et: any) => et.id === value)?.name || value : "Select type"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((et) => (
                      <SelectItem key={et.id} value={et.id} label={et.name}>{et.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea 
                id="description" 
                name="description" 
                defaultValue={event.description}
                placeholder="Detailed description of the event..." 
                className="min-h-[120px]"
                required 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_date" className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  Start Date & Time *
                </Label>
                <Input id="event_date" name="event_date" type="datetime-local" defaultValue={formatDateForInput(event.event_date)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  End Date & Time *
                </Label>
                <Input id="end_date" name="end_date" type="datetime-local" defaultValue={formatDateForInput(event.banner?.end_date)} required />
                <p className="text-xs text-muted-foreground">The event duration is calculated automatically.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Location *
                </Label>
                <Input id="location" name="location" defaultValue={event.location} placeholder="Venue or Online Link" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity" className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Capacity (0 for unlimited)
                </Label>
                <Input id="capacity" name="capacity" type="number" min="0" defaultValue={event.capacity || 0} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizer_email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Organizer Contact Email *
                </Label>
                <Input id="organizer_email" name="organizer_email" type="email" defaultValue={event.organizer_email} placeholder="contact@example.com" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="is_free">Event Fee *</Label>
                <Select name="is_free" defaultValue={isFreeDefault ? "true" : "false"} onValueChange={handleIsFreeChange} required>
                  <SelectTrigger id="is_free">
                    <SelectValue placeholder="Select type">
                      {(value: any) => String(value) === "true" ? "Free Event" : String(value) === "false" ? "Paid Event" : "Select type"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true" label="Free Event">Free Event</SelectItem>
                    <SelectItem value="false" label="Paid Event">Paid Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registration_url" className="flex items-center gap-2">
                  Registration / Ticketing Link *
                </Label>
                <Input id="registration_url" name="registration_url" type="url" defaultValue={event.banner?.registration_url} placeholder="Google Form or Konfhub link" required />
                <p className="text-xs text-muted-foreground">Mandatory: Google Form for free, Konfhub/Ticketing for paid.</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                Event Poster / Banner (Optional)
              </Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banner_file" className="text-xs text-muted-foreground">Upload File (Replaces existing)</Label>
                  <Input id="banner_file" name="banner_file" type="file" accept="image/*" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner" className="text-xs text-muted-foreground">Or provide Image URL</Label>
                  <Input id="banner" name="banner" type="url" defaultValue={initialBannerUrl} placeholder="https://..." />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">You can also upload files later from the event dashboard.</p>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {event.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" type="button" className="text-red-600 border-red-500/30 hover:bg-red-500/10 hover:text-red-700">Delete Event</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the event <strong>"{event.name}"</strong> and remove it from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                          onClick={async (e) => {
                            e.preventDefault()
                            setIsSubmitting(true)
                            try {
                              await deleteEvent(event.id)
                              toast.success('Event deleted successfully.')
                              router.push('/events/management')
                              router.refresh()
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to delete event')
                              setIsSubmitting(false)
                            }
                          }}
                        >
                          Delete Event
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Save Changes'}
                </Button>
                {event.status === 'draft' && (
                  <Button
                    type="button"
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isSubmitting}
                    onClick={async () => {
                      setIsSubmitting(true)
                      try {
                        await submitEvent(event.id)
                        toast.success('Event submitted for approval!')
                        router.push('/events/management')
                        router.refresh()
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to submit event')
                      } finally {
                        setIsSubmitting(false)
                      }
                    }}
                  >
                    Submit for Approval
                  </Button>
                )}
              </div>
            </div>

          </form>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <div className="xl:col-span-1 sticky top-6">
        <div className="rounded-xl overflow-hidden border border-border bg-card text-card-foreground shadow-sm flex flex-col">
          {preview.bannerUrl ? (
            <div className="w-full aspect-[4/3] bg-black relative overflow-hidden group">
              {/* Ambient blurred backdrop for images that don't perfectly fit */}
              <div 
                className="absolute inset-0 bg-cover bg-center blur-xl opacity-40 scale-110" 
                style={{ backgroundImage: `url(${preview.bannerUrl})` }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={preview.bannerUrl} 
                alt="Event banner preview" 
                className="w-full h-full object-contain relative z-10"
              />
            </div>
          ) : (
            <div className="w-full aspect-[4/3] bg-muted flex flex-col items-center justify-center text-muted-foreground border-b border-border/50">
              <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
              <span className="text-sm">No Image</span>
            </div>
          )}
          <div className="p-5 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {preview.eventType || 'Event Type'}
                </span>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {preview.is_free ? 'FREE' : 'PAID'}
                </span>
              </div>
              <h3 className="font-bold text-xl line-clamp-2 leading-tight">
                {preview.name || 'Event Name'}
              </h3>
            </div>
            
            <Dialog>
              <DialogTrigger render={<button type="button" className="group cursor-pointer rounded-md hover:bg-muted/50 p-2 -mx-2 transition-colors text-left w-full" />}>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {preview.description || 'Add a description to see it appear here...'}
                </p>
                <p className="text-xs text-primary font-medium mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Read full description</p>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{preview.name || 'Event Name'}</DialogTitle>
                </DialogHeader>
                <div className="mt-4 text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto pr-4 text-muted-foreground leading-relaxed">
                  {preview.description || 'No description provided.'}
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-2 text-sm text-muted-foreground mt-2 pt-4 border-t border-border/50">
              <div className="flex items-start gap-2">
                <CalendarIcon className="w-4 h-4 shrink-0 mt-0.5 text-foreground/70" />
                <span>
                  {preview.date 
                    ? new Date(preview.date).toLocaleString('en-IN', { 
                        weekday: 'short', month: 'short', day: 'numeric', 
                        hour: 'numeric', minute: '2-digit', hour12: true 
                      })
                    : 'Date & Time'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-foreground/70" />
                <span className="line-clamp-2">{preview.location || 'Location / Venue'}</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4">
          Live Preview
        </p>
      </div>
    </div>
  )
}
