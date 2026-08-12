import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY обязательны');
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Railway/Node: нативный WebSocket есть с Node 22; ws — запасной вариант
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  return client;
}
