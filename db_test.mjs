import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'

const envConfig = dotenv.parse(fs.readFileSync('.env'))
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, status, email, memberships!memberships_profile_id_fkey(branch_id)')
    .in('status', ['pending', 'under_review'])
  console.log('Pending Profiles:', JSON.stringify(profiles, null, 2))
  if (error) console.error('Error:', error)
}

main()
