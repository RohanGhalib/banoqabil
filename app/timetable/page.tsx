'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const SLOTS = ['9–11 am','11:30 am–1:30 pm','2–4 pm','4:30–6:30 pm'];
const DAYS  = ['Mon – Tue','Wed – Thu','Sat – Sun'];
const COURSE_NAMES: Record<string,string> = {DM:'Digital Marketing',GD:'Graphic Design',VE:'Video Editing',CS:'Cybersecurity',AiE:'AI Essentials',WD:'Website Dev'};
const COURSE_COLORS: Record<string,string> = {DM:'#378ADD',GD:'#9F3FBF',VE:'#D85A30',CS:'#E24B4A',AiE:'#1D9E75',WD:'#BA7517'};
const COURSE_BG:     Record<string,string> = {DM:'#E6F1FB',GD:'#F3E8FA',VE:'#FAECE7',CS:'#FCEBEB',AiE:'#E1F5EE',WD:'#FAEEDA'};

const CAMPUSES = {
  ds: { name:'Darussalam Campus', rooms:[
    {id:'ds-lab1',label:'Computer Lab 1',type:'lab',cap:50},
    {id:'ds-lab2',label:'Computer Lab 2',type:'lab',cap:40},
    {id:'ds-cls', label:'Classroom',     type:'class',cap:50},
  ]},
  ic: { name:'Islamic Center', rooms:[
    {id:'ic-lab',label:'Computer Lab',type:'lab',cap:35},
    {id:'ic-cls',label:'Classroom',   type:'class',cap:45},
  ]},
};

type SlotData = { id:string; campusId:string; roomId:string; slotKey:string; course:string; gender:string; capacity:number; enrolledCount:number; maleCount:number; femaleCount:number; };
type EditTarget = { roomId:string; campusId:string; d:number; s:number };

export default function Timetable() {
  const [campus, setCampus] = useState<'ds'|'ic'>('ds');
  const [slots, setSlots]   = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget|null>(null);
  const [mCourse, setMCourse]   = useState('');
  const [mGender, setMGender]   = useState('M');
  const [mCap,    setMCap]      = useState(50);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/slots'); const d = await r.json(); if(d.success) setSlots(d.slots); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSlots(); }, []);

  const getSlot = (roomId:string, d:number, s:number) =>
    slots.find(sl => sl.roomId===roomId && sl.slotKey===`${d}-${s}`);

  const openModal = (roomId:string, campusId:string, d:number, s:number) => {
    const sl = getSlot(roomId, d, s);
    const room = Object.values(CAMPUSES).flatMap(c=>c.rooms).find(r=>r.id===roomId);
    setEditTarget({roomId, campusId, d, s});
    setMCourse(sl?.course||'');
    setMGender(sl?.gender||'M');
    setMCap(sl?.capacity||room?.cap||50);
  };

  const closeModal = () => setEditTarget(null);

  const saveSlot = async () => {
    if(!editTarget) return;
    const {roomId,campusId,d,s} = editTarget;
    await fetch('/api/slots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campusId,roomId,slotKey:`${d}-${s}`,course:mCourse,gender:mGender,capacity:mCap,clear:!mCourse})});
    closeModal(); fetchSlots();
  };

  const clearSlot = async () => {
    if(!editTarget) return;
    const {roomId,campusId,d,s} = editTarget;
    await fetch('/api/slots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campusId,roomId,slotKey:`${d}-${s}`,clear:true})});
    closeModal(); fetchSlots();
  };

  const exportData = () => {
    const data = {exported:new Date().toISOString(), slots};
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download = 'bano_qabil_batch2_data.json'; a.click();
  };

  // ── Stats calculation ────────────────────────────────────────────────────────
  const campusRooms = CAMPUSES[campus].rooms;
  const campusSlots = slots.filter(sl=>sl.campusId===campus);
  const totalCap  = campusSlots.reduce((a,s)=>a+s.capacity,0);
  const totalMale = campusSlots.reduce((a,s)=>a+(s.gender==='M'?s.capacity:s.gender==='M+F'?Math.round(s.capacity/2):0),0);
  const totalFemale = campusSlots.reduce((a,s)=>a+(s.gender==='F'?s.capacity:s.gender==='M+F'?Math.round(s.capacity/2):0),0);
  const totalSlots  = campusRooms.length * 3 * 4;
  const filledSlots = campusSlots.length;
  const courseTotals: Record<string,{total:number,m:number,f:number}> = {};
  campusSlots.forEach(s=>{
    if(!courseTotals[s.course]) courseTotals[s.course]={total:0,m:0,f:0};
    courseTotals[s.course].total+=s.capacity;
    courseTotals[s.course].m+=s.gender==='M'?s.capacity:s.gender==='M+F'?Math.round(s.capacity/2):0;
    courseTotals[s.course].f+=s.gender==='F'?s.capacity:s.gender==='M+F'?Math.round(s.capacity/2):0;
  });
  const mPct = totalCap?Math.round(totalMale/totalCap*100):0;
  const fPct = 100-mPct;
  const r=42,cx=55,cy=55,circ=2*Math.PI*r;
  const mD=circ*mPct/100;

  return (
    <>
      <header>
        <div className="logo">
          <div className="logo-box"><svg viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg></div>
          <div><div className="logo-text">Bano Qabil — Batch 2</div><div className="logo-sub">Timetable Management</div></div>
        </div>
        <div className="hdr-btns">
          <Link href="/" className="btn">← Enrollment</Link>
          <button className="btn" onClick={()=>window.print()}>🖨 Print page</button>
          <button className="btn btn-green" onClick={exportData}>↓ Export JSON</button>
        </div>
      </header>

      <div className="main">
        {/* Campus tabs */}
        <div className="campus-tabs">
          <button className={`campus-tab${campus==='ds'?' active':''}`} onClick={()=>setCampus('ds')}>Darussalam Campus</button>
          <button className={`campus-tab${campus==='ic'?' active':''}`} onClick={()=>setCampus('ic')}>Islamic Center</button>
        </div>

        {/* Stats row */}
        <div className="stats-row">
          <div className="stat-card"><div className="stat-label">Total capacity</div><div className="stat-value">{totalCap.toLocaleString()}</div><div className="stat-sub">{filledSlots} of {totalSlots} slots filled</div></div>
          <div className="stat-card stat-m"><div className="stat-label">Male students</div><div className="stat-value" style={{color:'#185FA5'}}>{totalMale.toLocaleString()}</div><div className="stat-sub">{mPct}% of total</div></div>
          <div className="stat-card stat-f"><div className="stat-label">Female students</div><div className="stat-value" style={{color:'#993556'}}>{totalFemale.toLocaleString()}</div><div className="stat-sub">{fPct}% of total</div></div>
          <div className="stat-card"><div className="stat-label">Courses running</div><div className="stat-value">{Object.keys(courseTotals).length}</div><div className="stat-sub">out of 6 offered</div></div>
        </div>

        {/* Charts row */}
        <div className="charts-row">
          <div className="chart-card">
            <div className="chart-title">Students per course — click slot to edit</div>
            {Object.entries(courseTotals).sort((a,b)=>b[1].total-a[1].total).map(([code,{total,m,f}])=>{
              const max = Math.max(...Object.values(courseTotals).map(c=>c.total),1);
              return (
                <div className="bar-row" key={code}>
                  <div className="bar-label">{code}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{width:`${Math.round(total/max*100)}%`,background:COURSE_COLORS[code]}} title={`${COURSE_NAMES[code]} — Total:${total} M:${m} F:${f}`}/>
                  </div>
                  <div className="bar-val">{total}</div>
                </div>
              );
            })}
            {Object.keys(courseTotals).length===0&&<div style={{fontSize:'12px',color:'var(--text3)'}}>No slots assigned yet</div>}
          </div>
          <div className="chart-card">
            <div className="chart-title">Gender distribution</div>
            <div className="donut-section">
              <div className="donut-wrap">
                <svg viewBox="0 0 110 110" width="110" height="110">
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1EFE8" strokeWidth="16"/>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="#378ADD" strokeWidth="16" strokeDasharray={`${mD} ${circ-mD}`} transform={`rotate(-90 ${cx} ${cy})`}/>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="#D4537E" strokeWidth="16" strokeDasharray={`${circ-mD} ${mD}`} strokeDashoffset={-mD} transform={`rotate(-90 ${cx} ${cy})`}/>
                </svg>
                <div className="donut-center"><div className="donut-num">{totalCap.toLocaleString()}</div><div className="donut-lbl">total</div></div>
              </div>
              <div className="gender-items">
                {[{label:'Male',val:totalMale,pct:mPct,color:'#378ADD'},{label:'Female',val:totalFemale,pct:fPct,color:'#D4537E'}].map(g=>(
                  <div className="gender-item" key={g.label}>
                    <div className="g-dot" style={{background:g.color}}/>
                    <div className="g-info"><div className="g-name">{g.label}</div><div className="g-val">{g.val.toLocaleString()}</div><div className="g-pct">{g.pct}%</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="divider"/>

        {/* Legend */}
        <div className="legend-row">
          <div className="legend-item"><div className="legend-dot" style={{background:'#378ADD'}}/> Male</div>
          <div className="legend-item"><div className="legend-dot" style={{background:'#D4537E'}}/> Female</div>
          <div className="legend-item"><div className="legend-dot" style={{background:'#639922'}}/> Mixed</div>
          <div className="legend-item"><div className="legend-dot" style={{background:'var(--border2)'}}/> Empty — click to assign</div>
        </div>

        {/* Room timetable grids */}
        <div className="section-header">{CAMPUSES[campus].name} — Schedule</div>
        {loading&&<div style={{padding:'2rem',textAlign:'center',color:'var(--text3)'}}>Loading slots…</div>}
        {campusRooms.map(room=>(
          <div className="room-block" key={room.id}>
            <div className="room-header">
              <div className="room-name">{room.label}</div>
              <div className="room-badge">{room.type==='lab'?'Computer Lab':'Classroom'}</div>
              <div className="room-badge">{room.cap} seats max</div>
            </div>
            <table className="timetable">
              <thead><tr><th/>{SLOTS.map(s=><th key={s}>{s}</th>)}</tr></thead>
              <tbody>
                {DAYS.map((day,d)=>(
                  <tr key={d}>
                    <td className="day-cell">{day}</td>
                    {SLOTS.map((_,s)=>{
                      const sl = getSlot(room.id,d,s);
                      if(sl){
                        const col=COURSE_COLORS[sl.course];
                        const bg=COURSE_BG[sl.course];
                        const gBg=sl.gender==='M'?'#E6F1FB':sl.gender==='F'?'#FBEAF0':'#EAF3DE';
                        const gCol=sl.gender==='M'?'#0C447C':sl.gender==='F'?'#72243E':'#27500A';
                        return (
                          <td key={s} className="slot-cell" onClick={()=>openModal(room.id,campus,d,s)}>
                            <div className="slot-inner" style={{background:bg,borderColor:`${col}22`}}>
                              <div>
                                <div className="slot-course-name" style={{color:col}}>{sl.course}</div>
                                <span className="slot-gender-badge" style={{background:gBg,color:gCol}}>{sl.gender}</span>
                              </div>
                              <div className="slot-cap-txt">{sl.enrolledCount}/{sl.capacity} seats</div>
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={s} className="slot-cell" onClick={()=>openModal(room.id,campus,d,s)}>
                          <div className="slot-inner empty"><span className="slot-empty-txt">+ assign</span></div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Slot modal */}
      <div className={`slot-modal-bg${editTarget?' open':''}`} onClick={e=>{if(e.target===e.currentTarget)closeModal();}}>
        <div className="slot-modal">
          <div className="slot-modal-title">Edit slot</div>
          {editTarget&&(
            <div className="slot-modal-sub">
              {DAYS[editTarget.d]} · {SLOTS[editTarget.s]} · {Object.values(CAMPUSES).flatMap(c=>c.rooms).find(r=>r.id===editTarget.roomId)?.label}
            </div>
          )}
          <div className="field" style={{marginBottom:14}}>
            <label>Course</label>
            <select value={mCourse} onChange={e=>setMCourse(e.target.value)}>
              <option value="">— empty —</option>
              {Object.entries(COURSE_NAMES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{marginBottom:14}}>
            <label>Gender</label>
            <select value={mGender} onChange={e=>setMGender(e.target.value)}>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="M+F">Mixed (M+F)</option>
            </select>
          </div>
          <div className="field" style={{marginBottom:14}}>
            <label>Capacity (seats)</label>
            <input type="number" min={1} max={200} value={mCap} onChange={e=>setMCap(parseInt(e.target.value)||1)}/>
          </div>
          <div className="slot-modal-actions">
            <button className="btn-clear-slot" onClick={clearSlot}>Clear</button>
            <button className="btn-cancel-slot" onClick={closeModal}>Cancel</button>
            <button className="btn-save-slot" onClick={saveSlot}>Save</button>
          </div>
        </div>
      </div>
    </>
  );
}
