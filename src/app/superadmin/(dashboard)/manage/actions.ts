'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/server'
import { getEffectiveActor, verifySuperAdminPassword } from '@/utils/auth/superadmin'
import bcrypt from 'bcrypt'

const DEFAULT_PASSPHRASE = 'ieee-sbnu-nirma'

/**
 * Add a new superadmin
 */
export async function addSuperadmin(email: string) {
  const actor = await getEffectiveActor()
  if (!actor.isSuperAdmin) {
    return { error: 'Unauthorized: Only superadmins can add superadmins.' }
  }

  if (!email.endsWith('@nirmauni.ac.in')) {
    return { error: 'Email must be a @nirmauni.ac.in address.' }
  }

  try {
    const supabase = createAdminClient()
    const passphraseHash = await bcrypt.hash(DEFAULT_PASSPHRASE, 12)

    const { error } = await supabase
      .from('superadmins')
      .insert({
        email: email.toLowerCase(),
        passphrase_hash: passphraseHash,
      })

    if (error) {
      if (error.code === '23505') {
        return { error: 'This user is already a superadmin.' }
      }
      console.error('Failed to add superadmin:', error)
      return { error: 'Database error occurred while adding superadmin.' }
    }

    revalidatePath('/superadmin/manage')
    return { success: true }
  } catch (err) {
    console.error('Failed to hash passphrase:', err)
    return { error: 'Failed to process superadmin creation.' }
  }
}

/**
 * Remove a superadmin
 */
export async function removeSuperadmin(id: string, password?: string) {
  const actor = await getEffectiveActor()
  if (!actor.isSuperAdmin) {
    return { error: 'Unauthorized: Only superadmins can remove superadmins.' }
  }

  if (!password || !(await verifySuperAdminPassword(actor.realEmail, password))) {
    return { error: 'Incorrect superadmin password.' }
  }

  try {
    const supabase = createAdminClient()

    // Prevent a superadmin from removing themselves
    const { data: currentSuperadmin } = await supabase
      .from('superadmins')
      .select('id')
      .eq('email', actor.realEmail!)
      .single()

    if (currentSuperadmin?.id === id) {
      return { error: 'You cannot remove yourself.' }
    }

    const { error } = await supabase
      .from('superadmins')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to remove superadmin:', error)
      return { error: 'Database error occurred while removing superadmin.' }
    }

    revalidatePath('/superadmin/manage')
    return { success: true }
  } catch (err) {
    return { error: 'An unexpected error occurred.' }
  }
}

/**
 * Change the logged-in superadmin's passphrase
 */
export async function changePassphrase(currentPass: string, newPass: string) {
  const actor = await getEffectiveActor()
  if (!actor.isSuperAdmin) {
    return { error: 'Unauthorized.' }
  }

  if (newPass.length < 8) {
    return { error: 'New passphrase must be at least 8 characters long.' }
  }

  try {
    const supabase = createAdminClient()

    // Get current hash
    const { data: superadmin, error: fetchErr } = await supabase
      .from('superadmins')
      .select('id, passphrase_hash')
      .eq('email', actor.realEmail!)
      .single()

    if (fetchErr || !superadmin) {
      return { error: 'Failed to locate your superadmin record.' }
    }

    // Verify current passphrase
    const isValid = await bcrypt.compare(currentPass, superadmin.passphrase_hash)
    if (!isValid) {
      return { error: 'Incorrect current passphrase.' }
    }

    // Hash and update new passphrase
    const newHash = await bcrypt.hash(newPass, 12)
    const { error: updateErr } = await supabase
      .from('superadmins')
      .update({ passphrase_hash: newHash })
      .eq('id', superadmin.id)

    if (updateErr) {
      console.error('Failed to update passphrase:', updateErr)
      return { error: 'Database error occurred while updating passphrase.' }
    }

    return { success: true }
  } catch (err) {
    console.error('Failed to change passphrase:', err)
    return { error: 'An unexpected error occurred.' }
  }
}
