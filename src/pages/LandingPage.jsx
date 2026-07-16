import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Calendar as CalendarIcon, MapPin, Users, Trophy, Ticket, X,
  Activity, CheckCircle, Clock, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { getAllEvents } from '../lib/events';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

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

// Custom Toolbar for the Calendar to match our Glassmorphism UI
const CustomToolbar = (toolbar) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');

  return (
    <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
      <h2 className="text-2xl md:text-3xl font-anton text-white tracking-wide">
        {toolbar.label}
      </h2>

      <div className="inline-flex bg-white/5 border border-white/10 rounded-full p-1 backdrop-blur-md">
        {['month', 'agenda'].map(view => (
          <button
            key={view}
            onClick={() => toolbar.onView(view)}
            className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${toolbar.view === view
              ? 'bg-white/10 text-white shadow-[inset_0_0_12px_rgba(255,255,255,0.2),_0_4px_15px_rgba(0,0,0,0.4)] border border-white/20'
              : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
          >
            {view}
          </button>
        ))}
      </div>
    </div>
  );
};

// Custom Event Rendering in the Calendar
const CustomEvent = ({ event }) => {
  const rawEvent = event.resource;
  return (
    <div className="flex items-center gap-1.5 px-2 overflow-hidden w-full h-full" title={event.title}>
      <span className="text-[10px] font-bold leading-tight truncate text-white/90 drop-shadow-sm">{event.title}</span>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
export default function LandingPage() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 1000], [0, 400]);

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [councilFilter, setCouncilFilter] = useState('all');
  const [detailEvent, setDetailEvent] = useState(null);

  // Calendar state
  const [currentView, setCurrentView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());

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

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const stats = {
    total: allEvents.length,
    upcoming: allEvents.filter(e => e._status === 'approved').length,
    pending: allEvents.filter(e => ['submitted', 'revision_needed'].includes(e._status)).length,
    closed: allEvents.filter(e => e._status === 'closed').length,
  };

  const filteredEvents = allEvents.filter(e => {
    if (statusFilter !== 'all' && e._status !== statusFilter) return false;
    if (councilFilter !== 'all' && e.councilId !== councilFilter) return false;
    return true;
  });

  const nextMajorEvent = allEvents.find(e => e._status === 'approved' && e._startDate > new Date());
  const allCouncilIds = [...new Set(allEvents.map(e => e.councilId))].filter(Boolean);

  // Map to format required by react-big-calendar
  const calendarEvents = filteredEvents
    .filter(e => ['approved', 'report_pending', 'closed'].includes(e._status))
    .map(e => {
    const start = e._startDate;
    const fallbackEnd = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours default
    const end = toDate(e.endDate) || fallbackEnd;
    return {
      title: e.eventName,
      start,
      end,
      resource: e,
    };
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-satoshi selection:bg-[#ffe17c] selection:text-black relative overflow-x-hidden">
      {/* ── AMBIENT BACKGROUND GLOWS ───────────────────────────────────── */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#ffe17c]/5 rounded-full blur-[150px] pointer-events-none transform-gpu -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none transform-gpu -z-10" />



      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24 relative z-10">
        {/* ── HERO SPOTLIGHT ───────────────────────────────────────────── */}
        <div className="mb-16 relative z-0">
          <motion.div style={{ y: heroY }}>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="font-anton text-6xl md:text-8xl leading-[0.9] text-white tracking-tight mb-8"
            >
              Fr.CRCE OFFICIAL <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffe17c] to-amber-400">EVENTS PORTAL</span>
            </motion.h1>
          </motion.div>

          {nextMajorEvent && statusFilter === 'all' && councilFilter === 'all' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              onClick={() => setDetailEvent(nextMajorEvent)}
              className="relative z-10 group cursor-pointer rounded-3xl overflow-hidden border border-white/10 bg-[#050505]/60 backdrop-blur-xl p-8 transition-all hover:bg-[#050505]/80 hover:border-white/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#ffe17c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <p className="text-[#ffe17c] text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffe17c] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffe17c]"></span>
                </span>
                Next Major Event
              </p>
              <div className="grid md:grid-cols-2 gap-8 items-end">
                <div>
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-2 relative z-10">{nextMajorEvent.eventName}</h2>
                  <p className="text-white/60 text-lg relative z-10">{nextMajorEvent.councilName}</p>
                </div>
                <div className="md:text-right relative z-10">
                  <div className="inline-flex flex-col text-left bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-white/40 text-xs uppercase font-bold tracking-wider mb-1">Date</p>
                    <p className="text-xl font-medium text-white">{format(nextMajorEvent._startDate, 'EEEE, MMMM d')}</p>
                    <p className="text-[#ffe17c] font-bold mt-1">{format(nextMajorEvent._startDate, 'h:mm a')}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── STATS BENTO ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-16 relative z-10"
        >
          {[
            { label: 'Total Events', val: stats.total, color: 'text-white' },
            { label: 'Upcoming', val: stats.upcoming, color: 'text-[#10b981]' },
            { label: 'Completed', val: stats.closed, color: 'text-[#94a3b8]' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
              <div className={`font-anton text-4xl md:text-5xl mb-2 ${s.color}`}>{loading ? '—' : s.val}</div>
              <div className="text-white/40 text-xs uppercase tracking-widest font-bold">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* ── FULL CALENDAR GRID ───────────────────────────────────────── */}
        <div className="p-[1px] rounded-3xl bg-gradient-to-br from-white/20 via-white/5 to-transparent">
          <div className="bg-[#0a0a0a]/80 rounded-[23px] p-4 sm:p-8 backdrop-blur-xl">
            {loading ? (
              <div className="h-[600px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#ffe17c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="h-[700px] calendar-dark-theme">
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  views={['month', 'agenda']}
                  view={currentView}
                  onView={setCurrentView}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  onSelectEvent={(e) => setDetailEvent(e.resource)}
                  components={{
                    toolbar: CustomToolbar,
                    event: CustomEvent,
                  }}
                  eventPropGetter={(event) => {
                    const councilColor = COUNCIL_COLORS[event.resource.councilId] || '#fff';
                    return {
                      style: {
                        backgroundColor: `${councilColor}1A`,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: `1px solid ${councilColor}40`,
                        color: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '9999px',
                        boxShadow: `0 0 15px 0 ${councilColor}33`,
                        margin: '2px',
                        padding: '1px 0'
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER LINKS ─────────────────────────────────────────────── */}
        <div className="mt-12 mb-4 flex items-center justify-center gap-6">
          <Link to="/portal" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">Council Login</Link>
          <Link to="/admin" className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest bg-white text-black rounded-full hover:bg-[#ffe17c] hover:shadow-[0_0_20px_rgba(255,225,124,0.4)] transition-all duration-300">
            Admin Login
          </Link>
        </div>
      </div>


      {/* ── EVENT DETAIL MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {detailEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetailEvent(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <button
                onClick={() => setDetailEvent(null)}
                className="absolute top-6 right-6 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-colors z-10"
              >
                <X size={16} />
              </button>

              <div className="p-8 border-b border-white/5 relative overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: COUNCIL_COLORS[detailEvent.councilId] || '#fff' }} />
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/60">
                    {detailEvent.councilName}
                  </span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ backgroundColor: `${(STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).color}20`, color: (STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).color }}>
                    {(() => { const Icon = (STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).icon; return <Icon size={12} />; })()}
                    {(STATUS_CONFIG[detailEvent._status] || STATUS_CONFIG.closed).label}
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 leading-tight relative z-10">{detailEvent.eventName}</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 relative z-10">
                  <div className="flex items-center gap-1.5"><CalendarIcon size={14} /> {format(detailEvent._startDate, 'EEEE, MMM d, yyyy · h:mm a')}</div>
                  {detailEvent.venue && <div className="flex items-center gap-1.5"><MapPin size={14} /> {detailEvent.venue}</div>}
                </div>
              </div>

              <div className="p-8 overflow-y-auto">
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="bg-white/5 rounded-2xl p-4">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2"><Users size={14} /> Expected Footfall</p>
                    <p className="text-xl text-white font-medium">{detailEvent.expectedFootfall || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2"><Ticket size={14} /> Registration</p>
                    <p className="text-xl text-white font-medium">{detailEvent.registrationFeeApplicable ? `₹${detailEvent.registrationFeeAmount}` : 'Free'}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {detailEvent.prizeMoneyApplicable && (
                    <div>
                      <h4 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Trophy size={14} /> Prize Pool</h4>
                      <p className="text-white bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl inline-block">₹{detailEvent.prizeMoneyAmount} <span className="text-white/40 ml-2">({detailEvent.prizeMoneySource})</span></p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6 bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <div>
                      <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">Student Contact</h4>
                      <p className="text-sm text-white">{detailEvent.studentContactName}</p>
                      <p className="text-xs text-white/50">{detailEvent.studentContactPhone}</p>
                    </div>
                    <div>
                      <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">Faculty Coordinator</h4>
                      <p className="text-sm text-white">{detailEvent.facultyCoordinatorName}</p>
                    </div>
                  </div>

                  {(detailEvent.safetyArrangementNeeded || detailEvent.venuePermissionApplicable) && (
                    <div className="flex gap-2 flex-wrap pt-2">
                      {detailEvent.safetyArrangementNeeded && <span className="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 text-xs font-bold border border-orange-500/20">Safety Measures Required</span>}
                      {detailEvent.venuePermissionApplicable && <span className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-bold border border-teal-500/20">Venue Perm Required</span>}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
