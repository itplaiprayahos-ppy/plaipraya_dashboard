-- =====================================================================
-- Plaipraya KPI Dashboard - schema (safe to run many times)
-- =====================================================================

-- ---------- ผู้ใช้ ----------
CREATE TABLE IF NOT EXISTS users (
    id varchar(32) PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    department VARCHAR(100),
    role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- log ของ winston ----------
CREATE TABLE IF NOT EXISTS winston_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(50) NOT NULL,                    
    timestamp timestamp with time zone NOT NULL DEFAULT now(),  
    context VARCHAR(255),                         
    message TEXT NOT NULL,                        
    stack JSONB                                   
);

-- ---------- ตั้งค่าระบบ (แทนค่าใน .env / hard code) ----------
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- หน่วยบริการที่แสดงในตาราง/ฟอร์มกรอกข้อมูล ----------
CREATE TABLE IF NOT EXISTS units (
    hoscode VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- กลุ่มตัวชี้วัด (MOU / กระทรวง / ตรวจราชการ / ...) ----------
CREATE TABLE IF NOT EXISTS kpi_groups (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50) DEFAULT 'chart-bar',
    color1 VARCHAR(20) DEFAULT '#0575e6',
    color2 VARCHAR(20) DEFAULT '#021b79',
    sort_order INTEGER NOT NULL DEFAULT 0,
    show_on_home BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- ตัวชี้วัด ----------
CREATE TABLE IF NOT EXISTS kpis (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES kpi_groups(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    display_index VARCHAR(20) DEFAULT '',
    name TEXT NOT NULL,
    is_header BOOLEAN NOT NULL DEFAULT FALSE,          -- แถวหัวข้อ (ไม่มีค่า)
    criterion NUMERIC,                                 -- เกณฑ์
    criterion_op VARCHAR(2) NOT NULL DEFAULT '>=',     -- >=, >, <=, <
    multiplier NUMERIC NOT NULL DEFAULT 100,           -- ร้อยละ=100, ต่อพัน=1000, ต่อแสน=100000
    unit_label VARCHAR(20) DEFAULT '%',
    link TEXT DEFAULT '',
    summary_scope VARCHAR(10) NOT NULL DEFAULT 'unit', -- unit = ใช้ค่าของหน่วยเดียว, all = รวมทุกหน่วย
    summary_hoscode VARCHAR(10),
    allow_manual BOOLEAN NOT NULL DEFAULT FALSE,       -- กรอกเป้าหมาย/ผลงานเองได้
    active BOOLEAN NOT NULL DEFAULT TRUE,
    legacy_key VARCHAR(100),                           -- ชื่อตารางเดิม (ใช้ตอนย้ายข้อมูล)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kpis_op_chk CHECK (criterion_op IN ('>=', '>', '<=', '<')),
    CONSTRAINT kpis_scope_chk CHECK (summary_scope IN ('unit', 'all'))
);
CREATE INDEX IF NOT EXISTS kpis_group_idx ON kpis(group_id, sort_order);

-- ---------- แหล่งข้อมูล HDC ของแต่ละตัวชี้วัด (1 ตัวชี้วัดมีได้หลายตาราง) ----------
CREATE TABLE IF NOT EXISTS kpi_sources (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,              -- tableName ของ opendata.moph.go.th
    target_fields TEXT[] NOT NULL DEFAULT '{}',    -- ฟิลด์ที่นำมารวมเป็นเป้าหมาย
    result_fields TEXT[] NOT NULL DEFAULT '{}'     -- ฟิลด์ที่นำมารวมเป็นผลงาน
);
CREATE INDEX IF NOT EXISTS kpi_sources_kpi_idx ON kpi_sources(kpi_id);

-- ---------- ข้อมูลดิบจาก HDC (เก็บทุกตารางในที่เดียวแบบ JSONB) ----------
CREATE TABLE IF NOT EXISTS hdc_raw (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    b_year VARCHAR(4) NOT NULL,
    hospcode VARCHAR(10),
    data JSONB NOT NULL,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hdc_raw_lookup_idx ON hdc_raw(table_name, b_year, hospcode);

-- ---------- ประวัติการซิงค์ ----------
CREATE TABLE IF NOT EXISTS hdc_sync_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    b_year VARCHAR(4),
    row_count INTEGER,
    status VARCHAR(10) NOT NULL,       -- success / error
    error TEXT,
    synced_by VARCHAR(120),
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hdc_sync_log_idx ON hdc_sync_log(table_name, synced_at DESC);

-- ---------- ค่าที่กรอกเอง (ทับค่าจาก HDC รายหน่วย) ----------
CREATE TABLE IF NOT EXISTS kpi_manual_values (
    kpi_id INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    hospcode VARCHAR(10) NOT NULL,
    b_year VARCHAR(4) NOT NULL,
    target NUMERIC,
    result NUMERIC,
    updated_by VARCHAR(120),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kpi_id, hospcode, b_year)
);

-- ---------- PP Fee Schedule (เดิม) ----------
CREATE TABLE IF NOT EXISTS "ppfee_years" (
    id VARCHAR(32) PRIMARY KEY,
    year INT NOT NULL UNIQUE,          
    status VARCHAR(10) NOT NULL,       
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ppfee_data" (
    id VARCHAR(32) PRIMARY KEY,
    year_id VARCHAR(32) NOT NULL REFERENCES ppfee_years(id) ON DELETE CASCADE,
    service_unit_code VARCHAR(50) NOT NULL,  
    service_unit_name VARCHAR(255) NOT NULL, 
    main_activity VARCHAR(255) NOT NULL,    
    sub_activity VARCHAR(255) NOT NULL,      
    person_count INT DEFAULT 0,            
    service_count INT DEFAULT 0,            
    amount NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- ฟังก์ชันช่วยคำนวณ ----------
-- แปลงข้อความเป็นตัวเลขแบบปลอดภัย (ค่าที่ไม่ใช่ตัวเลข = 0)
CREATE OR REPLACE FUNCTION safe_num(v text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN v ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN v::numeric ELSE 0 END
$$;

-- รวมค่าของหลายฟิลด์ใน JSONB
CREATE OR REPLACE FUNCTION sum_keys(d jsonb, keys text[]) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(SUM(safe_num(d ->> k)), 0) FROM unnest(keys) AS k
$$;

-- =====================================================================
-- ปีงบประมาณ: ตัวชี้วัดแยกตามปี (เพิ่มในเวอร์ชันแยกปีงบ)
-- =====================================================================
CREATE TABLE IF NOT EXISTS fiscal_years (
    year VARCHAR(4) PRIMARY KEY,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE kpis ADD COLUMN IF NOT EXISTS b_year VARCHAR(4);
CREATE INDEX IF NOT EXISTS kpis_year_group_idx ON kpis(b_year, group_id, sort_order);

-- =====================================================================
-- บันทึกการใช้งาน (audit log) — ดูได้ที่หน้า "บันทึกการใช้งาน"
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    level VARCHAR(10) NOT NULL DEFAULT 'info',   -- info / warn / error
    action VARCHAR(50) NOT NULL,                 -- เช่น auth.login, kpi.update, hdc.sync
    username VARCHAR(64),
    user_name VARCHAR(120),
    ip VARCHAR(64),
    message TEXT,
    detail JSONB
);
CREATE INDEX IF NOT EXISTS audit_logs_at_idx ON audit_logs(at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action, at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(username, at DESC);
