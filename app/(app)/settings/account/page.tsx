import { createClient } from '@/lib/supabase/server'
import { AccountClient } from './account-client'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <AccountClient email={user?.email ?? ''} />
}
