import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  // loading stays true until BOTH the session check AND profile fetch are done
  const [loading, setLoading]     = useState(true)
  const fetchingRef               = useRef(false)   // prevents duplicate fetches

  useEffect(() => {
    // 1. Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // 2. Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          fetchingRef.current = false
          return
        }

        if (session?.user && !fetchingRef.current) {
          setUser(session.user)
          loadProfile(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Retry up to 5 times — profile row created by DB trigger may lag slightly
  async function loadProfile(userId) {
    if (fetchingRef.current) return
    fetchingRef.current = true

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (data) {
        setProfile(data)
        setLoading(false)
        fetchingRef.current = false
        return
      }

      // Wait before retrying (100ms, 300ms, 600ms, 1000ms)
      if (attempt < 4) {
        await new Promise(r => setTimeout(r, [100, 300, 600, 1000][attempt]))
      }
    }

    // Profile genuinely not found after retries
    setProfile(null)
    setLoading(false)
    fetchingRef.current = false
  }

  async function signIn(email, password) {
    // Reset so loadProfile can run fresh
    fetchingRef.current = false
    setLoading(true)
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      setLoading(false)
    }
    return result
  }

  async function signOut() {
    setLoading(true)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
