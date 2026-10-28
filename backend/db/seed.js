// ใส่ข้อมูลเริ่มต้น (กลุ่ม/ตัวชี้วัด/หน่วยบริการ) และย้ายข้อมูลจากตารางเดิม
const fs = require('fs');
const path = require('path');
const { saveSettings, getSettings } = require('../services/settings');
const { isIdent } = require('../services/util');

async function tableExists(client, name) {
    const r = await client.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
    return !!r.rows[0].t;
}

async function seed(client) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));
    const log = [];

    // 1) ตั้งค่า (เฉพาะครั้งแรก)
    const s = await client.query('SELECT COUNT(*)::int AS n FROM app_settings');
    if (s.rows[0].n === 0) {
        const defaults = await getSettings();
        await saveSettings(defaults, client);
        log.push('ตั้งค่าระบบเริ่มต้นจาก .env');
    }

    // 2) หน่วยบริการ
    const u = await client.query('SELECT COUNT(*)::int AS n FROM units');
    if (u.rows[0].n === 0) {
        for (const unit of data.units) {
            await client.query(
                'INSERT INTO units (hoscode, name, short_name, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
                [unit.hoscode, unit.name, unit.short_name, unit.sort_order]
            );
        }
        log.push(`เพิ่มหน่วยบริการ ${data.units.length} หน่วย`);
    }

    // 3) กลุ่ม + ตัวชี้วัด (เฉพาะเมื่อยังไม่มีกลุ่มเลย)
    const g = await client.query('SELECT COUNT(*)::int AS n FROM kpi_groups');
    if (g.rows[0].n === 0) {
        const year = (await getSettings()).b_year;
        const groupIds = {};
        for (const grp of data.groups) {
            const r = await client.query(
                `INSERT INTO kpi_groups (slug, name, icon, color1, color2, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                [grp.slug, grp.name, grp.icon, grp.color1, grp.color2, grp.sort_order]
            );
            groupIds[grp.slug] = r.rows[0].id;
        }
        for (const k of data.kpis) {
            const r = await client.query(
                `INSERT INTO kpis (group_id, sort_order, display_index, name, is_header, criterion, criterion_op,
                                   multiplier, unit_label, link, summary_scope, summary_hoscode, allow_manual, legacy_key, b_year)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
                [groupIds[k.group], k.sort_order, k.display_index, k.name, k.is_header, k.criterion, k.criterion_op,
                 k.multiplier, k.unit_label, k.link, k.summary_scope, k.summary_hoscode, k.allow_manual, k.legacy_key, year]
            );
            for (const src of k.sources) {
                await client.query(
                    'INSERT INTO kpi_sources (kpi_id, table_name, target_fields, result_fields) VALUES ($1,$2,$3,$4)',
                    [r.rows[0].id, src.table_name, src.target_fields, src.result_fields]
                );
            }
        }
        log.push(`เพิ่มกลุ่ม ${data.groups.length} กลุ่ม, ตัวชี้วัด ${data.kpis.length} รายการ`);
    }

    // 3.1) อัปเกรดจากเวอร์ชันที่ยังไม่แยกปีงบ: ตัวชี้วัดเดิมทั้งหมด = ปีงบปัจจุบัน
    {
        const cur = (await getSettings()).b_year;
        const r = await client.query('UPDATE kpis SET b_year = $1 WHERE b_year IS NULL', [cur]);
        if (r.rowCount) log.push(`กำหนดปีงบ ${cur} ให้ตัวชี้วัดเดิม ${r.rowCount} รายการ`);
        await client.query(
            `INSERT INTO fiscal_years (year)
             SELECT DISTINCT b_year FROM kpis WHERE b_year IS NOT NULL
             UNION SELECT $1::varchar
             ON CONFLICT DO NOTHING`,
            [cur]
        );
    }

    // 4) ย้ายข้อมูล HDC จากตารางเดิม (s_xxx) เข้า hdc_raw — ไม่ต้องซิงค์ใหม่
    const settings = await getSettings();
    const tables = await client.query('SELECT DISTINCT table_name FROM kpi_sources ORDER BY 1');
    for (const { table_name } of tables.rows) {
        if (!isIdent(table_name) || !(await tableExists(client, table_name))) continue;
        const has = await client.query('SELECT 1 FROM hdc_raw WHERE table_name = $1 LIMIT 1', [table_name]);
        if (has.rowCount) continue;
        const r = await client.query(
            `INSERT INTO hdc_raw (table_name, b_year, hospcode, data)
             SELECT $1, COALESCE(NULLIF(to_jsonb(t) ->> 'b_year', ''), $2), to_jsonb(t) ->> 'hospcode', to_jsonb(t)
             FROM "${table_name}" t`,
            [table_name, settings.b_year]
        );
        if (r.rowCount) log.push(`ย้ายข้อมูลเดิม ${table_name}: ${r.rowCount} แถว`);
    }

    // 5) ค่าที่เคยกรอกเองใน s_thai_id -> kpi_manual_values
    if (await tableExists(client, 's_thai_id')) {
        const r = await client.query(
            `INSERT INTO kpi_manual_values (kpi_id, hospcode, b_year, target, result, updated_by)
             SELECT k.id, t.hospcode, $1, safe_num(t.target::text), safe_num(t.result::text), 'migrate'
             FROM s_thai_id t
             JOIN kpis k ON k.legacy_key = 's_thai_id'
             WHERE t.hospcode IS NOT NULL
             ON CONFLICT DO NOTHING`,
            [settings.b_year]
        );
        if (r.rowCount) log.push(`ย้ายค่ากรอกเอง s_thai_id: ${r.rowCount} แถว`);
    }
    return log;
}

module.exports = { seed };
