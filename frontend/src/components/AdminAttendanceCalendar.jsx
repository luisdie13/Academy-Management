import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'

function AdminAttendanceCalendar() {
  const { user } = useAuthStore()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [classStudents, setClassStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attendanceData, setAttendanceData] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true)
        const response = await api.get('/classes')
        const data = response.data
        const classesArray = Array.isArray(data) ? data : (data.data || [])
        setClasses(classesArray)
      } catch (err) {
        console.error('Error fetching classes:', err)
        setError('Could not load classes. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (user?.role?.toLowerCase() === 'admin') {
      fetchClasses()
    }
  }, [user])

  // When a class is selected, fetch the enrolled students by their IDs
  const handleSelectClass = async (classItem) => {
    setSelectedClass(classItem)
    setSuccessMessage('')

    const studentIds = classItem.student_ids || []

    if (studentIds.length === 0) {
      setClassStudents([])
      setAttendanceData({})
      return
    }

    try {
      // Fetch real student data for the enrolled IDs
      const response = await api.get(`/users/students?status=active`)
      const allStudents = response.data.data || []
      const enrolled = allStudents.filter((s) => studentIds.includes(s.id))
      setClassStudents(enrolled)

      const initial = {}
      enrolled.forEach((s) => { initial[s.id] = 'pending' })
      setAttendanceData(initial)
    } catch (err) {
      console.error('Error fetching enrolled students:', err)
      // Fall back to ID-only placeholders so attendance can still be recorded
      const placeholders = studentIds.map((id) => ({ id, firstName: 'Student', lastName: `#${id}` }))
      setClassStudents(placeholders)
      const initial = {}
      studentIds.forEach((id) => { initial[id] = 'pending' })
      setAttendanceData(initial)
    }
  }

  const handleAttendanceChange = (studentId, status) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }))
  }

  const handleSubmitAttendance = async () => {
    if (!selectedClass) return

    try {
      setSubmitting(true)
      setError(null)

      await Promise.all(
        Object.entries(attendanceData).map(([studentId, status]) =>
          api.post('/attendance', {
            classId: selectedClass.id,
            studentId: parseInt(studentId),
            status,
          })
        )
      )

      setSuccessMessage('Attendance saved successfully.')
      setSelectedClass(null)
      setClassStudents([])
      setAttendanceData({})
    } catch (err) {
      console.error('Error submitting attendance:', err)
      setError('Failed to save some attendance records. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Attendance Calendar
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Select a class to record your students' attendance
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
          {successMessage}
        </div>
      )}

      {!selectedClass ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.length > 0 ? (
            classes.map((classItem) => (
              <button
                key={classItem.id}
                onClick={() => handleSelectClass(classItem)}
                className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {classItem.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {classItem.description}
                </p>
                <div className="space-y-1 text-sm text-gray-500 dark:text-gray-500">
                  <p>{classItem.start_time || classItem.class_time}</p>
                  <p>{classItem.instructor}</p>
                  <p>{(classItem.student_ids || []).length} students</p>
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">No classes created yet</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedClass.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedClass.start_time || selectedClass.class_time} — {selectedClass.instructor}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedClass(null)
                setClassStudents([])
                setAttendanceData({})
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ← Back
            </button>
          </div>

          {classStudents.length > 0 ? (
            <>
              <div className="space-y-3 mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Enrolled Students ({classStudents.length})
                </h4>
                {classStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {student.firstName} {student.lastName}
                    </span>
                    <div className="flex gap-2">
                      {[
                        { value: 'present', label: 'Present', activeClass: 'bg-green-600 text-white' },
                        { value: 'late', label: 'Late', activeClass: 'bg-yellow-500 text-white' },
                        { value: 'absent', label: 'Absent', activeClass: 'bg-red-600 text-white' },
                      ].map(({ value, label, activeClass }) => (
                        <button
                          key={value}
                          onClick={() => handleAttendanceChange(student.id, value)}
                          className={`px-3 py-2 rounded font-semibold transition-colors text-sm ${
                            attendanceData[student.id] === value
                              ? activeClass
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSubmitAttendance}
                disabled={submitting}
                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors"
              >
                {submitting ? 'Saving...' : 'Save Attendance'}
              </button>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                No students enrolled in this class
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminAttendanceCalendar
