import PaymentMethod from '../models/PaymentMethod.js';
import AcademySettings from '../models/AcademySettings.js';
import { queryOne } from '../config/database.js';

/**
 * GET /api/settings/payment-methods
 * Admins: returns their own methods.
 * Students: auto-resolves their associated admin's methods.
 */
export const getPaymentMethods = async (req, res, next) => {
  try {
    let adminId = req.query.adminId ? parseInt(req.query.adminId) : null;

    if (!adminId) {
      if (req.user.role === 'admin') {
        adminId = req.user.id;
      } else {
        // Student: resolve from association
        const assoc = await queryOne(
          'SELECT admin_id FROM student_admin_association WHERE student_id = $1 LIMIT 1',
          [req.user.id]
        );
        adminId = assoc?.admin_id || null;
      }
    }

    if (!adminId) {
      return res.status(400).json({
        error: { message: 'No associated academy found', statusCode: 400, timestamp: new Date().toISOString() }
      });
    }

    const [methods, settings] = await Promise.all([
      PaymentMethod.getByAdmin(adminId, true),
      AcademySettings.findByAdminId(adminId),
    ]);

    res.status(200).json({
      data: methods.map(method => ({
        id: method.id,
        adminId: method.admin_id,
        methodName: method.method_name,
        accountNumber: method.account_number,
        accountHolder: method.account_holder,
        bankName: method.bank_name,
        additionalInfo: method.additional_info,
        isActive: method.is_active,
        createdAt: method.created_at,
        updatedAt: method.updated_at
      })),
      academyInfo: {
        name: settings?.name || null,
        contactPhone: settings?.contact_phone || null,
        contactEmail: settings?.contact_email || null,
        bankAccountInfo: settings?.bank_account_info || null,
      },
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch payment methods', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

/**
 * POST /api/settings/payment-methods
 * Create a new payment method (admin only)
 */
export const createPaymentMethod = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const validated = req.validated;

    const method = await PaymentMethod.create({
      adminId,
      methodName: validated.methodName,
      accountNumber: validated.accountNumber || null,
      accountHolder: validated.accountHolder || null,
      bankName: validated.bankName || null,
      additionalInfo: validated.additionalInfo || null,
      isActive: true
    });

    res.status(201).json({
      message: 'Payment method created successfully',
      data: {
        id: method.id,
        adminId: method.admin_id,
        methodName: method.method_name,
        accountNumber: method.account_number,
        accountHolder: method.account_holder,
        bankName: method.bank_name,
        additionalInfo: method.additional_info,
        isActive: method.is_active,
        createdAt: method.created_at,
        updatedAt: method.updated_at
      }
    });
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create payment method',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * PUT /api/settings/payment-methods/:id
 * Update a payment method (admin only)
 */
export const updatePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const validated = req.validated;

    // Verify ownership
    const method = await PaymentMethod.findById(parseInt(id));
    if (!method) {
      return res.status(404).json({
        error: {
          message: 'Payment method not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (method.admin_id !== adminId) {
      return res.status(403).json({
        error: {
          message: 'Forbidden: You do not own this payment method',
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

    const updatedMethod = await PaymentMethod.update(parseInt(id), validated);

    res.status(200).json({
      message: 'Payment method updated successfully',
      data: {
        id: updatedMethod.id,
        adminId: updatedMethod.admin_id,
        methodName: updatedMethod.method_name,
        accountNumber: updatedMethod.account_number,
        accountHolder: updatedMethod.account_holder,
        bankName: updatedMethod.bank_name,
        additionalInfo: updatedMethod.additional_info,
        isActive: updatedMethod.is_active,
        createdAt: updatedMethod.created_at,
        updatedAt: updatedMethod.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update payment method',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * DELETE /api/settings/payment-methods/:id
 * Delete a payment method (admin only)
 */
export const deletePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Verify ownership
    const method = await PaymentMethod.findById(parseInt(id));
    if (!method) {
      return res.status(404).json({
        error: {
          message: 'Payment method not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (method.admin_id !== adminId) {
      return res.status(403).json({
        error: {
          message: 'Forbidden: You do not own this payment method',
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

    await PaymentMethod.delete(parseInt(id));

    res.status(200).json({
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete payment method',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

export default { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod };
