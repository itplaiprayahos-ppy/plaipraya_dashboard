import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api';

// ข้อมูลที่หลายหน้าใช้ร่วมกัน: กลุ่มตัวชี้วัด, ตั้งค่า, ปีงบประมาณ และปีที่กำลังดู
const AppDataContext = createContext({
    groups: [], settings: {}, years: [], year: null, setYear: () => {}, reload: () => {},
});

const YEAR_KEY = 'kpi_dashboard_year';
const readSavedYear = () => {
    try { return window.localStorage.getItem(YEAR_KEY); } catch { return null; }
};
const saveYear = (y) => {
    try { window.localStorage.setItem(YEAR_KEY, y); } catch { /* ไม่เป็นไร */ }
};

export function AppDataProvider({ children }) {
    const [groups, setGroups] = useState([]);
    const [settings, setSettings] = useState({});
    const [years, setYears] = useState([]);
    const [year, setYearState] = useState(null);

    // โหลดตั้งค่า + รายการปี แล้วเลือกปี (ปีที่เคยเลือกไว้ -> ปีเริ่มต้นของระบบ)
    const reload = useCallback(async () => {
        try {
            const [s, y] = await Promise.all([api.get('/settings'), api.get('/years')]);
            setSettings(s.data.values || {});
            setYears(y.data.years || []);
            setYearState(prev => {
                const list = (y.data.years || []).map(r => r.year);
                const wanted = prev || readSavedYear();
                return wanted && list.includes(wanted) ? wanted : y.data.default_year;
            });
        } catch (err) {
            console.error('โหลดข้อมูลระบบไม่สำเร็จ:', err);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    // กลุ่ม (จำนวนตัวชี้วัดขึ้นกับปีที่เลือก)
    const reloadGroups = useCallback(async () => {
        if (!year) return;
        try {
            const g = await api.get('/groups', { params: { year } });
            setGroups(g.data);
        } catch (err) {
            console.error('โหลดกลุ่มตัวชี้วัดไม่สำเร็จ:', err);
        }
    }, [year]);

    useEffect(() => { reloadGroups(); }, [reloadGroups]);

    const setYear = useCallback((y) => {
        setYearState(y);
        saveYear(y);
    }, []);

    const reloadAll = useCallback(async () => {
        await reload();
        await reloadGroups();
    }, [reload, reloadGroups]);

    return (
        <AppDataContext.Provider value={{ groups, settings, years, year, setYear, reload: reloadAll }}>
            {children}
        </AppDataContext.Provider>
    );
}

export const useAppData = () => useContext(AppDataContext);
