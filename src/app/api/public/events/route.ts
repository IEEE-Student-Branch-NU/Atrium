import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'

// We use the admin client because the Atrium portal relies on NextAuth and bypasses RLS.
// We secure this route by explicitly filtering for public-safe statuses.
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    
    const branch = searchParams.get('branch')
    const status = searchParams.get('status') // published or completed
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const limit = parseInt(searchParams.get('limit') || '10')
    const page = parseInt(searchParams.get('page') || '1')
    const offset = (page - 1) * limit

    let query = supabase
      .from('events')
      .select('*, branches(name, slug), event_types(name)', { count: 'exact' })
      .in('status', ['approved', 'published', 'completed'])

    if (status) {
      query = query.eq('status', status)
    }
    
    if (branch) {
      // filtering by branch slug requires joining branches, or we assume `branch` is branch_id
      // For simplicity, assuming branch is the UUID branch_id. If it's a slug, we need to filter via the join.
      query = query.eq('branches.slug', branch)
    }
    
    if (startDate) {
      query = query.gte('event_date', startDate)
    }
    
    if (endDate) {
      query = query.lte('event_date', endDate)
    }

    query = query
      .order('event_date', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('Public events API error:', error)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    return NextResponse.json({
      data,
      meta: {
        total: count,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    }, { headers })

  } catch (error) {
    console.error('Public events API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  return new NextResponse(null, { headers })
}
