import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://lsocdjpflecduumopijn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzk3NDMsImV4cCI6MjA5MTI1NTc0M30.4RnQ7s2qCXO4Qqlw1WKqTfZBfB-1Kq3toyXpGHnbv_0'
)

async function test() {
  const { data, error } = await supabase.from('orders').select('created_at').order('created_at', { ascending: false }).limit(5)
  if (error) console.error(error)
  else {
    console.log("Recent orders:", data.map(d => d.created_at))
    const { data: now, error: nowErr } = await supabase.rpc('get_now') // if exists, or just check server time
    console.log("Current time:", new Date().toISOString())
  }
}

test()
