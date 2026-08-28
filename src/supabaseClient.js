import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kjxqxzbndgyuqmxpbocd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tQWpFrtpK-Q21nxn985qSQ_fGQTcpZT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
