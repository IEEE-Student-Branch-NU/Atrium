import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('events')
    .select('*, branches(name), profiles:creator_id(full_name, email)')
    .order('event_date', { ascending: false });
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
