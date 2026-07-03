import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function RegisterPage() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    academyCode: '',
    academyName: '',
    phone: '',
    birthday: '',
    dpi: '',
    department: '',
    municipality: '',
    selectedClassIds: [],
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianRelationship: ''
  })

  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [availableClasses, setAvailableClasses] = useState([])
  const [classesLoadError, setClassesLoadError] = useState(false)
  // 'idle' | 'validating' | 'valid' | 'invalid'
  const [academyStatus, setAcademyStatus] = useState('idle')
  const [academyName, setAcademyName] = useState('')
  const [academyAdminId, setAcademyAdminId] = useState(null)
  const validateTimerRef = useRef(null)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [departments, setDepartments] = useState([])
  const [municipalities, setMunicipalities] = useState([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false)

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true)
        const response = await api.get('/geolocation/departments')
        if (response.data.data) {
          setDepartments(response.data.data)
        }
      } catch (error) {
        console.error('Error loading departments:', error)
        setDepartments([])
      } finally {
        setLoadingDepartments(false)
      }
    }
    loadDepartments()
  }, [])

  useEffect(() => {
    if (formData.department && formData.department !== '') {
      const loadMunicipalities = async () => {
        try {
          setLoadingMunicipalities(true)
          const response = await api.get(`/geolocation/municipalities/${formData.department}`)
          if (response.data.data) {
            setMunicipalities(response.data.data)
            setFormData((prev) => ({ ...prev, municipality: '' }))
          }
        } catch (error) {
          console.error('Error loading municipalities:', error)
          setMunicipalities([])
          setFormData((prev) => ({ ...prev, municipality: '' }))
        } finally {
          setLoadingMunicipalities(false)
        }
      }
      loadMunicipalities()
    } else {
      setMunicipalities([])
    }
  }, [formData.department])

  // Cleanup debounce timer on unmount
  useEffect(() => () => clearTimeout(validateTimerRef.current), [])

  const validateAcademyCode = async (code) => {
    setAcademyStatus('validating')
    setAcademyName('')
    setAvailableClasses([])
    setClassesLoadError(false)
    setAcademyAdminId(null)
    try {
      const response = await api.get(
        `/academies/validate?code=${encodeURIComponent(code.toLowerCase())}`,
        { skipAuthRedirect: true }
      )
      const adminId = response.data.data.adminId
      setAcademyStatus('valid')
      setAcademyName(response.data.data.name)
      setAcademyAdminId(adminId)

      setLoadingClasses(true)
      try {
        const classesRes = await api.get(
          `/classes/by-academy?adminId=${encodeURIComponent(adminId)}`,
          { skipAuthRedirect: true }
        )
        setAvailableClasses(classesRes.data.data || [])
        setClassesLoadError(false)
      } catch (classesErr) {
        console.error('[RegisterPage] Failed to load classes for adminId:', adminId, classesErr)
        setAvailableClasses([])
        setClassesLoadError(true)
      } finally {
        setLoadingClasses(false)
      }
    } catch {
      setAcademyStatus('invalid')
      setAvailableClasses([])
      setClassesLoadError(false)
      setLoadingClasses(false)
    }
  }

  const handleClassToggle = (classId) => {
    setFormData((prev) => {
      const isSelected = prev.selectedClassIds.includes(classId)
      const updatedIds = isSelected
        ? prev.selectedClassIds.filter((id) => id !== classId)
        : [...prev.selectedClassIds, classId]
      return {
        ...prev,
        selectedClassIds: updatedIds,
      }
    })
  }

  const passwordCriteria = {
    minLength: formData.password.length >= 8,
    hasUpperCase: /[A-Z]/.test(formData.password),
    hasLowerCase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  }

  const allPasswordCriteriaMet =
    passwordCriteria.minLength &&
    passwordCriteria.hasUpperCase &&
    passwordCriteria.hasLowerCase &&
    passwordCriteria.hasNumber &&
    passwordCriteria.hasSpecialChar

  const isFormValid =
    formData.firstName &&
    formData.lastName &&
    formData.email &&
    formData.password &&
    formData.confirmPassword &&
    formData.password === formData.confirmPassword &&
    allPasswordCriteriaMet &&
    (
      (formData.role === 'admin' && formData.academyName.trim().length > 0) ||
      (formData.role === 'student' && academyStatus === 'valid')
    )

  const handleChange = (e) => {
    const { name, value } = e.target

    if (name === 'academyCode') {
      // Clear classes and selections together to prevent cross-academy enrollment
      setFormData((prev) => ({
        ...prev,
        academyCode: value.toUpperCase(),
        selectedClassIds: [],
      }))
      setAcademyStatus('idle')
      setAcademyName('')
      setAcademyAdminId(null)
      setAvailableClasses([])
      setClassesLoadError(false)
      setLoadingClasses(false)
      clearTimeout(validateTimerRef.current)
      const trimmed = value.trim()
      if (trimmed.length >= 3) {
        validateTimerRef.current = setTimeout(() => validateAcademyCode(trimmed), 500)
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }

    if (formError) setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError('')

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.confirmPassword) {
      setFormError('Please fill in all required fields')
      setIsSubmitting(false)
      return
    }

    if (formData.role === 'student' && !formData.academyCode) {
      setFormError('Academy code is required for students')
      setIsSubmitting(false)
      return
    }

    if (formData.role === 'admin' && !formData.academyName.trim()) {
      setFormError('Academy name is required for administrators')
      setIsSubmitting(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match')
      setIsSubmitting(false)
      return
    }

    if (formData.password.length < 8) {
      setFormError('Password must be at least 8 characters')
      setIsSubmitting(false)
      return
    }

    if (formData.dpi && !/^\d{13}$/.test(formData.dpi)) {
      setFormError('DPI must be exactly 13 digits (numbers only)')
      setIsSubmitting(false)
      return
    }

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || null,
        role: formData.role,
      }

      if (formData.role === 'student') {
        payload.academyCode = formData.academyCode
        payload.birthday = formData.birthday || null
        payload.dpi = formData.dpi || null
        payload.department = formData.department || null
        payload.municipality = formData.municipality || null
        payload.guardianName = formData.guardianName || null
        payload.guardianPhone = formData.guardianPhone || null
        payload.guardianEmail = formData.guardianEmail || null
        payload.guardianRelationship = formData.guardianRelationship || null

        if (formData.selectedClassIds && formData.selectedClassIds.length > 0) {
          payload.selectedClassIds = formData.selectedClassIds
        }
      } else {
        payload.academyName = formData.academyName.trim()
        payload.guardianName = null
        payload.guardianPhone = null
        payload.guardianEmail = null
        payload.guardianRelationship = null
      }

      await api.post('/auth/register', payload)

      navigate('/login?registered=true')
    } catch (error) {
      let errorMessage = 'We had a problem processing your registration. Please check your information and try again.'

      const errorStatus = error.response?.status
      const serverMessage = error.response?.data?.error?.message || error.response?.data?.message || ''

      if (errorStatus === 409) {
        errorMessage = 'This email is already registered. Please use a different email or try logging in.'
      } else if (errorStatus === 400) {
        if (serverMessage.toLowerCase().includes('academy code')) {
          errorMessage = 'The academy code you entered is not valid. Please verify the code.'
        } else if (serverMessage.toLowerCase().includes('password')) {
          errorMessage = 'The password does not meet security requirements. Make sure it includes uppercase letters, lowercase letters, numbers, and special characters.'
        } else {
          errorMessage = 'There is an error in your information. Please verify all fields and try again.'
        }
      } else if (errorStatus === 401 || errorStatus === 403) {
        errorMessage = 'You do not have permission to perform this action. Please verify your account.'
      } else if (errorStatus === 500 || errorStatus >= 500) {
        errorMessage = 'We had a problem on our server. Please try again in a few minutes.'
      } else if (error.message) {
        if (error.message.includes('Network') || error.message.includes('ERR_NETWORK')) {
          errorMessage = 'Could not connect to the server. Please check your internet connection.'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'The request took too long. Please try again.'
        }
      }

      setFormError(errorMessage)
      console.error('Registration error:', { status: errorStatus, message: serverMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden">
           {/* Header */}
           <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 px-6 py-8">
             <h1 className="text-3xl font-bold text-white text-center">
               TheAcademy Management
             </h1>
             <p className="text-primary-100 text-center mt-2">
               Management System
             </p>
           </div>

          {/* Form Container */}
          <div className="px-6 py-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Create Account
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Unified registration form
            </p>

            {/* Error Alert */}
            {formError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                  ⚠️ {formError}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* First Name Field */}
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Your first name"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Last Name Field */}
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Your last name"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Role Field */}
              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  User Type
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                  disabled={isSubmitting}
                >
                  <option value="student">Student</option>
                  <option value="admin">Administrator / Teacher</option>
                </select>
              </div>

              {/* Academy Name Field (only for admins) */}
              {formData.role === 'admin' && (
                <div>
                  <label
                    htmlFor="academyName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Academy Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="academyName"
                    type="text"
                    name="academyName"
                    value={formData.academyName}
                    onChange={handleChange}
                    placeholder="e.g. Harmony Music Academy"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting}
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This will be the public name of your academy and will generate your unique academy code.
                  </p>
                </div>
              )}

               {/* Academy Code Field (only for students) */}
               {formData.role === 'student' && (
                 <div>
                   <label
                     htmlFor="academyCode"
                     className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                   >
                     Academy Code <span className="text-red-500">*</span>
                   </label>
                   <input
                     id="academyCode"
                     type="text"
                     name="academyCode"
                     value={formData.academyCode}
                     onChange={handleChange}
                     placeholder="e.g. ACAD2024"
                     className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 transition-all uppercase ${
                       academyStatus === 'valid'
                         ? 'border-green-500 dark:border-green-500 focus:ring-green-400'
                         : academyStatus === 'invalid'
                           ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                           : academyStatus === 'validating'
                             ? 'border-blue-400 dark:border-blue-500 focus:ring-blue-400'
                             : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500 dark:focus:ring-primary-400'
                     }`}
                     disabled={isSubmitting}
                   />
                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                     Unique code provided by your academy
                   </p>

                   {/* Real-time validation status indicator */}
                   {academyStatus === 'validating' && (
                     <div className="flex items-center gap-2 mt-2">
                       <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                       </svg>
                       <span className="text-sm text-blue-600 dark:text-blue-400">Verificando...</span>
                     </div>
                   )}

                   {academyStatus === 'valid' && (
                     <div className="flex items-center gap-2 mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                       <svg className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                         <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                       </svg>
                       <span className="text-sm font-medium text-green-700 dark:text-green-300">
                         Academia: {academyName}
                       </span>
                     </div>
                   )}

                   {academyStatus === 'invalid' && (
                     <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                       <svg className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                         <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                       </svg>
                       <span className="text-sm font-medium text-red-600 dark:text-red-400">
                         Código no encontrado
                       </span>
                     </div>
                   )}
                 </div>
               )}

               {/* Phone Field (always visible for students) */}
              {formData.role === 'student' && (
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Phone (Optional)
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1234567890"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* Guardian Section - Only visible for students */}
              {formData.role === 'student' && (
                <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2">
                    <span>👥</span> Guardian Information (Optional)
                  </h3>

                  {/* Guardian Name Field */}
                  <div className="mb-3">
                    <label
                      htmlFor="guardianName"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Guardian Name
                    </label>
                    <input
                      id="guardianName"
                      type="text"
                      name="guardianName"
                      value={formData.guardianName}
                      onChange={handleChange}
                      placeholder="Guardian's full name"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Guardian Phone Field */}
                  <div className="mb-3">
                    <label
                      htmlFor="guardianPhone"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Guardian Phone
                    </label>
                    <input
                      id="guardianPhone"
                      type="tel"
                      name="guardianPhone"
                      value={formData.guardianPhone}
                      onChange={handleChange}
                      placeholder="+1234567890"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Guardian Email Field */}
                  <div className="mb-3">
                    <label
                      htmlFor="guardianEmail"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Guardian Email
                    </label>
                    <input
                      id="guardianEmail"
                      type="email"
                      name="guardianEmail"
                      value={formData.guardianEmail}
                      onChange={handleChange}
                      placeholder="guardian@email.com"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Guardian Relationship Field */}
                  <div>
                    <label
                      htmlFor="guardianRelationship"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Relationship to Student
                    </label>
                    <select
                      id="guardianRelationship"
                      name="guardianRelationship"
                      value={formData.guardianRelationship}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                      disabled={isSubmitting}
                    >
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
              )}

              {/* Birthday Field (only for students) */}
              {formData.role === 'student' && (
                <div>
                  <label
                    htmlFor="birthday"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Date of Birth (Optional)
                  </label>
                  <input
                    id="birthday"
                    type="date"
                    name="birthday"
                    value={formData.birthday}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* DPI Field (only for students) */}
              {formData.role === 'student' && (
                <div>
                  <label
                    htmlFor="dpi"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    DPI (Optional)
                  </label>
                  <input
                    id="dpi"
                    type="text"
                    name="dpi"
                    value={formData.dpi}
                    onChange={handleChange}
                    placeholder="e.g. 1234567890123"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Guatemala DPI — must be exactly 13 digits
                  </p>
                </div>
              )}

              {/* Department Field - Cascading Select (only for students) */}
              {formData.role === 'student' && (
                <div>
                  <label
                    htmlFor="department"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Department (Optional)
                  </label>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting || loadingDepartments}
                  >
                    <option value="">
                      {loadingDepartments ? 'Loading departments...' : 'Select a department'}
                    </option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Municipality Field - Cascading Select (only for students, after department selected) */}
              {formData.role === 'student' && formData.department && (
                <div>
                  <label
                    htmlFor="municipality"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Municipality (Optional)
                  </label>
                  <select
                    id="municipality"
                    name="municipality"
                    value={formData.municipality}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting || loadingMunicipalities || municipalities.length === 0}
                  >
                    <option value="">
                      {loadingMunicipalities ? 'Loading municipalities...' : 'Select a municipality'}
                    </option>
                    {municipalities.map((muni) => (
                      <option key={muni} value={muni}>
                        {muni}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Classes Selection Field (only for students after validation) */}
              {formData.role === 'student' && academyStatus === 'valid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Classes (Optional)
                  </label>

                  {loadingClasses ? (
                    <div className="flex items-center gap-2 py-4 px-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <svg className="animate-spin h-4 w-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Loading classes...</span>
                    </div>
                  ) : classesLoadError ? (
                    <div className="text-sm text-yellow-700 dark:text-yellow-400 py-3 px-3 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      Could not load classes. You can still register and enroll later.
                    </div>
                  ) : availableClasses.length > 0 ? (
                    <div className="space-y-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 max-h-48 overflow-y-auto">
                      {availableClasses.map((cls) => (
                        <label
                          key={cls.id}
                          className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selectedClassIds.includes(cls.id)}
                            onChange={() => handleClassToggle(cls.id)}
                            disabled={isSubmitting}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {cls.title}
                            </p>
                            {cls.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {cls.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-3 px-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      No classes available at this time
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Select the classes you want to enroll in
                  </p>
                </div>
              )}

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum 8 characters, with uppercase, lowercase, numbers, and special characters
                </p>

                {/* Password Criteria Validation Block */}
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Security requirements:
                  </p>

                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      passwordCriteria.minLength
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {passwordCriteria.minLength ? '✓' : '✕'}
                    </div>
                    <span className={`text-xs transition-colors ${
                      passwordCriteria.minLength
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      Minimum 8 characters
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      passwordCriteria.hasUpperCase
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {passwordCriteria.hasUpperCase ? '✓' : '✕'}
                    </div>
                    <span className={`text-xs transition-colors ${
                      passwordCriteria.hasUpperCase
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      At least one uppercase letter (A-Z)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      passwordCriteria.hasLowerCase
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {passwordCriteria.hasLowerCase ? '✓' : '✕'}
                    </div>
                    <span className={`text-xs transition-colors ${
                      passwordCriteria.hasLowerCase
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      At least one lowercase letter (a-z)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      passwordCriteria.hasNumber
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {passwordCriteria.hasNumber ? '✓' : '✕'}
                    </div>
                    <span className={`text-xs transition-colors ${
                      passwordCriteria.hasNumber
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      At least one number (0-9)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      passwordCriteria.hasSpecialChar
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {passwordCriteria.hasSpecialChar ? '✓' : '✕'}
                    </div>
                    <span className={`text-xs transition-colors ${
                      passwordCriteria.hasSpecialChar
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      At least one special character (!, @, #, $, %, etc.)
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    disabled={isSubmitting}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Register Button */}
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              >
                {isSubmitting ? (
                  <>
                    <span className="loader"></span>
                    Registering...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Already have an account?
                </span>
              </div>
            </div>

            {/* Login Link */}
            <a
              href="/login"
              className="block w-full py-3 border-2 border-primary-600 text-primary-600 dark:text-primary-400 font-semibold rounded-lg hover:bg-primary-50 dark:hover:bg-gray-700 transition-all duration-200 text-center"
            >
              Sign In
            </a>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              © 2026 TheAcademy Management. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
