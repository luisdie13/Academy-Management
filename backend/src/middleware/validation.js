import { z } from 'zod';

/**
 * Validation Schemas using Zod
 * Sanitizes and validates all inputs before processing
 */

// ============================================
// AUTHENTICATION SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: z
    .string('Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),
  firstName: z
    .string('First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must not exceed 100 characters')
    .trim(),
  lastName: z
    .string('Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must not exceed 100 characters')
    .trim(),
  phone: z
    .string('Phone is optional')
    .max(20, 'Phone must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  role: z
    .enum(['student', 'teacher', 'admin'], 'Role must be student, teacher, or admin')
    .optional()
    .default('student'),
  academyCode: z.preprocess(
    // Normalize before validation: trim whitespace and uppercase.
    // This runs before any Zod validator, fixing two bugs:
    //   1. trim() was previously after regex(), so leading/trailing spaces caused false failures.
    //   2. Frontend may send lowercase if user typed it; backend normalizes defensively.
    (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
    z
      .string('Academy code is required for student registration')
      .regex(
        /^[A-Z0-9_-]+$/,
        'Academy code must be alphanumeric (with hyphens and underscores) and uppercase'
      )
      .min(4, 'Academy code must be at least 4 characters')
      .max(100, 'Academy code must not exceed 100 characters')
      .optional()
      .nullable()
  ),
  selectedClassIds: z
    .array(z.number().int().positive(), 'Each class ID must be a positive integer')
    .optional()
    .nullable(),
  // Guardian fields - Only required for students, optional/nullable for other roles
  guardianName: z
    .string('Guardian name must be a valid string')
    .min(2, 'Guardian name must be at least 2 characters')
    .max(100, 'Guardian name must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  guardianPhone: z
    .string('Guardian phone must be a valid string')
    .max(20, 'Guardian phone must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  guardianEmail: z
    .string('Guardian email must be valid')
    .email('Guardian email must be a valid email format')
    .toLowerCase()
    .trim()
    .optional()
    .nullable(),
  guardianRelationship: z
    .string('Guardian relationship must be a valid string')
    .max(50, 'Guardian relationship must not exceed 50 characters')
    .trim()
    .optional()
    .nullable(),
  // Additional student fields
  birthday: z
    .string('Birthday must be in YYYY-MM-DD format')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  dpi: z
    .string('DPI must be a valid string')
    .regex(/^\d{13}$/, 'DPI must be exactly 13 digits')
    .optional()
    .nullable(),
  department: z
    .string('Department must be a valid string')
    .max(100, 'Department must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  municipality: z
    .string('Municipality must be a valid string')
    .max(100, 'Municipality must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
}).superRefine((data, ctx) => {
  // If role is 'student', academy_code is required
  if (data.role === 'student' && !data.academyCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['academyCode'],
      message: 'Academy code is required for student registration'
    });
  }
});

export const loginSchema = z.object({
  email: z
    .string('Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string('Password is required')
    .min(1, 'Password is required'),
}).strict();

// ============================================
// ACADEMY SETTINGS SCHEMAS
// ============================================

export const academySettingsSchema = z.object({
  academyName: z
    .string('Academy name is required')
    .min(2, 'Academy name must be at least 2 characters')
    .max(255, 'Academy name must not exceed 255 characters')
    .trim(),
  primaryColor: z
    .string('Primary color is required')
    .regex(/^#([A-Fa-f0-9]{6})$/, 'Primary color must be a valid HEX color (e.g., #3B82F6)'),
  secondaryColor: z
    .string('Secondary color must be a valid HEX color')
    .regex(/^#([A-Fa-f0-9]{6})$/, 'Secondary color must be a valid HEX color (e.g., #10B981)')
    .optional()
    .nullable(),
  logoUrl: z
    .string('Logo URL must be a valid string')
    .url('Logo URL must be a valid URL')
    .optional()
    .nullable(),
  bankAccountInfo: z
    .string('Bank account info must be a valid string')
    .max(1000, 'Bank account info must not exceed 1000 characters')
    .optional()
    .nullable(),
});

// ============================================
// STUDENT SCHEMAS
// ============================================

export const createStudentSchema = z.object({
    email: z
      .string('Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    firstName: z
      .string('First name is required')
      .min(2, 'First name must be at least 2 characters')
      .max(100, 'First name must not exceed 100 characters')
      .trim(),
    lastName: z
      .string('Last name is required')
      .min(2, 'Last name must be at least 2 characters')
      .max(100, 'Last name must not exceed 100 characters')
      .trim(),
    phone: z
      .string('Phone is optional')
      .max(20, 'Phone must not exceed 20 characters')
      .trim()
      .optional()
      .nullable(),
    password: z
      .string('Password must be a valid string')
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .optional()
      .nullable(),
    status: z
      .enum(['active', 'inactive'], 'Status must be either active or inactive')
      .optional()
      .default('active'),
    paymentMode: z
      .enum(['prepaid', 'postpaid'], {
        errorMap: () => ({ message: "Payment mode must be 'prepaid' or 'postpaid'" })
      })
      .optional()
      .default('postpaid'),
    classPrice: z
      .number('Class price must be a number')
      .min(0, 'Class price cannot be negative')
      .optional()
      .default(0),
    monthlyFixedAmount: z
      .number('Monthly fixed amount must be a number')
      .min(0, 'Monthly fixed amount cannot be negative')
      .optional()
      .nullable(),
    selectedClassIds: z
      .array(z.number().int().positive(), 'Each class ID must be a positive integer')
      .optional()
      .nullable(),
    birthday: z
      .string('Birthday must be in YYYY-MM-DD format')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday must be in YYYY-MM-DD format')
      .optional()
      .nullable(),
    dpi: z
      .string('DPI must be a valid string')
      .regex(/^\d{13}$/, 'DPI must be exactly 13 digits')
      .optional()
      .nullable(),
    department: z
      .string('Department must be a valid string')
      .max(100, 'Department must not exceed 100 characters')
      .trim()
      .optional()
      .nullable(),
    municipality: z
      .string('Municipality must be a valid string')
      .max(100, 'Municipality must not exceed 100 characters')
      .trim()
      .optional()
      .nullable(),
    guardianName: z
      .string('Guardian name must be a valid string')
      .min(2, 'Guardian name must be at least 2 characters')
      .max(100, 'Guardian name must not exceed 100 characters')
      .trim()
      .optional()
      .nullable(),
    guardianPhone: z
      .string('Guardian phone must be a valid string')
      .max(20, 'Guardian phone must not exceed 20 characters')
      .trim()
      .optional()
      .nullable(),
    guardianEmail: z
      .string('Guardian email must be valid')
      .email('Guardian email must be a valid email format')
      .toLowerCase()
      .trim()
      .optional()
      .nullable(),
    guardianRelationship: z
      .string('Guardian relationship must be a valid string')
      .max(50, 'Guardian relationship must not exceed 50 characters')
      .trim()
      .optional()
      .nullable(),
});

export const updateStudentSchema = z.object({
  firstName: z
    .string('First name must be a valid string')
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must not exceed 100 characters')
    .trim()
    .optional(),
  lastName: z
    .string('Last name must be a valid string')
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must not exceed 100 characters')
    .trim()
    .optional(),
  phone: z
    .string('Phone must be a valid string')
    .max(20, 'Phone must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  password: z
    .string('Password must be a valid string')
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .optional()
    .nullable(),
  mustChangePassword: z
    .boolean('mustChangePassword must be a boolean')
    .optional(),
  status: z
    .enum(['active', 'inactive'], 'Status must be either active or inactive')
    .optional(),
  paymentMode: z
    .enum(['prepaid', 'postpaid'], {
      errorMap: () => ({ message: "Payment mode must be 'prepaid' or 'postpaid'" })
    })
    .optional(),
  classPrice: z
    .number('Class price must be a number')
    .min(0, 'Class price cannot be negative')
    .optional(),
  monthlyFixedAmount: z
    .number('Monthly fixed amount must be a number')
    .min(0, 'Monthly fixed amount cannot be negative')
    .optional()
    .nullable(),
  selectedClassIds: z
    .array(z.number().int().positive(), 'Each class ID must be a positive integer')
    .optional()
    .nullable(),
  birthday: z
    .string('Birthday must be in YYYY-MM-DD format')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  dpi: z
    .string('DPI must be a valid string')
    .regex(/^\d{13}$/, 'DPI must be exactly 13 digits')
    .optional()
    .nullable(),
  department: z
    .string('Department must be a valid string')
    .max(100, 'Department must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  municipality: z
    .string('Municipality must be a valid string')
    .max(100, 'Municipality must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  guardianName: z
    .string('Guardian name must be a valid string')
    .min(2, 'Guardian name must be at least 2 characters')
    .max(100, 'Guardian name must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  guardianPhone: z
    .string('Guardian phone must be a valid string')
    .max(20, 'Guardian phone must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  guardianEmail: z
    .string('Guardian email must be valid')
    .email('Guardian email must be a valid email format')
    .toLowerCase()
    .trim()
    .optional()
    .nullable(),
  guardianRelationship: z
    .string('Guardian relationship must be a valid string')
    .max(50, 'Guardian relationship must not exceed 50 characters')
    .trim()
    .optional()
    .nullable(),
});

// ============================================
// CLASS SCHEMAS
// ============================================

export const createClassSchema = z.object({
  title: z
    .string('Class title is required')
    .min(3, 'Class title must be at least 3 characters')
    .max(255, 'Class title must not exceed 255 characters')
    .trim(),
  description: z
    .string('Description must be a valid string')
    .max(1000, 'Description must not exceed 1000 characters')
    .optional()
    .nullable(),
  instructor: z
    .string('Instructor is required')
    .min(2, 'Instructor must be at least 2 characters')
    .max(255, 'Instructor must not exceed 255 characters')
    .trim(),
});

export const getClassesSchema = z.object({
  start: z
    .string('Start date must be in ISO format (YYYY-MM-DD)')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in ISO format (YYYY-MM-DD)')
    .optional()
    .nullable(),
  end: z
    .string('End date must be in ISO format (YYYY-MM-DD)')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in ISO format (YYYY-MM-DD)')
    .optional()
    .nullable(),
});

// ============================================
// CLASS INSCRIPTION SCHEMAS (user_classes)
// ============================================

export const createClassInscriptionSchema = z.object({
  classId: z
    .number('Class ID is required')
    .int('Class ID must be an integer')
    .positive('Class ID must be positive'),
  studentId: z
    .number('Student ID is required')
    .int('Student ID must be an integer')
    .positive('Student ID must be positive'),
  studyPlan: z
    .enum(['weekly', 'monthly', 'quarterly'], 'Study plan must be weekly, monthly, or quarterly')
    .optional()
    .nullable(),
  paymentMode: z
    .enum(['prepaid', 'postpaid'], 'Payment mode must be prepaid or postpaid')
    .optional()
    .nullable(),
  pricePerClass: z
    .number('Price per class must be a number')
    .min(0, 'Price per class cannot be negative')
    .optional()
    .nullable(),
  monthlyAmount: z
    .number('Monthly amount must be a number')
    .min(0, 'Monthly amount cannot be negative')
    .optional()
    .nullable(),
  modality: z
    .enum(['in_person', 'virtual', 'residential'], 'Modality must be in_person, virtual, or residential')
    .optional()
    .nullable(),
  daysOfWeek: z
    .array(
      z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], 'Days must be valid'),
      'Days of week must be an array'
    )
    .optional()
    .nullable(),
  classTime: z
    .string('Class time must be in HH:MM format')
    .regex(/^\d{2}:\d{2}$/, 'Class time must be in HH:MM format')
    .optional()
    .nullable(),
});

// ============================================
// ATTENDANCE SCHEMAS
// ============================================

export const createAttendanceSchema = z.object({
  classId: z
    .number('Class ID is required')
    .int('Class ID must be an integer')
    .positive('Class ID must be positive'),
  studentId: z
    .number('Student ID is required')
    .int('Student ID must be an integer')
    .positive('Student ID must be positive'),
  status: z
    .enum(['present', 'absent', 'pending'], 'Status must be either present, absent, or pending'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
});

// ============================================
// PAYMENT METHOD SCHEMAS
// ============================================

export const createPaymentMethodSchema = z.object({
  methodName: z
    .string('Method name is required')
    .min(3, 'Method name must be at least 3 characters')
    .max(100, 'Method name must not exceed 100 characters')
    .trim(),
  accountNumber: z
    .string('Account number must be a valid string')
    .max(100, 'Account number must not exceed 100 characters')
    .optional()
    .nullable(),
  accountHolder: z
    .string('Account holder must be a valid string')
    .max(255, 'Account holder must not exceed 255 characters')
    .optional()
    .nullable(),
  bankName: z
    .string('Bank name must be a valid string')
    .max(100, 'Bank name must not exceed 100 characters')
    .optional()
    .nullable(),
  additionalInfo: z
    .string('Additional info must be a valid string')
    .max(500, 'Additional info must not exceed 500 characters')
    .optional()
    .nullable(),
});

export const updatePaymentMethodSchema = z.object({
  methodName: z
    .string('Method name must be a valid string')
    .min(3, 'Method name must be at least 3 characters')
    .max(100, 'Method name must not exceed 100 characters')
    .trim()
    .optional(),
  accountNumber: z
    .string('Account number must be a valid string')
    .max(100, 'Account number must not exceed 100 characters')
    .optional()
    .nullable(),
  accountHolder: z
    .string('Account holder must be a valid string')
    .max(255, 'Account holder must not exceed 255 characters')
    .optional()
    .nullable(),
  bankName: z
    .string('Bank name must be a valid string')
    .max(100, 'Bank name must not exceed 100 characters')
    .optional()
    .nullable(),
  additionalInfo: z
    .string('Additional info must be a valid string')
    .max(500, 'Additional info must not exceed 500 characters')
    .optional()
    .nullable(),
  isActive: z
    .boolean('isActive must be a boolean')
    .optional(),
});

// ============================================
// INVOICE SCHEMAS
// ============================================

export const payInvoiceSchema = z.object({
  paymentMethod: z
    .string('Payment method is required')
    .min(2, 'Payment method must be at least 2 characters')
    .max(50, 'Payment method must not exceed 50 characters')
    .trim(),
  referenceNumber: z
    .string('Reference number is required')
    .min(3, 'Reference number must be at least 3 characters')
    .max(100, 'Reference number must not exceed 100 characters')
    .trim(),
});


// ============================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================

/**
 * Validates request body against a Zod schema
 * @param {z.ZodSchema} schema - Zod validation schema
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            statusCode: 400,
            details: errors,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      next(error);
    }
  };
};

export default validate;
