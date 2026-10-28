import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Button, Col, Row, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaFileExcel } from 'react-icons/fa';
import * as XLSX from "xlsx";

function PpFeeSchedule() {
  const { years } = useParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isValid, setIsValid] = useState(null);
  const navigate = useNavigate();

  const tableHeaders = [
    "หน่วยที่ให้บริการ",
    "ชื่อของหน่วยให้บริการ",
    "กิจกรรมหลัก",
    "กิจกรรมย่อย",
    "รับบริการ (คน)",
    "จำนวน (ครั้ง)",
    "การเบิกจ่าย (บาท)",
  ];

  useEffect(() => {
    const loading = async () => {
      setLoading(true)
      setTimeout(() => {
        setLoading(false);
      }, 500);

    };

    loading();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const yearRes = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/${years}`);
        if (yearRes.data.data && yearRes.data.data.length > 0) {
          const id = yearRes.data.data[0].id;

          const dataRes = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${id}`);
          setData(dataRes.data);
        } else {
          console.log("ไม่พบปีที่เลือก");
          setData([]);
        }
      } catch (error) {
        console.error("Error fetching PPFee data:", error);
        setData([]);
      } finally {
        setTimeout(() => {
          setLoading(false);
        }, 500);
      }
    };

    fetchData();
  }, [years]); // <--- เพิ่ม years เป็น dependency

  useEffect(() => {
    const checkYear = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/years`);
        const data = res.data;

        // ตรวจสอบว่าปีที่เข้ามามีอยู่ในฐานข้อมูล และ status เป็น active
        const found = data.find(item =>
          String(item.year) === String(years) && item.status === "active"
        );

        if (!found) {
          navigate("*", { replace: true }); // ไปหน้า NotFound
        } else {
          setIsValid(true);
        }

      } catch (err) {
        console.error(err);
        navigate("*", { replace: true }); // ถ้าเกิด error ก็ไป NotFound
      }
    };

    checkYear();
  }, [years, navigate]);

  if (isValid === null) return <div>กำลังตรวจสอบข้อมูล...</div>;

  const groupedData = data.reduce((acc, curr) => {
    // ใช้ key รวมกันของหน่วยบริการและกิจกรรมหลัก
    const key = `${curr.service_unit_code}-${curr.service_unit_name}-${curr.main_activity}`;

    if (!acc[key]) {
      acc[key] = {
        service_unit_code: curr.service_unit_code,
        service_unit_name: curr.service_unit_name,
        main_activity: curr.main_activity,
        sub_activities: [],
      };
    }

    acc[key].sub_activities.push({
      id: curr.id,
      sub_activity: curr.sub_activity,
      person_count: curr.person_count,
      service_count: curr.service_count,
      amount: curr.amount,
    });

    return acc;
  }, {});

  const rows = Object.values(groupedData);
  // สร้างตัวแปรรวมข้อมูลทั้งหมด
  const tableData = rows.flatMap((group) =>
    group.sub_activities.map((sub, i) => ({
      "หน่วยที่ให้บริการ": i === 0 ? group.service_unit_code : "",
      "ชื่อของหน่วยให้บริการ": i === 0 ? group.service_unit_name : "",
      "กิจกรรมหลัก": i === 0 ? group.main_activity : "",
      "กิจกรรมย่อย": sub.sub_activity,
      "รับบริการ (คน)": sub.person_count,
      "จำนวน (ครั้ง)": sub.service_count,
      "การเบิกจ่าย (บาท)": Number(sub.amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
      }),
    }))
  );


  const calculateColumnWidths = (tableData) => {
    if (!tableData || tableData.length === 0) return [];
    const keys = Object.keys(tableData[0]);
    return keys.map((key) => ({
      wch: Math.max(key.length, ...tableData.map((item) => item[key]?.toString().length || 0)) + 2,
    }));
  };

  const exportToExcel = () => {
    if (!tableData || tableData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(tableData);
    worksheet["!cols"] = calculateColumnWidths(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, years);
    XLSX.writeFile(workbook, `PpFeeSchedule ปีงบประมาณ ${years}.xlsx`);
  };

  return (
    loading ? (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spinner animation="border" role="status" size='lg'>
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    ) : (
      <div className="page">
        <h1 className="page-title mb-1">PP Fee Schedule</h1>
        <p className="page-sub mb-3">ปีงบประมาณ {years}</p>
        <Row style={{ display: 'flex', alignItems: "center", justifyContent: "flex-end", marginBottom: '1rem' }}>
          <Col xs={12} sm={6} md={4} xl={3} xxl={2} className="mb-2 mb-md-0">
            <Button
              onClick={exportToExcel}
              variant="outline-success"
              style={{ width: "100%" }}
            >
              <FaFileExcel className="me-2" /> ส่งออก Excel
            </Button>
          </Col>
        </Row>
        <div className="panel table-responsive mb-4" >
          <table className="table table-bordered align-middle">
            <thead className="table-light">
              <tr>
                {tableHeaders.map((header, index) => (
                  <th
                    key={index}
                    className="text-center"
                    style={{
                      backgroundColor: header === "จัดการ" ? '#334155' : '#0d9488',
                      color: '#fff',
                      textAlign: 'center'
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((group, idx) =>
                  group.sub_activities.map((sub, i) => (
                    <tr key={`${idx}-${i}`}>
                      {i === 0 && (
                        <>
                          <td rowSpan={group.sub_activities.length} className="text-center align-middle">
                            {group.service_unit_code}
                          </td>
                          <td rowSpan={group.sub_activities.length} className="text-center align-middle">
                            {group.service_unit_name}
                          </td>
                          <td rowSpan={group.sub_activities.length} className="text-center align-middle">
                            {group.main_activity}
                          </td>
                        </>
                      )}
                      <td>{sub.sub_activity}</td>
                      <td className="text-center">{sub.person_count}</td>
                      <td className="text-center">{sub.service_count}</td>
                      <td className="text-center">
                        {Number(sub.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )
              ) : (
                <tr>
                  <td colSpan="7" className="text-center">
                    ไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    )
  )
}

export default PpFeeSchedule