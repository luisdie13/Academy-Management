import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'

const DAYS_LABEL = { monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', friday: 'Vie', saturday: 'Sáb' }
const DAY_VALUES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_NAMES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// PostgreSQL returns enum arrays as "{monday,tuesday}" strings; parse to JS array
function parsePgArray(val) {
  if (Array.isArray(val)) return val
  if (!val || val === '{}') return []
  return String(val).replace(/^\{|\}$/g, '').split(',').filter(Boolean)
}

function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayStr() {
  return toLocalDateStr(new Date())
}

function monthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Mini calendar component showing marked attendance days
function AttendanceCalendar({ year, month, markedDates, selectedDate, onSelectDate }) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay() // 0=Sun
  const today = todayStr()

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(dateStr)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES_ES.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`e-${i}`} />
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate
          const hasRecords = markedDates.includes(dateStr)
          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`
                relative h-8 w-full rounded-lg text-xs font-medium transition-all
                ${isSelected ? 'bg-primary-600 text-white shadow-md' : ''}
                ${!isSelected && isToday ? 'ring-2 ring-primary-400 text-primary-700 dark:text-primary-300' : ''}
                ${!isSelected && !isToday ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
              `}
            >
              {dateStr.split('-')[2].replace(/^0/, '')}
              {hasRecords && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Modal to edit a student's schedule (days_of_week) for a class
function ScheduleModal({ student, classId, currentDays, onSave, onClose }) {
  const [selected, setSelected] = useState(currentDays || [])
  const [saving, setSaving] = useState(false)

  const toggle = (day) => {
    setSelected(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/enroll/${classId}/student/${student.id}/schedule`, { daysOfWeek: selected })
      onSave(student.id, selected)
      onClose()
    } catch (err) {
      console.error('Error updating schedule:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          Horario de {student.firstName} {student.lastName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Selecciona los días que debe asistir a esta clase.
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          {DAY_VALUES.map(day => (
            <button
              key={day}
              onClick={() => toggle(day)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selected.includes(day)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {DAYS_LABEL[day]}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ClassesPage() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingClassId, setEditingClassId] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [formData, setFormData] = useState({ title: '', description: '', instructor: '' })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  // Attendance state
  const [attendanceMap, setAttendanceMap] = useState({})
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [markingId, setMarkingId] = useState(null)
  const [enrolledStudents, setEnrolledStudents] = useState([])
  const [markedDates, setMarkedDates] = useState([])

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [calendarDate, setCalendarDate] = useState(new Date())

  // Schedule editing
  const [scheduleModal, setScheduleModal] = useState(null) // { student, currentDays }
  // Map of studentId → days_of_week[]
  const [studentSchedules, setStudentSchedules] = useState({})

  useEffect(() => { fetchClasses() }, [])

  useEffect(() => {
    if (selectedClassId) {
      fetchEnrolledStudents(selectedClassId)
    } else {
      setAttendanceMap({})
      setEnrolledStudents([])
      setMarkedDates([])
    }
  }, [selectedClassId])

  useEffect(() => {
    if (selectedClassId) {
      fetchAttendance(selectedClassId, selectedDate)
    }
  }, [selectedClassId, selectedDate])

  useEffect(() => {
    if (selectedClassId) {
      fetchMarkedDates(selectedClassId, monthStr(calendarDate))
    }
  }, [selectedClassId, calendarDate])

  const fetchClasses = async () => {
    setLoading(true)
    setError(null)
    setSelectedClassId(null)
    try {
      const response = await api.get('/classes')
      setClasses(response.data.data || [])
    } catch (err) {
      setError('No se pudieron cargar las clases')
    } finally {
      setLoading(false)
    }
  }

  const fetchEnrolledStudents = async (classId) => {
    try {
      const response = await api.get(`/classes/${classId}/students`)
      const students = response.data?.data || []
      setEnrolledStudents(students)
      // Build schedule map from inscription data
      const schedMap = {}
      students.forEach(s => {
        schedMap[s.id] = parsePgArray(s.daysOfWeek)
      })
      setStudentSchedules(schedMap)
    } catch (err) {
      setEnrolledStudents([])
    }
  }

  const fetchAttendance = async (classId, date) => {
    setAttendanceLoading(true)
    try {
      const response = await api.get(`/attendance/class/${classId}?date=${date}`)
      const records = response.data?.data?.records || []
      const map = {}
      records.forEach(r => {
        const sid = r.studentId ?? r.student_id
        if (sid != null) map[sid] = r.status
      })
      setAttendanceMap(map)
    } catch (err) {
      if (err.response?.status !== 404) console.error('Error fetching attendance:', err)
      setAttendanceMap({})
    } finally {
      setAttendanceLoading(false)
    }
  }

  const fetchMarkedDates = async (classId, month) => {
    try {
      const response = await api.get(`/attendance/class/${classId}/calendar?month=${month}`)
      const dates = (response.data?.data?.markedDates || []).map(d =>
        typeof d === 'string' ? d.split('T')[0] : d
      )
      setMarkedDates(dates)
    } catch {
      setMarkedDates([])
    }
  }

  const handleMarkAttendance = async (classId, studentId, status) => {
    setMarkingId(studentId)
    try {
      await api.post('/attendance', { classId, studentId, status, date: selectedDate })
      setAttendanceMap(prev => ({ ...prev, [studentId]: status }))
      // Refresh marked dates so the calendar dot appears
      fetchMarkedDates(classId, monthStr(calendarDate))
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al registrar asistencia')
    } finally {
      setMarkingId(null)
    }
  }

  const handleMarkAll = async (classId, status) => {
    for (const student of enrolledStudents) {
      const sid = student.id
      if (attendanceMap[sid] !== status) {
        await handleMarkAttendance(classId, sid, status)
      }
    }
  }

  const navigateDate = (delta) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    const newDate = toLocalDateStr(d)
    setSelectedDate(newDate)
    const newCal = new Date(d.getFullYear(), d.getMonth(), 1)
    if (monthStr(newCal) !== monthStr(calendarDate)) {
      setCalendarDate(newCal)
    }
  }

  const navigateCalendarMonth = (delta) => {
    const d = new Date(calendarDate)
    d.setMonth(d.getMonth() + delta)
    setCalendarDate(d)
  }

  const handleSelectDate = (dateStr) => {
    setSelectedDate(dateStr)
    const d = new Date(dateStr + 'T00:00:00')
    if (monthStr(new Date(d.getFullYear(), d.getMonth(), 1)) !== monthStr(calendarDate)) {
      setCalendarDate(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }

  const handleUpdateSchedule = (studentId, days) => {
    setStudentSchedules(prev => ({ ...prev, [studentId]: days }))
  }

  const handleToggleActive = async (classId, currentValue) => {
    setTogglingId(classId)
    try {
      await api.put(`/classes/${classId}`, { is_active: !currentValue })
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, isActive: !currentValue } : c))
      if (selectedClassId === classId && currentValue) setSelectedClassId(null)
    } catch (err) {
      setError('Error al cambiar el estado de la clase')
    } finally {
      setTogglingId(null)
    }
  }

  const handleEditClass = (classItem) => {
    setEditingClassId(classItem.id)
    setFormData({ title: classItem.title || '', description: classItem.description || '', instructor: classItem.instructor || '' })
    setShowModal(true)
  }

  const handleDeleteClass = async (classId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta clase?')) return
    try {
      await api.delete(`/classes/${classId}`)
      await fetchClasses()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al eliminar la clase')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingClassId(null)
    setFormData({ title: '', description: '', instructor: '' })
    setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError('')
    if (!formData.title || !formData.instructor) {
      setFormError('Por favor completa todos los campos obligatorios')
      setIsSubmitting(false)
      return
    }
    try {
      const payload = { title: formData.title.trim(), description: formData.description.trim(), instructor: formData.instructor.trim() }
      if (editingClassId) {
        await api.put(`/classes/${editingClassId}`, payload)
      } else {
        await api.post('/classes', payload)
      }
      handleCloseModal()
      await fetchClasses()
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || (editingClassId ? 'Error al actualizar' : 'Error al crear'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getName = (s) => s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name || s.email || '—'

  const isDayScheduled = (studentId, dateStr) => {
    const days = studentSchedules[studentId]
    if (!days || days.length === 0) return null // no schedule set = always show
    const dow = new Date(dateStr + 'T00:00:00').getDay() // 0=Sun
    const dayMap = [null, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return days.includes(dayMap[dow])
  }

  const activeClasses = classes.filter(c => c.isActive)

  const selectedDateDisplay = (() => {
    const d = new Date(selectedDate + 'T00:00:00')
    return `${d.getDate()} ${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`
  })()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-1">Clases & Asistencia</h1>
            <p className="text-gray-500 dark:text-gray-400">Gestiona clases y registra asistencia por día</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
          >
            + Nueva Clase
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando clases…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── SECCIÓN 1: CLASES ACTIVAS ── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Clases Activas</h2>
                <span className="px-2.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold rounded-full">
                  {activeClasses.length}
                </span>
              </div>

              {activeClasses.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 mb-1">No hay clases activas</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Activa una clase en el registro para comenzar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {activeClasses.map((cls) => (
                    <div
                      key={cls.id}
                      onClick={() => setSelectedClassId(selectedClassId === cls.id ? null : cls.id)}
                      className={`cursor-pointer rounded-xl border-2 p-6 transition-all ${
                        selectedClassId === cls.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{cls.title}</h3>
                        <span className="ml-2 flex-shrink-0 w-2.5 h-2.5 rounded-full bg-green-500 mt-1" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                        {cls.description || 'Sin descripción'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <span>👨‍🏫</span>
                        <span className="font-medium">{cls.instructor || '—'}</span>
                      </div>
                      <p className="mt-4 text-xs font-semibold text-primary-600 dark:text-primary-400">
                        {selectedClassId === cls.id ? '▲ Cerrar panel' : '▼ Ver alumnos y asistencia'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── PANEL DE ASISTENCIA ── */}
              {selectedClassId && (() => {
                const selectedClass = activeClasses.find(c => c.id === selectedClassId)
                if (!selectedClass) return null

                return (
                  <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Panel header */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        👥 {selectedClass.title} — Asistencia
                      </h3>
                      <button
                        onClick={() => setSelectedClassId(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Calendar */}
                      <div className="lg:col-span-1">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            onClick={() => navigateCalendarMonth(-1)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                          >
                            ‹
                          </button>
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {MONTH_NAMES_ES[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                          </span>
                          <button
                            onClick={() => navigateCalendarMonth(1)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                          >
                            ›
                          </button>
                        </div>
                        <AttendanceCalendar
                          year={calendarDate.getFullYear()}
                          month={calendarDate.getMonth()}
                          markedDates={markedDates}
                          selectedDate={selectedDate}
                          onSelectDate={handleSelectDate}
                        />
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                          • Días con registro de asistencia
                        </p>
                      </div>

                      {/* Right: Attendance table */}
                      <div className="lg:col-span-2">
                        {/* Date navigation */}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => navigateDate(-1)}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                          >
                            ← Anterior
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-gray-900 dark:text-white">{selectedDateDisplay}</span>
                            {selectedDate === todayStr() && (
                              <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-semibold rounded-full">Hoy</span>
                            )}
                          </div>
                          <button
                            onClick={() => navigateDate(1)}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                          >
                            Siguiente →
                          </button>
                        </div>

                        {attendanceLoading ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mr-3" />
                            <p className="text-gray-500 dark:text-gray-400">Cargando…</p>
                          </div>
                        ) : enrolledStudents.length === 0 ? (
                          <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <p className="text-gray-500 dark:text-gray-400">No hay alumnos inscritos en esta clase.</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Inscribe alumnos desde la página de Alumnos.</p>
                          </div>
                        ) : (
                          <>
                            {/* Bulk actions */}
                            <div className="flex gap-2 mb-3">
                              <button
                                onClick={() => handleMarkAll(selectedClassId, 'present')}
                                className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg text-xs font-semibold transition-colors"
                              >
                                ✓ Todos presentes
                              </button>
                              <button
                                onClick={() => handleMarkAll(selectedClassId, 'absent')}
                                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg text-xs font-semibold transition-colors"
                              >
                                ✗ Todos ausentes
                              </button>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                  <tr className="text-left">
                                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">#</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Alumno</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">Horario</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Marcar</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                  {enrolledStudents.map((student, index) => {
                                    const sid = student.id
                                    const currentStatus = attendanceMap[sid]
                                    const isMarking = markingId === sid
                                    const scheduled = isDayScheduled(sid, selectedDate)
                                    const days = Array.isArray(studentSchedules[sid]) ? studentSchedules[sid] : []

                                    return (
                                      <tr key={sid} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                        <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-3">
                                          <p className="font-medium text-gray-900 dark:text-white">{getName(student)}</p>
                                          <p className="text-xs text-gray-400 dark:text-gray-500">{student.email || '—'}</p>
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                          {days.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {days.map(d => (
                                                <span key={d} className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                                  scheduled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                                }`}>
                                                  {DAYS_LABEL[d]}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => setScheduleModal({ student, currentDays: [] })}
                                              className="text-xs text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 underline"
                                            >
                                              + Asignar días
                                            </button>
                                          )}
                                          {days.length > 0 && (
                                            <button
                                              onClick={() => setScheduleModal({ student, currentDays: days })}
                                              className="block text-xs text-gray-400 hover:text-primary-500 mt-0.5"
                                            >
                                              ✏️ editar
                                            </button>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {currentStatus === 'present' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">✓ Presente</span>
                                          )}
                                          {currentStatus === 'absent' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold">✗ Ausente</span>
                                          )}
                                          {currentStatus === 'pending' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold">⏳ Pendiente</span>
                                          )}
                                          {!currentStatus && scheduled === false && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500">No programado</span>
                                          )}
                                          {!currentStatus && scheduled !== false && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500">Sin registro</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex gap-1.5">
                                            <button
                                              onClick={() => handleMarkAttendance(selectedClassId, sid, 'present')}
                                              disabled={isMarking || currentStatus === 'present'}
                                              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                                currentStatus === 'present'
                                                  ? 'bg-green-600 text-white cursor-default'
                                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50'
                                              }`}
                                            >
                                              {isMarking ? '…' : '✓'}
                                            </button>
                                            <button
                                              onClick={() => handleMarkAttendance(selectedClassId, sid, 'absent')}
                                              disabled={isMarking || currentStatus === 'absent'}
                                              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                                currentStatus === 'absent'
                                                  ? 'bg-red-600 text-white cursor-default'
                                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50'
                                              }`}
                                            >
                                              {isMarking ? '…' : '✗'}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Summary bar */}
                            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                ✓ Presentes: {Object.values(attendanceMap).filter(s => s === 'present').length}
                              </span>
                              <span className="text-red-600 dark:text-red-400 font-semibold">
                                ✗ Ausentes: {Object.values(attendanceMap).filter(s => s === 'absent').length}
                              </span>
                              <span>
                                Registros: {Object.keys(attendanceMap).length} / {enrolledStudents.length}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </section>

            {/* ── SECCIÓN 2: REGISTRO DE CLASES ── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Registro de Clases</h2>
                <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-full">
                  {classes.length}
                </span>
              </div>

              {classes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Aún no hay clases registradas</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Registrar primera clase
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <tr className="text-left">
                        <th className="px-5 py-3.5 font-semibold text-gray-600 dark:text-gray-300 w-10">#</th>
                        <th className="px-5 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Título</th>
                        <th className="px-5 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Instructor</th>
                        <th className="px-5 py-3.5 font-semibold text-gray-600 dark:text-gray-300 text-center">Activa</th>
                        <th className="px-5 py-3.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {classes.map((cls, index) => {
                        const isToggling = togglingId === cls.id
                        return (
                          <tr key={cls.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-5 py-4 text-gray-400 dark:text-gray-500 font-mono text-xs">{index + 1}</td>
                            <td className="px-5 py-4">
                              <p className="font-semibold text-gray-900 dark:text-white">{cls.title}</p>
                              {cls.description && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{cls.description}</p>
                              )}
                            </td>
                            <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{cls.instructor || '—'}</td>
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => handleToggleActive(cls.id, cls.isActive)}
                                disabled={isToggling}
                                title={cls.isActive ? 'Desactivar clase' : 'Activar clase'}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed ${cls.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${cls.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditClass(cls)}
                                  className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-xs font-semibold"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteClass(cls.id)}
                                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-xs font-semibold"
                                >
                                  🗑️ Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* Modal crear/editar clase */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-6 flex items-center justify-between rounded-t-xl">
                <h2 className="text-2xl font-bold text-white">{editingClassId ? 'Editar Clase' : 'Nueva Clase'}</h2>
                <button onClick={handleCloseModal} className="text-white hover:opacity-80 transition-opacity text-xl">✕</button>
              </div>

              <div className="px-6 py-6">
                {formError && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 text-sm">⚠️ {formError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre de la clase *</label>
                    <input
                      type="text" name="title" value={formData.title}
                      onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ej. Guitarra Básica"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
                    <textarea
                      name="description" value={formData.description}
                      onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      placeholder="Descripción del contenido"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      rows="3" disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instructor *</label>
                    <input
                      type="text" name="instructor" value={formData.instructor}
                      onChange={e => setFormData(p => ({ ...p, instructor: e.target.value }))}
                      placeholder="Nombre del instructor"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="pt-6">
                    {editingClassId && (
                      <button
                        type="button"
                        onClick={() => { handleDeleteClass(editingClassId); handleCloseModal() }}
                        className="w-full px-4 py-2 text-red-600 dark:text-red-400 font-semibold rounded-lg border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mb-4"
                        disabled={isSubmitting}
                      >
                        🗑️ Eliminar Clase
                      </button>
                    )}
                    <div className="flex gap-3">
                      <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" disabled={isSubmitting}>
                        Cancelar
                      </button>
                      <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting}>
                        {isSubmitting ? (editingClassId ? 'Actualizando…' : 'Creando…') : (editingClassId ? 'Actualizar' : 'Crear')}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Schedule modal */}
        {scheduleModal && (
          <ScheduleModal
            student={scheduleModal.student}
            classId={selectedClassId}
            currentDays={scheduleModal.currentDays}
            onSave={handleUpdateSchedule}
            onClose={() => setScheduleModal(null)}
          />
        )}
      </div>
    </div>
  )
}

export default ClassesPage
