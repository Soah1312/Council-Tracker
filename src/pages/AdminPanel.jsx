import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, updateEventStatus, subscribeToAllEvents } from '../lib/events';
import { COUNCILS } from '../lib/auth';
import { format } from 'date-fns';
import { notifyProposalReopened } from '../lib/emailService';
import { seedAllEvents } from '../lib/seedData';
import { clearAllEvents } from '../lib/clearData';
import { IconFile, IconCheck, IconX, IconWarning, IconDownload, IconPhoto } from '../lib/icons';

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

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);

    const unsubscribe = subscribeToAllEvents((data) => {
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
      setLoading(false);
    });

    return () => unsubscribe();
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

  const openReviewDialog = async (event, statusType) => {
    // Accept / approve actions need no comment — close modal immediately, submit in background
    if (statusType === 'proposal_approved' || statusType === 'approved') {
      setSelectedEventDetail(null); // close instantly for immediate feedback
      setActionLoading(event.id);
      try {
        await updateEventStatus(event.id, statusType, '');
        showNotification(`Status updated: ${statusType.replace(/_/g, ' ')}.`);
      } catch (err) {
        showNotification('Failed to update status.', 'error');
      } finally {
        setActionLoading(null);
      }
      return;
    }
    // Rejection / revision / re-open actions open the comment dialog
    setReviewingEvent(event);
    setReviewStatusType(statusType);
    setReviewNotes(statusType === 'submitted' ? 'Proposal re-opened by administration for re-evaluation.' : '');
  };

  const submitReview = async () => {
    if (!reviewingEvent) return;

    // Enforce required notes/comments for Reject and Request Revision
    const isRequired = 
      reviewStatusType === 'rejected' || 
      reviewStatusType === 'revision_needed' || 
      reviewStatusType === 'permissions_revision_needed';

    if (isRequired && !reviewNotes.trim()) {
      showNotification('Comments/notes are required when rejecting or requesting revisions.', 'error');
      return;
    }
    
    setActionLoading(reviewingEvent.id);
    try {
      await updateEventStatus(reviewingEvent.id, reviewStatusType, reviewNotes);
      if (reviewStatusType === 'submitted') {
        notifyProposalReopened(reviewingEvent, reviewingEvent.councilName).catch(console.error);
        showNotification(`Proposal ${reviewingEvent.eventId || reviewingEvent.id} re-opened successfully!`);
      } else {
        showNotification(`Proposal marked as ${reviewStatusType.replace(/_/g, ' ')}.`);
      }
      setReviewingEvent(null);
      // Close the details modal drawer on success
      setSelectedEventDetail(null);
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
  const isProposalAccepted = (status) => {
    return [
      'proposal_approved',
      'permissions_submitted',
      'permissions_revision_needed',
      'approved',
      'report_pending',
      'closed'
    ].includes(status);
  };

  const isReportPending = (event) => {
    return event.status === 'approved' || event.status === 'report_pending';
  };

  const isReportOverdue = (event) => {
    if (event.status !== 'approved' && event.status !== 'report_pending') return false;
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
    if (!evt || !isProposalAccepted(evt.status)) return false;
    if (!evt.venue || !evt.startDate || !evt.endDate) return false;
    const startA = evt.startDate?.toDate ? evt.startDate.toDate().getTime() : new Date(evt.startDate).getTime();
    const endA = evt.endDate?.toDate ? evt.endDate.toDate().getTime() : new Date(evt.endDate).getTime();
    if (isNaN(startA) || isNaN(endA)) return false;
    const venueA = evt.venue.toLowerCase().trim();
    
    return eventsList.some(other => {
      if (!other || other.eventId === evt.eventId) return false;
      if (!isProposalAccepted(other.status)) return false;
      if (!other.venue || !other.startDate || !other.endDate) return false;
      const venueB = other.venue.toLowerCase().trim();
      if (venueA !== venueB) return false;
      
      const startB = other.startDate?.toDate ? other.startDate.toDate().getTime() : new Date(other.startDate).getTime();
      const endB = other.endDate?.toDate ? other.endDate.toDate().getTime() : new Date(other.endDate).getTime();
      if (isNaN(startB) || isNaN(endB)) return false;
      
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

  const getEventStage = (status) => {
    switch (status) {
      case 'submitted':
      case 'revision_needed':
      case 'rejected':
        return { num: 1, label: 'STAGE 1: PROPOSAL REVIEW', colorClass: 'bg-[#ffe17c] text-[#171e19] border border-[#171e19]/35' };
      case 'proposal_approved':
      case 'permissions_submitted':
      case 'permissions_revision_needed':
        return { num: 2, label: 'STAGE 2: DOCUMENTS & CLEARANCES', colorClass: 'bg-indigo-900 text-white' };
      case 'approved':
        return { num: 3, label: 'STAGE 3: POST-EVENT REPORTING (PENDING)', colorClass: 'bg-emerald-950 text-white' };
      case 'closed':
        return { num: 3, label: 'STAGE 3: COMPLETED / ARCHIVED', colorClass: 'bg-[#b7c6c2] text-[#171e19]' };
      default:
        return { num: 1, label: 'STAGE 1: PROPOSAL REVIEW', colorClass: 'bg-slate-800 text-white' };
    }
  };

  const renderStageTracker = (status) => {
    let currentStage = 1;
    if (['proposal_approved', 'permissions_submitted', 'permissions_revision_needed'].includes(status)) {
      currentStage = 2;
    } else if (['approved', 'closed', 'report_pending'].includes(status)) {
      currentStage = 3;
    }

    const stages = [
      { num: 1, name: 'Proposal', desc: 'Stage 1: Concept & Description' },
      { num: 2, name: 'Clearances', desc: 'Stage 2: Letters Uploaded' },
      { num: 3, name: 'Report', desc: 'Stage 3: Wrap-up & Completion' }
    ];

    return (
      <div className="border border-[#171e19]/10 bg-slate-50 p-4 rounded-none space-y-3 font-satoshi">
        <span className="font-bold text-[9px] uppercase tracking-wider text-[#171e19]/60 block">Event Progression Flow</span>
        <div className="grid grid-cols-3 gap-2">
          {stages.map((stg) => {
            const isCompleted = currentStage > stg.num || (stg.num === 3 && status === 'closed');
            const isActive = currentStage === stg.num && status !== 'closed';
            const isFuture = !isCompleted && !isActive;

            let bgColor = 'bg-white border-[#171e19]/15 text-[#171e19]/60';
            if (isActive) {
              bgColor = 'bg-[#ffe17c] border-[#171e19] text-[#171e19] font-bold shadow-[2px_2px_0px_0px_#171e19]';
            } else if (isCompleted) {
              bgColor = 'bg-[#171e19] border-[#171e19] text-[#ffe17c]';
            }

            return (
              <div key={stg.num} className={`p-2.5 border-2 flex flex-col items-center text-center justify-between gap-1 transition-brutal ${bgColor}`}>
                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                  <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                    isCompleted ? 'bg-[#ffe17c] text-[#171e19]' : isActive ? 'bg-[#171e19] text-[#ffe17c]' : 'bg-[#171e19]/10 text-[#171e19]/50'
                  }`}>
                    {isCompleted ? '✓' : stg.num}
                  </span>
                  <span className="font-anton text-xs uppercase tracking-wide">{stg.name}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wide block opacity-80 mt-1 font-semibold">{stg.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getBadgeClass = (event) => {
    const isRepPending = isReportPending(event);
    if (isRepPending) return 'bg-[#171e19] text-white border-2 border-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold';
    switch (event.status) {
      case 'submitted':
        return 'bg-[#b7c6c2]/50 text-[#171e19] border border-[#171e19]/25 px-3 py-1 rounded-full text-[10px] uppercase font-bold';
      case 'proposal_approved':
        return 'bg-indigo-900 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold';
      case 'permissions_submitted':
        return 'bg-blue-900 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold';
      case 'permissions_revision_needed':
        return 'bg-[#ffe17c] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold border border-[#171e19]';
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
  const countPendingReview = allEvents.filter(e => e.status === 'submitted' || e.status === 'permissions_submitted').length;
  const countAwaitingDocs = allEvents.filter(e => e.status === 'proposal_approved').length;
  const countApprovedUpcoming = allEvents.filter(isUpcoming).length;
  const countReportPending = allEvents.filter(isReportPending).length;
  const countOverdueReports = allEvents.filter(isReportOverdue).length;

  // "Needs Attention" List Compilation & Urgency Sorting
  const getNeedsAttentionList = () => {
    const overdue = allEvents.filter(isReportOverdue);
    const pendingProposals = allEvents.filter(e => e.status === 'submitted');
    const pendingPermissions = allEvents.filter(e => e.status === 'permissions_submitted');
    
    const sortedOverdue = overdue.sort((a, b) => {
      const dateA = a.reportDueDate?.toDate ? a.reportDueDate.toDate() : new Date(a.reportDueDate);
      const dateB = b.reportDueDate?.toDate ? b.reportDueDate.toDate() : new Date(b.reportDueDate);
      return dateA - dateB;
    });
    
    const sortedPendingProposals = pendingProposals.sort((a, b) => {
      const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
      const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
      return dateA - dateB;
    });

    const sortedPendingPermissions = pendingPermissions.sort((a, b) => {
      const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
      const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
      return dateA - dateB;
    });
    
    // Events waiting for council to upload permission documents (Stage 2, council's turn)
    const awaitingDocs = allEvents.filter(e => e.status === 'proposal_approved');
    const sortedAwaitingDocs = awaitingDocs.sort((a, b) => {
      const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
      const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
      return dateA - dateB;
    });

    // Stage 3: Events that are approved and awaiting post-event report
    const reportPendingEvents = allEvents.filter(e => e.status === 'approved' || e.status === 'report_pending');
    const sortedReportPending = reportPendingEvents.sort((a, b) => {
      // Sort overdue first, then by due date ascending
      const dueA = a.reportDueDate?.toDate ? a.reportDueDate.toDate() : (a.reportDueDate ? new Date(a.reportDueDate) : new Date(9999, 0));
      const dueB = b.reportDueDate?.toDate ? b.reportDueDate.toDate() : (b.reportDueDate ? new Date(b.reportDueDate) : new Date(9999, 0));
      return dueA - dueB;
    });

    return [
      ...sortedOverdue.map(e => ({ ...e, attentionReason: 'overdue' })),
      ...sortedPendingPermissions.map(e => ({ ...e, attentionReason: 'pending_permissions' })),
      ...sortedPendingProposals.map(e => ({ ...e, attentionReason: 'pending_proposal' })),
      ...sortedAwaitingDocs.map(e => ({ ...e, attentionReason: 'awaiting_docs' })),
      ...sortedReportPending.map(e => ({ ...e, attentionReason: 'report_pending' }))
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

  const pendingEvents = allEvents.filter(e => e.status === 'submitted' || e.status === 'permissions_submitted');
  const pendingProposals = allEvents.filter(e => e.status === 'submitted' || e.status === 'revision_needed');
  const pendingPermissions = allEvents.filter(e => e.status === 'permissions_submitted' || e.status === 'permissions_revision_needed');

  // PASSCODE LOCK SCREEN RENDER
  if (!authenticated) {
    return (
      <div className="min-h-screen grid-pattern-charcoal flex items-center justify-center px-4 py-12">
        <div className="bg-white border-4 border-[#171e19] p-8 md:p-10 max-w-md w-full space-y-8 shadow-[8px_8px_0px_0px_#ffe17c] rounded-none">
          <div className="text-center space-y-2">
            <h1 className="font-anton text-5xl md:text-6xl text-[#171e19] tracking-tight">
              COUNCILTRACK<span className="text-[#ffe17c]">.</span>
            </h1>
            <p className="font-satoshi text-xs uppercase tracking-widest text-[#171e19]/60 font-bold">
              Administrative Access
            </p>
          </div>

          <form onSubmit={handlePasscodeSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60 block">
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
            <Link to="/" className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60 hover:text-[#171e19] hover:underline mr-4">
              &larr; HOME
            </Link>
            <Link to="/portal" className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] hover:underline">
              EVENT PORTAL
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // MAIN ADMIN PANEL VIEW
  return (
    <div className="max-w-[1550px] mx-auto px-4 md:px-8 py-8 space-y-6">
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
              <p className="font-satoshi text-[10px] uppercase font-bold text-[#171e19]/60">Submit Event Review</p>
              <h3 className="font-anton text-2xl text-[#171e19] mt-1 tracking-tight">
                ACTION ON: {reviewingEvent.eventName.toUpperCase()}
              </h3>
              <p className="font-satoshi text-xs text-[#171e19] mt-1 uppercase font-semibold">
                Status Target: <span className="underline">{reviewStatusType.replace('_', ' ')}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">
                Review Comments & Notes *
              </label>
              <textarea
                rows="4"
                required
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

      {/* EVENT DETAIL MODAL — full screen centered */}
      {selectedEventDetail && (
        <div className="fixed inset-0 z-40 bg-[#171e19]/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white border-2 border-[#171e19] w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-[8px_8px_0px_0px_#171e19] flex flex-col animate-slide-up">
            
            {/* Modal Header Bar */}
            <div className="flex items-start justify-between border-b-2 border-[#171e19] px-6 py-4 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-satoshi text-xs font-bold tracking-widest border border-[#171e19] px-3 py-1 bg-white text-[#171e19]">
                  {selectedEventDetail.eventId}
                </span>
                {(() => {
                  const stage = getEventStage(selectedEventDetail.status);
                  return (
                    <span className={`px-3 py-1 font-satoshi text-xs font-bold uppercase tracking-widest border border-[#171e19]/25 rounded-none ${stage.colorClass}`}>
                      {stage.label}
                    </span>
                  );
                })()}
                <span className={getBadgeClass(selectedEventDetail)}>
                  {selectedEventDetail.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedEventDetail(null)}
                className="font-satoshi text-sm font-bold uppercase tracking-wider border-2 border-[#171e19] px-4 py-2 hover:bg-slate-100 transition-colors flex items-center gap-2 shrink-0"
              >
                <IconX className="w-4 h-4" /> Close
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              
              {/* Event Title Row */}
              <div>
                <h3 className="font-anton text-4xl text-[#171e19] leading-tight tracking-tight">
                  {String(selectedEventDetail.eventName || '').toUpperCase()}
                </h3>
                <p className="font-satoshi text-sm text-[#ffe17c] bg-[#171e19] px-3 py-1.5 inline-block uppercase font-bold tracking-wider mt-2">{selectedEventDetail.councilName}</p>
              </div>

              {/* Event Progress Tracker */}
              {renderStageTracker(selectedEventDetail.status)}

              {/* Overdue / Deadline Banner */}
              {selectedEventDetail.status === 'approved' && selectedEventDetail.reportDueDate && (
                <div className="bg-amber-50 border border-amber-300 p-4 text-amber-800 flex items-center justify-between gap-3 flex-wrap font-medium text-sm font-satoshi">
                  <div>
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-600 block mb-1">Report Submission Deadline</span>
                    <span className="text-sm uppercase">Post-event report expected by {formatEventDate(selectedEventDetail.reportDueDate)}.</span>
                  </div>
                  <span className="font-mono text-sm font-bold bg-amber-200 border border-amber-400 px-3 py-1 uppercase shrink-0">
                    {(() => {
                      const due = selectedEventDetail.reportDueDate.toDate ? selectedEventDetail.reportDueDate.toDate() : new Date(selectedEventDetail.reportDueDate);
                      const diffDays = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
                      if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
                      if (diffDays === 0) return 'Due Today!';
                      return `${diffDays} days remaining`;
                    })()}
                  </span>
                </div>
              )}

              {/* Two-Column Detail Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* LEFT: Dates, Venue, Footfall, Contacts */}
                <div className="space-y-4">
                  {/* Logistical Grid */}
                  <div className="bg-[#b7c6c2]/10 border border-[#171e19]/15 p-5 space-y-4">
                    <span className="font-satoshi text-xs font-bold uppercase tracking-widest text-[#171e19]/60 block">Event Logistics</span>
                    <div className="grid grid-cols-2 gap-4 text-[#171e19] font-satoshi">
                      <div>
                        <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Start Date</span>
                        <span className="font-bold text-sm">{formatEventDate(selectedEventDetail.startDate)}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">End Date</span>
                        <span className="font-bold text-sm">{formatEventDate(selectedEventDetail.endDate)}</span>
                      </div>
                      {selectedEventDetail.venue && (
                        <div className="col-span-2">
                          <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Venue Location</span>
                          <span className="font-bold text-sm">{String(selectedEventDetail.venue).toUpperCase()}</span>
                        </div>
                      )}
                      {selectedEventDetail.expectedFootfall > 0 && (
                        <div>
                          <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Expected Footfall</span>
                          <span className="font-bold text-sm">{selectedEventDetail.expectedFootfall} Attendees</span>
                        </div>
                      )}
                      {selectedEventDetail.registrationFeeApplicable && selectedEventDetail.registrationFeeAmount !== undefined && (
                        <div>
                          <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Registration Fee</span>
                          <span className="font-bold text-sm">₹{selectedEventDetail.registrationFeeAmount} / head</span>
                        </div>
                      )}
                      {selectedEventDetail.prizeMoneyApplicable && selectedEventDetail.prizeMoneyAmount && (
                        <div className="col-span-2">
                          <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Prize Pool</span>
                          <span className="font-bold text-sm">₹{selectedEventDetail.prizeMoneyAmount} <span className="text-[#171e19]/60 font-medium">via {selectedEventDetail.prizeMoneySource}</span></span>
                        </div>
                      )}
                      {selectedEventDetail.externalParticipantsApplicable && selectedEventDetail.externalParticipantsExpected > 0 && (
                        <div>
                          <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">External Participants</span>
                          <span className="font-bold text-sm">{selectedEventDetail.externalParticipantsExpected} Students</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contacts */}
                  {(selectedEventDetail.facultyCoordinatorName || selectedEventDetail.studentContactName) && (
                    <div className="bg-[#b7c6c2]/10 border border-[#171e19]/15 p-5 space-y-4">
                      <span className="font-satoshi text-xs font-bold uppercase tracking-widest text-[#171e19]/60 block">Contacts</span>
                      <div className="grid grid-cols-2 gap-4 text-[#171e19] font-satoshi">
                        {selectedEventDetail.facultyCoordinatorName && (
                          <div>
                            <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Faculty Coordinator</span>
                            <span className="font-bold text-sm">{String(selectedEventDetail.facultyCoordinatorName).toUpperCase()}</span>
                          </div>
                        )}
                        {selectedEventDetail.studentContactName && (
                          <div>
                            <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Student Lead POC</span>
                            <span className="font-bold text-sm block">{String(selectedEventDetail.studentContactName).toUpperCase()}</span>
                            {selectedEventDetail.studentContactPhone && <span className="text-sm text-[#171e19]/60">{selectedEventDetail.studentContactPhone}</span>}
                          </div>
                        )}
                        {selectedEventDetail.guestApplicable && selectedEventDetail.guestName && (
                          <div className="col-span-2">
                            <span className="font-bold text-[#171e19]/60 uppercase block text-xs mb-1">Chief Guest</span>
                            <span className="font-bold text-sm">{String(selectedEventDetail.guestName).toUpperCase()}{selectedEventDetail.guestDesignation ? `, ${selectedEventDetail.guestDesignation}` : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Resources, Safety, Documents */}
                <div className="space-y-4">
                  {/* Resources */}
                  {selectedEventDetail.resourcesNeeded && (
                    <div className="bg-[#b7c6c2]/10 border border-[#171e19]/15 p-5">
                      <span className="font-satoshi text-xs font-bold uppercase tracking-widest text-[#171e19]/60 block mb-2">AV / Resources Requested</span>
                      <p className="italic text-[#171e19]/80 text-sm leading-relaxed font-medium font-satoshi">"{String(selectedEventDetail.resourcesNeeded).toUpperCase()}"</p>
                    </div>
                  )}

                  {/* Safety */}
                  {selectedEventDetail.safetyArrangementNeeded && selectedEventDetail.safetyArrangementDetails && (
                    <div className="bg-red-50 border border-red-200 p-5">
                      <span className="font-satoshi text-xs font-bold uppercase tracking-widest text-red-600 block mb-2">Barricading & Safety Arrangements</span>
                      <p className="italic text-red-900 text-sm leading-relaxed font-semibold font-satoshi">"{String(selectedEventDetail.safetyArrangementDetails).toUpperCase()}"</p>
                    </div>
                  )}

                  {/* Document Clearance Links */}
                  <div className="border border-[#171e19]/15 p-5 space-y-3">
                    <span className="font-satoshi text-xs font-bold uppercase tracking-widest text-[#171e19]/60 block">Uploaded Clearances</span>
                    <div className="grid grid-cols-1 gap-2 font-satoshi">
                      {selectedEventDetail.eventDescriptionUrl && (
                        <a href={selectedEventDetail.eventDescriptionUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[#171e19] hover:bg-[#ffe17c] border border-[#171e19] px-3 py-3 transition-colors uppercase text-sm font-bold">
                          <IconFile className="w-5 h-5 shrink-0" /> Proposal Document
                        </a>
                      )}
                      {selectedEventDetail.eventOutcomeUrl && (
                        <a href={selectedEventDetail.eventOutcomeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[#171e19] hover:bg-[#ffe17c] border border-[#171e19] px-3 py-3 transition-colors uppercase text-sm font-bold">
                          <IconFile className="w-5 h-5 shrink-0" /> Event Outcome
                        </a>
                      )}
                      {selectedEventDetail.doswPermissionLetterUrl && (
                        <a href={selectedEventDetail.doswPermissionLetterUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[#171e19] hover:bg-[#ffe17c] border border-[#171e19] px-3 py-3 transition-colors uppercase text-sm font-bold">
                          <IconFile className="w-4 h-4 shrink-0" /> DOSW & Principal Clearance PDF
                        </a>
                      )}
                      {selectedEventDetail.customPermissionLetters && selectedEventDetail.customPermissionLetters.map((docItem, idx) => (
                        <a key={idx} href={docItem.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[#171e19] hover:bg-[#ffe17c] border border-[#171e19] px-3 py-3 transition-colors uppercase text-sm font-bold">
                          <IconFile className="w-4 h-4 shrink-0" /> {String(docItem.title || `Additional Letter ${idx + 1}`).toUpperCase()} PDF
                        </a>
                      ))}
                      {selectedEventDetail.otherDocumentUrl && (
                        <a href={selectedEventDetail.otherDocumentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[#171e19] hover:bg-[#ffe17c] border border-[#171e19] px-3 py-3 transition-colors uppercase text-sm font-bold">
                          <IconFile className="w-4 h-4 shrink-0" /> Other Relevant Document
                        </a>
                      )}
                      {selectedEventDetail.attendanceWaiverUrl && (
                        <a href={selectedEventDetail.attendanceWaiverUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[#171e19] hover:bg-[#ffe17c] border border-[#171e19] px-3 py-3 transition-colors uppercase text-sm font-bold">
                          <IconFile className="w-4 h-4 shrink-0" /> Waiver / Leave Requests
                        </a>
                      )}
                      {!selectedEventDetail.eventDescriptionUrl && !selectedEventDetail.eventOutcomeUrl && !selectedEventDetail.doswPermissionLetterUrl && !selectedEventDetail.customPermissionLetters?.length && !selectedEventDetail.otherDocumentUrl && !selectedEventDetail.attendanceWaiverUrl && (
                        <p className="text-[#171e19]/60 text-sm italic">No documents uploaded yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Post-Event Report (if closed) */}
                  {selectedEventDetail.status === 'closed' && selectedEventDetail.reportPdfUrl && (
                    <div className="space-y-3 border-t-2 border-dashed border-[#171e19] pt-4 bg-[#ffe17c]/5 p-5 font-satoshi">
                      <h4 className="font-bold text-[#171e19] uppercase tracking-wider text-xs">Archived Post-Event Report</h4>
                      <div className="space-y-2 font-bold">
                        <a href={selectedEventDetail.reportPdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[#171e19] hover:bg-[#ffe17c] border border-[#171e19] px-3 py-3 transition-colors uppercase text-sm">
                          <IconFile className="w-4 h-4 shrink-0" /> Download Final Wrap-Up Report PDF
                        </a>
                        {selectedEventDetail.reportSubmittedAt && (
                          <p className="text-xs text-[#171e19]/60 lowercase font-semibold">
                            Submitted: {formatEventDate(selectedEventDetail.reportSubmittedAt)}
                          </p>
                        )}
                        {selectedEventDetail.reportImageUrls && selectedEventDetail.reportImageUrls.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <p className="font-semibold text-sm text-[#171e19]">Uploaded Photos ({selectedEventDetail.reportImageUrls.length}):</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedEventDetail.reportImageUrls.map((url, index) => (
                                <a href={url} target="_blank" rel="noreferrer" key={index} className="w-16 h-16 bg-white border border-[#171e19] overflow-hidden flex items-center justify-center shrink-0">
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
              </div>
            </div>

            {/* Sticky Action Footer */}
            {(selectedEventDetail.status === 'submitted' || selectedEventDetail.status === 'permissions_submitted' || selectedEventDetail.status === 'rejected') && (
              <div className="flex items-center gap-3 px-6 py-4 border-t-2 border-[#171e19] bg-white shrink-0">
                {selectedEventDetail.status === 'submitted' && (<>
                  <button
                    onClick={() => openReviewDialog(selectedEventDetail, 'proposal_approved')}
                    className="flex-1 py-3 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest hover:shadow-[3px_3px_0px_0px_#171e19] transition-all"
                  >
                    Accept Proposal
                  </button>
                  <button
                    onClick={() => openReviewDialog(selectedEventDetail, 'revision_needed')}
                    className="flex-1 py-3 bg-white border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Request Revision
                  </button>
                  <button
                    onClick={() => openReviewDialog(selectedEventDetail, 'rejected')}
                    className="flex-1 py-3 bg-white border-2 border-red-500 text-red-500 font-anton text-sm uppercase tracking-widest hover:bg-red-50 transition-all"
                  >
                    Reject Proposal
                  </button>
                </>)}
                {selectedEventDetail.status === 'permissions_submitted' && (<>
                  <button
                    onClick={() => openReviewDialog(selectedEventDetail, 'approved')}
                    className="flex-1 py-3 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest hover:shadow-[3px_3px_0px_0px_#171e19] transition-all"
                  >
                    Approve Permissions
                  </button>
                  <button
                    onClick={() => openReviewDialog(selectedEventDetail, 'permissions_revision_needed')}
                    className="flex-1 py-3 bg-white border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Request Letters Revision
                  </button>
                  <button
                    onClick={() => openReviewDialog(selectedEventDetail, 'rejected')}
                    className="flex-1 py-3 bg-white border-2 border-red-500 text-red-500 font-anton text-sm uppercase tracking-widest hover:bg-red-50 transition-all"
                  >
                    Reject Request
                  </button>
                </>)}
                {selectedEventDetail.status === 'rejected' && (
                  <button
                    onClick={() => openReviewDialog(selectedEventDetail, 'submitted')}
                    className="flex-1 py-3 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest hover:shadow-[3px_3px_0px_0px_#171e19] transition-all flex items-center justify-center gap-2"
                  >
                    <IconCheck className="w-4 h-4" /> Re-open Proposal (Revert Rejection)
                  </button>
                )}
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
            to="/portal"
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

          {/* Developer Seeding Utility */}
          <div className="mt-8 p-4 bg-red-50 border-2 border-red-500 space-y-3 font-satoshi text-xs text-left">
            <p className="font-bold text-red-800 uppercase tracking-wide">Developer Seeding Console</p>
            <p className="text-red-950 font-medium leading-relaxed">
              Resets the database by clearing all records and optionally reseeding with mock events.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to CLEAR the database and reseed with clean 3-stage data?")) {
                    try {
                      showNotification("Clearing database events...");
                      await clearAllEvents();
                      showNotification("Seeding new mock events...");
                      await seedAllEvents();
                      showNotification("Database reseeded successfully!");
                    } catch (e) {
                      showNotification("Error reseeding database: " + e.message, "error");
                    }
                  }
                }}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-anton text-xs uppercase tracking-widest transition-colors rounded-none border border-red-700 cursor-pointer"
              >
                Clear & Reseed System
              </button>
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to completely CLEAR all events from the database? This action is irreversible and starts you fresh.")) {
                    try {
                      showNotification("Clearing all database events...");
                      const deletedCount = await clearAllEvents();
                      showNotification(`Successfully cleared ${deletedCount} events from the database!`);
                    } catch (e) {
                      showNotification("Error clearing database: " + e.message, "error");
                    }
                  }
                }}
                className="w-full py-2 bg-[#171e19] hover:bg-black text-white font-anton text-xs uppercase tracking-widest transition-colors rounded-none border border-[#171e19] cursor-pointer"
              >
                Clear Database (Start Fresh)
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {/* TAB: DASHBOARD */}
          {activeSubTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                {/* Card 1 */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm">
                  <p className="font-anton text-7xl text-white">{countPendingReview}</p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60">Pending Review</p>
                </div>
                
                {/* Card 2 — Stage 2: Awaiting council documents */}
                <div className={`border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm border-l-4 ${
                  countAwaitingDocs > 0 ? 'bg-indigo-950 border-l-indigo-400' : 'bg-[#272727] border-l-[#272727]'
                }`}>
                  <p className={`font-anton text-7xl ${countAwaitingDocs > 0 ? 'text-indigo-300' : 'text-white'}`}>
                    {countAwaitingDocs}
                  </p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60">Awaiting Council Docs</p>
                  <p className="font-satoshi text-[10px] text-[#171e19]/60/70 uppercase">Stage 2 — letters not yet uploaded</p>
                </div>

                {/* Card 3 */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm">
                  <p className="font-anton text-7xl text-white">{countApprovedUpcoming}</p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60">Approved Upcoming</p>
                </div>

                {/* Card 4 */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm">
                  <p className="font-anton text-7xl text-white">{countReportPending}</p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60">Report Pending</p>
                </div>

                {/* Card 5 - Overdue reports with a yellow left border accent */}
                <div className="bg-[#272727] border border-[#b7c6c2]/10 p-5 rounded-none space-y-1 shadow-sm border-l-4 border-l-[#ffe17c]">
                  <p className={`font-anton text-7xl ${countOverdueReports > 0 ? 'text-[#ffe17c] animate-pulse' : 'text-white'}`}>
                    {countOverdueReports}
                  </p>
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60">Overdue Reports</p>
                </div>
              </div>

              {/* Needs Attention Queue (Urgency Sorted) */}
              <div className="bg-white border-2 border-[#171e19] rounded-none p-6 space-y-4 shadow-[4px_4px_0px_0px_#171e19]">
                <div>
                  <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">NEEDS ATTENTION</h3>
                  <p className="font-satoshi text-[10px] text-[#171e19]/60 font-bold uppercase mt-1">
                    Action items — overdue reports, proposals awaiting admin review, and events waiting for council documents.
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
                    <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60 flex items-center gap-1.5"><IconCheck className="w-3 h-3 text-emerald-500" /> Clear Desk! No pending items require attention.</p>
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
                              {(() => {
                                const stage = getEventStage(event.status);
                                return (
                                  <span className={`px-2 py-0.5 font-satoshi text-[9px] font-bold uppercase tracking-widest border border-[#171e19]/25 rounded-none ${stage.colorClass}`}>
                                    {stage.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="font-satoshi text-xs text-[#171e19]/60 font-semibold uppercase tracking-wide">
                              Council: <span className="text-[#171e19] font-bold">{event.councilName}</span> &bull; Venue: {event.venue ? event.venue.toUpperCase() : 'TBD'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {event.attentionReason === 'overdue' && (
                              <span className="px-2.5 py-1 bg-[#ffe17c] border border-[#171e19] text-[#171e19] text-xs font-bold uppercase rounded-none">
                                Report Overdue ({getDaysDiff(event.reportDueDate)}d)
                              </span>
                            )}
                            {event.attentionReason === 'pending_permissions' && (
                              <span className="px-2.5 py-1 bg-blue-900 border border-[#171e19]/30 text-white text-xs font-bold uppercase rounded-none">
                                Permissions Submitted — Needs Review
                              </span>
                            )}
                            {event.attentionReason === 'awaiting_docs' && (
                              <span className="px-2.5 py-1 bg-indigo-900 border border-indigo-300/30 text-indigo-100 text-xs font-bold uppercase rounded-none">
                                ⏳ Awaiting Council Documents
                              </span>
                            )}
                            {event.attentionReason === 'pending_proposal' && (
                              <span className="px-2.5 py-1 bg-slate-100 border border-[#171e19]/30 text-[#171e19] text-xs font-bold uppercase rounded-none">
                                Proposal Awaiting ({getDaysDiffFuture(event.startDate)}d)
                              </span>
                            )}
                            {event.attentionReason === 'report_pending' && (() => {
                              const due = event.reportDueDate?.toDate ? event.reportDueDate.toDate() : (event.reportDueDate ? new Date(event.reportDueDate) : null);
                              const diffDays = due ? Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24)) : null;
                              const isOverdue = diffDays !== null && diffDays < 0;
                              return (
                                <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-none border ${
                                  isOverdue
                                    ? 'bg-red-800 border-red-900 text-white'
                                    : diffDays !== null && diffDays <= 3
                                    ? 'bg-amber-400 border-amber-600 text-[#171e19]'
                                    : 'bg-emerald-900 border-emerald-700 text-emerald-100'
                                }`}>
                                  {isOverdue
                                    ? `⚠ Report Overdue (${Math.abs(diffDays)}d ago)`
                                    : diffDays === 0
                                    ? '⚠ Report Due Today!'
                                    : due
                                    ? `Stage 3 — Report Due in ${diffDays}d`
                                    : 'Stage 3 — Report Pending'}
                                </span>
                              );
                            })()}
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
                <p className="font-satoshi text-xs text-[#171e19]/60 font-semibold uppercase tracking-wider mt-1">
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
              ) : (pendingProposals.length === 0 && pendingPermissions.length === 0) ? (
                <div className="bg-white border-2 border-[#171e19] p-12 text-center rounded-none">
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60">Clear queue! No pending items to review.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Stage 1 Queue */}
                  {pendingProposals.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-[#171e19]/10 pb-2">
                        <span className="w-2.5 h-2.5 bg-[#ffe17c] border border-[#171e19]" />
                        <h3 className="font-anton text-lg text-[#171e19] tracking-tight uppercase">Stage 1: Proposal Review Queue ({pendingProposals.length})</h3>
                      </div>
                      
                      <div className="space-y-4">
                        {pendingProposals.map(event => (
                          <div key={event.eventId} className="bg-white border-2 border-[#171e19] p-6 space-y-4 rounded-none">
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
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <p className="font-satoshi text-xs text-[#ffe17c] bg-[#171e19] px-2.5 py-1 inline-block uppercase font-bold tracking-wider">{event.councilName}</p>
                                  {(() => {
                                    const stage = getEventStage(event.status);
                                    return (
                                      <span className={`px-2 py-0.5 font-satoshi text-[9px] font-bold uppercase tracking-widest border border-[#171e19]/25 rounded-none ${stage.colorClass}`}>
                                        {stage.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="font-satoshi text-[10px] uppercase font-semibold text-[#171e19]/60 mt-1">Contact: {event.studentContactName ? event.studentContactName.toUpperCase() : 'TBD'} {event.studentContactPhone ? `• ${event.studentContactPhone}` : ''}</p>
                              </div>
                              
                              <div className="flex gap-2 sm:self-start flex-wrap">
                                <button
                                  onClick={() => openReviewDialog(event, 'proposal_approved')}
                                  className="px-4 py-2 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                                >
                                  Accept Proposal
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
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Start Date</span>
                                <span className="text-[11px]">{formatEventDate(event.startDate)}</span>
                              </div>
                              <div>
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Venue</span>
                                <span className="text-[11px]">{event.venue ? event.venue.toUpperCase() : 'TBD'}</span>
                              </div>
                              <div>
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Expected Crowd</span>
                                <span className="text-[11px]">{event.expectedFootfall} ATTENDEES</span>
                              </div>
                              <div>
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Venue Slip Required?</span>
                                <span className="text-[11px] uppercase font-bold text-[#171e19]">
                                  {event.venuePermissionApplicable ? 'YES' : 'NO'}
                                </span>
                              </div>
                            </div>

                            {/* Documents */}
                            <div className="space-y-2 font-satoshi text-xs font-bold uppercase">
                              <h4 className="text-[9px] uppercase font-bold text-[#171e19]/60 tracking-wider">Uploaded Files</h4>
                              <div className="flex flex-wrap gap-4">
                                <a href={event.eventDescriptionUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                  <IconFile className="w-3 h-3 shrink-0" /> PROPOSAL DOCUMENT PDF
                                </a>
                                {event.eventOutcomeUrl && (
                                  <a href={event.eventOutcomeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                    <IconFile className="w-3 h-3 shrink-0" /> EVENT OUTCOME PDF
                                  </a>
                                )}
                                {event.attendanceWaiverUrl && (
                                  <a href={event.attendanceWaiverUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                    <IconFile className="w-3 h-3 shrink-0" /> WAIVER REQUEST LIST PDF
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stage 2 Queue */}
                  {pendingPermissions.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-[#171e19]/10 pb-2 pt-4">
                        <span className="w-2.5 h-2.5 bg-blue-900 border border-[#171e19]" />
                        <h3 className="font-anton text-lg text-[#171e19] tracking-tight uppercase">Stage 2: Clearance & Permissions Review Queue ({pendingPermissions.length})</h3>
                      </div>

                      <div className="space-y-4">
                        {pendingPermissions.map(event => (
                          <div key={event.eventId} className="bg-white border-2 border-[#171e19] p-6 space-y-4 rounded-none">
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
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <p className="font-satoshi text-xs text-white bg-[#171e19] px-2.5 py-1 inline-block uppercase font-bold tracking-wider">{event.councilName}</p>
                                  {(() => {
                                    const stage = getEventStage(event.status);
                                    return (
                                      <span className={`px-2 py-0.5 font-satoshi text-[9px] font-bold uppercase tracking-widest border border-[#171e19]/25 rounded-none ${stage.colorClass}`}>
                                        {stage.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="font-satoshi text-[10px] uppercase font-semibold text-[#171e19]/60 mt-1">Contact: {event.studentContactName ? event.studentContactName.toUpperCase() : 'TBD'} {event.studentContactPhone ? `• ${event.studentContactPhone}` : ''}</p>
                              </div>
                              
                              <div className="flex gap-2 sm:self-start flex-wrap">
                                <button
                                  onClick={() => openReviewDialog(event, 'approved')}
                                  className="px-4 py-2 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                                >
                                  Approve Permissions
                                </button>
                                <button
                                  onClick={() => openReviewDialog(event, 'permissions_revision_needed')}
                                  className="px-4 py-2 bg-white border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                                >
                                  Request Letters Revision
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
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Start Date</span>
                                <span className="text-[11px]">{formatEventDate(event.startDate)}</span>
                              </div>
                              <div>
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Venue</span>
                                <span className="text-[11px]">{event.venue ? event.venue.toUpperCase() : 'TBD'}</span>
                              </div>
                              <div>
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Expected Crowd</span>
                                <span className="text-[11px]">{event.expectedFootfall} ATTENDEES</span>
                              </div>
                              <div>
                                <span className="font-bold block uppercase text-[#171e19]/60 text-[9px] mb-1">Venue slip status</span>
                                <span className="text-[11px] uppercase font-bold text-[#171e19]">
                                  {event.venuePermissionApplicable ? 'REQUIRED' : 'NOT APPLICABLE'}
                                </span>
                              </div>
                            </div>

                            {/* Clearance letters */}
                            <div className="space-y-2 font-satoshi text-xs font-bold uppercase">
                              <h4 className="text-[9px] uppercase font-bold text-[#171e19]/60 tracking-wider">Uploaded Clearance Letters</h4>
                              <div className="flex flex-wrap gap-4">
                                <a href={event.eventDescriptionUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                  <IconFile className="w-3 h-3 shrink-0" /> PROPOSAL DOCUMENT PDF
                                </a>
                                {event.eventOutcomeUrl && (
                                  <a href={event.eventOutcomeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                    <IconFile className="w-3 h-3 shrink-0" /> EVENT OUTCOME PDF
                                  </a>
                                )}
                                {event.doswPermissionLetterUrl && (
                                  <a href={event.doswPermissionLetterUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                    <IconFile className="w-3 h-3 shrink-0" /> DOSW CLEARANCE PDF
                                  </a>
                                )}
                                {event.otherDocumentUrl && (
                                  <a href={event.otherDocumentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                    <IconFile className="w-3 h-3 shrink-0" /> OTHER RELEVANT DOCUMENT PDF
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                  <p className="font-satoshi text-xs text-[#171e19]/60 font-semibold uppercase tracking-wider mt-1">
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
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Search Text</label>
                      <input
                        type="text"
                        placeholder="Search by event name or ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-4 py-2 text-xs text-[#171e19] placeholder-[#b7c6c2] outline-none w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Council / Committee</label>
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
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Status</label>
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
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Category</label>
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
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">From Date</label>
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={e => setStartDateFilter(e.target.value)}
                        className="bg-white border-2 border-[#171e19] focus:border-[#ffe17c] rounded-none px-3 py-2 text-xs text-[#171e19] outline-none w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">To Date</label>
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
                  <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]/60">No events yet.</p>
                </div>
              ) : (
                <div className="bg-white border-2 border-[#171e19] overflow-hidden rounded-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#171e19]/10 font-satoshi text-[10px] uppercase tracking-wider text-[#171e19]/60 font-bold">
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
                  <p className="font-satoshi text-[10px] text-[#171e19]/60 font-bold uppercase">
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
                      if (!isProposalAccepted(event.status)) return false;
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
                                    {clash && <span className="ml-1 text-red-500 inline-flex"><IconWarning className="w-2.5 h-2.5" /></span>}
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
