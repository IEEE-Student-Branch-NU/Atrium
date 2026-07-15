import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { images } = body // Expected: Array of { url, fileId }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Insert all images into event_gallery_images
    const rowsToInsert = images.map((img: any) => ({
      event_id: id,
      imagekit_url: img.url,
      imagekit_file_id: img.fileId
    }))

    const { error: insertError } = await supabase
      .from('event_gallery_images')
      .insert(rowsToInsert)

    if (insertError) {
      console.error('Gallery insert error:', insertError)
      return NextResponse.json({ error: 'Failed to insert gallery images' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: images.length })
  } catch (error) {
    console.error('Gallery route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('event_gallery_images')
      .select('*')
      .eq('event_id', id)
      .order('uploaded_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch gallery images' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
