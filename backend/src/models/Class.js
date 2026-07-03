import { query, queryOne, queryAll } from '../config/database.js';

/**
 * Class Model
 * Handles all database operations for classes/scheduling
 */

export class Class {
  /**
    * Create a new class (simplified - only title, description, instructor)
    * Modality, days_of_week, and class_time are now handled per-student in user_classes
    * @param {Object} classData - Class data
    * @returns {Promise<Object>} Created class
    */
  static async create(classData) {
    const {
      adminId,
      title,
      description = null,
      instructor = null
    } = classData;

    console.log('💾 PARÁMETROS RECIBIDOS EN MODELO (Class.create):', {
      adminId,
      title,
      description,
      instructor
    });

    const text = `
      INSERT INTO classes (admin_id, title, description, instructor)
      VALUES ($1, $2, $3, $4)
      RETURNING id, admin_id, title, description, instructor, is_active, created_at, updated_at
    `;

    const queryArray = [
      adminId,
      title,
      description,
      instructor
    ];

    console.log('💾 ARRAY DE PARÁMETROS PARA SQL:', queryArray);
    console.log('💾 ORDEN EN SQL: $1=admin_id, $2=title, $3=description, $4=instructor');

    const result = await query(text, queryArray);

    return result.rows[0];
  }

  /**
   * Find class by ID
   * @param {number} classId - Class ID
   * @returns {Promise<Object>} Class object or null
   */
   static async findById(classId) {
     const text = `
       SELECT id, admin_id, title, description, instructor, is_active, created_at, updated_at
       FROM classes
       WHERE id = $1
     `;

     const result = await queryOne(text, [classId]);
     return result || null;
   }

  /**
   * Get classes by admin within a date range
   * @param {number} adminId - Admin ID
   * @param {string} startDate - ISO format date (YYYY-MM-DD)
   * @param {string} endDate - ISO format date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of classes
   */
  static async getClassesByDateRange(adminId, startDate, endDate) {
    const text = `
      SELECT id, admin_id, title, description, instructor, created_at, updated_at
      FROM classes
      WHERE admin_id = $1 AND class_date BETWEEN $2 AND $3
      ORDER BY created_at DESC
    `;

    const result = await queryAll(text, [adminId, startDate, endDate]);
    return (result || []).map(cls => ({
      id: cls.id,
      adminId: cls.admin_id,
      title: cls.title,
      description: cls.description,
      instructor: cls.instructor,
      createdAt: cls.created_at
    }));
  }

  /**
   * Get all classes (for students to see their schedule)
   * @param {string} startDate - ISO format date
   * @param {string} endDate - ISO format date
   * @returns {Promise<Array>} Array of classes
   */
  static async getClassesByDate(startDate, endDate) {
    const text = `
      SELECT id, admin_id, title, description, instructor, created_at, updated_at
      FROM classes
      WHERE class_date BETWEEN $1 AND $2
      ORDER BY created_at DESC
    `;

    const result = await queryAll(text, [startDate, endDate]);
    return (result || []).map(cls => ({
      id: cls.id,
      adminId: cls.admin_id,
      title: cls.title,
      description: cls.description,
      instructor: cls.instructor,
      createdAt: cls.created_at
    }));
  }

   /**
     * Get classes for a specific student
     * Uses the student_admin_association table to establish formal student-admin relationships
     * Only returns classes from admins that have formally assigned the student
     * 🔒 SECURITY: Strict parametrized query prevents SQL injection and ensures proper filtering
     * @param {number} studentId - Student ID
     * @param {string} startDate - ISO format date
     * @param {string} endDate - ISO format date
     * @returns {Promise<Array>} Array of classes for student
     */
    static async getClassesByStudent(studentId, startDate, endDate) {
      const text = `
        SELECT DISTINCT c.id, c.admin_id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.instructor, c.created_at, c.updated_at
        FROM classes c
        INNER JOIN student_admin_association saa ON c.admin_id = saa.admin_id
        WHERE saa.student_id = $1 AND c.class_date BETWEEN $2 AND $3
        ORDER BY c.class_date ASC, c.start_time ASC
      `;

      const result = await queryAll(text, [studentId, startDate, endDate]);
      
      return result || [];
    }

   /**
    * Update class
    * @param {number} classId - Class ID
    * @param {Object} updates - Fields to update
    * @returns {Promise<Object>} Updated class
    * 
    * 🔒 UNIFIED DATE CRITERIA: Uses 'class_date' exclusively
    * ⚠️ DO NOT USE 'scheduled_date' - it's deprecated and only kept in DB for trigger compatibility
    */
   static async update(classId, updates) {
     // Map frontend field names to database column names
     // ✅ IMPORTANT: Only use 'class_date', never 'scheduled_date' in updates
     const fieldMapping = {
       'class_date': 'class_date',
       'title': 'title',
       'description': 'description',
       'instructor': 'instructor',
       'class_time': 'class_time',
       'duration_minutes': 'duration_minutes',
       'is_completed': 'is_completed',
       'is_active': 'is_active'
     };

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key] && value !== undefined) {
        const dbColumn = fieldMapping[key];
        fields.push(`${dbColumn} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return this.findById(classId);
    }

    values.push(classId);

    const text = `
      UPDATE classes
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, admin_id, title, description, class_date, start_time, end_time, instructor, is_active, created_at, updated_at
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Delete class (soft delete or hard delete based on needs)
   * @param {number} classId - Class ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(classId) {
    const text = `
      DELETE FROM classes
      WHERE id = $1
      RETURNING id
    `;

    const result = await queryOne(text, [classId]);
    return !!result;
  }

  /**
   * Mark class as completed
   * @param {number} classId - Class ID
   * @returns {Promise<Object>} Updated class
   */
   static async markCompleted(classId) {
     return this.update(classId, { is_completed: true });
   }

    /**
     * ⚠️ DEPRECATED: getClassesByAcademyCode no longer supported
     * academy_code field does NOT exist in real database schema
     * Use subdomain-based queries with academy_settings instead
     */
    static async getClassesByAcademyCode(academyCode) {
      console.warn('⚠️ getClassesByAcademyCode is deprecated - academy_code does not exist in DB');
      return null;
    }
 }
 
 export default Class;
