import { NextResponse } from 'next/server'
import { getPositionsForBranch } from '@/lib/queries'
import { auth } from '@/auth'

export async function GET(request: Request) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branchId')

  if (!branchId) {
    return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 })
  }

  try {
    const positions = await getPositionsForBranch(branchId)
    return NextResponse.json(positions)
  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
