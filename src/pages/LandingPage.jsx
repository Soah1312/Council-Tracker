import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  CalendarIcon, MapPin, Users, Trophy, Ticket, X,
  Activity, CheckCircle, Clock, AlertCircle, Sparkles,
  CalendarDays, CircleCheckBig, ChevronLeft, ChevronRight,
  ArrowRight, Zap, Shield, Globe, Star
} from 'lucide-react';
import { getAllEvents } from '../lib/events';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isToday, isAfter,
} from 'date-fns';

// ─── Config ─────────────────────────────────────────────────────────────────
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

// ─── Reusable Reveal Animation ───────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent, loading, delay }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className="group relative"
    >
      {/* Gradient border */}
      <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-white/15 via-white/5 to-transparent">
        <div className="w-full h-full rounded-2xl bg-[#080808]" />
      </div>
      {/* Hover glow blob */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-xl"
        style={{ background: `radial-gradient(circle at 50% 0%, ${accent}22 0%, transparent 70%)` }}
      />
      <div className="relative rounded-2xl bg-white/[0.025] backdrop-blur-xl p-7 group-hover:bg-white/[0.04] transition-colors duration-500">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/8"
            style={{ background: `${accent}15` }}>
            <Icon size={18} strokeWidth={1.75} style={{ color: accent }} />
          </div>
          <span className="text-white/30 text-[11px] uppercase tracking-[0.18em] font-semibold">{label}</span>
        </div>
        <div className="font-anton text-4xl md:text-6xl tracking-tight"
          style={{
            background: `linear-gradient(135deg, #ffffff 20%, ${accent} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
          {loading ? '—' : value}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Feature Pill ────────────────────────────────────────────────────────────
function FeaturePill({ icon: Icon, text, color }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-white/8 bg-white/[0.03] backdrop-blur-md">
      <Icon size={14} style={{ color }} strokeWidth={2} />
      <span className="text-white/60 text-xs font-semibold tracking-wide">{text}</span>
    </div>
  );
}

// ─── Floating Islands Calendar ────────────────────────────────────────────────
function buildCalendarGrid(date) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });
  const rows = [];
  let d = start;
  while (!isAfter(d, end)) {
    const week = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(d)); d = addDays(d, 1); }
    rows.push(week);
  }
  return rows;
}

function FloatingCalendar({ events, onSelectEvent, loading }) {
  const [month, setMonth] = useState(new Date());
  const rows = buildCalendarGrid(month);
  const byDate = {};
  events.forEach(ev => {
    if (!ev._startDate) return;
    const k = format(ev._startDate, 'yyyy-MM-dd');
    (byDate[k] = byDate[k] || []).push(ev);
  });
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => setMonth(m => subMonths(m, 1))}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.14] transition-all duration-200 active:scale-95">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <h2 className="font-anton text-2xl md:text-3xl text-white tracking-wide">{format(month, 'MMMM').toUpperCase()}</h2>
          <p className="text-white/25 text-sm font-medium">{format(month, 'yyyy')}</p>
        </div>
        <button onClick={() => setMonth(m => addMonths(m, 1))}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.14] transition-all duration-200 active:scale-95">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* DOW Headers */}
      <div className="overflow-x-auto pb-6 -mx-6 px-6 sm:mx-0 sm:px-0">
        <div className="min-w-[768px]">
          <div className="grid grid-cols-7 gap-2 mb-3">
            {DOW.map(d => (
              <div key={d} className="text-center text-[10px] font-bold tracking-[0.18em] text-white/18 py-1 uppercase">{d}</div>
            ))}
          </div>
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#ffe17c]/30 border-t-[#ffe17c] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-2">
                  {week.map((day, di) => {
                    const k = format(day, 'yyyy-MM-dd');
                    const dayEvs = byDate[k] || [];
                    const inMonth = isSameMonth(day, month);
                    const todayDay = isToday(day);
                    const hasEvent = inMonth && dayEvs.length > 0;
                    const primaryEvent = hasEvent ? dayEvs[0] : null;
                    const eventColor = primaryEvent ? (COUNCIL_COLORS[primaryEvent.councilId] || '#ffe17c') : null;

                    // Set styles dynamically if there is an event
                    const cellStyle = {};
                    let cellClasses = 'relative rounded-xl p-1.5 sm:p-2.5 min-h-[74px] sm:min-h-[92px] flex flex-col justify-between transition-all duration-300';
                    
                    if (todayDay) {
                      cellClasses += ' bg-[#ffe17c]/10 border border-[#ffe17c]/35 shadow-[0_0_24px_rgba(255,225,124,0.08),inset_0_1px_0_rgba(255,225,124,0.15)]';
                    } else if (inMonth) {
                      if (hasEvent) {
                        cellClasses += ' border hover:brightness-125 cursor-pointer';
                        cellStyle.background = `${eventColor}24`;
                        cellStyle.borderColor = `${eventColor}bf`;
                        cellStyle.boxShadow = `inset 0 0 15px ${eventColor}20, 0 0 20px ${eventColor}40`;
                      } else {
                        cellClasses += ' bg-white/[0.022] border border-white/[0.04] hover:bg-white/[0.04]';
                      }
                    } else {
                      cellClasses += ' bg-transparent border border-transparent';
                    }

                    return (
                      <motion.div key={di}
                        whileHover={inMonth ? { scale: 1.03, zIndex: 20 } : {}}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{ position: 'relative', zIndex: 1 }}
                        onClick={() => {
                          if (hasEvent) {
                            onSelectEvent(primaryEvent);
                          }
                        }}
                      >
                        <div className={cellClasses} style={cellStyle}>
                          {/* Top Row: Council name (no glow) and Date Number */}
                          <div className="flex items-center justify-between w-full">
                            <div>
                              {hasEvent && (
                                <span 
                                  className="text-[11px] font-black tracking-wider uppercase font-anton" 
                                  style={{ color: eventColor }}
                                >
                                  {primaryEvent.councilId?.toUpperCase() || primaryEvent.councilName?.slice(0, 8).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className={[
                              'text-[11px] font-bold leading-none flex items-center justify-center w-6 h-6 rounded-lg',
                              todayDay
                                ? 'bg-[#ffe17c] text-[#000] font-black shadow-[0_0_14px_rgba(255,225,124,0.6)]'
                                : inMonth 
                                  ? hasEvent 
                                    ? 'text-white font-extrabold'
                                    : 'text-white/55' 
                                  : 'text-white/12',
                            ].join(' ')}
                            style={hasEvent && !todayDay ? { textShadow: `0 0 6px ${eventColor}` } : {}}>
                              {format(day, 'd')}
                            </span>
                          </div>

                          {/* Event details occupying bottom area */}
                          {hasEvent && (
                            <div className="mt-2 flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: eventColor, boxShadow: `0 0 8px ${eventColor}` }} />
                                <span className="text-[10px] font-black tracking-wide uppercase truncate" style={{ color: eventColor, textShadow: `0 0 8px ${eventColor}30` }}>
                                  {primaryEvent.eventName}
                                </span>
                              </div>
                              {dayEvs.length > 1 && (
                                <span className="text-[8px] font-bold text-white/45 pl-3.5">
                                  +{dayEvs.length - 1} more event{dayEvs.length > 2 ? 's' : ''}
                                </span>
                              )}
                            </div>
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
      </div>
    </div>
  );
}

// ─── Marquee Council Names ────────────────────────────────────────────────────
const COUNCILS = [
  'IEEE-WIE', 'CSI', 'ACM', 'ASME', 'E-Cell', 'FSAI',
  'Team Robix', 'Team Abadha', 'Team CFR', 'GDA', 'NSS',
  'Mozilla Codelabs', 'GDSC', 'Rotaract Club', 'TEDx CRCE',
];
function Marquee() {
  return (
    <div className="relative overflow-hidden py-3 my-8">
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#000] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#000] to-transparent z-10 pointer-events-none" />
      <div className="flex" style={{ animation: 'marquee 30s linear infinite' }}>
        {[...COUNCILS, ...COUNCILS].map((name, i) => (
          <span key={i} className="flex items-center gap-4 mr-8 shrink-0">
            <span className="text-white/20 text-xs font-bold uppercase tracking-[0.2em]">{name}</span>
            <span className="w-1 h-1 rounded-full bg-[#ffe17c]/30" />
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllEvents();
      const resolved = data
        .map(e => ({ ...e, _status: resolveStatus(e), _startDate: toDate(e.startDate) }))
        .sort((a, b) => (a._startDate || 0) - (b._startDate || 0));
      setEvents(resolved);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch();
    document.body.style.background = '#000';
    return () => { document.body.style.background = '#fff'; };
  }, [fetch]);

  const stats = {
    total: events.length,
    upcoming: events.filter(e => e._status === 'approved').length,
    closed: events.filter(e => e._status === 'closed').length,
  };
  const next = events.find(e => e._status === 'approved' && e._startDate > new Date());
  const calEvs = events.filter(e => ['proposal_approved', 'permissions_submitted', 'permissions_revision_needed', 'approved', 'report_pending', 'closed'].includes(e._status) && e._startDate);

  return (
    <div className="min-h-screen bg-[#000] text-white font-satoshi overflow-x-hidden selection:bg-[#ffe17c] selection:text-black">

      {/* ── CSS Scroll-driven reveal keyframes (injected as style tag) ── */}
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes reveal-up {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @supports ((animation-timeline: scroll()) and (animation-range: 0% 100%)) {
          .scroll-reveal {
            animation: reveal-up linear both;
            animation-timeline: view();
            animation-range: entry 0% entry 30%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .scroll-reveal { animation: none !important; opacity: 1 !important; transform: none !important; }
          [style*="animation"] { animation: none !important; }
        }
        .noise-overlay::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 1;
          opacity: 0.35;
        }
      `}</style>

      {/* ── AMBIENT LAYERS ──────────────────────────────────────────────── */}
      <div className="noise-overlay" />
      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* Massive glow orbs */}
      <div className="fixed top-[-40%] left-1/2 -translate-x-1/2 w-[160%] h-[80vh] rounded-full blur-[180px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(255,225,124,0.035) 0%, transparent 65%)' }} />
      <div className="fixed bottom-[-30%] right-[-20%] w-[60vw] h-[60vh] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.025) 0%, transparent 70%)' }} />
      <div className="fixed top-[40%] left-[-20%] w-[50vw] h-[50vh] rounded-full blur-[130px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.02) 0%, transparent 70%)' }} />


      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-16 pb-16 px-6 z-10">
        <div className="max-w-7xl mx-auto w-full">

          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10b981]" />
            </span>
            <span className="text-[#10b981] text-[11px] font-bold uppercase tracking-[0.2em]">Live Events Portal</span>
          </motion.div>

          {/* Main headline */}
          <div className="overflow-hidden mb-4">
            <motion.h1
              initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-anton text-[clamp(3.5rem,12vw,11rem)] leading-[0.82] tracking-tight text-white"
            >
              FR.CRCE
            </motion.h1>
          </div>
          <div className="overflow-hidden mb-4">
            <motion.h1
              initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="font-anton text-[clamp(3rem,10vw,9rem)] leading-[0.82] tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #ffe17c 0%, #f59e0b 50%, #ffe17c 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              OFFICIAL
            </motion.h1>
          </div>
          <div className="overflow-hidden mb-10">
            <motion.h1
              initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="font-anton text-[clamp(3rem,10vw,9rem)] leading-[0.82] tracking-tight text-white/[0.12]"
            >
              EVENTS PORTAL
            </motion.h1>
          </div>

          {/* Sub text + CTA row */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-8"
          >
            <div className="max-w-md">
              <p className="text-white/35 text-base md:text-lg leading-relaxed font-medium">
                A unified platform for tracking, approving, and publishing every student council event at Fr. CRCE.
              </p>
              {/* Portal CTAs */}
              <div className="flex items-center gap-4 flex-wrap mt-6">
                <Link
                  to="/portal"
                  className="px-6 py-3.5 text-xs font-semibold text-white/50 hover:text-white border border-white/[0.07] hover:border-white/[0.15] rounded-xl transition-all duration-300 hover:bg-white/[0.04] cursor-pointer"
                >
                  Council Login
                </Link>
                <Link
                  to="/admin"
                  className="group relative px-6 py-3.5 text-xs font-bold uppercase tracking-[0.15em] overflow-hidden rounded-xl cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#ffe17c]/70 via-[#ffe17c] to-[#ffe17c]/70 p-[1px]">
                    <div className="w-full h-full rounded-[11px] bg-black group-hover:bg-[#ffe17c]/10 transition-colors duration-400" />
                  </div>
                  <span className="relative z-10 text-[#ffe17c] group-hover:text-white transition-colors duration-300">Admin Login</span>
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ boxShadow: '0 0 32px rgba(255,225,124,0.3)' }} />
                </Link>
              </div>
            </div>

            {/* Scroll hint */}
            <div className="hidden md:flex flex-col items-center gap-2 opacity-30">
              <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-white/50">Scroll</span>
              <div className="w-[1px] h-12 bg-gradient-to-b from-white/50 to-transparent" />
            </div>
          </motion.div>

          {/* Next Major Event - Glassmorphism card */}
          {next && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.6, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => setDetail(next)}
              className="relative group cursor-pointer mt-14 overflow-hidden"
            >
              {/* Animated gradient border */}
              <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-[#ffe17c]/30 via-white/5 to-[#ffe17c]/10">
                <div className="w-full h-full rounded-2xl bg-[#070707]" />
              </div>
              <div className="relative rounded-2xl backdrop-blur-xl bg-white/[0.02] p-8 md:p-10 transition-colors duration-500 group-hover:bg-white/[0.04]">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#ffe17c]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div>
                    <p className="text-[#ffe17c]/60 text-[10px] font-bold uppercase tracking-[0.22em] mb-3 flex items-center gap-2.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffe17c] opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ffe17c]" />
                      </span>
                      Next Approved Event
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-1.5">{next.eventName}</h2>
                    <p className="text-white/35 text-sm">{next.councilName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right bg-white/[0.04] border border-white/[0.07] rounded-xl p-4">
                      <p className="text-white/25 text-[10px] uppercase font-bold tracking-[0.15em] mb-1">Date</p>
                      <p className="text-white font-semibold text-base">{format(next._startDate, 'EEE, MMM d')}</p>
                      <p className="text-[#ffe17c]/70 text-sm font-bold">{format(next._startDate, 'h:mm a')}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#ffe17c]/10 border border-[#ffe17c]/20 flex items-center justify-center text-[#ffe17c] group-hover:bg-[#ffe17c]/20 transition-colors duration-300 shrink-0">
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── COUNCIL MARQUEE ─────────────────────────────────────────────── */}
      <div className="relative z-10 border-y border-white/[0.04] py-1">
        <Marquee />
      </div>



      {/* ── CALENDAR ────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-12 px-6 pb-28">
        <div className="max-w-7xl mx-auto">
          <Reveal className="mb-10">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <p className="text-white/20 text-[11px] uppercase tracking-[0.25em] font-bold mb-3">Event Schedule</p>
                <h2 className="font-anton text-4xl md:text-5xl text-white tracking-tight">CALENDAR</h2>
              </div>
              <p className="text-white/25 text-sm max-w-sm leading-relaxed">
                All approved and past events are shown. Click any event for full details.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {/* Glassmorphism Calendar Container */}
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-br from-white/12 via-white/4 to-transparent">
                <div className="w-full h-full rounded-3xl bg-[#050505]" />
              </div>
              <div className="relative rounded-3xl bg-white/[0.02] backdrop-blur-2xl p-6 sm:p-10">
                {/* Inner glow */}
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,225,124,0.03) 0%, transparent 60%)' }} />
                <FloatingCalendar events={calEvs} onSelectEvent={setDetail} loading={loading} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.05] py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-8">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 flex items-center justify-center">
              <img src="/logo.png" alt="FR.CRCE Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-anton text-lg text-white tracking-wide">FR.CRCE COUNCILS</p>
              <p className="text-white/30 text-xs uppercase tracking-[0.2em] mt-1">Official Events Portal</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/[0.04] flex items-center justify-center">
          <p className="text-white/15 text-[10px] uppercase tracking-[0.25em] font-medium text-center">
            Fr. Conceicao Rodrigues College of Engineering · Bandra, Mumbai
          </p>
        </div>
      </footer>

      {/* ── EVENT DETAIL MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {detail && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetail(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-lg" />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-[95vw] max-w-2xl flex flex-col max-h-[85vh]"
            >
              <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-white/15 via-white/5 to-transparent">
                <div className="w-full h-full rounded-2xl bg-[#060606]" />
              </div>
              <div className="relative rounded-2xl bg-[#060606] flex flex-col max-h-[85vh]">
                <button onClick={() => setDetail(null)}
                  className="absolute top-5 right-5 z-10 w-8 h-8 bg-white/[0.06] border border-white/[0.08] rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.12] transition-all">
                  <X size={14} />
                </button>
                <div className="p-8 border-b border-white/[0.05] shrink-0 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px]"
                    style={{ background: `linear-gradient(90deg, transparent 0%, ${COUNCIL_COLORS[detail.councilId] || '#ffe17c'} 50%, transparent 100%)` }} />
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/[0.05] text-white/45 border border-white/[0.06]">{detail.councilName}</span>
                    {(() => {
                      const s = STATUS_CONFIG[detail._status] || STATUS_CONFIG.closed;
                      const I = s.icon;
                      return (
                        <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border"
                          style={{ background: `${s.color}12`, color: s.color, borderColor: `${s.color}25` }}>
                          <I size={11} /> {s.label}
                        </span>
                      );
                    })()}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">{detail.eventName}</h2>
                  <div className="flex flex-wrap gap-4 text-sm text-white/35">
                    <span className="flex items-center gap-1.5"><CalendarIcon size={13} /> {format(detail._startDate, 'EEEE, MMM d · h:mm a')}</span>
                    {detail.venue && <span className="flex items-center gap-1.5"><MapPin size={13} /> {detail.venue}</span>}
                  </div>
                </div>
                <div className="p-8 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {[
                      { icon: Users, label: 'Expected Footfall', value: detail.expectedFootfall || 'N/A' },
                      { icon: Ticket, label: 'Registration', value: detail.registrationFeeApplicable ? `₹${detail.registrationFeeAmount}` : 'Free' },
                    ].map(({ icon: I, label, value }) => (
                      <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                        <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5"><I size={12} /> {label}</p>
                        <p className="text-xl text-white font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {detail.prizeMoneyApplicable && (
                      <div className="bg-amber-500/[0.07] border border-amber-500/[0.15] rounded-xl p-4">
                        <p className="text-amber-400/60 text-[10px] font-bold uppercase tracking-[0.15em] mb-1 flex items-center gap-1.5"><Trophy size={12} /> Prize Pool</p>
                        <p className="text-white font-semibold">₹{detail.prizeMoneyAmount} <span className="text-white/30 font-normal text-sm">({detail.prizeMoneySource})</span></p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                      <div>
                        <p className="text-white/25 text-[10px] uppercase tracking-[0.15em] font-bold mb-1.5">Student Contact</p>
                        <p className="text-sm text-white/80">{detail.studentContactName}</p>
                        <p className="text-xs text-white/35">{detail.studentContactPhone}</p>
                      </div>
                      <div>
                        <p className="text-white/25 text-[10px] uppercase tracking-[0.15em] font-bold mb-1.5">Faculty Coordinator</p>
                        <p className="text-sm text-white/80">{detail.facultyCoordinatorName}</p>
                      </div>
                    </div>
                    {(detail.safetyArrangementNeeded || detail.venuePermissionApplicable) && (
                      <div className="flex gap-2 flex-wrap">
                        {detail.safetyArrangementNeeded && <span className="px-3 py-1.5 rounded-lg bg-orange-500/[0.07] text-orange-400 text-xs font-bold border border-orange-500/[0.14]">Safety Required</span>}
                        {detail.venuePermissionApplicable && <span className="px-3 py-1.5 rounded-lg bg-teal-500/[0.07] text-teal-400 text-xs font-bold border border-teal-500/[0.14]">Venue Permit</span>}
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
