import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import AdminLayout from './pages/AdminLayout'
import Dashboard from './pages/Dashboard'
import TripDetail from './pages/TripDetail'
import UserTrips from './pages/UserTrips'
import UserTripDetail from './pages/UserTripDetail'

function ProtectedAdmin({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading"><div className="spinner" /><span>Loading…</span></div>
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.is_admin) return <Navigate to="/my-trips" replace />
  return children
}

function ProtectedUser({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading"><div className="spinner" /><span>Loading…</span></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (profile?.is_admin) return <Navigate to="/admin" replace />
  return <Navigate to="/my-trips" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/admin" element={<ProtectedAdmin><AdminLayout /></ProtectedAdmin>}>
            <Route index element={<Dashboard />} />
            <Route path="trips/:tripId" element={<TripDetail />} />
          </Route>
          <Route path="/my-trips" element={<ProtectedUser><UserTrips /></ProtectedUser>} />
          <Route path="/my-trips/:tripId" element={<ProtectedUser><UserTripDetail /></ProtectedUser>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
