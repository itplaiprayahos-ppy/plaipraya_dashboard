import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';
import { useAppData } from './AppDataContext';

// แจ้งเตือนสถานะข้อมูล HDC (เฉพาะผู้ดูแลระบบ) — รีเฟรชทุก 5 นาที, เมื่อเปลี่ยนปี และหลังซิงค์
const AlertsContext = createContext({ data: null, count: 0, refresh: () => {} });
const EVENT = 'hdc-alerts-refresh';

// เรียกหลังซิงค์ข้อมูลเพื่อให้กระดิ่งอัปเดตทันที
export const notifyAlertsChanged = () => window.dispatchEvent(new Event(EVENT));

export function AlertsProvider({ children }) {
    const { isAdmin } = useAuth();
    const { year } = useAppData();
    const [data, setData] = useState(null);

    const refresh = useCallback(async () => {
        if (!isAdmin || !year) { setData(null); return; }
        try {
            const res = await api.get('/alerts', { params: { year } });
            setData(res.data);
        } catch (err) {
            console.error('โหลดการแจ้งเตือนไม่สำเร็จ:', err);
        }
    }, [isAdmin, year]);

    useEffect(() => {
        refresh();
        if (!isAdmin) return undefined;
        const timer = setInterval(refresh, 5 * 60 * 1000);
        window.addEventListener(EVENT, refresh);
        return () => { clearInterval(timer); window.removeEventListener(EVENT, refresh); };
    }, [refresh, isAdmin]);

    const count = data ? data.alerts.length : 0;
    return <AlertsContext.Provider value={{ data, count, refresh }}>{children}</AlertsContext.Provider>;
}

export const useAlerts = () => useContext(AlertsContext);

// ข้อความอ่านง่ายของแต่ละการแจ้งเตือน
export function alertText(a) {
    if (a.type === 'sync_failed') return 'ซิงค์ล่าสุดล้มเหลว';
    if (a.type === 'never_synced') return 'ยังไม่เคยซิงค์ข้อมูลปีนี้';
    return `ไม่ได้อัปเดตมา ${a.days} วัน`;
}
