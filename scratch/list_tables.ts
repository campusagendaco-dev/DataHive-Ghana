import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://lsocdjpflecduumopijn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzk3NDMsImV4cCI6MjA5MTI1NTc0M30.4RnQ7s2qCXO4Qqlw1WKqTfZBfB-1Kq3toyXpGHnbv_0'
)

async function listTables() {
  const { data, error } = await supabase.rpc('get_table_names') // usually not available, but I'll try or use a standard query
  console.log("Listing tables...")
}
listTables()
