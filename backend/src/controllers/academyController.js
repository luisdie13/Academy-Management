import { queryOne } from '../config/database.js';
import AcademySettings from '../models/AcademySettings.js';

/**
 * GET /api/academies/validate?code=XYZ  (public — no auth)
 * Used by the registration form to verify an academy code in real-time.
 */
export async function validateAcademy(req, res) {
  try {
    const code = req.query.code?.toString().trim();
    if (!code) {
      return res.status(400).json({ error: { message: 'code query parameter is required', statusCode: 400 } });
    }
    const academy = await AcademySettings.findBySubdomain(code.toLowerCase());
    if (!academy || !academy.is_active || !academy.admin_id) {
      return res.status(404).json({ error: { message: 'Academy not found', statusCode: 404 } });
    }
    return res.status(200).json({ data: { name: academy.name, adminId: academy.admin_id } });
  } catch (error) {
    console.error('[validateAcademy] ERROR:', error);
    return res.status(500).json({ error: { message: 'Failed to validate academy code', statusCode: 500 } });
  }
}

export async function getAcademyProfile(req, res) {
  try {
    const adminId = req.user?.id;
    const settings = await AcademySettings.findByAdminId(adminId);

    if (!settings) {
      return res.status(200).json({
        success: true,
        data: {
          id: null,
          name: null,
          subdomain: null,
          logo_url: null,
          primary_color: '#3B82F6',
          secondary_color: '#10B981',
          bank_account_info: null,
          is_active: false
        }
      });
    }

    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('[ACADEMY_PROFILE_ERROR]:', error);
    return res.status(500).json({
      error: {
        message: 'Failed to retrieve academy profile',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export async function updateAcademyProfile(req, res) {
  try {
    const adminId = req.user?.id;
    const { name, primary_color, secondary_color, logo_url, bank_account_info, subdomain } = req.body;

    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    const updates = {};

    if (name !== undefined) updates.name = name;

    if (primary_color !== undefined) {
      if (!hexColorRegex.test(primary_color)) {
        return res.status(400).json({
          error: {
            message: 'Primary color must be a valid hex code (e.g. #3B82F6)',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }
      updates.primary_color = primary_color;
    }

    if (secondary_color !== undefined) {
      if (!hexColorRegex.test(secondary_color)) {
        return res.status(400).json({
          error: {
            message: 'Secondary color must be a valid hex code (e.g. #10B981)',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }
      updates.secondary_color = secondary_color;
    }

    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (bank_account_info !== undefined) updates.bank_account_info = bank_account_info;

    // Subdomain (academy code) update — validate format and uniqueness
    if (subdomain !== undefined) {
      const cleanSubdomain = subdomain
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 63);

      if (!cleanSubdomain) {
        return res.status(400).json({
          error: { message: 'Academy code cannot be empty', statusCode: 400 }
        });
      }

      const currentSettings = await AcademySettings.findByAdminId(adminId);
      const isUnique = await AcademySettings.isSubdomainUnique(
        cleanSubdomain,
        currentSettings?.id ?? null
      );

      if (!isUnique) {
        return res.status(409).json({
          error: {
            message: `Academy code "${cleanSubdomain}" is already in use. Please choose a different code.`,
            statusCode: 409
          }
        });
      }

      updates.subdomain = cleanSubdomain;
    }

    let settings = await AcademySettings.findByAdminId(adminId);

    if (!settings) {
      if (!name) {
        return res.status(400).json({
          error: {
            message: 'Academy name is required to create initial settings',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      const baseSubdomain = (updates.subdomain || name)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 63) || 'academy';

      settings = await AcademySettings.create({
        name,
        subdomain: baseSubdomain,
        primaryColor: primary_color || '#3B82F6',
        secondaryColor: secondary_color || '#10B981',
        logoUrl: logo_url || null,
        bankAccountInfo: bank_account_info || null,
        isActive: true,
        adminId: adminId || null
      });
    } else {
      settings = await AcademySettings.update(settings.id, updates);
    }

    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('[UPDATE_ACADEMY_PROFILE_ERROR]:', error);
    return res.status(500).json({
      error: {
        message: 'Failed to update academy profile',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * GET /api/academies/settings  (any authenticated role)
 * Returns only the branding colors for the academy the caller belongs to.
 * Admin  → direct lookup by their own admin_id.
 * Student → resolves their admin via student_admin_association, then fetches colors.
 */
export async function getAcademyTheme(req, res) {
  const FALLBACK = { primary_color: '#3B82F6', secondary_color: '#10B981' };
  try {
    let colors = null;

    if (req.user.role === 'admin') {
      const settings = await AcademySettings.findByAdminId(req.user.id);
      if (settings) {
        colors = { primary_color: settings.primary_color, secondary_color: settings.secondary_color };
      }
    } else {
      // Student: resolve the admin they belong to, then get that academy's colors
      colors = await queryOne(
        `SELECT a.primary_color, a.secondary_color
         FROM academy_settings a
         INNER JOIN student_admin_association saa ON saa.admin_id = a.admin_id
         WHERE saa.student_id = $1 AND a.is_active = true
         LIMIT 1`,
        [req.user.id]
      );
    }

    return res.status(200).json({ success: true, data: colors || FALLBACK });
  } catch (error) {
    console.error('[GET_ACADEMY_THEME_ERROR]:', error);
    return res.status(200).json({ success: true, data: FALLBACK });
  }
}

export default { getAcademyProfile, updateAcademyProfile, getAcademyTheme };
