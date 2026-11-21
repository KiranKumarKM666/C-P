import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { getToken, getUser } from './api.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Students from './pages/Students.jsx'
import Attendance from './pages/Attendance.jsx'
import Marks from './pages/Marks.jsx'
import Deficits from './pages/Deficits.jsx'
import Reports from './pages/Reports.jsx'
import Admin from './pages/Admin.jsx'
import StudentPortal from './pages/StudentPortal.jsx'
import Navbar from './components/Navbar.jsx'
import Chatbot from './components/Chatbot.jsx'

function PrivateRoute({ children, role }) {
  const token = getToken()
  const user = getUser()
  if (!token || !user) return <Navigate to="/" replace />
  if (role && user.role !== role && !(role === 'faculty' && user.role === 'admin')) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function AppShell({ children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="page-enter">
          {children}
        </div>
      </main>
      <Chatbot />
    </div>
  )
}

export default function App() {
  const user = getUser()
  const location = useLocation()

  return (
    <Routes>
      <Route path="/" element={
        getToken()
          ? <Navigate to="/dashboard" replace />
          : <Login />
      } />

      <Route path="/dashboard" element={
        <PrivateRoute>
          <AppShell><Dashboard /></AppShell>
        </PrivateRoute>
      } />

      <Route path="/courses/:id/students" element={
        <PrivateRoute>
          <AppShell><Students /></AppShell>
        </PrivateRoute>
      } />

      <Route path="/courses/:id/attendance" element={
        <PrivateRoute>
          <AppShell><Attendance /></AppShell>
        </PrivateRoute>
      } />

      <Route path="/courses/:id/marks" element={
        <PrivateRoute>
          <AppShell><Marks /></AppShell>
        </PrivateRoute>
      } />

      <Route path="/courses/:id/deficits" element={
        <PrivateRoute>
          <AppShell><Deficits /></AppShell>
        </PrivateRoute>
      } />

      <Route path="/courses/:id/reports" element={
        <PrivateRoute>
          <AppShell><Reports /></AppShell>
        </PrivateRoute>
      } />

      <Route path="/admin" element={
        <PrivateRoute role="admin">
          <AppShell><Admin /></AppShell>
        </PrivateRoute>
      } />

      <Route path="/student" element={
        <PrivateRoute role="student">
          <StudentPortal />
        </PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
