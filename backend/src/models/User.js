import { query, queryOne } from '../config/database.js';

/**
 * User Model
 * Handles all database operations related to users
 */

export class User {
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  static async create(userData) {
    const {
      email,
      passwordHash,
      firstName,
      lastName,
      role = 'student',
      status = 'active',
      phone = null,
      mustChangePassword = false,
      // NEW FIELDS
      department = null,
      municipality = null,
      dpi = null,
      gender = null,
      dominantHand = null,
      birthday = null,
      guardianName = null,
      guardianPhone = null,
      guardianEmail = null,
      guardianRelationship = null
    } = userData;
    
    const text = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, status, phone, must_change_password,
        department, municipality, dpi, gender, dominant_hand, birthday,
        guardian_name, guardian_phone, guardian_email, guardian_relationship
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id, email, first_name, last_name, role, status, phone, must_change_password, created_at, is_active,
        department, municipality, dpi, gender, dominant_hand, birthday,
        guardian_name, guardian_phone, guardian_email, guardian_relationship
    `;
    
    const result = await query(text, [
      email, passwordHash, firstName, lastName, role, status, phone, mustChangePassword,
      department, municipality, dpi, gender, dominantHand, birthday,
      guardianName, guardianPhone, guardianEmail, guardianRelationship
    ]);
    return result.rows[0];
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User object or null
   */
  static async findByEmail(email) {
    const text = `
      SELECT id, email, password_hash, first_name, last_name, role, status, is_active, created_at
      FROM users
      WHERE email = $1 AND is_active = true
    `;
    
    const result = await queryOne(text, [email]);
    return result || null;
  }

  /**
   * Find user by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User object or null
   */
   static async findById(userId) {
     const text = `
       SELECT 
         id, email, first_name, last_name, role, status, is_active, created_at, updated_at, must_change_password, phone,
         department, municipality, dpi, gender, dominant_hand, birthday,
         guardian_name, guardian_phone, guardian_email, guardian_relationship
       FROM users
       WHERE id = $1 AND is_active = true
     `;
     
     const result = await queryOne(text, [userId]);
     if (result && result.birthday) {
       // Calculate age from birthday
       const today = new Date();
       const birthDate = new Date(result.birthday);
       let age = today.getFullYear() - birthDate.getFullYear();
       const monthDiff = today.getMonth() - birthDate.getMonth();
       if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
         age--;
       }
       result.age = age;
     }
     return result || null;
   }

  /**
   * Check if email exists
   * @param {string} email - User email
   * @returns {Promise<boolean>} True if email exists
   */
  static async emailExists(email) {
    const text = `
      SELECT id FROM users WHERE email = $1
    `;
    
    const result = await queryOne(text, [email]);
    return !!result;
  }

  /**
   * Update user
   * @param {number} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
   static async update(userId, updates) {
     const allowedFields = ['first_name', 'last_name', 'phone', 'status', 'password_hash', 'must_change_password'];
     const fields = [];
     const values = [];
     let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return this.findById(userId);
    }

    values.push(userId);

    const text = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND is_active = true
      RETURNING id, email, first_name, last_name, role, status, is_active, created_at, updated_at, must_change_password, phone
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Delete user (soft delete)
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(userId) {
    const text = `
      UPDATE users
      SET is_active = false
      WHERE id = $1
      RETURNING id
    `;

    const result = await queryOne(text, [userId]);
    return !!result;
  }

  /**
   * Get all students with their payment configuration
   * @param {string} status - Filter by status: 'active' | 'inactive' | null (all)
   * @returns {Promise<Array>} Array of students with config
   */
    static async getStudentsWithConfig(status = null) {
      let text = `
        SELECT 
          u.id, u.email, u.first_name, u.last_name, u.phone, u.status, u.is_active, u.created_at, u.must_change_password,
          sc.payment_mode, sc.price_per_class, sc.monthly_fixed_amount
        FROM users u
        LEFT JOIN student_config sc ON u.id = sc.student_id
        WHERE u.role = 'student' AND u.is_active = true
      `;
    const params = [];

    if (status === 'active') {
      text += ` AND u.status = 'active'`;
    } else if (status === 'inactive') {
      text += ` AND u.status = 'inactive'`;
    }

    text += ` ORDER BY u.created_at DESC`;

    const result = await query(text, params);
    return result.rows || [];
  }

  /**
   * Get student with their configuration
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Student with config or null
   */
  static async getStudentWithConfig(studentId) {
    const text = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.status, u.is_active, u.created_at, u.updated_at, u.must_change_password,
        sc.id as config_id, sc.payment_mode, sc.price_per_class, sc.monthly_fixed_amount, 
        sc.created_at as config_created_at, sc.updated_at as config_updated_at
      FROM users u
      LEFT JOIN student_config sc ON u.id = sc.student_id
      WHERE u.id = $1 AND u.is_active = true AND u.role = 'student'
    `;

    const result = await queryOne(text, [studentId]);
    return result || null;
  }
}

export default User;
