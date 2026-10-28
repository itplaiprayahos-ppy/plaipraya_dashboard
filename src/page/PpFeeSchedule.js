import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Button, Col, Row, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaFileExcel } from 'react-icons/fa';
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

function PpFeeSchedule() {
  const { years } = useParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isValid, setIsValid] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [role, setRole] = useState(null);
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
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
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
          console.log("ไม่พบข้อมูลปีนี้");
          setData([]);
        }
      } catch (error) {
        console.error("Error fetching PPFee data:", error);
        setData([]);
      } finally {
        setTimeout(() => setLoading(false), 500);
      }
    };

    fetchData();
  }, [years]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checkAuth`, {
          withCredentials: true
        });
        if (res.data.loggedIn && res.data.username) {
          setRole(res.data.role)
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          return
        }
        // console.error("Auth check failed:", error);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const checkYear = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/years`);
        const found = res.data.find(
          (item) => String(item.year) === String(years) && item.status === "active"
        );

        if (!found) {
          navigate("*", { replace: true });
        } else {
          setIsValid(true);
        }
      } catch (err) {
        console.error(err);
        navigate("*", { replace: true });
      }
    };

    checkYear();
  }, [years, navigate]);

  if (isValid === null) return <div>กำลังตรวจสอบข้อมูล...</div>;

  const groupedData = data.reduce((acc, curr) => {
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
    if (!tableData.length) return;

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    worksheet["!cols"] = calculateColumnWidths(tableData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, years);
    XLSX.writeFile(workbook, `PpFeeSchedule_${years}.xlsx`);
  };

  const handleEditChange = (id, field, value) => {
    setEditedData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    try {
      const updates = Object.keys(editedData).map(async (id) => {
        await axios.put(
          `${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${id}`,
          editedData[id]
        );
      });

      await Promise.all(updates);

      Swal.fire({
        icon: "success",
        title: "บันทึกข้อมูลสำเร็จ",
        timer: 1500,
        showConfirmButton: false,
      });

      setIsEditMode(false);
      setEditedData({});
      window.location.reload();

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
      });
    }
  };


  return loading ? (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <Spinner animation="border" />
    </div>
  ) : (
    <div className="container mt-4">

      {/* ✅ ปุ่มแก้ไข / ยกเลิก / บันทึก */}
      <Row className="mb-3" style={{ justifyContent: "space-between" }}>
        <Col xs="auto">
          {(role === "superadmin" || role === "admin") && (
            !isEditMode ? (
              <Button variant="warning" onClick={() => setIsEditMode(true)} style={{ color: '#FFF' }}>
                แก้ไขข้อมูล
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditMode(false);
                    setEditedData({});
                  }}
                >
                  ยกเลิกการแก้ไข
                </Button>

                <Button
                  variant="success"
                  className="ms-2"
                  onClick={handleSaveAll}
                >
                  บันทึกข้อมูล
                </Button>
              </>
            )
          )}

        </Col>

        <Col xs="auto">
          <Button onClick={exportToExcel} variant="outline-success">
            <FaFileExcel className="me-2" /> ส่งออก Excel
          </Button>
        </Col>
      </Row>

      {/* ✅ ตารางข้อมูล */}
      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead className="table-light">
            <tr>
              {tableHeaders.map((header, index) => (
                <th
                  key={index}
                  className="text-center"
                  style={{ backgroundColor: '#0d9488', color: '#fff' }}
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

                    {/* กิจกรรมย่อย */}
                    <td>{sub.sub_activity}</td>

                    {/* รับบริการ */}
                    <td className="text-center">
                      {isEditMode ? (
                        <input
                          type="number"
                          className="form-control text-center"
                          defaultValue={sub.person_count}
                          onChange={(e) =>
                            handleEditChange(sub.id, "person_count", Number(e.target.value))
                          }
                        />
                      ) : (
                        sub.person_count
                      )}
                    </td>

                    {/* จำนวนครั้ง */}
                    <td className="text-center">
                      {isEditMode ? (
                        <input
                          type="number"
                          className="form-control text-center"
                          defaultValue={sub.service_count}
                          onChange={(e) =>
                            handleEditChange(sub.id, "service_count", Number(e.target.value))
                          }
                        />
                      ) : (
                        sub.service_count
                      )}
                    </td>

                    {/* การเบิกจ่าย */}
                    <td className="text-center">
                      {isEditMode ? (
                        <input
                          type="number"
                          className="form-control text-center"
                          defaultValue={sub.amount}
                          onChange={(e) =>
                            handleEditChange(sub.id, "amount", Number(e.target.value))
                          }
                        />
                      ) : (
                        Number(sub.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                      )}
                    </td>
                  </tr>
                ))
              )
            ) : (
              <tr>
                <td colSpan="7" className="text-center">ไม่มีข้อมูล</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default PpFeeSchedule;
