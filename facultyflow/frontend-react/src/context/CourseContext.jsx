import { createContext, useContext, useState, useEffect } from 'react'
import { getCourses, getUser } from '../api.js'

const CourseContext = createContext(null)

export function CourseProvider({ children }) {
  const [courses, setCourses] = useState([])
  const [activeCourseId, setActiveCourseId] = useState(() => {
    return localStorage.getItem('ff_active_course_id') || null
  })
  const [loading, setLoading] = useState(true)

  const reloadCourses = async () => {
    try {
      const user = getUser()
      if (!user) return
      const list = await getCourses()
      setCourses(list)
      if (list.length > 0) {
        // If current active course is not in list, pick the first
        const found = list.find(c => String(c.course_id) === String(activeCourseId))
        if (!found) {
          setActiveCourseId(String(list[0].course_id))
          localStorage.setItem('ff_active_course_id', String(list[0].course_id))
        }
      }
    } catch (e) {
      console.error('Failed to load courses', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reloadCourses()
  }, [])

  const handleSetActiveCourseId = (id) => {
    setActiveCourseId(String(id))
    localStorage.setItem('ff_active_course_id', String(id))
  }

  const activeCourse = courses.find(c => String(c.course_id) === String(activeCourseId)) || courses[0] || null

  return (
    <CourseContext.Provider value={{
      courses,
      activeCourseId: activeCourse ? String(activeCourse.course_id) : activeCourseId,
      activeCourse,
      setActiveCourseId: handleSetActiveCourseId,
      reloadCourses,
      loading
    }}>
      {children}
    </CourseContext.Provider>
  )
}

export function useCourse() {
  return useContext(CourseContext)
}
