import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function StudentCalendar({
  attendanceData = [],
  onDateClick = null
}) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()

  const attendanceMap = {}
  attendanceData.forEach(item => {
    const dateStr = new Date(item.date).toISOString().split('T')[0]
    attendanceMap[dateStr] = item.status
  })

  const calendarDays = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  const handlePreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getDayStatus = (day) => {
    if (!day) return null
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const today = new Date()
    const dayDate = new Date(year, month, day)
    return {
      dateStr,
      status: attendanceMap[dateStr],
      isToday: dayDate.toDateString() === today.toDateString(),
      isPast: dayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {monthNames[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => {
            const dayInfo = getDayStatus(day)

            if (!day) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square rounded-lg bg-gray-50 dark:bg-gray-700/30"
                />
              )
            }

            // Support both backend values (present/absent) and legacy (attended/scheduled)
            const status = dayInfo.status
            const isPresent = status === 'present' || status === 'attended'
            const isAbsent = status === 'absent'
            const isToday = dayInfo.isToday
            const isPast = dayInfo.isPast

            let dayClasses =
              'aspect-square rounded-lg flex items-center justify-center font-semibold text-sm cursor-pointer transition-all '

            if (isPresent && isPast) {
              dayClasses +=
                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-2 border-green-400 dark:border-green-600 hover:shadow-md'
            } else if (isAbsent && isPast) {
              dayClasses +=
                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-2 border-red-400 dark:border-red-600 hover:shadow-md'
            } else if (isToday) {
              dayClasses +=
                'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-2 border-primary-500 dark:border-primary-500 font-bold'
            } else {
              dayClasses +=
                'bg-gray-50 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }

            return (
              <button
                key={dayInfo.dateStr}
                onClick={() => onDateClick && onDateClick(dayInfo.dateStr, status)}
                className={dayClasses}
                title={`${day} — ${status || 'Sin registro'}`}
              >
                <div className="flex flex-col items-center">
                  <span>{day}</span>
                  {isPresent && isPast && <span className="text-xs mt-0.5">✓</span>}
                  {isAbsent && isPast && <span className="text-xs mt-0.5">✗</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Leyenda:</p>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600"></div>
            <span className="text-gray-700 dark:text-gray-300">Presente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600"></div>
            <span className="text-gray-700 dark:text-gray-300">Ausente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary-100 dark:bg-primary-900/20 border-2 border-primary-500 dark:border-primary-500"></div>
            <span className="text-gray-700 dark:text-gray-300">Hoy</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">Presentes</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">
            {attendanceData.filter(a => a.status === 'present' || a.status === 'attended').length}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">Ausentes</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-400">
            {attendanceData.filter(a => a.status === 'absent').length}
          </p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">Total registros</p>
          <p className="text-xl font-bold text-orange-700 dark:text-orange-400">
            {attendanceData.length}
          </p>
        </div>
      </div>
    </div>
  )
}

export default StudentCalendar
