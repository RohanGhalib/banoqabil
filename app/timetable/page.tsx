'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, MapPin, Users, Edit2, ShieldAlert, Award, 
  Trash2, Search, Settings, Save, CheckCircle
} from 'lucide-react';
import { Slot, Student, COURSE_NAMES, PRIORITY_BADGES } from '@/lib/types';

export default function TimetableScheduler() {
  // --- Timetable State ---
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampus, setActiveCampus] = useState<'ds' | 'ic'>('ds');

  // --- Inspector Panel / Drawer State ---
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // --- Slot Editor Form State ---
  const [formCourse, setFormCourse] = useState('GD');
  const [formGender, setFormGender] = useState<'M' | 'F' | 'M+F'>('M+F');
  const [formCapacity, setFormCapacity] = useState(50);
  const [formAlert, setFormAlert] = useState<string | null>(null);

  // Fetch timetable slots and dynamic roster counts from database
  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots || []);
        
        // If a slot is currently inspected, update its state dynamically in case roster changed!
        if (selectedSlot) {
          const updated = data.slots.find((s: Slot) => s.id === selectedSlot.id);
          if (updated) {
            setSelectedSlot(updated);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  // Set editor values when a slot is inspected
  useEffect(() => {
    if (selectedSlot) {
      setFormCourse(selectedSlot.course);
      setFormGender(selectedSlot.gender);
      setFormCapacity(selectedSlot.capacity);
      setFormAlert(null);
    }
  }, [selectedSlot]);

  // --- Save Timetable Slot Configuration Changes ---
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campusId: selectedSlot.campusId,
          roomId: selectedSlot.roomId,
          slotKey: selectedSlot.slotKey,
          course: formCourse,
          gender: formGender,
          capacity: formCapacity
        })
      });
      const data = await res.json();
      if (data.success) {
        setFormAlert('✅ Configuration saved successfully!');
        fetchSlots();
        setTimeout(() => {
          setIsConfiguring(false);
          setFormAlert(null);
        }, 1500);
      } else {
        setFormAlert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setFormAlert('❌ A network error occurred.');
    }
  };

  // --- Unenroll Candidate from Roster ---
  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to remove this candidate from the class roster?')) return;
    
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
        // Refresh timetable grid and active drawer roster
        fetchSlots();
      } else {
        alert(`Failed to remove student: ${data.error}`);
      }
    } catch (err) {
      alert('Error removing student.');
    }
  };

  // --- Timetable Grid Construction Helpers ---
  const DAYS = ['0', '1', '2']; // Mon-Tue, Wed-Thu, Sat-Sun
  const SLOTS = ['0', '1', '2', '3']; // 9-11 am, 11:30-1:30 pm, 2-4 pm, 4:30-6:30 pm

  const getDayLabel = (idx: string) => {
    if (idx === '0') return 'Mon-Tue';
    if (idx === '1') return 'Wed-Thu';
    return 'Sat-Sun';
  };

  const getSlotTimeLabel = (idx: string) => {
    if (idx === '0') return '9:00 - 11:00 AM';
    if (idx === '1') return '11:30 - 1:30 PM';
    if (idx === '2') return '2:00 - 4:00 PM';
    return '4:30 - 6:30 PM';
  };

  const getCampusRooms = (campus: 'ds' | 'ic') => {
    if (campus === 'ds') {
      return [
        { id: 'ds-lab1', name: 'Computer Lab 1' },
        { id: 'ds-lab2', name: 'Computer Lab 2' },
        { id: 'ds-cls', name: 'Classroom' }
      ];
    } else {
      return [
        { id: 'ic-lab', name: 'Computer Lab' },
        { id: 'ic-cls', name: 'Classroom' }
      ];
    }
  };

  // --- Dynamic Dashboard Metrics Aggregation ---
  // Calculates dynamic counts from database active slots
  const campusRooms = getCampusRooms(activeCampus);
  const activeCampusSlots = slots.filter(s => s.campusId === activeCampus);

  const totalCapacity = activeCampusSlots.reduce((acc, curr) => acc + curr.capacity, 0);
  const totalEnrolled = activeCampusSlots.reduce((acc, curr) => acc + (curr.enrolledCount || 0), 0);
  const totalMale = activeCampusSlots.reduce((acc, curr) => acc + (curr.maleCount || 0), 0);
  const totalFemale = activeCampusSlots.reduce((acc, curr) => acc + (curr.femaleCount || 0), 0);

  // Dynamic Course Counts
  const courseCounts: Record<string, number> = { GD: 0, VE: 0, CS: 0, WD: 0, AiE: 0, DM: 0 };
  activeCampusSlots.forEach(s => {
    courseCounts[s.course] = (courseCounts[s.course] || 0) + (s.enrolledCount || 0);
  });
  const maxCourseCount = Math.max(...Object.values(courseCounts), 1);

  // Donut Chart Math
  const totalGenders = totalMale + totalFemale;
  const malePercent = totalGenders ? Math.round((totalMale / totalGenders) * 100) : 0;
  const femalePercent = totalGenders ? Math.round((totalFemale / totalGenders) * 100) : 0;

  // SVG Circle Parameters
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // 251.3
  const maleStrokeDashoffset = totalGenders 
    ? circumference - (totalMale / totalGenders) * circumference 
    : circumference;

  return (
    <div className="timetable-section">
      
      {/* ── Dynamic Analytics Row ── */}
      <section className="timetable-charts-row">
        {/* Course Roster Share (CSS Bar Chart) */}
        <div className="chart-card">
          <h3 className="chart-title">📊 Roster Share by Course</h3>
          <div className="chart-content">
            <div className="bar-chart-container">
              {Object.entries(COURSE_NAMES).map(([code, name]) => {
                const count = courseCounts[code] || 0;
                const percentage = Math.round((count / maxCourseCount) * 100);

                return (
                  <div key={code} className="bar-row">
                    <div className="bar-label-group">
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{name} ({code})</span>
                      <span style={{ color: 'var(--text3)' }}>{count} students</span>
                    </div>
                    <div className="bar-bg">
                      <div 
                        className="bar-fill"
                        style={{ width: `${percentage}%`, background: code === 'GD' ? '#3B82F6' : code === 'VE' ? '#F43F5E' : '#10B981' }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gender Balance (SVG Donut Chart) */}
        <div className="chart-card">
          <h3 className="chart-title">🍩 Dynamic Gender Balance</h3>
          <div className="chart-content" style={{ gap: '24px' }}>
            {totalGenders > 0 ? (
              <>
                <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100">
                    {/* Background ring */}
                    <circle 
                      cx="50" cy="50" r={radius} 
                      fill="transparent" stroke="#F1F5F9" strokeWidth="12" 
                    />
                    {/* Female ring (Pink base) */}
                    <circle 
                      cx="50" cy="50" r={radius} 
                      fill="transparent" stroke="#EC4899" strokeWidth="12" 
                    />
                    {/* Male segment (Blue overlay) */}
                    <circle 
                      cx="50" cy="50" r={radius} 
                      fill="transparent" stroke="#3B82F6" strokeWidth="12" 
                      strokeDasharray={circumference}
                      strokeDashoffset={maleStrokeDashoffset}
                      className="donut-segment"
                      style={{ 
                        // Set CSS variables for smooth animation trigger
                        ['--dashoffset-total' as any]: circumference,
                        ['--dashoffset-value' as any]: maleStrokeDashoffset
                      }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    lineHeight: '1.2'
                  }}>
                    <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>{totalGenders}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>Enrolled</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#3B82F6' }}></div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Male: <strong>{totalMale}</strong> ({malePercent}%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#EC4899' }}></div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Female: <strong>{totalFemale}</strong> ({femalePercent}%)</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No enrolled candidates to compute gender ratios.</div>
            )}
          </div>
        </div>

        {/* Timetable Utilization Panel */}
        <div className="chart-card">
          <h3 className="chart-title">🏫 Campus Seating Utilization</h3>
          <div className="chart-content" style={{ flexDirection: 'column', justifyContent: 'space-between', padding: '10px 0' }}>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--text2)', marginBottom: '8px' }}>
                <span>Allocated Seats</span>
                <span style={{ float: 'right' }}><strong>{totalEnrolled} / {totalCapacity}</strong></span>
              </div>
              <div className="bar-bg" style={{ height: '12px' }}>
                <div 
                  className="bar-fill"
                  style={{ 
                    width: `${totalCapacity ? Math.min(Math.round((totalEnrolled / totalCapacity) * 100), 100) : 0}%`,
                    background: 'var(--accent)'
                  }}
                ></div>
              </div>
            </div>
            
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>Active Classes</div>
                <strong style={{ fontSize: '20px', color: 'var(--primary)' }}>
                  {activeCampusSlots.filter(s => (s.enrolledCount || 0) > 0).length}
                </strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>Remaining Seats</div>
                <strong style={{ fontSize: '20px', color: 'var(--primary)' }}>
                  {Math.max(totalCapacity - totalEnrolled, 0)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Timetable Grid Layout ── */}
      <section className="timetable-section">
        {/* Toggle Nav Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div className="timetable-campus-toggle" style={{ width: '320px' }}>
            <button 
              className={`campus-btn ${activeCampus === 'ds' ? 'active' : ''}`}
              onClick={() => setActiveCampus('ds')}
            >
              🕌 Darussalam Campus
            </button>
            <button 
              className={`campus-btn ${activeCampus === 'ic' ? 'active' : ''}`}
              onClick={() => setActiveCampus('ic')}
            >
              🏢 Islamic Center
            </button>
          </div>

          <button className="btn" onClick={() => window.print()}>
            🖨️ Print Timetable Roster
          </button>
        </div>

        {/* Room Scheduler Cards */}
        {loading ? (
          <div className="panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Loading timetables...</div>
        ) : (
          <div className="room-grid">
            {campusRooms.map(room => {
              const roomSlots = slots.filter(s => s.roomId === room.id);

              return (
                <div key={room.id} className="room-card">
                  <div className="room-card-header">
                    <h3 className="room-title">📍 {room.name}</h3>
                    <span className="room-capacity">
                      Capacity Limit: {roomSlots[0]?.capacity || 50} seats
                    </span>
                  </div>

                  {/* Scheduler Layout */}
                  <div className="timetable-grid-layout">
                    {/* Days row header (Mon-Tue, Wed-Thu, Sat-Sun) */}
                    <div className="day-header-col">
                      {DAYS.map(dayIdx => (
                        <div key={dayIdx} className="day-row-label">
                          {getDayLabel(dayIdx)}
                        </div>
                      ))}
                    </div>

                    {/* Columns grid including Time labels */}
                    <div className="grid-slots-container">
                      {/* Time period header row */}
                      <div className="time-headers-row">
                        {SLOTS.map(slotIdx => (
                          <div key={slotIdx} className="time-header-cell">
                            {getSlotTimeLabel(slotIdx)}
                          </div>
                        ))}
                      </div>

                      {/* Mon-Tue, Wed-Thu, Sat-Sun grids */}
                      {DAYS.map(dayIdx => (
                        <div key={dayIdx} className="slots-grid-row" style={{ height: '102px', marginBottom: '8px' }}>
                          {SLOTS.map(slotIdx => {
                            const slotKey = `${dayIdx}-${slotIdx}`;
                            const slot = roomSlots.find(s => s.slotKey === slotKey);

                            if (!slot) {
                              return (
                                <div key={slotKey} className="slot-card" style={{ cursor: 'default' }}>
                                  <span className="slot-empty-label">No Class</span>
                                </div>
                              );
                            }

                            const courseName = COURSE_NAMES[slot.course] || slot.course;
                            const occupancy = slot.enrolledCount || 0;
                            const filledPercent = slot.capacity ? Math.round((occupancy / slot.capacity) * 100) : 0;
                            
                            let capColor = 'ok';
                            if (filledPercent >= 100) capColor = 'full';
                            else if (filledPercent >= 85) capColor = 'warning';

                            return (
                              <div 
                                key={slotKey} 
                                className={`slot-card occupied ${slot.gender.toLowerCase()}-slot`}
                                onClick={() => setSelectedSlot(slot)}
                              >
                                <div className="slot-course">
                                  <span>{slot.course}</span>
                                  <span className={`slot-gender-marker ${slot.gender.toLowerCase()}`}>
                                    {slot.gender === 'M' ? 'M' : slot.gender === 'F' ? 'F' : 'M+F'}
                                  </span>
                                </div>

                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {courseName}
                                </div>

                                <div className="slot-progress-container">
                                  <div className="slot-progress-text">
                                    <span>Roster Size</span>
                                    <strong>{occupancy} / {slot.capacity}</strong>
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
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Timetable Slot Inspector & Drawer ── */}
      <div className={`drawer-overlay ${selectedSlot ? 'open' : ''}`}>
        <div className="drawer-panel" style={{ maxWidth: '520px' }}>
          <div className="drawer-header">
            <div>
              <h3 className="modal-title" style={{ fontSize: '17px' }}>⏰ Slot Inspector</h3>
              <p style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 500, marginTop: '2px' }}>
                {selectedSlot?.campusId === 'ds' ? 'Darussalam Campus' : 'Islamic Center'} · {selectedSlot?.roomId.split('-')[1].toUpperCase()}
              </p>
            </div>
            <button className="modal-close" onClick={() => { setSelectedSlot(null); setIsConfiguring(false); }}>
              <X size={18} />
            </button>
          </div>

          <div className="drawer-body">
            {selectedSlot && (
              <>
                {/* Visual Roster Stats Card */}
                <div className="stat-card" style={{ background: '#F8FAFC', padding: '16px', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="stat-label">Active Course Allocation</span>
                    <button 
                      className="btn" 
                      style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px' }}
                      onClick={() => setIsConfiguring(!isConfiguring)}
                    >
                      <Settings size={12} /> Configure Class
                    </button>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>
                      {COURSE_NAMES[selectedSlot.course]} ({selectedSlot.course})
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 600, marginTop: '2px' }}>
                      📆 {getDayLabel(selectedSlot.slotKey)} · ⏰ {getSlotTimeLabel(selectedSlot.slotKey)}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>Enrolled</div>
                      <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>{selectedSlot.enrolledCount || 0}</strong>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>Male / Female</div>
                      <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {selectedSlot.maleCount || 0}m / {selectedSlot.femaleCount || 0}f
                      </strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>Limit</div>
                      <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>{selectedSlot.capacity} seats</strong>
                    </div>
                  </div>
                </div>

                {/* Inspector Configure Sub-form */}
                {isConfiguring ? (
                  <form onSubmit={handleSaveConfig} className="panel" style={{ borderStyle: 'dashed', padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>🛠️ Slot Configuration Settings</h4>
                    {formAlert && (
                      <div style={{ padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, marginBottom: '12px', background: formAlert.includes('✅') ? '#ECFDF5' : '#FEF2F2', color: formAlert.includes('✅') ? '#047857' : '#B91C1C' }}>
                        {formAlert}
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Assigned Course</label>
                      <select className="form-select" value={formCourse} onChange={(e) => setFormCourse(e.target.value)}>
                        {Object.entries(COURSE_NAMES).map(([code, name]) => (
                          <option key={code} value={code}>{name} ({code})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Gender Restriction</label>
                        <select className="form-select" value={formGender} onChange={(e) => setFormGender(e.target.value as any)}>
                          <option value="M">Male Only</option>
                          <option value="F">Female Only</option>
                          <option value="M+F">Mixed (M+F)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Seat Capacity Limit</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={formCapacity} 
                          onChange={(e) => setFormCapacity(Number(e.target.value))}
                          required 
                          min={1} 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '12px' }}>
                      <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setIsConfiguring(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        <Save size={14} /> Save Config
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Roster Inspector */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📋 Class Enrollment Roster ({selectedSlot.roster?.length || 0})
                      </div>
                    </div>

                    {/* Roster Search */}
                    {selectedSlot.roster && selectedSlot.roster.length > 0 && (
                      <div className="search-box">
                        <Search className="search-icon" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search enrolled candidates..." 
                          className="search-input"
                          style={{ height: '36px', fontSize: '13px' }}
                          value={rosterSearch}
                          onChange={(e) => setRosterSearch(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Students Roster list */}
                    {!selectedSlot.roster || selectedSlot.roster.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px', background: '#F8FAFC' }}>
                        This class is currently empty. Go to the student directory to enroll candidates!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '42vh' }}>
                        {selectedSlot.roster
                          .filter((student: any) => 
                            student.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                            student.id.toLowerCase().includes(rosterSearch.toLowerCase())
                          )
                          .map((student: any, index: number) => {
                            const badge = student.gender === 'Female' ? 'g-badge female' : 'g-badge male';
                            return (
                              <div 
                                key={student.id} 
                                style={{ 
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px',
                                  border: '1px solid var(--border)'
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{index + 1}</span>
                                    {student.name}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 500, fontFamily: 'var(--font-mono)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>ID: {student.id}</span>
                                    <span className={badge} style={{ padding: '0 4px', fontSize: '10px' }}>
                                      {student.gender === 'Male' ? 'M' : 'F'}
                                    </span>
                                    <span className={`p-badge ${PRIORITY_BADGES[student.priority] || 'p3-badge'}`} style={{ padding: '0 4px', fontSize: '9px', lineHeight: 1.5 }}>
                                      P{student.priority}
                                    </span>
                                  </div>
                                </div>
                                
                                <button 
                                  className="btn" 
                                  style={{ padding: '6px', borderRadius: '6px', borderColor: '#FCA5A5', color: '#DC2626', background: 'transparent' }}
                                  title="Un-enroll from slot"
                                  onClick={() => handleRemoveStudent(student.id)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
