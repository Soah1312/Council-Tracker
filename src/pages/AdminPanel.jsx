import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, updateEventStatus } from '../lib/events';
import { format } from 'date-fns';

const COUNCILS = [
  // Professional Chapters
  { id: 'ieee-wie', name: 'IEEE & WIE' },
  { id: 'csi', name: 'CSI' },
  { id: 'acm', name: 'ACM' },
  { id: 'asme', name: 'ASME' },
  { id: 'e-cell', name: 'E-Cell' },
  { id: 'fsai', name: 'FSAI' },
  
  // Technical Teams
  { id: 'team-robix', name: 'Team Robix' },
  { id: 'team-abadha', name: 'Team Abadha' },
  { id: 'team-cfr', name: 'Team CFR' },
  { id: 'team-vaayushastra', name: 'Team Vaayushastra' },
  { id: 'team-mavericks', name: 'Team Mavericks' },
  { id: 'project-cell', name: 'Project Cell' },
  
  // Technical Student Clubs
  { id: 'mozilla-codelabs', name: 'Mozilla & Codelabs' },
  { id: 'gdsc', name: 'GDSC' },
  { id: 'gda', name: 'GDA' },
  
  // Additional Societies
  { id: 'nss', name: 'NSS' },
  { id: 'rotaract-club', name: 'Rotaract Club' },
  { id: 'tedx', name: 'TEDx' }
];

export default function AdminPanel() {
  // Passcode Security Gate State
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  const [activeSubTab, setActiveSubTab] = useState('dashboard'); // 'dashboard' | 'review' | 'logbook' | 'calendar'
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // ID of event being reviewed
  const [notification, setNotification] = useState(null);
  
  // Search and date filters (applied client-side on allEvents)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [councilFilter, setCouncilFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Calendar navigation state
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 6, 1)); // Default July 2026

  // Review Dialog state
  const [reviewingEvent, setReviewingEvent] = useState(null);
  const [reviewStatusType, setReviewStatusType] = useState(''); // 'approved' | 'rejected' | 'revision_needed'
  const [reviewNotes, setReviewNotes] = useState('');

  // Event Detail Modal (Phase 7)
  const [selectedEventDetail, setSelectedEventDetail] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch all events to maintain consistent counters on dashboard
      const data = await getAllEvents();
      
      // Auto-transition events with status === 'approved' and past endDate to 'report_pending' client-side
      const processed = data.map(event => {
        if (event.status === 'approved') {
          const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
          if (endDate < new Date()) {
            return { ...event, status: 'report_pending' };
          }
        }
        return event;
      });
      
      setAllEvents(processed);
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch events from Firestore.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchEvents();
    }
  }, [authenticated]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    const correctPasscode = import.meta.env.VITE_ADMIN_PASSCODE || 'admin123';
    if (passcode === correctPasscode) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setAuthenticated(true);
      setPasscodeError('');
    } else {
      setPasscodeError('INVALID PASSCODE. ACCESS DENIED.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setAuthenticated(false);
    setPasscode('');
  };

  const openReviewDialog = (event, statusType) => {
    setReviewingEvent(event);
    setReviewStatusType(statusType);
    setReviewNotes('');
  };

  const submitReview = async () => {
    if (!reviewingEvent) return;

    // Enforce required notes/comments for Reject and Request Revision
    if ((reviewStatusType === 'rejected' || reviewStatusType === 'revision_needed') && !reviewNotes.trim()) {
      showNotification('Comments/notes are required when rejecting or requesting revisions.', 'error');
      return;
    }
    
    setActionLoading(reviewingEvent.id);
    try {
      await updateEventStatus(reviewingEvent.id, reviewStatusType, reviewNotes);
      showNotification(`Proposal marked as ${reviewStatusType.replace('_', ' ')}.`);
      setReviewingEvent(null);
      // Close the details modal drawer on success
      setSelectedEventDetail(null);
      fetchEvents();
    } catch (err) {
      showNotification('Failed to submit review notes.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const exportToCSV = () => {
    if (filteredEvents.length === 0) {
      showNotification('No events to export.', 'error');
      return;
    }

    const headers = [
      'Event ID',
      'Council',
      'Event Name',
      'Category',
      'Start Date',
      'End Date',
      'Venue',
      'Status',
      'Expected Footfall',
      'Student Contact Name',
      'Student Contact Phone',
      'Faculty Coordinator'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const stringVal = String(val);
      return `"${stringVal.replace(/"/g, '""')}"`;
    };

    const csvRows = [
      headers.join(','),
      ...filteredEvents.map(event => {
        const isRepPending = isReportPending(event);
        const displayStatus = isRepPending ? 'report pending' : event.status;
        const councilName = event.jointWith ? `${event.councilName} x ${event.jointWith}` : event.councilName;
        
        const startDate = formatEventDate(event.startDate, 'yyyy-MM-dd HH:mm');
        const endDate = formatEventDate(event.endDate, 'yyyy-MM-dd HH:mm');

        return [
          escapeCSV(event.eventId),
          escapeCSV(councilName),
          escapeCSV(event.eventName),
          escapeCSV(event.category),
          escapeCSV(startDate),
          escapeCSV(endDate),
          escapeCSV(event.venue),
          escapeCSV(displayStatus),
          escapeCSV(event.expectedFootfall),
          escapeCSV(event.studentContactName),
          escapeCSV(event.studentContactPhone),
          escapeCSV(event.facultyCoordinatorName)
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `events_registry_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('CSV exported successfully.');
  };

  // Convert dates to human readable string
  const formatEventDate = (dateField, pattern = 'MMM dd, yyyy h:mm a') => {
    if (!dateField) return 'N/A';
    let dateJS = dateField;
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      dateJS = dateField.toDate();
    } else if (dateField.seconds) {
      dateJS = new Date(dateField.seconds * 1000);
    } else {
      dateJS = new Date(dateField);
    }
    try {
      return format(dateJS, pattern);
    } catch (err) {
      return String(dateField);
    }
  };

  // Helper date diff calculations
  const getDaysDiff = (dateField) => {
    if (!dateField) return 0;
    const dateJS = dateField.toDate ? dateField.toDate() : new Date(dateField);
    const diffTime = new Date() - dateJS;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 0 ? 0 : diffDays;
  };

  const getDaysDiffFuture = (dateField) => {
    if (!dateField) return 0;
    const dateJS = dateField.toDate ? dateField.toDate() : new Date(dateField);
    const diffTime = dateJS - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 0 ? 0 : diffDays;
  };

  // Status helper predicates
  const isReportPending = (event) => {
    return event.status === 'report_pending';
  };

  const isReportOverdue = (event) => {
    if (event.status !== 'report_pending') return false;
    if (!event.reportDueDate) return false;
    const dueDate = event.reportDueDate.toDate ? event.reportDueDate.toDate() : new Date(event.reportDueDate);
    return dueDate < new Date();
  };

  const isUpcoming = (event) => {
    if (event.status !== 'approved') return false;
    const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    return startDate > new Date();
  };

  // Clash checking function for venue overlaps (only for active approved/upcoming events)
  const hasClash = (evt, eventsList) => {
    if (evt.status !== 'approved' && evt.status !== 'report_pending' && evt.status !== 'closed') return false;
    if (!evt.venue) return false;
    const startA = evt.startDate?.toDate ? evt.startDate.toDate().getTime() : new Date(evt.startDate).getTime();
    const endA = evt.endDate?.toDate ? evt.endDate.toDate().getTime() : new Date(evt.endDate).getTime();
    const venueA = evt.venue.toLowerCase().trim();
    
    return eventsList.some(other => {
      if (other.eventId === evt.eventId) return false;
      if (other.status !== 'approved' && other.status !== 'report_pending' && other.status !== 'closed') return false;
      if (!other.venue) return false;
      const venueB = other.venue.toLowerCase().trim();
      if (venueA !== venueB) return false;
      
      const startB = other.startDate?.toDate ? other.startDate.toDate().getTime() : new Date(other.startDate).getTime();
      const endB = other.endDate?.toDate ? other.endDate.toDate().getTime() : new Date(other.endDate).getTime();
      
      return startA < endB && endA > startB;
    });
  };

  // Calendar day builder
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const getCategoryChipClass = (category) => {
    switch (category) {
      case 'technical':
        return 'bg-[#171e19] text-white';
      case 'cultural':
        return 'bg-[#b7c6c2] text-[#171e19] border border-[#171e19]/20';
      case 'sports':
        return 'bg-[#ffe17c] text-[#171e19] border border-[#171e19]/25';
      case 'workshop':
        return 'bg-[#ffe17c]/50 text-[#171e19] border border-[#171e19]/10';
      case 'guest_lecture':
        return 'bg-[#272727] text-white';
      case 'competition':
        return 'bg-[#ffe17c] text-[#171e19] border border-[#171e19]';
      default:
        return 'bg-[#b7c6c2]/50 text-[#171e19]';
    }
  };

  const getBadgeClass = (event) => {
    const isRepPending = isReportPending(event);
    if (isRepPending) return 'bg-[#171e19] text-white border-2 border-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold';
    switch (event.status) {
      case 'submitted':
        return 'bg-[#b7c6c2] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold';
      case 'approved':
        return 'bg-emerald-950 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold';
      case 'rejected':
        return 'bg-red-800 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold';
      case 'revision_needed':
        return 'bg-[#ffe17c] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold border border-[#171e19]';
      case 'closed':
        return 'bg-[#b7c6c2] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold';
      default:
        return 'bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-[10px] uppercase font-bold';
    }
  };

  // Dynamic Dashboard Stats Counters
  const countPendingReview = allEvents.filter(e => e.status === 'submitted').length;
  const countApprovedUpcoming = allEvents.filter(isUpcoming).length;
  const countReportPending = allEvents.filter(isReportPending).length;
  const countOverdueReports = allEvents.filter(isReportOverdue).length;

  // "Needs Attention" List Compilation & Urgency Sorting
  const getNeedsAttentionList = () => {
    const overdue = allEvents.filter(isReportOverdue);
    const pending = allEvents.filter(e => e.status === 'submitted');
    
    const sortedOverdue = overdue.sort((a, b) => {
      const dateA = a.reportDueDate?.toDate ? a.reportDueDate.toDate() : new Date(a.reportDueDate);
      const dateB = b.reportDueDate?.toDate ? b.reportDueDate.toDate() : new Date(b.reportDueDate);
      return dateA - dateB;
    });
    
    const sortedPending = pending.sort((a, b) => {
      const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
      const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
      return dateA - dateB;
    });
    
    return [
      ...sortedOverdue.map(e => ({ ...e, attentionReason: 'overdue' })),
      ...sortedPending.map(e => ({ ...e, attentionReason: 'pending' }))
    ];
  };

  const needsAttentionList = getNeedsAttentionList();

  // Registry Search & Filter (applied locally)
  const filteredEvents = allEvents.filter(event => {
    if (statusFilter !== 'All') {
      if (statusFilter === 'report_pending') {
        if (!isReportPending(event)) return false;
      } else if (event.status !== statusFilter) {
        return false;
      }
    }
    if (councilFilter !== 'All' && event.councilId !== councilFilter) return false;
    if (categoryFilter !== 'All' && event.category !== categoryFilter) return false;
    
    if (startDateFilter) {
      const filterStart = new Date(startDateFilter).getTime();
      const eventStart = event.startDate?.toDate ? event.startDate.toMillis() : new Date(event.startDate).getTime();
      if (eventStart < filterStart) return false;
    }
    if (endDateFilter) {
      const filterEnd = new Date(endDateFilter).getTime();
      const eventEnd = event.endDate?.toDate ? event.endDate.toMillis() : new Date(event.endDate).getTime();
      if (eventEnd > filterEnd) return false;
    }

    const text = searchTerm.toLowerCase();
    const matchesSearch = 
      (event.eventName && event.eventName.toLowerCase().includes(text)) ||
      (event.eventId && event.eventId.toLowerCase().includes(text));
      
    return matchesSearch;
  });

  const pendingEvents = allEvents.filter(e => e.status === 'submitted');

  // PASSCODE LOCK SCREEN RENDER
  if (!authenticated) {
    return (
      <div className="min-h-screen grid-pattern-charcoal flex items-center justify-center px-4 py-12">
        <div className="bg-white border-4 border-[#171e19] p-8 md:p-10 max-w-md w-full space-y-8 shadow-[8px_8px_0px_0px_#ffe17c] rounded-none">
          <div className="text-center space-y-2">
            <h1 className="font-anton text-5xl md:text-6xl text-[#171e19] tracking-tight">
              COUNCILTRACK<span className="text-[#ffe17c]">.</span>
            </h1>
            <p className="font-satoshi text-xs uppercase tracking-widest text-[#b7c6c2] font-bold">
              Administrative Access
            </p>
          </div>

          <form onSubmit={handlePasscodeSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2] block">
                Enter Administrator Passcode
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passcode}
                onChange={e => {
                  setPasscode(e.target.value);
                  setPasscodeError('');
                }}
                className={`w-full bg-white border-2 px-4 py-3 text-sm text-[#171e19] font-satoshi text-center tracking-widest focus:outline-none focus:border-[#ffe17c] rounded-none transition-brutal ${
                  passcodeError ? 'border-red-500' : 'border-[#171e19]'
                }`}
              />
              {passcodeError && (
                <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide mt-1 text-center">
                  {passcodeError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-[#ffe17c] hover:bg-[#ffe17c]/90 text-[#171e19] font-anton text-lg py-3.5 uppercase tracking-wider transition-brutal border-2 border-[#171e19] rounded-none hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#171e19]"
            >
              UNLOCK DASHBOARD
            </button>
          </form>

          <div className="text-center pt-4 border-t border-[#171e19]/10">
            <Link to="/" className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] hover:underline">
              &larr; BACK TO EVENT PORTAL
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // MAIN ADMIN PANEL VIEW
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center p-4 border transition-all duration-300 transform translate-y-0 rounded-none ${
          notification.type === 'error' 
            ? 'bg-red-50 border-red-500 text-red-800' 
            : 'bg-emerald-50 border-emerald-500 text-emerald-800'
        }`}>
          <div className="font-satoshi text-xs font-bold uppercase tracking-wide">{notification.message}</div>
        </div>
      )}

      {/* Review Dialog Modal Overlay */}
      {reviewingEvent && (
        <div className="fixed inset-0 z-50 bg-[#171e19]/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-white border-4 border-[#171e19] rounded-none w-full max-w-lg p-6 space-y-4 shadow-[8px_8px_0px_0px_#ffe17c]">
            <div>
              <p className="font-satoshi text-[10px] uppercase font-bold text-[#b7c6c2]">Submit Event Review</p>
              <h3 className="font-anton text-2xl text-[#171e19] mt-1 tracking-tight">
                ACTION ON: {reviewingEvent.eventName.toUpperCase()}
              </h3>
              <p className="font-satoshi text-xs text-[#171e19] mt-1 uppercase font-semibold">
                Status Target: <span className="underline">{reviewStatusType.replace('_', ' ')}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">
                Review Comments & Notes {(reviewStatusType === 'rejected' || reviewStatusType === 'revision_needed') && '*'}
              </label>
              <textarea
                rows="4"
                required={reviewStatusType === 'rejected' || reviewStatusType === 'revision_needed'}
                placeholder="Provide details or revision requirements..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-4 py-3 text-sm text-[#171e19] placeholder-[#b7c6c2] outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReviewingEvent(null)}
                className="px-4 py-2 border-2 border-[#171e19] hover:bg-slate-100 font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] rounded-none transition-brutal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReview}
                className="px-5 py-2 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] font-anton text-sm uppercase tracking-widest rounded-none border-2 border-[#171e19] transition-brutal"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT DETAIL DRAWER MODAL */}
      {selectedEventDetail && (
        <div className="fixed inset-0 z-40 bg-[#171e19]/70 backdrop-blur-sm flex justify-end">
          <div className="bg-white border-l-4 border-[#171e19] w-full max-w-2xl h-full overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl flex flex-col justify-between rounded-none animate-slide-left">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[#171e19]/10 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {/* Signature ID Tag */}
                    <span className="font-satoshi text-[10px] font-bold tracking-widest border border-[#171e19] px-2 py-0.5 bg-white text-[#171e19]">
                      {selectedEventDetail.eventId}
                    </span>
                    <span className={getBadgeClass(selectedEventDetail)}>
                      {selectedEventDetail.status}
                    </span>
                  </div>
                  <h3 className="font-anton text-3xl text-[#171e19] leading-tight tracking-tight">
                    {selectedEventDetail.eventName.toUpperCase()}
                  </h3>
                  <p className="font-satoshi text-xs text-[#ffe17c] bg-[#171e19] px-2.5 py-1 inline-block uppercase font-bold tracking-wider mt-1">{selectedEventDetail.councilName}</p>
                </div>
                <button
                  onClick={() => setSelectedEventDetail(null)}
                  className="font-satoshi text-xs font-bold uppercase tracking-wider border-2 border-[#171e19] px-3 py-1.5 hover:bg-slate-100 transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {/* Logistical Grid */}
              <div className="grid grid-cols-2 gap-4 bg-[#b7c6c2]/10 border border-[#171e19]/10 p-4 rounded-none text-xs text-[#171e19]/90 font-satoshi">
                <div>
                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] mb-1">Start Date</span>
                  <span className="font-bold">{formatEventDate(selectedEventDetail.startDate)}</span>
                </div>
                <div>
                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] mb-1">End Date</span>
                  <span className="font-bold">{formatEventDate(selectedEventDetail.endDate)}</span>
                </div>
                <div>
                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] mb-1">Venue Location</span>
                  <span className="font-bold">{selectedEventDetail.venue.toUpperCase()}</span>
                </div>
                <div>
                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] mb-1">Expected Footfall</span>
                  <span className="font-bold">{selectedEventDetail.expectedFootfall} ATTENDEES</span>
                </div>
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-2 gap-4 text-xs text-[#171e19] font-satoshi font-semibold">
                <div>
                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] mb-1">Faculty Coordinator</span>
                  <span className="font-bold">{selectedEventDetail.facultyCoordinatorName.toUpperCase()}</span>
                </div>
                <div>
                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] mb-1">Student Lead POC</span>
                  <span>
                    {selectedEventDetail.studentContactName.toUpperCase()} ({selectedEventDetail.studentContactPhone})
                  </span>
                </div>
              </div>

              {/* Resources */}
              {selectedEventDetail.resourcesNeeded && (
                <div className="space-y-1 text-xs font-satoshi">
                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px]">AV/Resources Requested</span>
                  <p className="italic text-[#171e19]/80 leading-relaxed font-medium">"{selectedEventDetail.resourcesNeeded.toUpperCase()}"</p>
                </div>
              )}

              {/* Safety */}
              {selectedEventDetail.safetyArrangementNeeded && (
                <div className="space-y-1 text-xs font-satoshi">
                  <span className="font-bold text-red-600 uppercase block text-[9px]">Barricading & Safety Arrangements</span>
                  <p className="italic text-red-950 leading-relaxed font-semibold">"{selectedEventDetail.safetyArrangementDetails.toUpperCase()}"</p>
                </div>
              )}

              {/* Document Clearance Links */}
              <div className="space-y-2 border-t border-[#171e19]/10 pt-4 font-satoshi">
                <h4 className="font-bold text-[#b7c6c2] uppercase tracking-wider text-[9px]">Uploaded Clearances</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs uppercase font-bold">
                  <a href={selectedEventDetail.eventDescriptionUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                    📄 PROPOSAL SUMMARY PDF
                  </a>
                  <a href={selectedEventDetail.doswPermissionLetterUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                    📄 DOSW CLEARANCE PDF
                  </a>
                  <a href={selectedEventDetail.councilPermissionLetterUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                    📄 COUNCIL PERMISSION PDF
                  </a>
                  {selectedEventDetail.venuePermissionLetterUrl && (
                    <a href={selectedEventDetail.venuePermissionLetterUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                      📄 VENUE BOOKING SLIP
                    </a>
                  )}
                  {selectedEventDetail.attendanceWaiverUrl && (
                    <a href={selectedEventDetail.attendanceWaiverUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                      📄 WAIVER LEAVE REQUESTS
                    </a>
                  )}
                </div>
              </div>

              {/* Post-Event Report (if closed) */}
              {selectedEventDetail.status === 'closed' && selectedEventDetail.reportPdfUrl && (
                <div className="space-y-3 border-t-2 border-dashed border-[#171e19] pt-4 bg-[#ffe17c]/5 p-4 rounded-none font-satoshi">
                  <h4 className="font-bold text-[#171e19] uppercase tracking-wider text-[10px]">Archived Post-Event Report</h4>
                  <div className="space-y-2 text-xs uppercase font-bold">
                    <a href={selectedEventDetail.reportPdfUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                      📄 Download final wrap-up report PDF
                    </a>
                    {selectedEventDetail.reportSubmittedAt && (
                      <p className="text-[10px] text-[#b7c6c2] lowercase font-semibold">
                        Submitted: {formatEventDate(selectedEventDetail.reportSubmittedAt)}
                      </p>
                    )}
                    {selectedEventDetail.reportImageUrls && selectedEventDetail.reportImageUrls.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <p className="font-semibold text-[#171e19]">Uploaded Photos ({selectedEventDetail.reportImageUrls.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedEventDetail.reportImageUrls.map((url, index) => (
                            <a href={url} target="_blank" rel="noreferrer" key={index} className="w-12 h-12 bg-white border border-[#171e19] rounded-none overflow-hidden flex items-center justify-center shrink-0">
                              <img src={url} alt={`event-${index}`} className="object-cover w-full h-full" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Review actions footer (for pending proposals) */}
            {selectedEventDetail.status === 'submitted' && (
              <div className="flex items-center gap-3 pt-6 border-t-2 border-[#171e19]">
                <button
                  onClick={() => openReviewDialog(selectedEventDetail, 'approved')}
                  className="flex-grow py-3 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest transition-brutal"
                >
                  Approve Request
                </button>
                <button
                  onClick={() => openReviewDialog(selectedEventDetail, 'revision_needed')}
                  className="flex-grow py-3 bg-white border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest transition-brutal"
                >
                  Request Revision
                </button>
                <button
                  onClick={() => openReviewDialog(selectedEventDetail, 'rejected')}
                  className="flex-grow py-3 bg-white border-2 border-red-500 text-red-500 font-anton text-sm uppercase tracking-widest transition-brutal hover:bg-red-50"
                >
                  Reject Request
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-[#171e19] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[#ffe17c] border border-[#171e19]" />
            <p className="font-satoshi text-[10px] uppercase tracking-widest text-[#171e19] font-bold">Administrative Dashboard</p>
          </div>
          <h1 className="font-anton text-4xl text-[#171e19] tracking-tight mt-2">
            DEAN / DOSW CONSOLE
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border-2 border-[#171e19] hover:bg-[#ffe17c]/10 bg-white font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] transition-brutal"
          >
            &larr; PORTAL HOME
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-[#171e19] bg-white font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] hover:bg-[#ffe17c]/10 transition-brutal"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`w-full text-left px-4 py-3 font-anton uppercase tracking-wider text-sm transition-brutal rounded-none flex items-center justify-between border-2 ${
              activeSubTab === 'dashboard'
                ? 'bg-[#171e19] border-[#171e19] text-white'
                : 'bg-white border-[#171e19]/10 hover:border-[#171e19] text-[#171e19]'
            }`}
          >
            <span>Overview Dashboard</span>
          </button>
          
          <button
            onClick={() => setActiveSubTab('review')}
            className={`w-full text-left px-4 py-3 font-anton uppercase tracking-wider text-sm transition-brutal rounded-none flex items-center justify-between border-2 ${
              activeSubTab === 'review'
                ? 'bg-[#171e19] border-[#171e19] text-white'
                : 'bg-white border-[#171e19]/10 hover:border-[#171e19] text-[#171e19]'
            }`}
          >
            <span>Review Proposals</span>
            {pendingEvents.length > 0 && (
              <span className="bg-[#ffe17c] border border-[#171e19] px-2 py-0.5 rounded-full text-[10px] text-[#171e19] font-anton tracking-wider animate-pulse">
                {pendingEvents.length} PENDING
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('logbook')}
            className={`w-full text-left px-4 py-3 font-anton uppercase tracking-wider text-sm transition-brutal rounded-none flex items-center justify-between border-2 ${
              activeSubTab === 'logbook'
                ? 'bg-[#171e19] border-[#171e19] text-white'
                : 'bg-white border-[#171e19]/10 hover:border-[#171e19] text-[#171e19]'
            }`}
          >
            <span>Events Registry</span>
          </button>

          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`w-full text-left px-4 py-3 font-anton uppercase tracking-wider text-sm transition-brutal rounded-none flex items-center justify-between border-2 ${
              activeSubTab === 'calendar'
                ? 'bg-[#171e19] border-[#171e19] text-white'
                : 'bg-white border-[#171e19]/10 hover:border-[#171e19] text-[#171e19]'
            }`}
          >
            <span>Calendar View</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {/* TAB: DASHBOARD */}
          {activeSubTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1 */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm">
                  <p className="font-anton text-7xl text-white">{countPendingReview}</p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">Pending Review</p>
                </div>
                
                {/* Card 2 */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm">
                  <p className="font-anton text-7xl text-white">{countApprovedUpcoming}</p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">Approved Upcoming</p>
                </div>

                {/* Card 3 */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm">
                  <p className="font-anton text-7xl text-white">{countReportPending}</p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">Report Pending</p>
                </div>

                {/* Card 4 - Overdue reports with a yellow left border accent */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm border-l-4 border-l-[#ffe17c]">
                  <p className={`font-anton text-7xl ${countOverdueReports > 0 ? 'text-[#ffe17c] animate-pulse' : 'text-white'}`}>
                    {countOverdueReports}
                  </p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">Overdue Reports</p>
                </div>
              </div>

              {/* Needs Attention Queue (Urgency Sorted) */}
              <div className="bg-white border-2 border-[#171e19] rounded-none p-6 space-y-4 shadow-[4px_4px_0px_0px_#171e19]">
                <div>
                  <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">NEEDS ATTENTION</h3>
                  <p className="font-satoshi text-[10px] text-[#b7c6c2] font-bold uppercase mt-1">
                    Action items (overdue summaries and incoming proposals) sorted by administrative urgency.
                  </p>
                </div>

                {loading ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="py-4 border-b border-[#171e19]/10 last:border-none flex justify-between items-center">
                        <div className="space-y-2 flex-grow">
                          <div className="h-6 bg-[#b7c6c2]/30 w-1/2 rounded-none" />
                          <div className="h-4 bg-[#b7c6c2]/20 w-1/3 rounded-none" />
                        </div>
                        <div className="h-8 bg-[#b7c6c2]/30 w-16 rounded-none" />
                      </div>
                    ))}
                  </div>
                ) : needsAttentionList.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-[#171e19] rounded-none">
                    <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">✓ Clear Desk! No pending items require attention.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#171e19]/10">
                    {needsAttentionList.map(event => {
                      const isOverdue = event.attentionReason === 'overdue';
                      return (
                        <div
                          key={event.eventId}
                          onClick={() => setSelectedEventDetail(event)}
                          className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-[#ffe17c]/5 px-3 -mx-3 rounded-none transition-brutal"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-anton text-lg text-[#171e19] tracking-tight">
                                {event.jointWith ? `${event.eventName.toUpperCase()} (${event.jointWith.toUpperCase()})` : event.eventName.toUpperCase()}
                              </p>
                              <span className="font-satoshi text-[10px] font-bold tracking-widest border border-[#171e19] px-2 py-0.5 bg-white text-[#171e19]">
                                {event.eventId}
                              </span>
                            </div>
                            <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold uppercase tracking-wide">
                              Council: <span className="text-[#171e19] font-bold">{event.councilName}</span> &bull; Venue: {event.venue.toUpperCase()}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {isOverdue ? (
                              <span className="px-2.5 py-0.5 bg-[#ffe17c] border border-[#171e19] text-[#171e19] text-[9px] font-bold uppercase rounded-none">
                                Report Overdue ({getNeedsAttentionList ? `${getDaysDiff(event.reportDueDate)}d` : ''})
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-slate-100 border border-[#171e19]/30 text-[#171e19] text-[9px] font-bold uppercase rounded-none">
                                Review Awaiting (Starts {getNeedsAttentionList ? `${getDaysDiffFuture(event.startDate)}d` : ''})
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEventDetail(event);
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wide transition-brutal rounded-none"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: REVIEW PANEL */}
          {activeSubTab === 'review' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-anton text-3xl text-[#171e19] tracking-tight">Review Queue</h2>
                <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold uppercase tracking-wider mt-1">
                  Verify logistics, target venues, and official clearances. Approve requests or request revisions back to the student councils.
                </p>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map((n) => (
                    <div key={n} className="bg-white border-2 border-[#171e19] p-6 space-y-4 rounded-none animate-pulse">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#171e19]/10 pb-4">
                        <div className="space-y-2 flex-grow">
                          <div className="h-6 bg-[#b7c6c2]/30 w-3/4 rounded-none" />
                          <div className="h-4 bg-[#b7c6c2]/20 w-1/4 rounded-none" />
                        </div>
                        <div className="h-8 bg-[#b7c6c2]/30 w-24 rounded-none shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingEvents.length === 0 ? (
                <div className="bg-white border-2 border-[#171e19] p-12 text-center rounded-none">
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">Clear queue! No pending event proposals to review.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingEvents.map(event => (
                    <div
                      key={event.eventId}
                      className="bg-white border-2 border-[#171e19] p-6 space-y-4 rounded-none"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#171e19]/10 pb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-anton text-xl text-[#171e19] tracking-tight">
                              {event.jointWith ? `${event.eventName.toUpperCase()} (${event.jointWith.toUpperCase()})` : event.eventName.toUpperCase()}
                            </h3>
                            <span className="font-satoshi text-[10px] font-bold tracking-widest border border-[#171e19] px-2 py-0.5 bg-white text-[#171e19] shrink-0">
                              {event.eventId}
                            </span>
                          </div>
                          <p className="font-satoshi text-xs text-[#ffe17c] bg-[#171e19] px-2.5 py-1 inline-block uppercase font-bold tracking-wider mt-1">{event.councilName}</p>
                          <p className="font-satoshi text-[10px] uppercase font-semibold text-[#b7c6c2] mt-1">Contact: {event.studentContactName.toUpperCase()} &bull; {event.studentContactPhone}</p>
                        </div>
                        
                        <div className="flex gap-2 sm:self-start flex-wrap">
                          <button
                            onClick={() => openReviewDialog(event, 'approved')}
                            className="px-4 py-2 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openReviewDialog(event, 'revision_needed')}
                            className="px-4 py-2 bg-white border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                          >
                            Revision
                          </button>
                          <button
                            onClick={() => openReviewDialog(event, 'rejected')}
                            className="px-4 py-2 bg-white border-2 border-red-500 text-red-500 font-anton text-xs uppercase tracking-wider transition-brutal rounded-none hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      {/* Logistical Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-[#171e19]/90 bg-[#b7c6c2]/10 border border-[#171e19]/10 p-4 rounded-none font-satoshi font-semibold">
                        <div>
                          <span className="font-bold block uppercase text-[#b7c6c2] text-[9px] mb-1">Start Date</span>
                          <span className="text-[11px]">
                            {formatEventDate(event.startDate)}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold block uppercase text-[#b7c6c2] text-[9px] mb-1">Venue</span>
                          <span className="text-[11px]">{event.venue.toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="font-bold block uppercase text-[#b7c6c2] text-[9px] mb-1">Expected Crowd</span>
                          <span className="text-[11px]">{event.expectedFootfall} ATTENDEES</span>
                        </div>
                        <div>
                          <span className="font-bold block uppercase text-[#b7c6c2] text-[9px] mb-1">Prize Pool Offered</span>
                          <span className="text-[11px] text-[#ffe17c] bg-[#171e19] px-1.5 py-0.5 inline-block font-bold">
                            {event.prizeMoneyApplicable ? `$${event.prizeMoneyAmount}` : 'NONE'}
                          </span>
                        </div>
                      </div>

                      {/* Attached documents */}
                      <div className="space-y-2 font-satoshi text-xs font-bold uppercase">
                        <h4 className="text-[9px] uppercase font-bold text-[#b7c6c2] tracking-wider">Uploaded Clearance Documents</h4>
                        <div className="flex flex-wrap gap-4">
                          <a href={event.eventDescriptionUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                            📄 PROPOSAL DOCUMENT PDF
                          </a>
                          <a href={event.doswPermissionLetterUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                            📄 DOSW PERMISSION LETTER PDF
                          </a>
                          <a href={event.councilPermissionLetterUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                            📄 COUNCIL APPROVAL LETTER PDF
                          </a>
                          {event.venuePermissionApplicable && event.venuePermissionLetterUrl && (
                            <a href={event.venuePermissionLetterUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                              📄 VENUE BOOKING SLIP PDF
                            </a>
                          )}
                          {event.attendanceWaiverApplicable && event.attendanceWaiverUrl && (
                            <a href={event.attendanceWaiverUrl} target="_blank" rel="noreferrer" className="text-[#171e19] hover:underline">
                              📄 WAIVER REQUEST LIST PDF
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Safety & infrastructure details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-satoshi pt-2">
                        {event.resourcesNeeded && (
                          <div>
                            <span className="font-bold uppercase text-[#b7c6c2] block text-[9px] mb-1">Resources Requested:</span>
                            <p className="text-[#171e19] leading-relaxed italic font-medium">"{event.resourcesNeeded.toUpperCase()}"</p>
                          </div>
                        )}
                        {event.safetyArrangementNeeded && (
                          <div>
                            <span className="font-bold uppercase text-red-500 block text-[9px] mb-1">Security / Safety Plan:</span>
                            <p className="text-red-950 leading-relaxed italic font-semibold">"{event.safetyArrangementDetails.toUpperCase()}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: LOGBOOK */}
          {activeSubTab === 'logbook' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#171e19]/10 pb-4">
                <div>
                  <h2 className="font-anton text-3xl text-[#171e19] tracking-tight">Events Registry</h2>
                  <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold uppercase tracking-wider mt-1">
                    Search, filter, and audit chronological event request histories and final reports.
                  </p>
                </div>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2.5 bg-[#ffe17c] hover:bg-[#ffe17c]/90 text-[#171e19] border-2 border-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none sm:self-end"
                >
                  Export CSV
                </button>
              </div>

              {/* Filters Box */}
              <div className="bg-white border-2 border-[#171e19] rounded-none p-5 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1: Search & Council */}
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Search Text</label>
                      <input
                        type="text"
                        placeholder="Search by event name or ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-4 py-2 text-xs text-[#171e19] placeholder-[#b7c6c2] outline-none w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Council / Committee</label>
                      <select
                        value={councilFilter}
                        onChange={e => setCouncilFilter(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-3 py-2 text-xs text-[#171e19] outline-none w-full"
                      >
                        <option value="All">All Councils ({COUNCILS.length})</option>
                        {COUNCILS.map(c => (
                          <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Column 2: Status & Category */}
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Status</label>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-3 py-2 text-xs text-[#171e19] outline-none w-full"
                      >
                        <option value="All">All Statuses</option>
                        <option value="submitted">Submitted (Pending Review)</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="revision_needed">Revision Needed</option>
                        <option value="report_pending">Report Pending</option>
                        <option value="closed">Closed (Report Submitted)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Category</label>
                      <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-3 py-2 text-xs text-[#171e19] outline-none w-full"
                      >
                        <option value="All">All Categories</option>
                        <option value="technical">Technical</option>
                        <option value="cultural">Cultural</option>
                        <option value="sports">Sports</option>
                        <option value="workshop">Workshop</option>
                        <option value="guest_lecture">Guest Lecture</option>
                        <option value="competition">Competition</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Column 3: Date Range */}
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">From Date</label>
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={e => setStartDateFilter(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-3 py-2 text-xs text-[#171e19] outline-none w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">To Date</label>
                      <input
                        type="date"
                        value={endDateFilter}
                        onChange={e => setEndDateFilter(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-3 py-2 text-xs text-[#171e19] outline-none w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="bg-white border-2 border-[#171e19] overflow-hidden rounded-none animate-pulse">
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="flex items-center gap-4 py-2 border-b border-[#171e19]/10 last:border-none">
                        <div className="h-6 bg-[#b7c6c2]/30 w-16 rounded-none shrink-0" />
                        <div className="h-6 bg-[#b7c6c2]/20 w-32 rounded-none shrink-0" />
                        <div className="h-6 bg-[#b7c6c2]/20 w-48 rounded-none flex-grow" />
                        <div className="h-6 bg-[#b7c6c2]/20 w-24 rounded-none shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="bg-white border-2 border-[#171e19] p-12 text-center rounded-none shadow-[4px_4px_0px_0px_#171e19]">
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">No events yet.</p>
                </div>
              ) : (
                <div className="bg-white border-2 border-[#171e19] overflow-hidden rounded-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#171e19]/10 font-satoshi text-[10px] uppercase tracking-wider text-[#b7c6c2] font-bold">
                          <th className="p-4 pl-6">Event ID</th>
                          <th className="p-4">Council</th>
                          <th className="p-4">Event Name</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Dates</th>
                          <th className="p-4">Venue</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 pr-6">Submitted On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#171e19]/10 font-satoshi text-xs font-medium text-[#171e19]">
                        {filteredEvents.map(event => {
                          const isRepPending = isReportPending(event);
                          return (
                            <tr
                              key={event.eventId}
                              onClick={() => setSelectedEventDetail(event)}
                              className="hover:bg-[#ffe17c]/5 cursor-pointer transition-brutal"
                            >
                              <td className="p-4 pl-6 font-mono font-bold text-[#171e19]">
                                {/* Signature ID Tag */}
                                <span className="border border-[#171e19] px-2 py-0.5 bg-white">
                                  {event.eventId}
                                </span>
                              </td>
                              <td className="p-4 text-[#171e19] font-bold">
                                {event.jointWith ? `${event.councilName} x ${event.jointWith}` : event.councilName}
                              </td>
                              <td className="p-4 font-semibold">
                                {event.eventName}
                              </td>
                              <td className="p-4 capitalize">
                                {event.category?.replace('_', ' ')}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                {formatEventDate(event.startDate, 'MMM dd, yyyy')} - {formatEventDate(event.endDate, 'MMM dd, yyyy')}
                              </td>
                              <td className="p-4">
                                {event.venue}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={getBadgeClass(event)}>
                                  {isRepPending ? 'report pending' : event.status}
                                </span>
                              </td>
                              <td className="p-4 pr-6 whitespace-nowrap">
                                {formatEventDate(event.createdAt, 'MMM dd, yyyy')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: CALENDAR VIEW */}
          {activeSubTab === 'calendar' && (
            <div className="bg-white border-2 border-[#171e19] p-6 space-y-6 rounded-none shadow-[4px_4px_0px_0px_#ffe17c]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#171e19]/10 pb-4 gap-4">
                <div>
                  <h2 className="font-anton text-3xl text-[#171e19] tracking-tight">CALENDAR REGISTRY</h2>
                  <p className="font-satoshi text-[10px] text-[#b7c6c2] font-bold uppercase">
                    Chronological month view detailing approved schedules and venue booking conflicts.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrevMonth}
                    className="px-3 py-1.5 border-2 border-[#171e19] hover:bg-[#ffe17c]/10 text-xs font-bold uppercase transition-brutal"
                  >
                    &larr; Prev
                  </button>
                  <span className="font-anton text-2xl text-[#171e19] select-none tracking-wide">
                    {format(currentMonthDate, 'MMMM yyyy').toUpperCase()}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="px-3 py-1.5 border-2 border-[#171e19] hover:bg-[#ffe17c]/10 text-xs font-bold uppercase transition-brutal"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>

              {/* Month Grid */}
              <div className="border-t border-l border-[#171e19]">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-[#171e19] bg-[#b7c6c2]/10 font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/70 text-center py-2">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                <div className="grid grid-cols-7">
                  {getDaysInMonth(currentMonthDate).map((day, idx) => {
                    const isToday = day && day.toDateString() === new Date().toDateString();
                    
                    // Filter approved/upcoming/closed events occurring on this day
                    const dayEvents = day ? allEvents.filter(event => {
                      if (event.status !== 'approved' && event.status !== 'report_pending' && event.status !== 'closed') return false;
                      const eventStart = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                      const eventEnd = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
                      
                      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
                      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
                      
                      return eventStart <= dayEnd && eventEnd >= dayStart;
                    }) : [];

                    return (
                      <div
                        key={idx}
                        className={`min-h-[110px] p-2 border-r border-b border-[#171e19] flex flex-col justify-between font-satoshi transition-all bg-white relative ${
                          isToday ? 'ring-2 ring-inset ring-[#171e19] z-10' : ''
                        }`}
                      >
                        {day ? (
                          <>
                            <span className={`text-xs font-bold ${isToday ? 'text-white bg-[#171e19] px-1.5 py-0.5 self-start font-anton tracking-wide' : 'text-[#171e19]'}`}>
                              {day.getDate()}
                            </span>
                            
                            <div className="mt-2 space-y-1.5 flex-grow overflow-y-auto">
                              {dayEvents.map(event => {
                                const clash = hasClash(event, allEvents);
                                return (
                                  <div
                                    key={event.eventId}
                                    onClick={() => setSelectedEventDetail(event)}
                                    className={`p-1 text-[9px] font-bold uppercase tracking-tight cursor-pointer truncate ${getCategoryChipClass(event.category)} ${
                                      clash ? 'border-2 border-dashed border-red-500' : ''
                                    }`}
                                    title={`${event.eventName} @ ${event.venue} (${clash ? 'CONFLICT DETECTED!' : 'Scheduled'})`}
                                  >
                                    {event.eventName} @ {event.venue}
                                    {clash && <span className="ml-1 text-red-500">⚠️</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="bg-slate-50/50 w-full h-full min-h-[90px]" />
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
