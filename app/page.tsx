'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

const PBADGE: Record<number,string> = {1:'p1-b',2:'p2-b',3:'p3-b',4:'p4-b'};
const PNAMES: Record<number,string> = {1:'P1',2:'P2',3:'P3',4:'P4'};

type Student = {
  id:string; name:string; gender:string; interviewed:string; deposit:string;
  batch1:string; priority:number; status:string; enrolled:boolean;
  campusId?:string; roomId?:string; slotKey?:string; courseCode?:string;
};

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'search'|'enrolled'>('search');
  const [addModal, setAddModal] = useState(false);
  const [addTab, setAddTab] = useState<'manual'|'upload'>('manual');
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState('Male');
  const [formPriority, setFormPriority] = useState(4);
  const [formIv, setFormIv] = useState('No');
  const [formDp, setFormDp] = useState('No');
  const [formStatus, setFormStatus] = useState('');
  const [formAlert, setFormAlert] = useState<{type:'ok'|'warn',msg:string}|null>(null);
  const [uploadFiles, setUploadFiles] = useState<Record<number,{file:File,rows:any[]}>>({});
  const [uploadAlert, setUploadAlert] = useState<{type:'ok'|'warn',msg:string}|null>(null);
  const [stats, setStats] = useState({total:0,enrolled:0,p1:0,p2:0,remaining:0});
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [enrollStudent, setEnrollStudent] = useState<Student | null>(null);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const PAGE_SIZE = 50;

  const fetchStudents = useCallback(async (s=search,f=filter,p=page) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/students?search=${encodeURIComponent(s)}&filter=${f}&page=${p}&pageSize=${PAGE_SIZE}`);
      const d = await r.json();
      if(d.success){setStudents(d.students);setTotalCount(d.totalCount);setTotalPages(d.totalPages);}
    } finally { setLoading(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    const [all,enr,p1,p2] = await Promise.all([
      fetch('/api/students?pageSize=1').then(r=>r.json()),
      fetch('/api/students?filter=enrolled&pageSize=1').then(r=>r.json()),
      fetch('/api/students?filter=p1&pageSize=1').then(r=>r.json()),
      fetch('/api/students?filter=p2&pageSize=1').then(r=>r.json()),
    ]);
    setStats({total:all.totalCount||0,enrolled:enr.totalCount||0,p1:p1.totalCount||0,p2:p2.totalCount||0,remaining:(all.totalCount||0)-(enr.totalCount||0)});
  }, []);

  const fetchEnrolled = useCallback(async () => {
    const r = await fetch('/api/students?filter=enrolled&pageSize=200');
    const d = await r.json();
    if(d.success) setEnrolledStudents(d.students);
  }, []);

  const fetchTimetableSlots = useCallback(async () => {
    try {
      const r = await fetch('/api/slots');
      const d = await r.json();
      if (d.success) setTimetableSlots(d.slots);
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  }, []);

  useEffect(()=>{ fetchStudents(); fetchStats(); fetchTimetableSlots(); },[]);
  useEffect(()=>{ if(tab==='enrolled') fetchEnrolled(); },[tab]);

  const onSearch = (v:string) => {
    setSearch(v);
    if(debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{setPage(1);fetchStudents(v,filter,1);},400);
  };

  const setFilterAndFetch = (f:string) => { setFilter(f);setPage(1);fetchStudents(search,f,1); };
  const goPage = (p:number) => { setPage(p);fetchStudents(search,filter,p); };

  const executeEnrollment = async (slot: any) => {
    if (!enrollStudent) return;
    const enrolledCount = slot.enrolledCount || 0;
    if (enrolledCount >= slot.capacity) {
      if (!confirm(`Warning: This class is already full (${enrolledCount}/${slot.capacity} seats). Do you want to override and enroll anyway?`)) {
        return;
      }
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
        fetchStats();
        fetchTimetableSlots();
        if (tab === 'enrolled') fetchEnrolled();
      } else {
        alert(`Failed to enroll student: ${data.error}`);
      }
    } catch (err) {
      alert('An error occurred during enrollment.');
    }
  };

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
        fetchStats();
        fetchTimetableSlots();
        if (tab === 'enrolled') fetchEnrolled();
      } else {
        alert(`Failed to un-enroll: ${data.error}`);
      }
    } catch (err) {
      alert('An error occurred during un-enrollment.');
    }
  };

  const addManual = async () => {
    if(!formId||!formName||!formGender){setFormAlert({type:'warn',msg:'ID, Name and Gender are required.'});return;}
    const r = await fetch('/api/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:formId,name:formName,gender:formGender,priority:formPriority,interviewed:formIv,deposit:formDp,status:formStatus||'Manually added'})});
    const d = await r.json();
    if(d.success){setFormAlert({type:'ok',msg:'Student added!'});setFormId('');setFormName('');fetchStudents();fetchStats();}
    else setFormAlert({type:'warn',msg:d.error||'Failed'});
  };

  const handleUploadFile = async (e:React.ChangeEvent<HTMLInputElement>, priority:number) => {
    const file = e.target.files?.[0]; if(!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf); const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws);
    const rows = raw.map(r=>({
      id: String(r['Student ID']||r['id']||'').trim(),
      name: String(r['Student Name']||r['Name']||r['name']||'').trim(),
      gender: String(r['Gender']||r['gender']||'Male').trim(),
      priority, interviewed:'No', deposit:'No', batch1:'No', status:`P${priority} Upload`,
    })).filter(r=>r.id&&r.name);
    setUploadFiles(prev=>({...prev,[priority]:{file,rows}}));
  };

  const mergeUploads = async () => {
    const all = Object.values(uploadFiles).flatMap(u=>u.rows);
    if(!all.length){setUploadAlert({type:'warn',msg:'No valid rows found.'});return;}
    const r = await fetch('/api/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(all)});
    const d = await r.json();
    if(d.success){setUploadAlert({type:'ok',msg:`Added ${d.added}, ${d.duplicates} duplicates skipped.`});fetchStudents();fetchStats();}
    else setUploadAlert({type:'warn',msg:d.error||'Upload failed'});
  };

  const downloadExcel = () => {
    if(!students.length) return;
    const ws = XLSX.utils.json_to_sheet(students);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Students');
    XLSX.writeFile(wb,'bano_qabil_students.xlsx');
  };

  const maleEnrolled = enrolledStudents.filter(s=>s.gender==='Male');
  const femaleEnrolled = enrolledStudents.filter(s=>s.gender==='Female');

  const renderPagination = () => {
    if(totalPages<=1) return null;
    const pages:number[] = [];
    for(let i=Math.max(1,page-2);i<=Math.min(totalPages,page+2);i++) pages.push(i);
    return (
      <div className="pagination">
        <button className="page-btn" disabled={page===1} onClick={()=>goPage(page-1)}>‹</button>
        {pages[0]>1&&<><button className="page-btn" onClick={()=>goPage(1)}>1</button><span style={{padding:'0 4px',color:'var(--text3)'}}>…</span></>}
        {pages.map(p=><button key={p} className={`page-btn${p===page?' active':''}`} onClick={()=>goPage(p)}>{p}</button>)}
        {pages[pages.length-1]<totalPages&&<><span style={{padding:'0 4px',color:'var(--text3)'}}>…</span><button className="page-btn" onClick={()=>goPage(totalPages)}>{totalPages}</button></>}
        <button className="page-btn" disabled={page===totalPages} onClick={()=>goPage(page+1)}>›</button>
        <span className="page-info">{totalCount.toLocaleString()} students</span>
      </div>
    );
  };

  return (
    <>
      <header>
        <div className="logo">
          <div className="logo-box"><svg viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg></div>
          <div><div className="logo-text">Bano Qabil — Batch 2</div><div className="logo-sub">Enrollment Manager</div></div>
        </div>
        <div className="hdr-btns">
          <Link href="/timetable" className="btn">🗓 Timetable</Link>
          <button className="btn" onClick={()=>setAddModal(true)}>+ Add Students</button>
          <button className="btn btn-green" onClick={downloadExcel}>↓ Download Excel</button>
        </div>
      </header>

      <div className="nav">
        <div className={`nav-tab${tab==='search'?' active':''}`} onClick={()=>setTab('search')}>Search &amp; Enroll</div>
        <div className={`nav-tab${tab==='enrolled'?' active':''}`} onClick={()=>setTab('enrolled')}>Enrolled Students</div>
      </div>

      <div className="main">
        {/* SEARCH TAB */}
        <div id="tab-search" className={`tab-section${tab==='search'?' active':''}`}>
          <div className="stats" id="stats-bar">
            {[
              {lbl:'Total Students',val:stats.total.toLocaleString(),sub:'all priorities'},
              {lbl:'P1 — Priority',val:stats.p1.toLocaleString(),sub:'deposit paid'},
              {lbl:'Enrolled',val:stats.enrolled.toLocaleString(),sub:'assigned to class'},
              {lbl:'Remaining',val:stats.remaining.toLocaleString(),sub:'not yet enrolled'},
              {lbl:'P2 Batch1/IV',val:stats.p2.toLocaleString(),sub:'interviewed'},
            ].map(s=>(
              <div className="stat" key={s.lbl}>
                <div className="stat-lbl">{s.lbl}</div>
                <div className="stat-val">{s.val}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="search-wrap">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="search-input" type="text" placeholder="Search by Student ID or Name..." value={search} onChange={e=>onSearch(e.target.value)}/>
            {search&&<button className="search-clear" onClick={()=>{setSearch('');fetchStudents('',filter,1);}}>✕</button>}
          </div>

          <div className="filters">
            {[
              {k:'all',label:'All',cls:'f-all'},
              {k:'p1',label:'P1 — Deposit Paid',cls:'f-p1'},
              {k:'p2',label:'P2 — Batch 1 / Interviewed',cls:'f-p2'},
              {k:'p3',label:'P3 — Test Only',cls:'f-p3'},
              {k:'p4',label:'P4 — New',cls:'f-p4'},
            ].map(f=>(
              <button key={f.k} className={`filter-btn ${f.cls}${filter===f.k?' active':''}`} onClick={()=>setFilterAndFetch(f.k)}>{f.label}</button>
            ))}
            <div className="filter-sep"/>
            <button className={`filter-btn f-enrolled${filter==='enrolled'?' active':''}`} onClick={()=>setFilterAndFetch('enrolled')}>Enrolled</button>
            <div className="filter-sep"/>
            <button className={`filter-btn f-male${filter==='male'?' active':''}`} onClick={()=>setFilterAndFetch('male')}>Male</button>
            <button className={`filter-btn f-female${filter==='female'?' active':''}`} onClick={()=>setFilterAndFetch('female')}>Female</button>
            <span className="results-count">{loading?'Loading…':`${totalCount.toLocaleString()} results`}</span>
          </div>

          <div className="table-wrap">
            <div className="table-scroll">
              <table>
                <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Gender</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
                <tbody id="table-body">
                  {loading ? (
                    <tr><td colSpan={7} style={{textAlign:'center',padding:'3rem',color:'var(--text3)'}}>Loading…</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan={7} style={{textAlign:'center',padding:'3rem',color:'var(--text3)'}}>No students found.</td></tr>
                  ) : students.map((s,i)=>(
                    <tr key={s.id}>
                      <td style={{textAlign:'center',color:'var(--text3)',fontSize:'12px'}}>{(page-1)*PAGE_SIZE+i+1}</td>
                      <td><span className="sid">{s.id}</span></td>
                      <td style={{fontWeight:500}}>{s.name}</td>
                      <td><span className={`g-badge ${s.gender==='Male'?'g-m':'g-f'}`}>{s.gender}</span></td>
                      <td><span className={`p-badge ${PBADGE[s.priority]}`}>{PNAMES[s.priority]}</span></td>
                      <td style={{fontSize:'12px',color:'var(--text2)'}}>{s.status}</td>
                      <td>
                        {s.enrolled ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              className="enroll-btn enrolled" 
                              onClick={() => undoEnrollment(s.id)}
                              title="Click to un-enroll"
                            >
                              ✓ Enrolled
                            </button>
                            <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                              {s.campusId?.toUpperCase()} · {s.roomId?.split('-')[1]?.toUpperCase()} · {s.courseCode}
                            </span>
                          </div>
                        ) : (
                          <button className="enroll-btn" onClick={() => setEnrollStudent(s)}>
                            Enroll in Class
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {renderPagination()}
        </div>

        {/* ENROLLED TAB */}
        <div id="tab-enrolled" className={`tab-section${tab==='enrolled'?' active':''}`}>
          <div className="stats" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:'1.5rem'}}>
            {[
              {lbl:'Total Enrolled',val:enrolledStudents.length.toLocaleString()},
              {lbl:'Male',val:maleEnrolled.length.toLocaleString()},
              {lbl:'Female',val:femaleEnrolled.length.toLocaleString()},
              {lbl:'% Enrolled',val:`${stats.total?Math.round(enrolledStudents.length/stats.total*100):0}%`},
            ].map(s=>(
              <div className="stat" key={s.lbl}><div className="stat-lbl">{s.lbl}</div><div className="stat-val">{s.val}</div></div>
            ))}
          </div>

          <div className="enr-grid">
            {[{label:'Male Enrolled',cls:'male',data:maleEnrolled},{label:'Female Enrolled',cls:'female',data:femaleEnrolled}].map(g=>(
              <div className="enr-card" key={g.cls}>
                <div className={`enr-card-hdr ${g.cls}`}>{g.label} <span style={{fontWeight:400,fontSize:'12px'}}>({g.data.length})</span></div>
                <div className="enr-list">
                  {g.data.length===0?<div style={{padding:'1rem',color:'var(--text3)',fontSize:'13px'}}>None enrolled yet.</div>:
                    g.data.map(s=>(
                      <div className="enr-item" key={s.id}>
                        <div><div className="enr-name">{s.name}</div><div className="enr-meta">{s.id} · {PNAMES[s.priority]} · {s.campusId?.toUpperCase()} · {s.roomId?.split('-')[1]?.toUpperCase()} · {s.courseCode}</div></div>
                        <button className="enroll-btn enrolled" style={{fontSize:'11px'}} onClick={() => undoEnrollment(s.id)}>Unenroll</button>
                      </div>
                    ))
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <div className="table-scroll">
              <table>
                <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Gender</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {enrolledStudents.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:'3rem',color:'var(--text3)'}}>No enrolled students yet.</td></tr>:
                    enrolledStudents.map((s,i)=>(
                      <tr key={s.id}>
                        <td style={{textAlign:'center',color:'var(--text3)',fontSize:'12px'}}>{i+1}</td>
                        <td><span className="sid">{s.id}</span></td>
                        <td style={{fontWeight:500}}>{s.name}</td>
                        <td><span className={`g-badge ${s.gender==='Male'?'g-m':'g-f'}`}>{s.gender}</span></td>
                        <td><span className={`p-badge ${PBADGE[s.priority]}`}>{PNAMES[s.priority]}</span></td>
                        <td style={{fontSize:'12px',color:'var(--text2)'}}>{s.campusId?.toUpperCase()} · {s.roomId?.split('-')[1]?.toUpperCase()} · {s.courseCode}</td>
                        <td><button className="enroll-btn enrolled" onClick={() => undoEnrollment(s.id)}>Unenroll</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ADD STUDENTS MODAL */}
      {addModal&&(
        <div className="overlay open" onClick={e=>{if(e.target===e.currentTarget)setAddModal(false);}}>
          <div className="modal">
            <button className="modal-close" onClick={()=>setAddModal(false)}>✕</button>
            <div className="modal-title">Add Students</div>
            <div className="modal-sub">Add a single student manually or upload an Excel file.</div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <button className={`filter-btn${addTab==='manual'?' active':''}`} onClick={()=>setAddTab('manual')}>Manual Entry</button>
              <button className={`filter-btn${addTab==='upload'?' active':''}`} onClick={()=>setAddTab('upload')}>Upload Excel</button>
            </div>
            {addTab==='manual'&&(
              <div>
                {formAlert&&<div className={`alert alert-${formAlert.type==='ok'?'ok':'warn'}`}>{formAlert.msg}</div>}
                <div className="field-row">
                  <div className="field"><label>Student ID *</label><input type="text" value={formId} onChange={e=>setFormId(e.target.value)} placeholder="e.g. 512345"/></div>
                  <div className="field"><label>Full Name *</label><input type="text" value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Muhammad Ali"/></div>
                </div>
                <div className="field-row">
                  <div className="field"><label>Gender *</label>
                    <select value={formGender} onChange={e=>setFormGender(e.target.value)}>
                      <option value="Male">Male</option><option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="field"><label>Priority</label>
                    <select value={formPriority} onChange={e=>setFormPriority(Number(e.target.value))}>
                      <option value={1}>P1 — Deposit Paid</option><option value={2}>P2 — Batch 1 / Interviewed</option>
                      <option value={3}>P3 — Test Only</option><option value={4}>P4 — New</option>
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field"><label>Interviewed?</label>
                    <select value={formIv} onChange={e=>setFormIv(e.target.value)}><option>No</option><option>Yes</option></select>
                  </div>
                  <div className="field"><label>Deposit Paid?</label>
                    <select value={formDp} onChange={e=>setFormDp(e.target.value)}><option>No</option><option>Yes</option></select>
                  </div>
                </div>
                <div className="field"><label>Status / Notes</label><input type="text" value={formStatus} onChange={e=>setFormStatus(e.target.value)} placeholder="e.g. Walk-in registration"/></div>
                <div className="modal-actions"><button className="btn" onClick={()=>setAddModal(false)}>Cancel</button><button className="btn btn-green" onClick={addManual}>Add Student</button></div>
              </div>
            )}
            {addTab==='upload'&&(
              <div>
                <div className="alert alert-warn">Excel must have columns: <strong>Student ID</strong> and <strong>Student Name</strong>. Gender optional.</div>
                {uploadAlert&&<div className={`alert alert-${uploadAlert.type==='ok'?'ok':'warn'}`}>{uploadAlert.msg}</div>}
                <div className="upload-sections">
                  {[{p:1,lbl:'P1 — Deposit Paid',cls:'p1'},{p:2,lbl:'P2 — Batch 1',cls:'p2'},{p:3,lbl:'P3 — Test Only',cls:'p3'}].map(({p,lbl,cls})=>(
                    <div className="upload-section" key={p}>
                      <div className={`upload-section-lbl ${cls}`}>{lbl}</div>
                      <label className="upload-btn" style={{display:'block',padding:'6px 12px',borderRadius:'6px',border:'1px solid var(--border2)',background:'var(--bg)',cursor:'pointer',fontSize:'12px',textAlign:'center',marginBottom:6}}>
                        {uploadFiles[p]?`✓ ${uploadFiles[p].file.name.substring(0,20)}…`:'Choose file'}
                        <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleUploadFile(e,p)}/>
                      </label>
                      {uploadFiles[p]&&<div className="upload-status">{uploadFiles[p].rows.length} rows</div>}
                    </div>
                  ))}
                </div>
                <div className="modal-actions"><button className="btn" onClick={()=>setAddModal(false)}>Cancel</button><button className="btn btn-green" onClick={mergeUploads}>Merge &amp; Add</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SLOT ALLOCATOR DRAWER */}
      <div className={`drawer-overlay${enrollStudent ? ' open' : ''}`} onClick={e=>{if(e.target===e.currentTarget)setEnrollStudent(null);}}>
        <div className="drawer-panel">
          <div className="drawer-header">
            <div>
              <div className="modal-title">🏫 Slot Allocator</div>
              <div className="modal-sub" style={{marginBottom:0}}>Select a class schedule for {enrollStudent?.name}</div>
            </div>
            <button className="modal-close" onClick={()=>setEnrollStudent(null)}>✕</button>
          </div>
          <div className="drawer-body">
            {enrollStudent && (
              <div className="alert alert-info">
                <div style={{fontWeight:600,marginBottom:4}}>Candidate Details:</div>
                <div>📌 ID: {enrollStudent.id}</div>
                <div>👤 Gender: {enrollStudent.gender}</div>
                <div>⚡ Priority: {PNAMES[enrollStudent.priority]}</div>
              </div>
            )}
            
            {['ds', 'ic'].map(campusKey => {
              const campusName = campusKey === 'ds' ? 'Darussalam Campus' : 'Islamic Center';
              const campusSlots = timetableSlots.filter(s => s.campusId === campusKey);
              
              return (
                <div key={campusKey}>
                  <div className="drawer-section-title">{campusName}</div>
                  {campusSlots.length === 0 ? (
                    <div style={{fontSize:'12px',color:'var(--text3)',padding:'4px 0'}}>No slots configured.</div>
                  ) : (
                    <div className="drawer-slots-list">
                      {campusSlots.map(slot => {
                        const filledPct = slot.capacity ? Math.round((slot.enrolledCount / slot.capacity) * 100) : 0;
                        const reqGender = enrollStudent?.gender === 'Female' ? 'F' : 'M';
                        const isGenderMatch = slot.gender === 'M+F' || slot.gender === reqGender;
                        
                        return (
                          <div 
                            key={slot.id} 
                            className="drawer-slot-card"
                            style={{
                              opacity: isGenderMatch ? 1 : 0.5,
                              borderColor: isGenderMatch ? 'var(--border2)' : 'var(--border)'
                            }}
                            onClick={() => {
                              if (!isGenderMatch) {
                                if (!confirm(`Warning: This slot is designated for ${slot.gender} students, but the candidate is ${enrollStudent?.gender}. Enroll anyway?`)) {
                                  return;
                                }
                              }
                              executeEnrollment(slot);
                            }}
                          >
                            <div className="drawer-slot-header">
                              <div>
                                <div className="drawer-slot-title" style={{color: isGenderMatch ? 'var(--text)' : 'var(--text3)'}}>
                                  {slot.roomId.split('-')[1].toUpperCase()} · {slot.course}
                                </div>
                                <div className="drawer-slot-meta">
                                  Slot: {slot.slotKey.split('-').join(', ')} · Capacity: {slot.capacity} · Gender: {slot.gender}
                                </div>
                              </div>
                              <span className={`g-badge ${slot.gender === 'M' ? 'g-m' : slot.gender === 'F' ? 'g-f' : ''}`} style={{background: slot.gender==='M+F'?'#EAF3DE':undefined, color: slot.gender==='M+F'?'#27500A':undefined}}>
                                {slot.gender}
                              </span>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'var(--text2)',marginTop:2}}>
                              <span>Seats Filled</span>
                              <strong>{slot.enrolledCount} / {slot.capacity} ({filledPct}%)</strong>
                            </div>
                            <div className="drawer-slot-bar-wrap">
                              <div 
                                className="drawer-slot-bar-fill" 
                                style={{
                                  width: `${Math.min(100, filledPct)}%`,
                                  background: filledPct >= 100 ? 'var(--red)' : filledPct >= 85 ? 'var(--p3)' : 'var(--green)'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
