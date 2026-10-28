// หัวหน้าเพจ: ชื่อ + คำอธิบาย + ปุ่มด้านขวา
export default function PageHeader({ title, sub, children }) {
    return (
        <div className="page-head">
            <div>
                <h1 className="page-title">{title}</h1>
                {sub && <p className="page-sub">{sub}</p>}
            </div>
            {children && <div className="page-actions">{children}</div>}
        </div>
    );
}
