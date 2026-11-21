import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken, getUser } from './api.js'
import { CourseProvider } from './context/CourseContext.jsx'
import ThreeBackground from './components/ThreeBackground.jsx'
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
    <div className="min-h-screen relative overflow-x-hidden flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* 3D Interactive Ambient Mesh Layer across all authenticated views */}
      <ThreeBackground density={500} speed={0.0005} />
      
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 relative z-10">
        <div className="page-enter">
          {children}
        </div>
      </main>

      <Chatbot />
    </div>
  )
}

export default function App() {
  return (
    <CourseProvider>
      <Routes>
        <Route path="/" element={
          getToken()
            ? <Navigate to={getUser()?.role === 'student' ? '/student' : '/dashboard'} replace />
            : <Login />
        } />

        <Route path="/dashboard" element={
          <PrivateRoute>
            <AppShell><Dashboard /></AppShell>
          </PrivateRoute>
        } />

        <Route path="/students" element={
          <PrivateRoute>
            <AppShell><Students /></AppShell>
          </PrivateRoute>
        } />
        <Route path="/courses/:id/students" element={
          <PrivateRoute>
            <AppShell><Students /></AppShell>
          </PrivateRoute>
        } />

        <Route path="/attendance" element={
          <PrivateRoute>
            <AppShell><Attendance /></AppShell>
          </PrivateRoute>
        } />
        <Route path="/courses/:id/attendance" element={
          <PrivateRoute>
            <AppShell><Attendance /></AppShell>
          </PrivateRoute>
        } />

        <Route path="/marks" element={
          <PrivateRoute>
            <AppShell><Marks /></AppShell>
          </PrivateRoute>
        } />
        <Route path="/courses/:id/marks" element={
          <PrivateRoute>
            <AppShell><Marks /></AppShell>
          </PrivateRoute>
        } />

        <Route path="/deficits" element={
          <PrivateRoute>
            <AppShell><Deficits /></AppShell>
          </PrivateRoute>
        } />
        <Route path="/courses/:id/deficits" element={
          <PrivateRoute>
            <AppShell><Deficits /></AppShell>
          </PrivateRoute>
        } />

        <Route path="/reports" element={
          <PrivateRoute>
            <AppShell><Reports /></AppShell>
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
    </CourseProvider>
  )
}
