import { queryAll } from '../config/database.js';

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * GET /api/stats/attendance-trend
 * Returns attendance % by day of week for the last 28 days.
 */
export const getAttendanceTrend = async (req, res) => {
  try {
    const adminId = req.user.id;

    const rows = await queryAll(`
      SELECT
        EXTRACT(DOW FROM class_date)::int AS dow,
        COUNT(*) FILTER (WHERE status = 'present') AS present_count,
        COUNT(*) FILTER (WHERE status IN ('present', 'absent')) AS total_count
      FROM attendance
      WHERE class_id IN (SELECT id FROM classes WHERE admin_id = $1)
        AND class_date >= CURRENT_DATE - INTERVAL '28 days'
      GROUP BY dow
      ORDER BY dow
    `, [adminId]);

    const byDow = {};
    rows.forEach(r => {
      byDow[parseInt(r.dow)] = {
        present: parseInt(r.present_count) || 0,
        total: parseInt(r.total_count) || 0,
      };
    });

    // Mon–Sat (DOW 1–6)
    const data = [1, 2, 3, 4, 5, 6].map(dow => {
      const d = byDow[dow] || { present: 0, total: 0 };
      return {
        name: DOW_LABELS[dow],
        attendance: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
      };
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('[ATTENDANCE_TREND_ERROR]:', error);
    return res.status(500).json({ error: { message: 'Failed to fetch attendance trend', statusCode: 500 } });
  }
};

/**
 * GET /api/stats/monthly-income
 * Returns paid income vs billed amount per month for the last 6 months.
 */
export const getMonthlyIncome = async (req, res) => {
  try {
    const adminId = req.user.id;

    const rows = await queryAll(`
      SELECT
        invoice_month,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(total_amount), 0) AS billed
      FROM invoices
      WHERE admin_id = $1
        AND invoice_month >= TO_CHAR(DATE_TRUNC('month', NOW()) - INTERVAL '5 months', 'YYYY-MM')
      GROUP BY invoice_month
      ORDER BY invoice_month
    `, [adminId]);

    // Build the last 6 months list (YYYY-MM)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const byMonth = {};
    rows.forEach(r => {
      byMonth[r.invoice_month] = {
        income: parseFloat(r.income) || 0,
        billed: parseFloat(r.billed) || 0,
      };
    });

    const data = months.map(m => {
      const monthIndex = parseInt(m.split('-')[1]) - 1;
      const d = byMonth[m] || { income: 0, billed: 0 };
      return {
        name: MONTH_LABELS_ES[monthIndex],
        income: d.income,
        billed: d.billed,
      };
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('[MONTHLY_INCOME_ERROR]:', error);
    return res.status(500).json({ error: { message: 'Failed to fetch monthly income', statusCode: 500 } });
  }
};
