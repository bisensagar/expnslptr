import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage      from './pages/LoginPage'
import AdminLayout    from './pages/AdminLayout'
import Dashboard      from './pages/Dashboard'
import TripDetail     from './pages/TripDetail'
import UserTrips      from './pages/UserTrips'
import UserTripDetail from './pages/UserTripDetail'

function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Loading…</span>
    </div>
  )
}

// Root: shows spinner until auth + profile are both ready, then routes correctly
function RootRedirect() {
  const { user, profile, loading } = useAuth()

  // Always wait for loading to finish — never redirect prematurely
  if (loading) return <Spinner />
  if (!user)   return <Navigate to="/login" replace />

  // User is authenticated — profile is now guaranteed to be loaded (or null if missing)
  if (profile?.is_admin) return <Navigate to="/admin" replace />
  return <Navigate to="/my-trips" replace />
}

// Admin guard: waits for profile before deciding
function ProtectedAdmin({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading)              return <Spinner />
  if (!user)                return <Navigate to="/login" replace />
  if (profile?.is_admin)    return children
  // User is logged in but not admin
  return <Navigate to="/my-trips" replace />
}

// User guard: just needs a valid session
function ProtectedUser({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user)   return <Navigate to="/login" replace />
  return children
}

// Redirect away from login if already authenticated
function LoginGuard() {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user)   return <LoginPage />
  if (profile?.is_admin) return <Navigate to="/admin" replace />
  return <Navigate to="/my-trips" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"      element={<RootRedirect />} />
          <Route path="/login" element={<LoginGuard />} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedAdmin><AdminLayout /></ProtectedAdmin>}>
            <Route index                element={<Dashboard />} />
            <Route path="trips/:tripId" element={<TripDetail />} />
          </Route>

          {/* User routes */}
          <Route path="/my-trips"         element={<ProtectedUser><UserTrips /></ProtectedUser>} />
          <Route path="/my-trips/:tripId" element={<ProtectedUser><UserTripDetail /></ProtectedUser>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
