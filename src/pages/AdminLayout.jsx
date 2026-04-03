import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>expnspltr</h1>
          <span>Admin Panel</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/admin" end className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="icon">🏠</span> Dashboard
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div style={{padding:'10px 12px', fontSize:13, color:'var(--text3)', marginBottom:8}}>
            <div style={{fontWeight:600, color:'var(--text2)', marginBottom:2}}>{profile?.name}</div>
            <div style={{fontSize:12}}>{profile?.email}</div>
          </div>
          <button className="nav-item" onClick={handleSignOut} style={{color:'var(--danger)'}}>
            <span className="icon">↩</span> Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
