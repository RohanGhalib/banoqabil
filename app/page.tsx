'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Search, UserPlus, Upload, Download, Database, Check, X, 
  AlertTriangle, ChevronLeft, ChevronRight, Filter, BookOpen, Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, Slot, COURSE_NAMES, PRIORITY_BADGES, PRIORITY_NAMES } from '@/lib/types';

export default function StudentDirectory() {
  // --- Data State ---
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    enrolled: 0,
    p1: 0,
    p2: 0,
    remaining: 0
  });

  // --- Filtering & Pagination State ---
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- Modals & Drawer State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTab, setAddTab] = useState<'manual' | 'upload'>('manual');
  const [enrollStudent, setEnrollStudent] = useState<Student | null>(null);
  const [timetableSlots, setTimetableSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // --- Manual Student Form State ---
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'Male' | 'Female'>('Male');
  const [formPriority, setFormPriority] = useState<number>(4);
  const [formInterviewed, setFormInterviewed] = useState<'Yes' | 'No'>('No');
  const [formDeposit, setFormDeposit] = useState<'Yes' | 'No'>('No');
  const [formStatus, setFormStatus] = useState('');
  const [formAlert, setFormAlert] = useState<{ type: 'ok' | 'warn'; msg: string } | null>(null);

  // --- Bulk Upload Excel State ---
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPriority, setUploadPriority] = useState<number>(1);
  const [uploadStatus, setUploadStatus] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [uploadAlert, setUploadAlert] = useState<{ type: 'ok' | 'warn'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Seeding Loading State ---
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccessMsg, setSeedSuccessMsg] = useState<string | null>(null);

  // --- Fetch Student Data ---
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(search)}&filter=${filter}&page=${page}&pageSize=${pageSize}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
        setTotalCount(data.totalCount);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Fetch Directory Statistics ---
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/students?filter=all&page=1&pageSize=1500');
      const data = await res.json();
      if (data.success) {
        const all: Student[] = data.students || [];
        const enrolled = all.filter(s => s.enrolled).length;
        const p1 = all.filter(s => s.priority === 1).length;
        const p2 = all.filter(s => s.priority === 2).length;
        
        setStats({
          total: data.totalCount,
          enrolled,
          p1,
          p2,
          remaining: data.totalCount - enrolled
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // Fetch when filters or page change
  useEffect(() => {
    fetchStudents();
  }, [search, filter, page]);

  // Fetch statistics on load
  useEffect(() => {
    fetchStats();
  }, [students]);

  // --- Trigger Database Seeding ---
  const triggerSeeding = async () => {
    if (!confirm('This will extract the 1,000+ student records from the raw HTML backup file and seed them into Firebase. Proceed?')) return;
    setIsSeeding(true);
    setSeedSuccessMsg(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedSuccessMsg(`🎉 Successfully seeded ${data.seededStudents} students & ${data.seededSlots} classes!`);
        fetchStudents();
        fetchStats();
      } else {
        alert(`Seeding failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Seeding error: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // --- Fetch Roster Slots for Enrollment ---
  const fetchSlotsForEnrollment = async () => {
    setSlotsLoading(true);
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      if (data.success) {
        setTimetableSlots(data.slots || []);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (enrollStudent) {
      fetchSlotsForEnrollment();
    }
  }, [enrollStudent]);

  // --- Handle Manual Student Submission ---
  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormAlert(null);

    if (!formId.trim() || !formName.trim() || !formGender) {
      setFormAlert({ type: 'warn', msg: 'Please enter Student ID, Name, and Gender.' });
      return;
    }

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formId,
          name: formName,
          gender: formGender,
          priority: formPriority,
          interviewed: formInterviewed,
          deposit: formDeposit,
          status: formStatus || 'Manually added'
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setFormAlert({ type: 'ok', msg: 'Student successfully added to directory!' });
        setFormId('');
        setFormName('');
        setFormStatus('');
        fetchStudents();
      } else {
        setFormAlert({ type: 'warn', msg: data.error || 'Failed to add student.' });
      }
    } catch (err) {
      setFormAlert({ type: 'warn', msg: 'A network error occurred.' });
    }
  };

  // --- Handle Excel / CSV Parsing ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setUploadStatus('Reading spreadsheet...');
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryString = event.target?.result;
        const workbook = XLSX.read(binaryString, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse rows as array of JSON objects
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (json.length < 2) {
          setUploadStatus('File appears to be empty.');
          return;
        }

        // Map column headers
        const header = json[0].map((h: any) => String(h).trim().toLowerCase());
        const idCol = header.findIndex((h: string) => h.includes('id') || h.includes('student'));
        const nameCol = header.findIndex((h: string) => h.includes('name'));
        const genderCol = header.findIndex((h: string) => h.includes('gender'));

        if (idCol === -1 || nameCol === -1) {
          setUploadStatus('Could not locate "Student ID" and "Name" columns.');
          return;
        }

        const mappedStudents = json.slice(1).map((row: any) => {
          const rawId = row[idCol];
          const rawName = row[nameCol];
          let rawGender = row[genderCol] || 'Male';

          // Standardize gender
          rawGender = String(rawGender).trim().toLowerCase();
          const gender = rawGender.startsWith('f') || rawGender.includes('female') ? 'Female' : 'Male';

          return {
            id: String(rawId || '').trim(),
            name: String(rawName || '').trim(),
            gender,
            priority: Number(uploadPriority) || 1,
            status: 'Excel Import'
          };
        }).filter(s => s.id && s.name);

        setParsedRows(mappedStudents);
        setUploadStatus(`${mappedStudents.length} students parsed successfully.`);
      } catch (err) {
        setUploadStatus('Error reading spreadsheet file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- Submit Bulk Merge Uploads ---
  const submitBulkMerge = async () => {
    setUploadAlert(null);
    if (!parsedRows.length) {
      setUploadAlert({ type: 'warn', msg: 'Please select a valid spreadsheet file first.' });
      return;
    }

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedRows)
      });
      const data = await res.json();
      if (data.success) {
        setUploadAlert({ type: 'ok', msg: data.message });
        setParsedRows([]);
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchStudents();
        setTimeout(() => setIsAddModalOpen(false), 2500);
      } else {
        setUploadAlert({ type: 'warn', msg: data.error || 'Bulk merge failed.' });
      }
    } catch (err) {
      setUploadAlert({ type: 'warn', msg: 'Bulk merge network error.' });
    }
  };

  // --- Toggle Student Enrollment Assignment ---
  const executeEnrollment = async (slot: Slot) => {
    if (!enrollStudent) return;

    // Gender rules check
    const studentGenderCode = enrollStudent.gender === 'Female' ? 'F' : 'M';
    if (slot.gender !== 'M+F' && slot.gender !== studentGenderCode) {
      const confirmOverride = confirm(`⚠️ Gender mismatch warning! This slot is reserved for "${slot.gender === 'F' ? 'Female' : 'Male'}" students, but you are enrolling a "${enrollStudent.gender}". Proceed anyway?`);
      if (!confirmOverride) return;
    }

    // Capacity limit check
    if (slot.enrolledCount && slot.enrolledCount >= slot.capacity) {
      const confirmFull = confirm('⚠️ Slot is full! This classroom has reached its maximum seat capacity. Enroll anyway and override capacity?');
      if (!confirmFull) return;
    }

    try {
      const res = await fetch(`/api/students/${enrollStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrolled: true,
          campusId: slot.campusId,
          roomId: slot.roomId,
          slotKey: slot.slotKey,
          courseCode: slot.course
        })
      });
      const data = await res.json();
      if (data.success) {
        setEnrollStudent(null);
        fetchStudents();
      } else {
        alert(`Enrollment failed: ${data.error}`);
      }
    } catch (err) {
      alert('Enrollment error occurred.');
    }
  };

  // --- Unenroll Student (Reset to general pool) ---
  const undoEnrollment = async (studentId: string) => {
    if (!confirm('Are you sure you want to un-enroll this student from their timetable slot?')) return;
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrolled: false
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchStudents();
      } else {
        alert(`Failed to un-enroll student: ${data.error}`);
      }
    } catch (err) {
      alert('Un-enrollment error occurred.');
    }
  };

  // --- Bulk Export to CSV ---
  const handleExport = () => {
    const rows = [['Sr.', 'Student ID', 'Name', 'Gender', 'Priority', 'Interviewed', 'Deposit', 'Batch 1', 'Status', 'Enrolled', 'Campus', 'Room', 'Class Code']];
    
    // Fetch all for export (we can just pull all in-memory from stats fetch or pull)
    fetch('/api/students?filter=all&page=1&pageSize=2000')
      .then(res => res.json())
      .then(data => {
        if (!data.success) return;
        const all: Student[] = data.students || [];
        all.forEach((s, i) => {
          rows.push([
            String(i + 1),
            s.id,
            s.name,
            s.gender,
            'P' + s.priority,
            s.interviewed,
            s.deposit,
            s.batch1,
            s.status,
            s.enrolled ? 'Yes' : 'No',
            s.campusId || '',
            s.roomId || '',
            s.courseCode || ''
          ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Bano_Qabil_Batch2_Database_Export.csv`;
        a.click();
      });
  };

  const getDayName = (key: string) => {
    const day = key.split('-')[0];
    if (day === '0') return 'Mon-Tue';
    if (day === '1') return 'Wed-Thu';
    return 'Sat-Sun';
  };

  const getSlotTime = (key: string) => {
    const idx = key.split('-')[1];
    if (idx === '0') return '09:00 AM - 11:00 AM';
    if (idx === '1') return '11:30 AM - 01:30 PM';
    if (idx === '2') return '02:00 PM - 04:00 PM';
    return '04:30 PM - 06:30 PM';
  };

  return (
    <div className="dashboard-grid">
      {/* Dynamic Database Seeding Notification / Trigger */}
      {stats.total === 0 && !loading && (
        <div className="alert alert-warning" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} />
            <div>
              <strong>Database is Empty!</strong>
              <p style={{ fontSize: '12px', opacity: 0.9 }}>Would you like to import the 1,000+ student database from your original Bano Qabil HTML file?</p>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ padding: '6px 12px', fontSize: '12px', background: '#D97706', borderColor: '#D97706' }}
            onClick={triggerSeeding}
            disabled={isSeeding}
          >
            {isSeeding ? 'Importing...' : '⚡ Seed Database Now'}
          </button>
        </div>
      )}

      {seedSuccessMsg && (
        <div className="alert alert-success">
          <Check size={20} />
          <span>{seedSuccessMsg}</span>
        </div>
      )}

      {/* ── Statistics Summary Row ── */}
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Student Directory</span>
          <span className="stat-value">{stats.total.toLocaleString()}</span>
          <span className="stat-sub">Registered Candidates</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Enrolled in Classes</span>
          <span className="stat-value" style={{ color: 'var(--green)' }}>{stats.enrolled.toLocaleString()}</span>
          <span className="stat-sub" style={{ fontWeight: 500 }}>
            {stats.total ? Math.round((stats.enrolled / stats.total) * 100) : 0}% seat utilization
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">P1 Ready</span>
          <span className="stat-value" style={{ color: 'var(--p1)' }}>{stats.p1.toLocaleString()}</span>
          <span className="stat-sub">Interviewed & Deposit Paid</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">P2 Priority</span>
          <span className="stat-value" style={{ color: 'var(--p2)' }}>{stats.p2.toLocaleString()}</span>
          <span className="stat-sub">Interview Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Remaining Candidates</span>
          <span className="stat-value">{stats.remaining.toLocaleString()}</span>
          <span className="stat-sub">Awaiting Slot Allocation</span>
        </div>
      </section>

      {/* ── Directory Search & Filter Panel ── */}
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">👥 Student Enrollment Directory</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <UserPlus size={16} />
              Add Student
            </button>
            <button className="btn" onClick={handleExport}>
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters and Inputs Row */}
        <div className="search-filters-bar">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              placeholder="Search by Name or Student ID..." 
              className="search-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filters-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '6px', fontSize: '13px', color: 'var(--text2)', fontWeight: 600 }}>
              <Filter size={14} />
              Filters:
            </div>
            {[
              { id: 'all', label: 'All Candidates' },
              { id: 'p1', label: 'P1 Priority' },
              { id: 'p2', label: 'P2 Priority' },
              { id: 'p3', label: 'P3 Priority' },
              { id: 'p4', label: 'P4 Priority' },
              { id: 'enrolled', label: 'Enrolled' },
              { id: 'male', label: 'Male' },
              { id: 'female', label: 'Female' }
            ].map(f => (
              <button 
                key={f.id} 
                className={`filter-btn ${filter === f.id ? 'active' : ''}`}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Counter */}
        <div style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: 600, marginBottom: '12px' }}>
          {totalCount.toLocaleString()} candidates matched
        </div>

        {/* Student Table */}
        <div className="table-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Loading students directory...</div>
          ) : !students.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed var(--border)' }}>
              No candidates found matching filters.
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Priority</th>
                  <th>Status Notes</th>
                  <th>Enrollment Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {((page - 1) * pageSize) + idx + 1}
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--primary)' }}>
                      {s.id}
                    </td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td>
                      <span className={`g-badge ${s.gender.toLowerCase()}`}>
                        {s.gender === 'Male' ? '♂ Male' : '♀ Female'}
                      </span>
                    </td>
                    <td>
                      <span className={`p-badge ${PRIORITY_BADGES[s.priority] || 'p3-badge'}`}>
                        P{s.priority}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {s.status}
                    </td>
                    <td>
                      {s.enrolled ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button 
                            className="enroll-action-btn enrolled"
                            onClick={() => undoEnrollment(s.id)}
                            title="Click to un-enroll"
                          >
                            ✓ Enrolled
                          </button>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>
                            {s.campusId === 'ds' ? 'Darussalam' : 'Islamic Center'} · {s.roomId?.split('-')[1].toUpperCase()} · {s.courseCode}
                          </div>
                        </div>
                      ) : (
                        <button 
                          className="enroll-action-btn"
                          onClick={() => setEnrollStudent(s)}
                        >
                          Enroll in Class
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Dynamic Pagination Control */}
        {totalPages > 1 && (
          <div className="pagination-container">
            <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 500 }}>
              Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount.toLocaleString()} candidates)
            </span>
            <div className="page-btn-group">
              <button 
                className="page-btn" 
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </button>
              
              {/* Intelligent page subsetting */}
              {Array.from({ length: totalPages }).map((_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span style={{ padding: '0 4px', color: 'var(--text3)' }}>…</span>}
                      <button 
                        className={`page-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button 
                className="page-btn" 
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Add / Upload Student Modal ── */}
      <div className={`modal-overlay ${isAddModalOpen ? 'open' : ''}`}>
        <div className="modal-card">
          <div className="modal-header">
            <h3 className="modal-title">➕ Add Candidates to Directory</h3>
            <button className="modal-close" onClick={() => { setIsAddModalOpen(false); setFormAlert(null); setUploadAlert(null); }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <button 
              className={`nav-link ${addTab === 'manual' ? 'active' : ''}`}
              style={{ flex: 1, padding: '12px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              onClick={() => setAddTab('manual')}
            >
              👤 Manual Entry
            </button>
            <button 
              className={`nav-link ${addTab === 'upload' ? 'active' : ''}`}
              style={{ flex: 1, padding: '12px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              onClick={() => setAddTab('upload')}
            >
              📊 Upload Spreadsheet (Excel/CSV)
            </button>
          </div>

          <div className="modal-body">
            {addTab === 'manual' ? (
              <form onSubmit={handleAddManual}>
                {formAlert && (
                  <div className={`alert ${formAlert.type === 'ok' ? 'alert-success' : 'alert-error'}`}>
                    {formAlert.type === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />}
                    <span>{formAlert.msg}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Student ID *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 504914" 
                    className="form-input"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Candidate Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Saleha Bibi" 
                    className="form-input"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select className="form-select" value={formGender} onChange={(e) => setFormGender(e.target.value as any)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority Level</label>
                    <select className="form-select" value={formPriority} onChange={(e) => setFormPriority(Number(e.target.value))}>
                      <option value={1}>P1 - Ready (Passed + Deposit)</option>
                      <option value={2}>P2 - Interview Completed</option>
                      <option value={3}>P3 - Test Passed</option>
                      <option value={4}>P4 - New Registration</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Interview Completed?</label>
                    <select className="form-select" value={formInterviewed} onChange={(e) => setFormInterviewed(e.target.value as any)}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deposit Verified?</label>
                    <select className="form-select" value={formDeposit} onChange={(e) => setFormDeposit(e.target.value as any)}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status Details</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Test + Interview + Deposit" 
                    className="form-input"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                  />
                </div>

                <div className="modal-footer" style={{ padding: '16px 0 0 0', background: 'transparent' }}>
                  <button type="button" className="btn" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Candidate</button>
                </div>
              </form>
            ) : (
              <div>
                {uploadAlert && (
                  <div className={`alert ${uploadAlert.type === 'ok' ? 'alert-success' : 'alert-error'}`}>
                    {uploadAlert.type === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />}
                    <span>{uploadAlert.msg}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Target Priority Level for Uploaded List</label>
                  <select 
                    className="form-select" 
                    value={uploadPriority} 
                    onChange={(e) => setUploadPriority(Number(e.target.value))}
                    style={{ marginBottom: '16px' }}
                  >
                    <option value={1}>P1 - Ready list</option>
                    <option value={2}>P2 - Interview list</option>
                    <option value={3}>P3 - Passed list</option>
                    <option value={4}>P4 - Registered list</option>
                  </select>
                </div>

                <input 
                  type="file" 
                  accept=".csv, .xlsx, .xls" 
                  style={{ display: 'none' }} 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />

                <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
                  <div className="upload-icon-container">
                    <Upload size={24} />
                  </div>
                  <div>
                    <strong>Click to select spreadsheet file</strong>
                    <p className="upload-text">Supports Excel (.xlsx, .xls) and CSV (.csv) lists</p>
                  </div>
                  {uploadFile && <span className="upload-filename">📄 {uploadFile.name}</span>}
                </div>

                {uploadStatus && (
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)', marginTop: '12px', textAlign: 'center' }}>
                    {uploadStatus}
                  </div>
                )}

                <div className="modal-footer" style={{ padding: '24px 0 0 0', background: 'transparent' }}>
                  <button type="button" className="btn" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={submitBulkMerge}
                    disabled={!parsedRows.length}
                  >
                    🚀 Merge Spreadsheet Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Class Enrollment Slot Allocator Drawer ── */}
      <div className={`drawer-overlay ${enrollStudent ? 'open' : ''}`}>
        <div className="drawer-panel">
          <div className="drawer-header">
            <div>
              <h3 className="modal-title" style={{ fontSize: '17px' }}>🏫 Slot Allocator</h3>
              <p style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 500, marginTop: '2px' }}>
                Select a class schedule for {enrollStudent?.name}
              </p>
            </div>
            <button className="modal-close" onClick={() => setEnrollStudent(null)}>
              <X size={18} />
            </button>
          </div>

          <div className="drawer-body">
            {enrollStudent && (
              <div className="alert alert-info" style={{ display: 'block', fontSize: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Candidate Details:</div>
                <div>📌 <strong>ID</strong>: {enrollStudent.id}</div>
                <div>👤 <strong>Gender</strong>: {enrollStudent.gender}</div>
                <div>⚡ <strong>Priority</strong>: {PRIORITY_NAMES[enrollStudent.priority]}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available Scheduled Slots
              </div>

              {slotsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: '13px' }}>Loading timetable classes...</div>
              ) : !timetableSlots.length ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: '13px' }}>No classrooms slots seeded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
                  {/* Separate ds and ic slots for structured presentation */}
                  {['ds', 'ic'].map(campus => {
                    const campusName = campus === 'ds' ? 'Darussalam Campus' : 'Islamic Center';
                    const campusSlots = timetableSlots.filter(s => s.campusId === campus);
                    
                    if (!campusSlots.length) return null;

                    return (
                      <div key={campus} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', background: '#F1F5F9', padding: '4px 8px', borderRadius: '4px' }}>
                          {campusName}
                        </div>
                        {campusSlots.map(slot => {
                          const courseName = COURSE_NAMES[slot.course] || slot.course;
                          const filledPercent = slot.capacity ? Math.round(((slot.enrolledCount || 0) / slot.capacity) * 100) : 0;
                          
                          // Capacity Color code
                          let capColor = 'ok';
                          if (filledPercent >= 100) capColor = 'full';
                          else if (filledPercent >= 85) capColor = 'warning';

                          const studentGenderCode = enrollStudent?.gender === 'Female' ? 'F' : 'M';
                          const isGenderMatch = slot.gender === 'M+F' || slot.gender === studentGenderCode;

                          return (
                            <div 
                              key={slot.id} 
                              className={`slot-card occupied ${slot.gender.toLowerCase()}-slot`}
                              style={{ height: 'auto', gap: '8px', cursor: 'pointer', borderColor: isGenderMatch ? '' : '#E2E8F0' }}
                              onClick={() => executeEnrollment(slot)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                                    {courseName}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <BookOpen size={11} /> {slot.roomId.split('-')[1].toUpperCase()}
                                    <Clock size={11} style={{ marginLeft: '6px' }} /> {getDayName(slot.slotKey)} · {getSlotTime(slot.slotKey).split(' ')[0]}
                                  </div>
                                </div>
                                <span className={`slot-gender-marker ${slot.gender.toLowerCase()}`}>
                                  {slot.gender === 'M' ? 'Male Only' : slot.gender === 'F' ? 'Female Only' : 'Mixed (M+F)'}
                                </span>
                              </div>

                              <div className="slot-progress-container">
                                <div className="slot-progress-text">
                                  <span>Seats Filled</span>
                                  <strong>{slot.enrolledCount || 0} / {slot.capacity}</strong>
                                </div>
                                <div className="slot-progress-bar">
                                  <div 
                                    className={`slot-progress-fill ${capColor}`}
                                    style={{ width: `${Math.min(filledPercent, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
