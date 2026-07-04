'use server'

import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { enableSudoMode } from '@/utils/auth/sudo'
import bcrypt from 'bcrypt'

export async function elevateToSudo(formData: FormData) {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: 'Not authenticated' }
  }

  const passphrase = formData.get('passphrase') as string
  if (!passphrase) {
    return { error: 'Passphrase required' }
  }

  // 1. Fetch all superadmin records (there should only be a handful)
  const supabase = createAdminClient()
  const { data: admins } = await supabase
    .from('superadmins')
    .select('hashed_email, passphrase_hash')

  if (!admins || admins.length === 0) {
    return { error: 'Invalid credentials' }
  }

  // 2. Iterate and use bcrypt.compare to find the matching email
  // Because bcrypt is slow and we have ZERO environment variables, this is 
  // the safest way to guarantee obfuscation without deployment risks.
  let matchedAdmin = null
  for (const admin of admins) {
    const isEmailMatch = await bcrypt.compare(session.user.email, admin.hashed_email)
    if (isEmailMatch) {
      matchedAdmin = admin
      break
    }
  }

  if (!matchedAdmin) {
    return { error: 'Invalid credentials' }
  }

  // 3. Verify the passphrase
  const isPassphraseValid = await bcrypt.compare(passphrase, matchedAdmin.passphrase_hash)
  if (!isPassphraseValid) {
    return { error: 'Invalid credentials' }
  }

  // 4. Issue the secure sudo cookie
  await enableSudoMode(session.user.email)
  
  return { success: true }
}
