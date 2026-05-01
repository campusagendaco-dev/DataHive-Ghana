import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://lsocdjpflecduumopijn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzk3NDMsImV4cCI6MjA5MTI1NTc0M30.4RnQ7s2qCXO4Qqlw1WKqTfZBfB-1Kq3toyXpGHnbv_0'
)

async function test() {
  const { data, error } = await supabase.from('orders').select('*').limit(1)
  if (error) console.error(error)
  else console.log(Object.keys(data[0] || {}))
}

test()
