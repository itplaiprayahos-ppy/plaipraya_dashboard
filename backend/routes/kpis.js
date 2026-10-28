const express = require('express');
const router = express.Router();
const { audit } = require('../services/audit');

// id ต้องเป็นตัวเลขเท่านั้น
router.param('id', (req, res, next, id) => (/^\d+$/.test(id) ? next() : res.status(400).json({ message: 'id ไม่ถูกต้อง' })));
const pool = require('../config/db');
const { requireAdmin, displayName } = require('../middleware/auth');
const { asyncHandler, isIdent, toNumberOrNull, HttpError } = require('../services/util');
const { computeKpis, lastSyncByKpi } = require('../services/kpiEngine');
const { getSettings } = require('../services/settings');
const { syncTable } = require('../services/hdc');

const KPI_COLUMNS = `k.id, k.group_id, k.sort_order, k.display_index, k.name, k.is_header, k.criterion::float AS criterion,
    k.criterion_op, k.multiplier::float AS multiplier, k.unit_label, k.link, k.summary_scope, k.summary_hoscode,
    k.allow_manual, k.active, k.b_year`;

async function loadSources(ids) {
    if (!ids.length) return new Map();
    const r = await pool.query(
        'SELECT id, kpi_id, table_name, target_fields, result_fields FROM kpi_sources WHERE kpi_id = ANY($1::int[]) ORDER BY id',
        [ids]
    );
    const m = new Map();
    for (const s of r.rows) {
        if (!m.has(s.kpi_id)) m.set(s.kpi_id, []);
        m.get(s.kpi_id).push({ id: s.id, table_name: s.table_name, target_fields: s.target_fields, result_fields: s.result_fields });
    }
    return m;
}

function yearOf(req, settings) {
    const y = req.query.year;
    return y && /^\d{4}$/.test(y) ? y : settings.b_year;
}

async function groupWithKpis(groupId, year, settings) {
    const kr = await pool.query(
        `SELECT ${KPI_COLUMNS} FROM kpis k WHERE k.group_id = $1 AND k.b_year = $2 AND k.active ORDER BY k.sort_order, k.id`,
        [groupId, year]
    );
    const kpis = kr.rows;
    const ids = kpis.map(k => k.id);
    const [values, sources, syncs] = await Promise.all([
        computeKpis(kpis, { year, settings }),
        loadSources(ids),
        lastSyncByKpi(ids, year),
    ]);
    return kpis.map(k => ({
        ...k,
        has_sources: (sources.get(k.id) || []).length > 0,
        last_sync: syncs.get(k.id) || null,
        value: k.is_header ? null : values.get(k.id),
    }));
}

// ===== หน้าแสดงผล (สาธารณะ) =====

// หน้าแรก: ทุกกลุ่มที่แสดงในหน้าแรก พร้อมผลตัวชี้วัด
router.get('/home', asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const year = yearOf(req, settings);
    const gr = await pool.query('SELECT * FROM kpi_groups WHERE active AND show_on_home ORDER BY sort_order, id');
    const groups = [];
    for (const g of gr.rows) groups.push({ ...g, kpis: await groupWithKpis(g.id, year, settings) });
    res.json({ year, groups });
}));

router.get('/groups/:slug/kpis', asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const year = yearOf(req, settings);
    const gr = await pool.query('SELECT * FROM kpi_groups WHERE slug = $1 AND active', [req.params.slug]);
    if (!gr.rowCount) return res.status(404).json({ message: 'ไม่พบกลุ่มตัวชี้วัด' });
    const staleDays = Math.max(0, parseInt(settings.alert_stale_days, 10) || 0);
    res.json({ year, group: gr.rows[0], stale_days: staleDays, kpis: await groupWithKpis(gr.rows[0].id, year, settings) });
}));

router.get('/kpis/:id/detail', asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const year = yearOf(req, settings);
    const kr = await pool.query(
        `SELECT ${KPI_COLUMNS}, g.slug AS group_slug, g.name AS group_name
         FROM kpis k JOIN kpi_groups g ON g.id = k.group_id WHERE k.id = $1`,
        [req.params.id]
    );
    if (!kr.rowCount) return res.status(404).json({ message: 'ไม่พบตัวชี้วัด' });
    const kpi = kr.rows[0];
    const kpiYear = kpi.b_year || year;
    const values = await computeKpis([kpi], { year: kpiYear, settings, withUnits: true });
    const sources = await loadSources([kpi.id]);
    const syncs = await lastSyncByKpi([kpi.id], kpiYear);
    res.json({
        year: kpiYear, kpi: { ...kpi, sources: sources.get(kpi.id) || [], last_sync: syncs.get(kpi.id) || null },
        value: values.get(kpi.id) || null,
        default_hoscode: settings.default_hoscode,
    });
}));

// ===== ซิงค์ + กรอกข้อมูล (ต้องล็อกอิน) =====

router.post('/kpis/:id/sync', requireAdmin, asyncHandler(async (req, res) => {
    const kr = await pool.query('SELECT b_year FROM kpis WHERE id = $1', [req.params.id]);
    if (!kr.rowCount) return res.status(404).json({ message: 'ไม่พบตัวชี้วัด' });
    const sources = (await loadSources([Number(req.params.id)])).get(Number(req.params.id)) || [];
    if (!sources.length) return res.status(400).json({ message: 'ตัวชี้วัดนี้ไม่มีแหล่งข้อมูล HDC' });
    const tables = [...new Set(sources.map(s => s.table_name))];
    const results = [];
    for (const t of tables) results.push(await syncTable(t, { year: kr.rows[0].b_year, user: displayName(req.user) }));
    audit(req, 'kpi.sync', `ซิงค์ตัวชี้วัด #${req.params.id} (${tables.join(', ')})`, { detail: { kpi_id: Number(req.params.id), results } });
    res.json({ message: 'Import success', results });
}));

router.get('/kpis/:id/values', requireAdmin, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    let year = yearOf(req, settings);
    const kr = await pool.query(`SELECT ${KPI_COLUMNS} FROM kpis k WHERE k.id = $1`, [req.params.id]);
    if (!kr.rowCount) return res.status(404).json({ message: 'ไม่พบตัวชี้วัด' });
    const kpi = kr.rows[0];
    if (kpi.b_year) year = kpi.b_year;
    const [computed, manual] = await Promise.all([
        computeKpis([kpi], { year, settings, withUnits: true }),
        pool.query('SELECT hospcode, target::float, result::float FROM kpi_manual_values WHERE kpi_id = $1 AND b_year = $2', [kpi.id, year]),
    ]);
    const manualMap = new Map(manual.rows.map(r => [r.hospcode, r]));
    const v = computed.get(kpi.id);
    res.json({
        year,
        units: (v ? v.units : []).map(u => ({
            ...u,
            manual_target: manualMap.has(u.hoscode) ? manualMap.get(u.hoscode).target : null,
            manual_result: manualMap.has(u.hoscode) ? manualMap.get(u.hoscode).result : null,
        })),
    });
}));

// body: { year?, values: [{hospcode, target, result}] } — ค่าว่าง = ใช้ค่าจาก HDC
router.put('/kpis/:id/values', requireAdmin, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const body = req.body || {};
    const list = Array.isArray(body) ? body : body.values;
    let year = body.year && /^\d{4}$/.test(body.year) ? body.year : settings.b_year;
    if (!Array.isArray(list)) return res.status(400).json({ message: 'ต้องส่ง values เป็น array' });
    const kr = await pool.query('SELECT id, allow_manual, is_header, b_year FROM kpis WHERE id = $1', [req.params.id]);
    if (!kr.rowCount) return res.status(404).json({ message: 'ไม่พบตัวชี้วัด' });
    if (kr.rows[0].b_year) year = kr.rows[0].b_year;
    if (!kr.rows[0].allow_manual || kr.rows[0].is_header) return res.status(400).json({ message: 'ตัวชี้วัดนี้ไม่เปิดให้กรอกข้อมูลเอง' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of list) {
            if (!item || !item.hospcode) throw new HttpError(400, 'ต้องระบุ hospcode');
            const target = toNumberOrNull(item.target);
            const result = toNumberOrNull(item.result);
            if (Number.isNaN(target) || Number.isNaN(result)) throw new HttpError(400, `ค่าของ ${item.hospcode} ต้องเป็นตัวเลข`);
            if (target === null && result === null) {
                await client.query('DELETE FROM kpi_manual_values WHERE kpi_id=$1 AND hospcode=$2 AND b_year=$3', [req.params.id, item.hospcode, year]);
            } else {
                await client.query(
                    `INSERT INTO kpi_manual_values (kpi_id, hospcode, b_year, target, result, updated_by, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
                     ON CONFLICT (kpi_id, hospcode, b_year) DO UPDATE
                     SET target = EXCLUDED.target, result = EXCLUDED.result, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
                    [req.params.id, item.hospcode, year, target, result, displayName(req.user)]
                );
            }
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    audit(req, 'kpi.values', `กรอกข้อมูลตัวชี้วัด #${req.params.id} ปี ${year} (${list.length} หน่วย)`, { detail: { kpi_id: Number(req.params.id), year, values: list } });
    res.json({ success: true });
}));

// ===== จัดการตัวชี้วัด (admin) =====

function readKpi(body) {
    const b = body || {};
    const criterion = toNumberOrNull(b.criterion);
    const multiplier = toNumberOrNull(b.multiplier);
    return {
        group_id: Number(b.group_id),
        display_index: String(b.display_index || '').trim().slice(0, 20),
        name: String(b.name || '').trim(),
        is_header: !!b.is_header,
        criterion,
        criterion_op: ['>=', '>', '<=', '<'].includes(b.criterion_op) ? b.criterion_op : '>=',
        multiplier: multiplier === null ? 100 : multiplier,
        unit_label: String(b.unit_label ?? '%').trim().slice(0, 20),
        link: String(b.link || '').trim(),
        summary_scope: b.summary_scope === 'all' ? 'all' : 'unit',
        summary_hoscode: b.summary_hoscode ? String(b.summary_hoscode).trim() : null,
        allow_manual: !!b.allow_manual,
        active: b.active !== false,
        sources: Array.isArray(b.sources) ? b.sources : [],
        b_year: b.b_year ? String(b.b_year).trim() : null,
    };
}

function cleanFields(v) {
    const arr = Array.isArray(v) ? v : String(v || '').split(/[\s,+]+/);
    return arr.map(s => String(s).trim()).filter(Boolean);
}

function validateKpi(k) {
    if (!k.group_id) return 'กรุณาเลือกกลุ่ม';
    if (!k.name) return 'กรุณากรอกชื่อตัวชี้วัด';
    if (Number.isNaN(k.criterion)) return 'เกณฑ์ต้องเป็นตัวเลข';
    if (Number.isNaN(k.multiplier) || k.multiplier <= 0) return 'ตัวคูณต้องเป็นตัวเลขมากกว่า 0';
    if (k.link && !/^https?:\/\//i.test(k.link)) return 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://';
    k.sources = k.sources.map(s => ({
        table_name: String(s.table_name || '').trim(),
        target_fields: cleanFields(s.target_fields),
        result_fields: cleanFields(s.result_fields),
    })).filter(s => s.table_name);
    for (const s of k.sources) {
        if (!isIdent(s.table_name)) return `ชื่อตาราง HDC "${s.table_name}" ไม่ถูกต้อง`;
        const bad = [...s.target_fields, ...s.result_fields].find(f => !isIdent(f));
        if (bad) return `ชื่อฟิลด์ "${bad}" ไม่ถูกต้อง (ใช้ได้เฉพาะ a-z, 0-9, _)`;
        if (!s.target_fields.length || !s.result_fields.length) return `ตาราง ${s.table_name}: ต้องระบุฟิลด์เป้าหมายและผลงาน`;
    }
    if (k.is_header) { k.sources = []; k.allow_manual = false; }
    return null;
}

async function saveSources(client, kpiId, sources) {
    await client.query('DELETE FROM kpi_sources WHERE kpi_id = $1', [kpiId]);
    for (const s of sources) {
        await client.query(
            'INSERT INTO kpi_sources (kpi_id, table_name, target_fields, result_fields) VALUES ($1,$2,$3,$4)',
            [kpiId, s.table_name, s.target_fields, s.result_fields]
        );
    }
}

router.get('/admin/kpis', requireAdmin, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const params = [yearOf(req, settings)];
    let where = 'WHERE k.b_year = $1';
    if (req.query.group_id) { params.push(Number(req.query.group_id)); where += ' AND k.group_id = $2'; }
    const r = await pool.query(`SELECT ${KPI_COLUMNS} FROM kpis k ${where} ORDER BY k.group_id, k.sort_order, k.id`, params);
    const sources = await loadSources(r.rows.map(k => k.id));
    res.json(r.rows.map(k => ({ ...k, sources: sources.get(k.id) || [] })));
}));

router.post('/admin/kpis', requireAdmin, asyncHandler(async (req, res) => {
    const k = readKpi(req.body);
    const err = validateKpi(k);
    if (err) return res.status(400).json({ message: err });
    if (!k.b_year) k.b_year = (await getSettings()).b_year;
    const fy = await pool.query('SELECT 1 FROM fiscal_years WHERE year = $1', [k.b_year]);
    if (!fy.rowCount) return res.status(400).json({ message: `ยังไม่มีปีงบประมาณ ${k.b_year} กรุณาเพิ่มปีงบประมาณก่อน` });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // ตำแหน่ง: ต่อท้าย หรือแทรกหลัง after_id
        let sort;
        const afterId = req.body && req.body.after_id;
        if (afterId) {
            const a = await client.query('SELECT sort_order FROM kpis WHERE id = $1 AND group_id = $2 AND b_year = $3', [afterId, k.group_id, k.b_year]);
            if (a.rowCount) {
                sort = a.rows[0].sort_order + 1;
                await client.query('UPDATE kpis SET sort_order = sort_order + 1 WHERE group_id = $1 AND b_year = $2 AND sort_order >= $3', [k.group_id, k.b_year, sort]);
            }
        }
        if (sort === undefined) {
            const m = await client.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM kpis WHERE group_id = $1 AND b_year = $2', [k.group_id, k.b_year]);
            sort = m.rows[0].n;
        }
        const r = await client.query(
            `INSERT INTO kpis (group_id, sort_order, display_index, name, is_header, criterion, criterion_op, multiplier,
                               unit_label, link, summary_scope, summary_hoscode, allow_manual, active, b_year)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
            [k.group_id, sort, k.display_index, k.name, k.is_header, k.criterion, k.criterion_op, k.multiplier,
             k.unit_label, k.link, k.summary_scope, k.summary_hoscode, k.allow_manual, k.active, k.b_year]
        );
        await saveSources(client, r.rows[0].id, k.sources);
        await client.query('COMMIT');
        audit(req, 'kpi.create', `เพิ่มตัวชี้วัด "${k.name}" ปี ${k.b_year}`, { detail: { id: r.rows[0].id, ...k } });
        res.json({ success: true, id: r.rows[0].id });
    } catch (e) {
        await client.query('ROLLBACK');
        if (e.code === '23503') return res.status(400).json({ message: 'ไม่พบกลุ่มที่เลือก' });
        throw e;
    } finally {
        client.release();
    }
}));

router.put('/admin/kpis/:id', requireAdmin, asyncHandler(async (req, res) => {
    const k = readKpi(req.body);
    const err = validateKpi(k);
    if (err) return res.status(400).json({ message: err });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cur = await client.query('SELECT group_id, b_year FROM kpis WHERE id = $1', [req.params.id]);
        if (!cur.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'ไม่พบตัวชี้วัด' }); }
        // ย้ายกลุ่ม -> ไปต่อท้ายกลุ่มใหม่
        let sortSql = 'sort_order';
        const params = [k.group_id, k.display_index, k.name, k.is_header, k.criterion, k.criterion_op, k.multiplier,
            k.unit_label, k.link, k.summary_scope, k.summary_hoscode, k.allow_manual, k.active, req.params.id];
        if (cur.rows[0].group_id !== k.group_id) {
            params.push(cur.rows[0].b_year);
            sortSql = '(SELECT COALESCE(MAX(sort_order),0)+1 FROM kpis WHERE group_id = $1 AND b_year = $15)';
        }
        await client.query(
            `UPDATE kpis SET group_id=$1, display_index=$2, name=$3, is_header=$4, criterion=$5, criterion_op=$6, multiplier=$7,
                    unit_label=$8, link=$9, summary_scope=$10, summary_hoscode=$11, allow_manual=$12, active=$13,
                    sort_order=${sortSql}, updated_at=CURRENT_TIMESTAMP
             WHERE id=$14`,
            params
        );
        await saveSources(client, req.params.id, k.sources);
        await client.query('COMMIT');
        audit(req, 'kpi.update', `แก้ไขตัวชี้วัด #${req.params.id} "${k.name}"`, { detail: { id: Number(req.params.id), ...k } });
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        if (e.code === '23503') return res.status(400).json({ message: 'ไม่พบกลุ่มที่เลือก' });
        throw e;
    } finally {
        client.release();
    }
}));

router.delete('/admin/kpis/:id', requireAdmin, asyncHandler(async (req, res) => {
    const r = await pool.query('DELETE FROM kpis WHERE id = $1 RETURNING name, b_year', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบตัวชี้วัด' });
    audit(req, 'kpi.delete', `ลบตัวชี้วัด #${req.params.id} "${r.rows[0].name}" ปี ${r.rows[0].b_year}`, { level: 'warn' });
    res.json({ success: true });
}));

// body: { ids: [ลำดับใหม่ของ id ในกลุ่ม] }
router.post('/admin/kpis/reorder', requireAdmin, asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number) : null;
    if (!ids) return res.status(400).json({ message: 'ต้องส่ง ids เป็น array' });
    await pool.query(
        `UPDATE kpis k SET sort_order = x.ord FROM unnest($1::int[]) WITH ORDINALITY AS x(id, ord) WHERE k.id = x.id`,
        [ids]
    );
    audit(req, 'kpi.reorder', `เรียงลำดับตัวชี้วัด ${ids.length} รายการ`);
    res.json({ success: true });
}));

module.exports = router;
