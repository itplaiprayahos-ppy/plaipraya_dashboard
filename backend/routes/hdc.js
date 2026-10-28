const express = require('express');
const router = express.Router();
const { audit } = require('../services/audit');
const pool = require('../config/db');
const { requireAdmin, displayName } = require('../middleware/auth');
const { asyncHandler } = require('../services/util');
const { syncTable, listFields } = require('../services/hdc');
const { getSettings } = require('../services/settings');

// ตาราง HDC ทั้งหมดที่ตัวชี้วัดใช้ + สถานะซิงค์
function yearParam(v, settings) {
    return /^\d{4}$/.test(String(v || '')) ? String(v) : settings.b_year;
}

// ตาราง HDC ที่ตัวชี้วัดของปีงบนั้นใช้ + สถานะซิงค์ของปีนั้น
router.get('/hdc/tables', requireAdmin, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const year = yearParam(req.query.year, settings);
    const r = await pool.query(
        `SELECT t.table_name,
                (SELECT COUNT(*)::int FROM hdc_raw r WHERE r.table_name = t.table_name AND r.b_year = $1) AS row_count,
                l.synced_at, l.synced_by, l.status, l.error,
                (SELECT ARRAY_AGG(DISTINCT k.name) FROM kpi_sources s JOIN kpis k ON k.id = s.kpi_id
                  WHERE s.table_name = t.table_name AND k.b_year = $1) AS kpis
         FROM (SELECT DISTINCT s.table_name FROM kpi_sources s JOIN kpis k ON k.id = s.kpi_id WHERE k.b_year = $1) t
         LEFT JOIN LATERAL (
            SELECT synced_at, synced_by, status, error FROM hdc_sync_log
            WHERE table_name = t.table_name AND b_year = $1 ORDER BY synced_at DESC LIMIT 1
         ) l ON TRUE
         ORDER BY t.table_name`,
        [year]
    );
    res.json({ year, tables: r.rows });
}));

router.post('/hdc/sync/:table', requireAdmin, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const year = yearParam(req.body && req.body.year, settings);
    const result = await syncTable(req.params.table, { year, user: displayName(req.user) });
    audit(req, 'hdc.sync', `ซิงค์ ${req.params.table} ปี ${year}: ${result.count} แถว`, { detail: result });
    res.json({ message: 'Import success', ...result });
}));

// ซิงค์ทุกตารางของปีงบนั้น
router.post('/hdc/sync-all', requireAdmin, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const year = yearParam(req.body && req.body.year, settings);
    const r = await pool.query(
        'SELECT DISTINCT s.table_name FROM kpi_sources s JOIN kpis k ON k.id = s.kpi_id WHERE k.b_year = $1 ORDER BY 1',
        [year]
    );
    const results = [];
    for (const { table_name } of r.rows) {
        try {
            results.push({ ...(await syncTable(table_name, { year, user: displayName(req.user) })), ok: true });
        } catch (err) {
            results.push({ table_name, ok: false, error: err.message });
        }
    }
    const failed = results.filter(r => !r.ok).length;
    audit(req, 'hdc.sync_all', `ซิงค์ทั้งหมด ปี ${year}: สำเร็จ ${results.length - failed}/${results.length}`, { level: failed ? 'warn' : 'info', detail: { year, results } });
    res.json({ year, results });
}));

router.get('/hdc/fields/:table', requireAdmin, asyncHandler(async (req, res) => {
    res.json(await listFields(req.params.table, { live: req.query.live === '1' }));
}));

module.exports = router;
