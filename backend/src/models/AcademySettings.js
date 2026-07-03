import { query, queryOne } from '../config/database.js';

/**
 * AcademySettings Model
 * Handles all database operations related to academy settings and configuration
 * 
 * ⚠️ CRITICAL: ACTUAL DATABASE SCHEMA (verified in DataGrip)
 * Database Schema (actual columns from PostgreSQL):
 * - id: Primary key
 * - name: Academy name (NOT academy_name)
 * - subdomain: Unique subdomain (NOT academy_code)
 * - primary_color: Hex color code for primary branding
 * - secondary_color: Hex color code for secondary branding
 * - logo_url: URL to academy logo
 * - bank_account_info: Bank account information
 * - is_active: Boolean flag for active status
 * 
 * Additional columns present in DB:
 * - admin_id: FK to users(id) — links each academy row to its owner
 */

export class AcademySettings {
  /**
   * Find academy settings by ID
   * @param {number} id - Academy settings ID
   * @returns {Promise<Object>} Academy settings or null
   */
  static async findById(id) {
    const text = `
      SELECT 
        id, name, subdomain, primary_color, secondary_color,
        logo_url, bank_account_info, is_active, created_at, updated_at
      FROM academy_settings
      WHERE id = $1
    `;
    
    const result = await queryOne(text, [id]);
    return result || null;
  }

  /**
   * Find academy settings by subdomain
   * @param {string} subdomain - Academy subdomain
   * @returns {Promise<Object>} Academy settings or null
   */
  static async findBySubdomain(subdomain) {
    const text = `
      SELECT
        id, name, subdomain, primary_color, secondary_color,
        logo_url, bank_account_info, is_active, admin_id, created_at, updated_at
      FROM academy_settings
      WHERE subdomain = $1
    `;
    
    const result = await queryOne(text, [subdomain.toLowerCase()]);
    return result || null;
  }

  /**
   * Get all academy settings
   * @returns {Promise<Array>} Array of academy settings
   */
  static async getAll() {
    const text = `
      SELECT 
        id, name, subdomain, primary_color, secondary_color,
        logo_url, bank_account_info, is_active, created_at, updated_at
      FROM academy_settings
      ORDER BY created_at DESC
    `;
    
    const result = await query(text, []);
    return result.rows || [];
  }

  /**
   * Find academy settings by the owning admin's user ID.
   * This is the correct scoped read for multi-admin environments.
   * @param {number} adminId - ID from req.user.id
   * @returns {Promise<Object>} Academy settings or null
   */
  static async findByAdminId(adminId) {
    const text = `
      SELECT
        id, name, subdomain, primary_color, secondary_color,
        logo_url, bank_account_info, is_active, admin_id, created_at, updated_at
      FROM academy_settings
      WHERE admin_id = $1 AND is_active = true
      LIMIT 1
    `;
    const result = await queryOne(text, [adminId]);
    return result || null;
  }

  /**
   * Get the first (primary) academy settings
   * @deprecated Use findByAdminId(adminId) for multi-tenant contexts.
   * @returns {Promise<Object>} Academy settings or null
   */
  static async getPrimary() {
    const text = `
      SELECT 
        id, name, subdomain, primary_color, secondary_color,
        logo_url, bank_account_info, is_active, created_at, updated_at
      FROM academy_settings
      WHERE is_active = true
      ORDER BY id ASC
      LIMIT 1
    `;
    
    const result = await queryOne(text, []);
    return result || null;
  }

  /**
   * Create academy settings
   * @param {Object} settingsData - Settings data
   * @returns {Promise<Object>} Created settings
   */
  static async create(settingsData) {
    const {
      name,
      subdomain,
      primaryColor = '#3B82F6',
      secondaryColor = '#10B981',
      logoUrl = null,
      bankAccountInfo = null,
      isActive = true,
      adminId = null
    } = settingsData;

    // Validate required fields
    if (!name || !subdomain) {
      throw new Error('Academy name and subdomain are required');
    }

    const text = `
      INSERT INTO academy_settings
      (name, subdomain, primary_color, secondary_color,
       logo_url, bank_account_info, is_active, admin_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, subdomain, primary_color, secondary_color,
                logo_url, bank_account_info, is_active, admin_id, created_at, updated_at
    `;

    const result = await query(text, [
      name,
      subdomain.toLowerCase(),
      primaryColor,
      secondaryColor,
      logoUrl,
      bankAccountInfo,
      isActive,
      adminId
    ]);

    return result.rows[0];
  }

  /**
   * Update academy settings
   * @param {number} id - Academy settings ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated settings
   */
  static async update(id, updates) {
    const allowedFields = [
      'name',
      'subdomain',
      'primary_color',
      'secondary_color',
      'logo_url',
      'bank_account_info',
      'is_active'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        // Lowercase subdomains
        if (key === 'subdomain' && value) {
          values.push(value.toLowerCase());
        } else {
          values.push(value);
        }
        paramCount++;
      }
    }

    if (fields.length === 0) {
      // No updates to make, return current record
      return this.findById(id);
    }

    values.push(id);

    const text = `
      UPDATE academy_settings
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, subdomain, primary_color, secondary_color,
                logo_url, bank_account_info, is_active, created_at, updated_at
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Check if subdomain exists
   * @param {string} subdomain - Academy subdomain
   * @returns {Promise<boolean>} True if subdomain exists
   */
  static async subdomainExists(subdomain) {
    const text = `
      SELECT id FROM academy_settings WHERE subdomain = $1
    `;

    const result = await queryOne(text, [subdomain.toLowerCase()]);
    return !!result;
  }

  /**
   * Check if subdomain is unique (excluding specific ID)
   * @param {string} subdomain - Academy subdomain
   * @param {number} excludeId - ID to exclude from check
   * @returns {Promise<boolean>} True if subdomain is unique
   */
  static async isSubdomainUnique(subdomain, excludeId = null) {
    let text = `SELECT id FROM academy_settings WHERE subdomain = $1`;
    const values = [subdomain.toLowerCase()];

    if (excludeId !== null) {
      text += ` AND id != $2`;
      values.push(excludeId);
    }

    const result = await queryOne(text, values);
    return !result;
  }

  /**
   * Delete academy settings
   * @param {number} id - Academy settings ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(id) {
    const text = `
      DELETE FROM academy_settings WHERE id = $1
      RETURNING id
    `;

    const result = await query(text, [id]);
    return result.rows.length > 0;
  }
}

export default AcademySettings;
