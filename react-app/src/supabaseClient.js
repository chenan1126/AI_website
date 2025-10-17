import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔍 環境變數檢查:')
console.log('VITE_SUPABASE_URL:', supabaseUrl)
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '已設定' : '未設定')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('請確認 react-app/.env 文件存在且包含正確的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
  console.error('並重新啟動開發伺服器 (npm run dev)')
  throw new Error('Missing Supabase environment variables. Please check react-app/.env file.')
}

console.log('✅ Supabase 環境變數已設定')
console.log('URL:', supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: window.localStorage,
    debug: true
  }
})
