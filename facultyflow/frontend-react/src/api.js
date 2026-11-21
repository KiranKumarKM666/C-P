// ─── Single API module ───────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_BASE || ''

function getToken() { return sessionStorage.getItem('ff_token') }
function setToken(t) { sessionStorage.setItem('ff_token', t) }
function clearToken() { sessionStorage.removeItem('ff_token'); sessionStorage.removeItem('ff_user') }
function getUser() {
  try { return JSON.parse(sessionStorage.getItem('ff_user')) } catch { return null }
}
function setUser(u) { sessionStorage.setItem('ff_user', JSON.stringify(u)) }

function authHeader() {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function request(method, path, body, isFile = false) {
  const headers = { ...authHeader() }
  let fetchBody
  if (isFile) {
    fetchBody = body // FormData — do NOT set Content-Type
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    fetchBody = JSON.stringify(body)
  }

  const res = await fetch(BASE + path, { method, headers, body: fetchBody })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/'
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = Array.isArray(err.detail)
      ? err.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
      : err.detail || 'Request failed'
    throw new Error(msg)
  }

  const ct = res.headers.get('Content-Type') || ''
  if (ct.includes('application/json')) return res.json()
  return res
}

async function downloadFile(path) {
  const res = await request('GET', path)
  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition') || ''
  const match = disp.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
  const filename = match ? match[1].replace(/['"]/g, '') : 'report'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const data = await request('POST', '/auth/login', { email, password })
  setToken(data.token)
  setUser(data.user)
  return data.user
}
export { getToken, clearToken, getUser }

export const updateProfile = (body) => request('PUT', '/auth/me', body)
export const forgotPassword = (body) => request('POST', '/auth/forgot-password', body)

// ─── Courses ─────────────────────────────────────────────────────────────────
export const getCourses = () => request('GET', '/courses')
export const createCourse = (body) => request('POST', '/courses', body)

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboard = () => request('GET', '/dashboard')

// ─── Students ────────────────────────────────────────────────────────────────
export const getStudents = (cid) => request('GET', `/courses/${cid}/students`)
export const addStudent = (cid, body) => request('POST', `/courses/${cid}/students`, body)
export const removeStudent = (cid, sid) => request('DELETE', `/courses/${cid}/students/${sid}`)
export const updateStudent = (cid, sid, body) => request('PUT', `/courses/${cid}/students/${sid}`, body)
export const uploadStudents = (cid, fd) => request('POST', `/courses/${cid}/students/upload`, fd, true)

// ─── Attendance ──────────────────────────────────────────────────────────────
export const getAttendance = (cid, date) => request('GET', `/courses/${cid}/attendance${date ? `?date=${date}` : ''}`)
export const saveAttendance = (body) => request('POST', '/attendance', body)
export const uploadAttendance = (cid, fd) => request('POST', `/attendance/upload?course_id=${cid}`, fd, true)
export const getAttendanceTrend = (cid) => request('GET', `/courses/${cid}/attendance-trend`)

// ─── Marks ───────────────────────────────────────────────────────────────────
export const getMarks = (cid) => request('GET', `/courses/${cid}/marks`)
export const saveMarks = (body) => request('POST', '/marks', body)
export const uploadMarks = (cid, fd) => request('POST', `/marks/upload?course_id=${cid}`, fd, true)

// ─── Summary / Deficits ──────────────────────────────────────────────────────
export const getSummary = (cid) => request('GET', `/courses/${cid}/summary`)
export const getDeficits = (cid) => request('GET', `/courses/${cid}/deficits`)

// ─── Advisories ──────────────────────────────────────────────────────────────
export const draftAdvisory = (body) => request('POST', '/advisories/draft', body)
export const approveAdvisory = (id, body) => request('POST', `/advisories/${id}/approve`, body)
export const getCourseAdvisories = (cid) => request('GET', `/courses/${cid}/advisories`)
export const getStudentAdvisories = () => request('GET', '/student/me')

// ─── Reports ─────────────────────────────────────────────────────────────────
export const downloadReport = (type, params) => {
  const q = new URLSearchParams(params).toString()
  return downloadFile(`/reports/${type}?${q}`)
}

// ─── Users (admin) ───────────────────────────────────────────────────────────
export const getUsers = () => request('GET', '/users')
export const createUser = (body) => request('POST', '/users', body)
export const updateUser = (uid, body) => request('PUT', `/users/${uid}`, body)
export const deleteUser = (uid) => request('DELETE', `/users/${uid}`)
export const getPasswordRequests = () => request('GET', '/auth/password-requests')
export const resolvePasswordRequest = (rid, body) => request('POST', `/auth/password-requests/${rid}/resolve`, body)

// ─── Settings ────────────────────────────────────────────────────────────────
export const getSettings = () => request('GET', '/settings')
export const updateSettings = (body) => request('PUT', '/settings', body)

// ─── Templates ───────────────────────────────────────────────────────────────
export const getTemplate = (type) => downloadFile(`/templates/${type}`)
