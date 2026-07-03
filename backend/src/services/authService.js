import bcryptjs from 'bcryptjs';
import User from '../models/User.js';
import AcademySettings from '../models/AcademySettings.js';
import StudentConfig from '../models/StudentConfig.js';
import { generateToken } from '../middleware/auth.js';
import { transaction } from '../config/database.js';

const BCRYPT_ROUNDS = 12;

export const registerUser = async (userData) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      role = 'student',
      academyCode = null,
      academyName = null,
      selectedClassIds = null,
      guardianName = null,
      guardianPhone = null,
      guardianEmail = null,
      guardianRelationship = null,
      birthday = null,
      dpi = null,
      department = null,
      municipality = null,
      classModality = null,
    } = userData;

    const existingUser = await User.emailExists(email);
    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcryptjs.hash(password, BCRYPT_ROUNDS);

    let newUser;

    if (role === 'student') {
      // Students registered via the public form get a default config; admins
      // create students with full config through the admin endpoint instead.
      const result = await transaction(async (client) => {
        const userText = `
          INSERT INTO users (
            email, password_hash, first_name, last_name, role, status, phone,
            birthday, dpi, department, municipality,
            guardian_name, guardian_phone, guardian_email, guardian_relationship
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, email, first_name, last_name, role, status, is_active, created_at, updated_at
        `;
        const userResult = await client.query(userText, [
          email, passwordHash, firstName, lastName, role, 'active',
          phone || null, birthday || null, dpi || null,
          department || null, municipality || null,
          guardianName || null, guardianPhone || null,
          guardianEmail || null, guardianRelationship || null
        ]);
        const createdUser = userResult.rows[0];

        await client.query(
          `INSERT INTO student_config (student_id, payment_mode, price_per_class, monthly_fixed_amount, class_modality)
           VALUES ($1, $2, $3, $4, $5)`,
          [createdUser.id, 'postpaid', 0, null, classModality || null]
        );

        // Link the student to their academy's admin so class-level isolation works.
        // academyCode is the subdomain the student used to find this academy.
        if (academyCode) {
          const subdomain = academyCode.toLowerCase();
          const academyRow = await client.query(
            `SELECT admin_id FROM academy_settings
             WHERE subdomain = $1 AND is_active = true AND admin_id IS NOT NULL
             LIMIT 1`,
            [subdomain]
          );
          const adminId = academyRow.rows[0]?.admin_id;
          if (adminId) {
            await client.query(
              `INSERT INTO student_admin_association (admin_id, student_id)
               VALUES ($1, $2)
               ON CONFLICT (admin_id, student_id) DO NOTHING`,
              [adminId, createdUser.id]
            );
            console.log(`[REGISTER] Linked student ${createdUser.id} to admin ${adminId} via academy "${subdomain}"`);

            // Enroll in classes the student pre-selected during registration.
            // Security: only classes owned by this admin and currently active are allowed.
            if (Array.isArray(selectedClassIds) && selectedClassIds.length > 0) {
              const validClasses = await client.query(
                `SELECT id FROM classes
                 WHERE id = ANY($1) AND admin_id = $2 AND is_active = true`,
                [selectedClassIds, adminId]
              );
              if (validClasses.rows.length > 0) {
                const placeholders = validClasses.rows
                  .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}, 'active')`)
                  .join(', ');
                const params = validClasses.rows.flatMap(row => [row.id, createdUser.id, adminId]);
                await client.query(
                  `INSERT INTO class_inscriptions (class_id, student_id, admin_id, enrollment_status)
                   VALUES ${placeholders}
                   ON CONFLICT (class_id, student_id) DO NOTHING`,
                  params
                );
                console.log(`[REGISTER] Enrolled student ${createdUser.id} in ${validClasses.rows.length} class(es)`);
              }
            }
          } else {
            console.warn(`[REGISTER] No admin found for academy subdomain "${subdomain}" — student_admin_association NOT created`);
          }
        }

        return createdUser;
      });
      newUser = result;
    } else if (role === 'admin') {
      newUser = await User.create({ email, passwordHash, firstName, lastName, phone, role, status: 'active' });

      try {
        const resolvedAcademyName = academyName?.trim() || `${firstName}'s Academy`;
        const baseSubdomain = resolvedAcademyName
          .toLowerCase()
          .trim()
          .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e')
          .replace(/[íìîï]/g, 'i').replace(/[óòôö]/g, 'o')
          .replace(/[úùûü]/g, 'u').replace(/[ñ]/g, 'n')
          .replace(/'/g, '').replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '').slice(0, 50);

        let uniqueSubdomain = baseSubdomain;
        let counter = 1;
        while (await AcademySettings.subdomainExists(uniqueSubdomain)) {
          uniqueSubdomain = `${baseSubdomain}-${counter}`;
          counter++;
        }

        await AcademySettings.create({
          name: resolvedAcademyName,
          subdomain: uniqueSubdomain,
          primaryColor: '#3B82F6',
          secondaryColor: '#10B981',
          logoUrl: null,
          bankAccountInfo: null,
          isActive: true,
          adminId: newUser.id
        });

        console.log(`[ACADEMY_INIT] Academy initialized for admin ${newUser.id}: ${resolvedAcademyName}`);
      } catch (settingsError) {
        console.error(`[ACADEMY_INIT_ERROR] Failed to create academy settings for admin ${newUser.id}:`, settingsError);
      }
    } else {
      newUser = await User.create({ email, passwordHash, firstName, lastName, phone, role, status: 'active' });
    }

    if (!newUser?.id) {
      const error = new Error('Registration failed: could not create user record');
      error.statusCode = 500;
      throw error;
    }

    const token = generateToken(newUser);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role
      },
      token
    };
  } catch (error) {
    if (error.code === '23505') {
      const constraint = error.constraint || '';
      let message = 'An account with this information already exists';
      if (constraint.includes('dpi')) {
        message = 'DPI already registered by another account';
      } else if (constraint.includes('email')) {
        message = 'Email already registered';
      }
      const conflict = new Error(message);
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
};

/**
 * Login user
 * @param {Object} credentials - Login credentials
 * @returns {Promise<Object>} User data and token
 * @throws {Error} If credentials are invalid
 */
export const loginUser = async (credentials) => {
  try {
    const { email, password } = credentials;

    const user = await User.findByEmail(email);

    // Guard against null AND against malformed rows ({} is truthy but has no id)
    if (!user?.id) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    if (!user.is_active) {
      const error = new Error('User account is inactive');
      error.statusCode = 403;
      throw error;
    }

    const token = generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.must_change_password || false,
        birthday: user.birthday
          ? (user.birthday instanceof Date
              ? user.birthday.toISOString().split('T')[0]
              : String(user.birthday).split('T')[0])
          : null,
        dpi: user.dpi || null,
        department: user.department || null,
        municipality: user.municipality || null,
        guardianName: user.guardian_name || null,
        guardianPhone: user.guardian_phone || null,
        guardianEmail: user.guardian_email || null,
        guardianRelationship: user.guardian_relationship || null,
      },
      token
    };
  } catch (error) {
    throw error;
  }
};


/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User data
 */
export const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const profile = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      mustChangePassword: user.must_change_password || false,
      birthday: user.birthday
        ? (user.birthday instanceof Date
            ? user.birthday.toISOString().split('T')[0]
            : String(user.birthday).split('T')[0])
        : null,
      dpi: user.dpi || null,
      department: user.department || null,
      municipality: user.municipality || null,
      guardianName: user.guardian_name || null,
      guardianPhone: user.guardian_phone || null,
      guardianEmail: user.guardian_email || null,
      guardianRelationship: user.guardian_relationship || null,
    };

    // Include payment config for students so the dashboard can display billing info
    if (user.role === 'student') {
      const config = await StudentConfig.findByStudentId(userId);
      if (config) {
        profile.paymentMode = config.payment_mode;
        profile.classPrice = parseFloat(config.price_per_class || 0);
        profile.monthlyFixedAmount = config.monthly_fixed_amount
          ? parseFloat(config.monthly_fixed_amount)
          : null;
        profile.creditBalance = parseFloat(config.credit_balance || 0);
        profile.classModality = config.class_modality || null;
      }
    }

    return profile;
  } catch (error) {
    throw error;
  }
};

export default {
  registerUser,
  loginUser,
  getUserById
};
