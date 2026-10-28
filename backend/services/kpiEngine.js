// คำนวณเป้าหมาย/ผลงาน/ร้อยละ ของตัวชี้วัดจากการตั้งค่าในฐานข้อมูล (ไม่มี hard code ต่อตัวชี้วัด)
const pool = require('../config/db');
const { getSettings } = require('./settings');

const round2 = (n) => Math.round(n * 100) / 100;

function calcPercent(target, result, multiplier) {
    const t = Number(target) || 0;
    const r = Number(result) || 0;
    if (t === 0) return 0;
    return round2((r * Number(multiplier || 100)) / t);
}

function isPass(value, op, criterion) {
    if (criterion === null || criterion === undefined) return null;
    const v = Number(value), c = Number(criterion);
    switch (op) {
        case '>': return v > c;
        case '<=': return v <= c;
        case '<': return v < c;
        default: return v >= c;
    }
}

async function getUnits() {
    const r = await pool.query('SELECT hoscode, name, short_name FROM units WHERE active ORDER BY sort_order, hoscode');
    return r.rows;
}

/**
 * คำนวณผลของรายการตัวชี้วัด
 * @param {Array} kpis แถวจากตาราง kpis
 * @param {Object} opts { year, withUnits }
 * @returns Map<kpiId, { target, result, percent, has_data, pass, units? }>
 */
async function computeKpis(kpis, opts = {}) {
    const settings = opts.settings || await getSettings();
    const year = String(opts.year || settings.b_year);
    const ids = kpis.filter(k => !k.is_header).map(k => k.id);
    const out = new Map();
    if (ids.length === 0) return out;

    const [agg, manual, units] = await Promise.all([
        pool.query(
            `SELECT s.kpi_id, r.hospcode,
                    SUM(sum_keys(r.data, s.target_fields)) AS target,
                    SUM(sum_keys(r.data, s.result_fields)) AS result
             FROM kpi_sources s
             JOIN hdc_raw r ON r.table_name = s.table_name AND r.b_year = $2
             WHERE s.kpi_id = ANY($1::int[])
             GROUP BY s.kpi_id, r.hospcode`,
            [ids, year]
        ),
        pool.query(
            `SELECT kpi_id, hospcode, target, result FROM kpi_manual_values
             WHERE kpi_id = ANY($1::int[]) AND b_year = $2`,
            [ids, year]
        ),
        opts.units ? Promise.resolve({ rows: opts.units }) : pool.query('SELECT hoscode, name, short_name FROM units WHERE active ORDER BY sort_order, hoscode'),
    ]);

    // kpi_id -> hospcode -> {target, result}
    const values = new Map();
    const cell = (kpiId, hos) => {
        if (!values.has(kpiId)) values.set(kpiId, new Map());
        const m = values.get(kpiId);
        if (!m.has(hos)) m.set(hos, { target: 0, result: 0, manual: false });
        return m.get(hos);
    };
    for (const row of agg.rows) {
        const c = cell(row.kpi_id, row.hospcode);
        c.target += Number(row.target) || 0;
        c.result += Number(row.result) || 0;
    }
    const kpiById = new Map(kpis.map(k => [k.id, k]));
    for (const row of manual.rows) {
        const k = kpiById.get(row.kpi_id);
        if (!k || !k.allow_manual) continue;
        const c = cell(row.kpi_id, row.hospcode);
        if (row.target !== null) { c.target = Number(row.target); c.manual = true; }
        if (row.result !== null) { c.result = Number(row.result); c.manual = true; }
    }

    for (const k of kpis) {
        if (k.is_header) continue;
        const m = values.get(k.id) || new Map();
        const unitRows = units.rows.map(u => {
            const c = m.get(u.hoscode) || { target: 0, result: 0, manual: false };
            const percent = calcPercent(c.target, c.result, k.multiplier);
            return {
                hoscode: u.hoscode, name: u.name, short_name: u.short_name || u.name,
                target: round2(c.target), result: round2(c.result), percent,
                manual: c.manual,
                pass: c.target > 0 ? isPass(percent, k.criterion_op, k.criterion) : null,
            };
        });
        const total = unitRows.reduce((a, u) => ({ target: a.target + u.target, result: a.result + u.result }), { target: 0, result: 0 });
        total.target = round2(total.target); total.result = round2(total.result);
        total.percent = calcPercent(total.target, total.result, k.multiplier);

        let summary;
        if (k.summary_scope === 'all') {
            summary = { ...total, hoscode: null };
        } else {
            const hos = k.summary_hoscode || settings.default_hoscode;
            const c = m.get(hos) || { target: 0, result: 0 };
            summary = { target: round2(c.target), result: round2(c.result), percent: calcPercent(c.target, c.result, k.multiplier), hoscode: hos };
        }
        summary.has_data = summary.target > 0;
        summary.pass = summary.has_data ? isPass(summary.percent, k.criterion_op, k.criterion) : false;

        const entry = { ...summary };
        if (opts.withUnits) { entry.units = unitRows; entry.total = total; }
        out.set(k.id, entry);
    }
    return out;
}

// เวลาซิงค์ล่าสุดของแต่ละตัวชี้วัด (ดูจากตาราง HDC ที่ใช้)
async function lastSyncByKpi(ids, year) {
    if (!ids.length) return new Map();
    const r = await pool.query(
        `SELECT s.kpi_id, MAX(l.synced_at) AS synced_at,
                (ARRAY_AGG(l.synced_by ORDER BY l.synced_at DESC))[1] AS synced_by
         FROM kpi_sources s
         JOIN hdc_sync_log l ON l.table_name = s.table_name AND l.status = 'success' AND ($2::varchar IS NULL OR l.b_year = $2)
         WHERE s.kpi_id = ANY($1::int[])
         GROUP BY s.kpi_id`,
        [ids, year || null]
    );
    return new Map(r.rows.map(x => [x.kpi_id, { synced_at: x.synced_at, synced_by: x.synced_by }]));
}

module.exports = { computeKpis, calcPercent, isPass, getUnits, lastSyncByKpi };
