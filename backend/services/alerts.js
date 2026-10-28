// แจ้งเตือนสถานะข้อมูล HDC: ซิงค์ล้มเหลว / ยังไม่เคยซิงค์ / ไม่ได้อัปเดตเกิน X วัน
// คำนวณสดจาก hdc_sync_log ทุกครั้ง — เมื่อซิงค์สำเร็จ แจ้งเตือนจะหายไปเอง
const pool = require('../config/db');
const { getSettings } = require('./settings');

const DAY = 24 * 60 * 60 * 1000;

/**
 * @returns {Promise<{ year, stale_days, alerts: Array, summary }>}
 *   alert = { type: 'sync_failed'|'never_synced'|'stale', level: 'danger'|'warning',
 *             table_name, kpis: [..], last_success_at, last_success_by, failed_at, error, days }
 */
async function computeAlerts(year) {
    const settings = await getSettings();
    const y = /^\d{4}$/.test(String(year || '')) ? String(year) : settings.b_year;
    const staleDays = Math.max(0, parseInt(settings.alert_stale_days, 10) || 0);

    const r = await pool.query(
        `SELECT t.table_name, t.kpis, t.kpi_ids,
                ok.synced_at AS last_success_at, ok.synced_by AS last_success_by, ok.row_count,
                lst.status AS last_status, lst.synced_at AS last_at, lst.synced_by AS last_by, lst.error AS last_error
         FROM (
             SELECT s.table_name, ARRAY_AGG(DISTINCT k.name) AS kpis, ARRAY_AGG(DISTINCT k.id) AS kpi_ids
             FROM kpi_sources s JOIN kpis k ON k.id = s.kpi_id
             WHERE k.b_year = $1 AND k.active
             GROUP BY s.table_name
         ) t
         LEFT JOIN LATERAL (
             SELECT synced_at, synced_by, row_count FROM hdc_sync_log
             WHERE table_name = t.table_name AND b_year = $1 AND status = 'success'
             ORDER BY synced_at DESC LIMIT 1
         ) ok ON TRUE
         LEFT JOIN LATERAL (
             SELECT status, synced_at, synced_by, error FROM hdc_sync_log
             WHERE table_name = t.table_name AND b_year = $1
             ORDER BY synced_at DESC LIMIT 1
         ) lst ON TRUE
         ORDER BY t.table_name`,
        [y]
    );

    const now = Date.now();
    const alerts = [];
    for (const row of r.rows) {
        const base = {
            table_name: row.table_name,
            kpis: row.kpis || [],
            kpi_ids: row.kpi_ids || [],
            last_success_at: row.last_success_at,
            last_success_by: row.last_success_by,
        };
        const daysSince = row.last_success_at ? Math.floor((now - new Date(row.last_success_at).getTime()) / DAY) : null;
        if (row.last_status === 'error') {
            alerts.push({
                ...base, type: 'sync_failed', level: 'danger',
                failed_at: row.last_at, failed_by: row.last_by, error: row.last_error, days: daysSince,
            });
        } else if (!row.last_success_at) {
            alerts.push({ ...base, type: 'never_synced', level: 'warning', days: null });
        } else if (staleDays > 0 && daysSince >= staleDays) {
            alerts.push({ ...base, type: 'stale', level: 'warning', days: daysSince });
        }
    }
    // ล้มเหลวก่อน แล้วเรียงตามความเก่า
    alerts.sort((a, b) => (a.level === b.level ? (b.days || 9999) - (a.days || 9999) : a.level === 'danger' ? -1 : 1));

    return {
        year: y,
        stale_days: staleDays,
        tables_total: r.rows.length,
        summary: {
            sync_failed: alerts.filter(a => a.type === 'sync_failed').length,
            never_synced: alerts.filter(a => a.type === 'never_synced').length,
            stale: alerts.filter(a => a.type === 'stale').length,
        },
        alerts,
    };
}

module.exports = { computeAlerts };
