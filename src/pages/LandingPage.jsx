import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, MapPin, Users, Trophy, Ticket, X,
  Activity, CheckCircle, Clock, AlertCircle, Sparkles, CalendarDays, CircleCheckBig,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { getAllEvents } from '../lib/events';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isSameMonth, isToday,
  isBefore, isAfter
} from 'date-fns';

// ─── Council & Status Config ─────────────────────────────────────────────
const COUNCIL_COLORS = {
  'ieee-wie': '#6366f1', 'csi': '#0ea5e9', 'acm': '#14b8a6', 'asme': '#f97316',
  'e-cell': '#8b5cf6', 'fsai': '#ec4899', 'team-robix': '#ef4444', 'team-abadha': '#f59e0b',
  'team-cfr': '#10b981', 'team-vaayushastra': '#3b82f6', 'team-mavericks': '#a855f7',
  'project-cell': '#06b6d4', 'mozilla-codelabs': '#f43f5e', 'gdsc': '#22c55e',
  'gda': '#eab308', 'nss': '#64748b', 'rotaract-club': '#d97706', 'tedx': '#dc2626',
};

const STATUS_CONFIG = {
  approved: { label: 'Approved', color: '#10b981', icon: CheckCircle },
  submitted: { label: 'Pending', color: '#f59e0b', icon: Clock },
  revision_needed: { label: 'Revision', color: '#f97316', icon: AlertCircle },
  rejected: { label: 'Rejected', color: '#ef4444', icon: X },
  report_pending: { label: 'Report Pending', color: '#3b82f6', icon: Activity },
  closed: { label: 'Closed', color: '#94a3b8', icon: CheckCircle },
};

const toDate = (field) => {
  if (!field) return null;
  if (field.toDate) return field.toDate();
  if (field.seconds) return new Date(field.seconds * 1000);
  return new Date(field);
};

const resolveStatus = (event) => {
  if (event.status === 'approved') {
    const end = toDate(event.endDate);
    if (end && end < new Date()) return 'report_pending';
  }
  return event.status;
};

// ─── Glassmorphism Stat Card ─────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accentColor, loading, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="group relative overflow-hidden"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.12] via-white/[0.04] to-transparent p-[1px]">
        <div className="w-full h-full rounded-2xl bg-[#0a0a0a]" />
      </div>
      <div className="relative rounded-2xl bg-white/[0.03] backdrop-blur-xl p-6 md:p-7 transition-all duration-500 group-hover:bg-white/[0.05]">
        <div
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{ background: accentColor }}
        />
        <div className="flex items-start justify-between mb-4 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center">
            <Icon size={16} strokeWidth={2} style={{ color: accentColor }} />
          </div>
        </div>
        <div className="relative z-10">
          <div
            className="font-anton text-4xl md:text-5xl mb-1.5 tracking-tight"
            style={{
              background: `linear-gradient(135deg, #fff 30%, ${accentColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {loading ? '—' : value}
          </div>
          <div className="text-white/35 text-[11px] uppercase tracking-[0.15em] font-semibold">{label}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Build calendar grid rows ─────────────────────────────────────────────
function buildCalendarGrid(currentDate) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const rows = [];
  let day = gridStart;
  while (!isAfter(day, gridEnd)) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(day));
      day = addDays(day, 1);
    }
    rows.push(week);
  }
  return rows;
}

// ─── Floating Islands Calendar ────────────────────────────────────────────
function FloatingCalendar({ events, onSelectEvent, loading }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();

  const rows = buildCalendarGrid(currentDate);

  // Index events by date string (YYYY-MM-DD)
  const eventsByDate = {};
  events.forEach(ev => {
    if (!ev._startDate) return;
    const key = format(ev._startDate, 'yyyy-MM-dd');
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  });

  const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div>
      {/* Calendar Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentDate(d => subMonths(d, 1))}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
        >
          <ChevronLeft size={16} />
        </button>

        <h2 className="font-anton text-2xl md:text-3xl text-white tracking-wide">
          {format(currentDate, 'MMMM yyyy').toUpperCase()}
        </h2>

        <button
          onClick={() => setCurrentDate(d => addMonths(d, 1))}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] font-bold tracking-[0.15em] text-white/20 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="h-[520px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#ffe17c]/40 border-t-[#ffe17c] rounded-full animate-spin" />
        </div>
      ) : (
        /* Floating Island Grid */
        <div className="flex flex-col gap-2">
          {rows.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 gap-2">
              {week.map((day, dIdx) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate[key] || [];
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isTodayDay = isToday(day);
                const hasEvents = dayEvents.length > 0;
                const visibleEvents = dayEvents.slice(0, 2);
                const overflow = dayEvents.length - 2;

                return (
                  <motion.div
                    key={dIdx}
                    whileHover={isCurrentMonth ? { scale: 1.04, zIndex: 10 } : {}}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="relative"
                    style={{ zIndex: 1 }}
                  >
                    <div
                      className={`
                        relative rounded-xl p-2 min-h-[80px] sm:min-h-[96px] flex flex-col gap-1
                        transition-colors duration-200 cursor-default
                        ${isTodayDay
                          ? 'bg-[#ffe17c]/[0.08] border border-[#ffe17c]/30 shadow-[0_0_20px_rgba(255,225,124,0.1),inset_0_0_20px_rgba(255,225,124,0.03)]'
                          : isCurrentMonth
                            ? hasEvents
                              ? 'bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12]'
                              : 'bg-white/[0.025] border border-white/[0.04] hover:bg-white/[0.04]'
                            : 'bg-white/[0.01] border border-white/[0.02]'
                        }
                      `}
                    >
                      {/* Date number */}
                      <div className="flex justify-end">
                        <span
                          className={`
                            text-[11px] font-bold leading-none w-6 h-6 flex items-center justify-center rounded-lg
                            ${isTodayDay
                              ? 'bg-[#ffe17c] text-black font-black shadow-[0_0_12px_rgba(255,225,124,0.5)]'
                              : isCurrentMonth
                                ? 'text-white/60'
                                : 'text-white/15'
                            }
                          `}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>

                      {/* Event pills */}
                      {isCurrentMonth && visibleEvents.map((ev, eIdx) => {
                        const color = COUNCIL_COLORS[ev.councilId] || '#fff';
                        return (
                          <button
                            key={eIdx}
                            onClick={() => onSelectEvent(ev)}
                            className="flex items-center gap-1 w-full rounded-md px-1.5 py-0.5 text-left transition-all duration-150 hover:brightness-125"
                            style={{
                              backgroundColor: `${color}18`,
                              border: `1px solid ${color}30`,
                            }}
                          >
                            <span
                              className="w-1 h-1 rounded-full shrink-0"
                              style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
                            />
                            <span className="text-[9px] font-semibold truncate" style={{ color: `${color}cc` }}>
                              {ev.eventName}
                            </span>
                          </button>
                        );
                      })}

                      {/* Overflow indicator */}
                      {isCurrentMonth && overflow > 0 && (
                        <span className="text-[9px] font-bold text-white/30 px-1.5">
                          +{overflow} more
                        </span>
                      )}

                      {/* Today glow ring */}
                      {isTodayDay && (
                        <div className="absolute inset-0 rounded-xl pointer-events-none" style={{
                          boxShadow: 'inset 0 0 0 1px rgba(255,225,124,0.4)',
                        }} />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function LandingPage() {
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailEvent, setDetailEvent] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllEvents();
      const resolved = data.map(e => ({ ...e, _status: resolveStatus(e), _startDate: toDate(e.startDate) }));
      resolved.sort((a, b) => (a._startDate || 0) - (b._startDate || 0));
      setAllEvents(resolved);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    document.body.style.backgroundColor = '#000000';
    return () => { document.body.style.backgroundColor = '#ffffff'; };
  }, [fetchEvents]);

  const stats = {
    total: allEvents.length,
    upcoming: allEvents.filter(e => e._status === 'approved').length,
    closed: allEvents.filter(e => e._status === 'closed').length,
  };

  const nextMajorEvent = allEvents.find(e => e._status === 'approved' && e._startDate > new Date());

  // Only show approved/closed events on the calendar
  const calendarEvents = allEvents.filter(e =>
    ['approved', 'report_pending', 'closed'].includes(e._status) && e._startDate
  );

  return (
    <div className="min-h-screen bg-[#000000] text-white font-satoshi selection:bg-[#ffe17c] selection:text-black relative overflow-x-hidden">

      {/* ── AMBIENT BACKGROUND ────────────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[120%] h-[80%] bg-[#ffe17c]/[0.04] rounded-full blur-[200px] pointer-events-none transform-gpu z-0" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[50%] h-[50%] bg-emerald-500/[0.02] rounded-full blur-[150px] pointer-events-none transform-gpu z-0" />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-28 relative z-10">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div className="mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="relative"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#ffe17c]/[0.05] rounded-full blur-[120px] pointer-events-none" />

            <h1 className="font-anton text-6xl md:text-8xl lg:text-[9rem] leading-[0.85] text-white tracking-tight mb-4 relative">
              FR.CRCE
            </h1>
            <h1 className="font-anton text-5xl md:text-7xl lg:text-[7rem] leading-[0.85] tracking-tight mb-3 relative">
              <span className="text-white">OFFICIAL </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffe17c] via-amber-300 to-[#ffe17c]">EVENTS</span>
            </h1>
            <h1 className="font-anton text-5xl md:text-7xl lg:text-[7rem] leading-[0.85] tracking-tight relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffe17c] via-amber-300 to-[#ffe17c]">PORTAL</span>
            </h1>

            <p className="mt-8 text-white/30 text-sm md:text-base max-w-md font-medium tracking-wide leading-relaxed">
              A unified calendar and tracking system for all college council events, proposals, and clearances.
            </p>
          </motion.div>

          {/* Next Major Event Banner */}
          {nextMajorEvent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => setDetailEvent(nextMajorEvent)}
              className="relative z-10 group cursor-pointer overflow-hidden mt-12"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.12] via-white/[0.04] to-transparent p-[1px]">
                <div className="w-full h-full rounded-2xl bg-[#050505]" />
              </div>
              <div className="relative rounded-2xl bg-white/[0.02] backdrop-blur-xl p-8 md:p-10 transition-all duration-500 group-hover:bg-white/[0.04]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#ffe17c]/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl" />
                <p className="text-[#ffe17c]/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-5 flex items-center gap-2.5 relative z-10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffe17c] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ffe17c]"></span>
                  </span>
                  Next Major Event
                </p>
                <div className="grid md:grid-cols-2 gap-8 items-end relative z-10">
                  <div>
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-2 text-white">{nextMajorEvent.eventName}</h2>
                    <p className="text-white/40 text-sm">{nextMajorEvent.councilName}</p>
                  </div>
                  <div className="md:text-right">
                    <div className="inline-flex flex-col text-left bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
                      <p className="text-white/30 text-[10px] uppercase font-bold tracking-[0.15em] mb-1">Date</p>
                      <p className="text-lg font-medium text-white">{format(nextMajorEvent._startDate, 'EEEE, MMMM d')}</p>
                      <p className="text-[#ffe17c]/80 font-semibold text-sm mt-0.5">{format(nextMajorEvent._startDate, 'h:mm a')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── STATS ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-20 relative z-10">
          <StatCard icon={CalendarDays}   label="Total Events" value={stats.total}    accentColor="#ffe17c" loading={loading} delay={0.15} />
          <StatCard icon={Sparkles}       label="Upcoming"     value={stats.upcoming} accentColor="#10b981" loading={loading} delay={0.25} />
          <StatCard icon={CircleCheckBig} label="Completed"    value={stats.closed}   accentColor="#94a3b8" loading={loading} delay={0.35} />
        </div>

        {/* ── FLOATING ISLANDS CALENDAR ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="p-[1px] rounded-2xl bg-gradient-to-br from-white/[0.1] via-white/[0.03] to-transparent">
            <div className="bg-[#060606]/90 rounded-[15px] p-5 sm:p-8 backdrop-blur-xl">
              <FloatingCalendar
                events={calendarEvents}
                onSelectEvent={setDetailEvent}
                loading={loading}
              />
            </div>
          </div>
        </motion.div>

        {/* ── FOOTER / CTA ──────────────────────────────────────────────── */}
        <div className="mt-20 flex flex-col items-center gap-6">
          <div className="flex items-center gap-8">
            <Link to="/portal" className="text-sm font-medium text-white/30 hover:text-white/70 transition-colors duration-300 tracking-wide">
              Council Login
            </Link>
            <Link to="/admin" className="group relative px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] overflow-hidden rounded-xl transition-all duration-500">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#ffe17c]/60 via-[#ffe17c] to-[#ffe17c]/60 p-[1px]">
                <div className="w-full h-full rounded-[11px] bg-[#000] group-hover:bg-[#ffe17c]/10 transition-colors duration-500" />
              </div>
              <span className="relative z-10 text-[#ffe17c] group-hover:text-white transition-colors duration-300">Admin Login</span>
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 shadow-[0_0_30px_rgba(255,225,124,0.25)] transition-opacity duration-500" />
            </Link>
          </div>
          <p className="text-white/15 text-[10px] uppercase tracking-[0.2em] font-medium mt-4">
            Fr. Conceicao Rodrigues College of Engineering
          </p>
        </div>
      </div>

      {/* ── EVENT DETAIL MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {detailEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetailEvent(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.15] via-white/[0.05] to-transparent p-[1px]">
                <div className="w-full h-full rounded-2xl bg-[#080808]" />
              </div>
              <div className="relative rounded-2xl bg-[#080808] flex flex-col max-h-[90vh]">
                <button
                  onClick={() => setDetailEvent(null)}
                  className="absolute top-5 right-5 w-8 h-8 bg-white/[0.06] border border-white/[0.08] rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.12] transition-all z-10"
                >
                  <X size={14} />
                </button>
                <div className="p-8 border-b border-white/[0.06] relative overflow-hidden shrink-0">
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${COUNCIL_COLORS[detailEvent.councilId] || '#fff'}, transparent)` }} />
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/[0.05] text-white/50 border border-white/[0.06]">
                      {detailEvent.councilName}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border" style={{ backgroundColor: `${(STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).color}12`, color: (STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).color, borderColor: `${(STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).color}25` }}>
                      {(() => { const Icon = (STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).icon; return <Icon size={11} />; })()}
                      {(STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).label}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">{detailEvent.eventName}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-white/40">
                    <div className="flex items-center gap-1.5"><CalendarIcon size={13} /> {format(detailEvent._startDate, 'EEEE, MMM d, yyyy · h:mm a')}</div>
                    {detailEvent.venue && <div className="flex items-center gap-1.5"><MapPin size={13} /> {detailEvent.venue}</div>}
                  </div>
                </div>
                <div className="p-8 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 flex items-center gap-2"><Users size={13} /> Expected Footfall</p>
                      <p className="text-xl text-white font-medium">{detailEvent.expectedFootfall || 'N/A'}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 flex items-center gap-2"><Ticket size={13} /> Registration</p>
                      <p className="text-xl text-white font-medium">{detailEvent.registrationFeeApplicable ? `₹${detailEvent.registrationFeeAmount}` : 'Free'}</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {detailEvent.prizeMoneyApplicable && (
                      <div>
                        <h4 className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2"><Trophy size={13} /> Prize Pool</h4>
                        <p className="text-white bg-amber-500/[0.08] border border-amber-500/[0.15] px-4 py-3 rounded-xl inline-block text-sm">₹{detailEvent.prizeMoneyAmount} <span className="text-white/30 ml-2">({detailEvent.prizeMoneySource})</span></p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                      <div>
                        <h4 className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em] mb-1">Student Contact</h4>
                        <p className="text-sm text-white">{detailEvent.studentContactName}</p>
                        <p className="text-xs text-white/40">{detailEvent.studentContactPhone}</p>
                      </div>
                      <div>
                        <h4 className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em] mb-1">Faculty Coordinator</h4>
                        <p className="text-sm text-white">{detailEvent.facultyCoordinatorName}</p>
                      </div>
                    </div>
                    {(detailEvent.safetyArrangementNeeded || detailEvent.venuePermissionApplicable) && (
                      <div className="flex gap-2 flex-wrap pt-2">
                        {detailEvent.safetyArrangementNeeded && <span className="px-3 py-1.5 rounded-lg bg-orange-500/[0.08] text-orange-400 text-xs font-bold border border-orange-500/[0.15]">Safety Measures Required</span>}
                        {detailEvent.venuePermissionApplicable && <span className="px-3 py-1.5 rounded-lg bg-teal-500/[0.08] text-teal-400 text-xs font-bold border border-teal-500/[0.15]">Venue Perm Required</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
