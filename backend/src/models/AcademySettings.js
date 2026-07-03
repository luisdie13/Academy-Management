import { query, queryOne } from '../config/database.js';

const CONTACT_COLS = `id, name, subdomain, primary_color, secondary_color,
        logo_url, bank_account_info, contact_phone, contact_email,
        is_active, currency, admin_id, created_at, updated_at`;

export class AcademySettings {
  static async findById(id) {
    const result = await queryOne(
      `SELECT ${CONTACT_COLS} FROM academy_settings WHERE id = $1`,
      [id]
    );
    return result || null;
  }

  static async findBySubdomain(subdomain) {
    const result = await queryOne(
      `SELECT ${CONTACT_COLS} FROM academy_settings WHERE subdomain = $1`,
      [subdomain.toLowerCase()]
    );
    return result || null;
  }

  static async getAll() {
    const result = await query(
      `SELECT ${CONTACT_COLS} FROM academy_settings ORDER BY created_at DESC`,
      []
    );
    return result.rows || [];
  }

  static async findByAdminId(adminId) {
    const result = await queryOne(
      `SELECT ${CONTACT_COLS} FROM academy_settings WHERE admin_id = $1 AND is_active = true LIMIT 1`,
      [adminId]
    );
    return result || null;
  }

  static async getPrimary() {
    const result = await queryOne(
      `SELECT ${CONTACT_COLS} FROM academy_settings WHERE is_active = true ORDER BY id ASC LIMIT 1`,
      []
    );
    return result || null;
  }

  static async create(settingsData) {
    const {
      name,
      subdomain,
      primaryColor = '#3B82F6',
      secondaryColor = '#10B981',
      logoUrl = null,
      bankAccountInfo = null,
      isActive = true,
      adminId = null,
      contactPhone = null,
      contactEmail = null,
    } = settingsData;

    if (!name || !subdomain) throw new Error('Academy name and subdomain are required');

    const result = await query(
      `INSERT INTO academy_settings
       (name, subdomain, primary_color, secondary_color, logo_url, bank_account_info,
        contact_phone, contact_email, is_active, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${CONTACT_COLS}`,
      [name, subdomain.toLowerCase(), primaryColor, secondaryColor, logoUrl,
       bankAccountInfo, contactPhone, contactEmail, isActive, adminId]
    );
    return result.rows[0];
  }

  static async update(id, updates) {
    const allowedFields = [
      'name', 'subdomain', 'primary_color', 'secondary_color',
      'logo_url', 'bank_account_info', 'contact_phone', 'contact_email',
      'is_active', 'currency',
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === 'subdomain' && value ? value.toLowerCase() : value);
        paramCount++;
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query(
      `UPDATE academy_settings SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING ${CONTACT_COLS}`,
      values
    );
    return result.rows[0] || null;
  }

  static async subdomainExists(subdomain) {
    const result = await queryOne(
      'SELECT id FROM academy_settings WHERE subdomain = $1',
      [subdomain.toLowerCase()]
    );
    return !!result;
  }

  static async isSubdomainUnique(subdomain, excludeId = null) {
    let text = 'SELECT id FROM academy_settings WHERE subdomain = $1';
    const values = [subdomain.toLowerCase()];
    if (excludeId !== null) { text += ' AND id != $2'; values.push(excludeId); }
    const result = await queryOne(text, values);
    return !result;
  }

  static async delete(id) {
    const result = await query('DELETE FROM academy_settings WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }
}

export default AcademySettings;
