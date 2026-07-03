import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import api from '../services/api'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  status: 'active',
  password: '',
  manualPassword: false,
  mustChangePassword: false,
  paymentMode: 'postpaid',
  classPrice: 0,
  monthlyFixedAmount: 0,
  selectedClassIds: [],
  birthday: '',
  dpi: '',
  department: '',
  municipality: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianRelationship: '',
}

function StudentsPage() {
  const [activeTab, setActiveTab] = useState('active')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tempPassword, setTempPassword] = useState(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [availableClasses, setAvailableClasses] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [departments, setDepartments] = useState([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [municipalities, setMunicipalities] = useState([])
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false)

  useEffect(() => {
    fetchStudents()
  }, [activeTab])

  useEffect(() => {
    if (showModal) {
      fetchAdminClasses()
      fetchDepartments()
    }
  }, [showModal])

  useEffect(() => {
    if (formData.department) {
      fetchMunicipalities(formData.department)
    } else {
      setMunicipalities([])
    }
  }, [formData.department])

  const fetchDepartments = async () => {
    setLoadingDepartments(true)
    try {
      const response = await api.get('/geolocation/departments')
      setDepartments(response.data.data || [])
    } catch (err) {
      console.error('Error fetching departments:', err)
      setDepartments([])
    } finally {
      setLoadingDepartments(false)
    }
  }

  const fetchMunicipalities = async (dept) => {
    setLoadingMunicipalities(true)
    try {
      const response = await api.get(`/geolocation/municipalities/${dept}`)
      setMunicipalities(response.data.data || [])
    } catch (err) {
      console.error('Error fetching municipalities:', err)
      setMunicipalities([])
    } finally {
      setLoadingMunicipalities(false)
    }
  }

  const fetchAdminClasses = async () => {
    setLoadingClasses(true)
    try {
      const response = await api.get('/classes/admin-classes')
      setAvailableClasses(response.data.data || [])
    } catch (err) {
      console.error('Error fetching admin classes:', err)
      setAvailableClasses([])
    } finally {
      setLoadingClasses(false)
    }
  }

  const fetchStudents = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/users/students?status=${activeTab}`)
      setStudents(response.data.data || [])
    } catch (err) {
      console.error('Error fetching students:', err)
      setError(`Failed to load ${activeTab === 'active' ? 'active' : 'inactive'} students`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const isNumericField = name.toLowerCase().includes('price') || name.toLowerCase().includes('amount')
    setFormData((prev) => ({
      ...prev,
      [name]: isNumericField ? (parseFloat(value) || 0) : value,
      ...(name === 'department' ? { municipality: '' } : {}),
    }))
    if (formError) setFormError('')
  }

  const handleEditStudent = (student) => {
    setEditingStudentId(student.id)
    setFormData({
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email: student.email || '',
      phone: student.phone || '',
      status: student.status || 'active',
      password: '',
      manualPassword: false,
      mustChangePassword: student.mustChangePassword || false,
      paymentMode: student.paymentMode || 'postpaid',
      classPrice: student.classPrice ?? 0,
      monthlyFixedAmount: student.monthlyFixedAmount ?? 0,
      selectedClassIds: [],
      birthday: student.birthday ? student.birthday.split('T')[0] : '',
      dpi: student.dpi || '',
      department: student.department || '',
      municipality: student.municipality || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      guardianEmail: student.guardianEmail || '',
      guardianRelationship: student.guardianRelationship || '',
    })
    setShowModal(true)
  }

  const handleDeleteStudent = async (studentId) => {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return
    }

    try {
      await api.delete(`/users/students/${studentId}`)
      await fetchStudents()
    } catch (err) {
      console.error('Error deleting student:', err)
      const errorMsg = err.response?.data?.error?.message || 'Failed to delete student'
      setError(errorMsg)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingStudentId(null)
    setFormData(EMPTY_FORM)
    setFormError('')
    setTempPassword(null)
    setShowSuccessModal(false)
    setShowPassword(false)
    setMunicipalities([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError('')

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setFormError('Please fill in all required fields')
      setIsSubmitting(false)
      return
    }

    if (formData.dpi && !/^\d{13}$/.test(formData.dpi)) {
      setFormError('DPI must be exactly 13 digits (numbers only)')
      setIsSubmitting(false)
      return
    }

    if (formData.manualPassword && !formData.password) {
      setFormError('Please enter a password')
      setIsSubmitting(false)
      return
    }

    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        status: formData.status || 'active',
        paymentMode: formData.paymentMode || 'postpaid',
        classPrice: parseFloat(formData.classPrice) || 0,
        monthlyFixedAmount: parseFloat(formData.monthlyFixedAmount) || 0,
        selectedClassIds: formData.selectedClassIds || [],
        birthday: formData.birthday || null,
        dpi: formData.dpi.trim() || null,
        department: formData.department || null,
        municipality: formData.municipality || null,
        guardianName: formData.guardianName.trim() || null,
        guardianPhone: formData.guardianPhone.trim() || null,
        guardianEmail: formData.guardianEmail.trim() || null,
        guardianRelationship: formData.guardianRelationship || null,
      }

      if (!editingStudentId && formData.manualPassword && formData.password) {
        payload.password = formData.password
      }

      if (editingStudentId) {
        // Email is immutable — strip it from the update payload
        const { email, ...updatePayload } = payload

        if (formData.password) {
          updatePayload.password = formData.password
        }
        if (formData.mustChangePassword === true) {
          updatePayload.mustChangePassword = true
        }

        await api.put(`/users/students/${editingStudentId}`, updatePayload)
        setShowModal(false)
        setEditingStudentId(null)
        await fetchStudents()
      } else {
        const response = await api.post('/users/students', payload)

        if (response.data?.data?.tempPassword) {
          setTempPassword(response.data.data.tempPassword)
          setShowSuccessModal(true)
        } else {
          setShowModal(false)
          setEditingStudentId(null)
          await fetchStudents()
        }
      }

      setFormData(EMPTY_FORM)
    } catch (err) {
      console.error('Error saving student:', err)
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || (editingStudentId ? 'Failed to update student' : 'Failed to register student')
      const details = err.response?.data?.error?.details

      if (details && Array.isArray(details) && details.length > 0) {
        const validationMessages = details.map(d => {
          let fieldLabel = d.field
          let customMessage = d.message
          if (d.field === 'paymentMode') { fieldLabel = 'Payment Mode'; customMessage = 'Select a valid option (Prepaid or Postpaid).' }
          if (d.field === 'classPrice') fieldLabel = 'Price per Class'
          if (d.field === 'monthlyFixedAmount') fieldLabel = 'Monthly Fixed Amount'
          return `${fieldLabel}: ${customMessage}`
        }).join('\n')
        setFormError(validationMessages)
      } else {
        setFormError(errorMsg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Student Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage active and inactive students
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
          >
            + Register Student
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            👥 Active Students
          </button>
          <button
            onClick={() => setActiveTab('inactive')}
            className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'inactive'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            ⏸️ Inactive Students
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading students...</p>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No {activeTab === 'active' ? 'active' : 'inactive'} students registered
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-block px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
            >
              Register the first student
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Phone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Payment Mode</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Price/Class</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Monthly Fixed</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr
                    key={student.id || index}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{student.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{student.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        student.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {student.status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-semibold">
                        {student.paymentMode || 'postpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${student.classPrice || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${student.monthlyFixedAmount || 0}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-xs font-semibold"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-xs font-semibold"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Registration / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-6 flex items-center justify-between sticky top-0 z-10">
                <h2 className="text-2xl font-bold text-white">
                  {editingStudentId ? 'Edit Student' : 'Register New Student'}
                </h2>
                <button onClick={handleCloseModal} className="text-white hover:opacity-80 transition-opacity">✕</button>
              </div>

              <div className="px-6 py-6">
                {formError && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 text-sm whitespace-pre-line">⚠️ {formError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* ── Basic Info ─────────────────────────────── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name *</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                      placeholder="Jane"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name *</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                      placeholder="Doe"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange}
                      placeholder="jane@example.com"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                      placeholder="+502 7777-7777"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting} />
                  </div>

                  {/* ── Additional Info ───────────────────────── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date of Birth (Optional)</label>
                    <input type="date" name="birthday" value={formData.birthday} onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">DPI (Optional)</label>
                    <input type="text" name="dpi" value={formData.dpi} onChange={handleChange}
                      placeholder="e.g. 1234567890123"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting} />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Guatemala DPI — must be exactly 13 digits</p>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department (Optional)</label>
                    <select name="department" value={formData.department} onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting || loadingDepartments}>
                      <option value="">{loadingDepartments ? 'Loading departments...' : 'Select a department'}</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* Municipality (only when department selected) */}
                  {formData.department && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Municipality (Optional)</label>
                      <select name="municipality" value={formData.municipality} onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={isSubmitting || loadingMunicipalities || municipalities.length === 0}>
                        <option value="">{loadingMunicipalities ? 'Loading municipalities...' : 'Select a municipality'}</option>
                        {municipalities.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  )}

                  {/* ── Guardian Info ─────────────────────────── */}
                  <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2">
                      <span>👥</span> Guardian Information (Optional)
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardian Name</label>
                        <input type="text" name="guardianName" value={formData.guardianName} onChange={handleChange}
                          placeholder="Guardian's full name"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={isSubmitting} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardian Phone</label>
                        <input type="tel" name="guardianPhone" value={formData.guardianPhone} onChange={handleChange}
                          placeholder="+1234567890"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={isSubmitting} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardian Email</label>
                        <input type="email" name="guardianEmail" value={formData.guardianEmail} onChange={handleChange}
                          placeholder="guardian@email.com"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={isSubmitting} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relationship to Student</label>
                        <select name="guardianRelationship" value={formData.guardianRelationship} onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={isSubmitting}>
                          <option value="">Select a relationship</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Legal Guardian">Legal Guardian</option>
                          <option value="Grandparent">Grandparent</option>
                          <option value="Uncle/Aunt">Uncle/Aunt</option>
                          <option value="Older Sibling">Older Sibling</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ── Password (edit: if unused) ─────────────── */}
                  {editingStudentId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Temporary Password</label>
                      {formData.mustChangePassword === true ? (
                        <>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              name="password"
                              value={formData.password}
                              onChange={handleChange}
                              placeholder="New temporary password"
                              className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              disabled={isSubmitting}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                              disabled={isSubmitting}>
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            ✏️ Password has not been used yet. You can correct or set a new one.
                          </p>
                        </>
                      ) : (
                        <>
                          <input type="password" value="••••••••" placeholder="Password used"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                            disabled />
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            🔒 Password already used by the student. Cannot be changed.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Status ───────────────────────────────── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting}>
                      <option value="active">✅ Active</option>
                      <option value="inactive">⏸️ Inactive</option>
                    </select>
                  </div>

                  {/* ── Manual Password (create only) ─────────── */}
                  {!editingStudentId && (
                    <>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" name="manualPassword" checked={formData.manualPassword}
                            onChange={(e) => setFormData((prev) => ({ ...prev, manualPassword: e.target.checked, password: e.target.checked ? prev.password : '' }))}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            disabled={isSubmitting} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🔐 Set password manually?</span>
                        </label>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formData.manualPassword ? 'Enter a custom password' : 'A secure password will be generated automatically'}
                        </p>
                      </div>

                      {formData.manualPassword && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password *</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              name="password"
                              value={formData.password}
                              onChange={handleChange}
                              placeholder="Enter a secure password"
                              className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              disabled={isSubmitting}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                              disabled={isSubmitting}>
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Minimum 8 characters</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Payment Mode ──────────────────────────── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Mode</label>
                    <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isSubmitting}>
                      <option value="postpaid">Postpaid</option>
                      <option value="prepaid">Prepaid</option>
                    </select>
                  </div>

                  {/* ── Pricing ───────────────────────────────── */}
                  <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <h3 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-4">💰 Configuración de Precios</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Precio por Clase
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">Q</span>
                          <input
                            type="number" name="classPrice" value={formData.classPrice}
                            onChange={handleChange} min="0" step="0.01"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={isSubmitting}
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Postpago: clases asistidas</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Monto Mensual Fijo
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">Q</span>
                          <input
                            type="number" name="monthlyFixedAmount" value={formData.monthlyFixedAmount}
                            onChange={handleChange} min="0" step="0.01"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            disabled={isSubmitting}
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Prepago: cuota mensual fija</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Classes ───────────────────────────────── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">🎓 Classes to Enroll (Optional)</label>
                    {loadingClasses ? (
                      <div className="p-4 text-center">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600"></div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Loading classes...</p>
                      </div>
                    ) : availableClasses.length === 0 ? (
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400">No classes available</p>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 space-y-2">
                        {availableClasses.map((cls) => (
                          <label key={cls.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={(formData.selectedClassIds || []).includes(cls.id)}
                              onChange={(e) => {
                                setFormData((prev) => {
                                  const ids = prev.selectedClassIds || []
                                  return { ...prev, selectedClassIds: e.target.checked ? [...ids, cls.id] : ids.filter((id) => id !== cls.id) }
                                })
                              }}
                              disabled={isSubmitting}
                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{cls.title}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {cls.instructor ? `Instructor: ${cls.instructor}` : 'No instructor'}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Actions ───────────────────────────────── */}
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={handleCloseModal}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      disabled={isSubmitting}>
                      Cancel
                    </button>
                    <button type="submit"
                      className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}>
                      {isSubmitting ? (editingStudentId ? 'Updating...' : 'Registering...') : (editingStudentId ? 'Update' : 'Register')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal - Temporary Password */}
        {showSuccessModal && tempPassword && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">✅ Student Registered!</h2>
                <button onClick={handleCloseModal} className="text-white hover:opacity-80 transition-opacity">✕</button>
              </div>

              <div className="px-6 py-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  The student has been registered successfully. Share the following temporary password:
                </p>

                <div className="bg-gray-100 dark:bg-gray-700 border-2 border-green-500 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Temporary Password:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-600 px-3 py-2 rounded break-all">
                      {tempPassword}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(tempPassword); alert('Password copied to clipboard!') }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    <strong>⚠️ Important:</strong> The student must change this password on their first login.
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>💡 Tip:</strong> Copy the password and share it securely with the student.
                  </p>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentsPage
