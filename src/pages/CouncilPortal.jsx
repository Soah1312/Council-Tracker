import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateEventId, createEventRequest, uploadFile, subscribeToEventsByCouncil, subscribeToAllEvents, subscribeToBlockedDates, submitReport, submitPermissionLetters, deleteEventRequest, updateEventDetails } from '../lib/events';
import { addCouncilMember, updateCouncilMember, deleteCouncilMember, subscribeToCouncilMembers, updateCouncilMembersOrder } from '../lib/members';
import { loginWithEmail, logoutUser, sendPasswordReset, onAuthChange, getCouncilByEmail } from '../lib/auth';
import { auth } from '../lib/firebase';
import { format } from 'date-fns';
import { notifyProposalSubmitted, notifyProposalResubmitted, notifyPermissionsSubmitted, notifyReportSubmitted } from '../lib/emailService';
import {
  IconFile, IconCalendar, IconMapPin, IconWarning,
  IconPhoto, IconMoney, IconTicket, IconUser, IconGlobe, IconTool, IconDownload, IconBan
} from '../lib/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';



function DragDropUpload({ id, label, accept, file, filesList, multiple, onChange, error, cachedUrl, helperText }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      if (multiple) {
        const arr = Array.from(e.dataTransfer.files);
        const valid = arr.filter(f => f.size <= 10 * 1024 * 1024);
        if (valid.length !== arr.length) {
          alert("Some files were skipped because they exceed the 10MB limit.");
        }
        onChange(valid);
      } else if (e.dataTransfer.files[0]) {
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile.size > 10 * 1024 * 1024) {
          alert("File size exceeds 10MB limit.");
          return;
        }
        onChange(droppedFile);
      }
    }
  };

  const onFileInputChange = (e) => {
    if (e.target.files) {
      if (multiple) {
        const arr = Array.from(e.target.files);
        const valid = arr.filter(f => f.size <= 10 * 1024 * 1024);
        if (valid.length !== arr.length) {
          alert("Some files were skipped because they exceed the 10MB limit.");
        }
        onChange(valid);
      } else if (e.target.files[0]) {
        const selectedFile = e.target.files[0];
        if (selectedFile.size > 10 * 1024 * 1024) {
          alert("File size exceeds 10MB limit.");
          e.target.value = "";
          return;
        }
        onChange(selectedFile);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">
        {label}
      </label>
      {helperText && (
        <p className="font-satoshi text-[10px] text-[#b7c6c2] uppercase -mt-1 mb-1">
          {helperText}
        </p>
      )}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed p-4 flex flex-col items-center justify-center transition-all cursor-pointer rounded-none relative ${dragActive
            ? 'border-[#ffe17c] bg-[#ffe17c]/5'
            : (file || (filesList && filesList.length > 0))
              ? 'border-emerald-600 bg-emerald-50/5'
              : 'border-[#171e19]/30 hover:border-[#171e19] bg-white'
          }`}
      >
        <input
          type="file"
          id={id}
          accept={accept}
          multiple={multiple}
          onChange={onFileInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="text-center space-y-1.5 pointer-events-none select-none">
          <p className="font-anton text-xs text-[#171e19] uppercase tracking-wider">
            {multiple
              ? (filesList && filesList.length > 0 ? `✓ ${filesList.length} Files Selected` : "Drag & Drop Files Here")
              : (file ? "✓ File Ready" : "Drag & Drop File Here")}
          </p>
          <p className="font-satoshi text-[10px] text-[#b7c6c2] uppercase font-bold">
            {multiple
              ? (filesList && filesList.length > 0 ? filesList.map(f => f.name).join(', ') : "or click to browse")
              : (file ? file.name : "or click to browse")}
          </p>
        </div>
      </div>
      {cachedUrl && (
        <p className="font-satoshi text-[9px] text-[#ffe17c] font-bold uppercase bg-[#171e19] px-2 py-0.5 self-start mt-1">✓ CACHED</p>
      )}
      {error && (
        <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{error}</p>
      )}
    </div>
  );
}

function SortableMemberCard({ member, openEditMemberModal, handleDeleteMember, IconUser }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.9 : 1,
  };

  const initials = member.name
    ? member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'CM';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border-2 border-[#171e19] p-5 rounded-none shadow-[4px_4px_0px_0px_#171e19] flex flex-col justify-between space-y-4 hover:border-[#ffe17c] transition-colors relative ${isDragging ? 'border-[#ffe17c] scale-105 shadow-[8px_8px_0px_0px_#171e19]' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-3 top-1/2 -translate-y-1/2 p-1 bg-white border-2 border-[#171e19] cursor-grab active:cursor-grabbing hover:bg-[#ffe17c] transition-colors z-20"
        >
          <GripVertical className="w-4 h-4 text-[#171e19]" />
        </div>
        <div className="w-12 h-12 bg-[#ffe17c] border-2 border-[#171e19] shrink-0 font-anton text-lg flex items-center justify-center text-[#171e19]">
          {initials}
        </div>
        <div className="space-y-1 overflow-hidden">
          <h3 className="font-anton text-lg text-[#171e19] tracking-tight truncate">
            {member.name.toUpperCase()}
          </h3>
          <span className="font-satoshi text-[10px] font-bold uppercase tracking-wider bg-[#171e19] text-white px-2 py-0.5 inline-block rounded-none">
            {member.designation}
          </span>
          <div className="flex items-center gap-1.5 font-satoshi text-xs font-semibold text-[#171e19]/80 pt-1">
            <IconUser className="w-3.5 h-3.5 text-[#171e19]/60" />
            <span>{member.contactNumber}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#171e19]/10">
        <button
          type="button"
          onClick={() => openEditMemberModal(member)}
          className="px-3 py-1 bg-white border border-[#171e19] text-[#171e19] hover:bg-[#ffe17c] font-satoshi text-[11px] font-bold uppercase tracking-wider transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => handleDeleteMember(member.id)}
          className="px-3 py-1 bg-red-50 border border-red-300 text-red-600 hover:bg-red-500 hover:text-white font-satoshi text-[11px] font-bold uppercase tracking-wider transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function CouncilPortal() {
  const [activeTab, setActiveTab] = useState('new-request'); // 'new-request' | 'my-events' | 'report'
  const [council, setCouncil] = useState(() => {
    const saved = sessionStorage.getItem('active_council');
    return saved ? JSON.parse(saved) : null;
  });

  const [notification, setNotification] = useState(null);

  // Firestore events state
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    eventName: '',
    jointWith: '',
    category: 'technical',
    startDate: '',
    endDate: '',
    venue: '',
    expectedFootfall: '',
    studentContactName: '',
    studentContactPhone: '',
    facultyCoordinatorName: '',
    resourcesNeeded: '',

    // Toggles
    venuePermissionApplicable: false,
    prizeMoneyApplicable: false,
    prizeMoneyAmount: '',
    prizeMoneySource: '',
    registrationFeeApplicable: false,
    registrationFeeAmount: '',
    attendanceWaiverApplicable: false,
    guestApplicable: false,
    guestName: '',
    guestDesignation: '',
    externalParticipantsApplicable: false,
    externalParticipantsExpected: '',
    safetyArrangementNeeded: false,
    safetyArrangementDetails: ''
  });

  // Attached files state
  const [files, setFiles] = useState({
    eventDescription: null,
    eventOutcome: null,
    doswLetter: null,
    councilLetter: null,
    venueLetter: null,
    waiverLetter: null
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submittedEventId, setSubmittedEventId] = useState(null);

  // Edit / Resubmit Tracking State
  const [editingEventId, setEditingEventId] = useState(null);
  const [existingUrls, setExistingUrls] = useState({
    eventDescriptionUrl: '',
    eventOutcomeUrl: '',
    doswPermissionLetterUrl: '',
    councilPermissionLetterUrl: '',
    venuePermissionLetterUrl: '',
    attendanceWaiverUrl: ''
  });

  // Report Submission State (Phase 5)
  const [reportingEvent, setReportingEvent] = useState(null);
  const [reportPdf, setReportPdf] = useState(null);
  const [reportImages, setReportImages] = useState([]);

  // Permission Upload States (Stage 2)
  const [permissionsUploadEvent, setPermissionsUploadEvent] = useState(null);
  const [permissionsFiles, setPermissionsFiles] = useState({
    doswLetter: null
  });
  const [customPermissionDocs, setCustomPermissionDocs] = useState([]);
  const [permissionsErrors, setPermissionsErrors] = useState({});
  const [permissionsSubmitting, setPermissionsSubmitting] = useState(false);

  // Council Members State
  const [councilMembers, setCouncilMembers] = useState([]);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: '', designation: '', contactNumber: '' });
  const [memberErrors, setMemberErrors] = useState({});
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  // Calendar State
  const [calMonth, setCalMonth] = useState(new Date());
  const [allCalEvents, setAllCalEvents] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);

  // Calendar Event Detail Modal State
  const [selectedCalEvent, setSelectedCalEvent] = useState(null);
  const [isEditingCalEvent, setIsEditingCalEvent] = useState(false);
  const [calEventForm, setCalEventForm] = useState({
    registrationFeeApplicable: false,
    registrationFeeAmount: '',
    studentContactName: '',
    studentContactPhone: '',
    facultyCoordinatorName: '',
    facultyCoordinatorPhone: '',
    posterFile: null
  });
  const [calEventSaving, setCalEventSaving] = useState(false);

  const handleOpenCalEventModal = (event) => {
    setSelectedCalEvent(event);
    setIsEditingCalEvent(false);
    setCalEventForm({
      registrationFeeApplicable: Boolean(event.registrationFeeApplicable),
      registrationFeeAmount: event.registrationFeeAmount ? String(event.registrationFeeAmount) : '',
      studentContactName: event.studentContactName || '',
      studentContactPhone: event.studentContactPhone || '',
      facultyCoordinatorName: event.facultyCoordinatorName || '',
      facultyCoordinatorPhone: event.facultyCoordinatorPhone || '',
      posterFile: null
    });
  };

  const handleCalEventSave = async (e) => {
    e.preventDefault();
    if (!selectedCalEvent) return;
    setCalEventSaving(true);
    try {
      let eventPosterUrl = selectedCalEvent.eventPosterUrl || null;
      if (calEventForm.posterFile) {
        const uploadPath = `events/${selectedCalEvent.eventId}/posters`;
        eventPosterUrl = await uploadFile(calEventForm.posterFile, uploadPath);
      }

      const updates = {
        registrationFeeApplicable: Boolean(calEventForm.registrationFeeApplicable),
        registrationFeeAmount: calEventForm.registrationFeeApplicable && calEventForm.registrationFeeAmount ? Number(calEventForm.registrationFeeAmount) : null,
        studentContactName: calEventForm.studentContactName.trim(),
        studentContactPhone: calEventForm.studentContactPhone.trim(),
        facultyCoordinatorName: calEventForm.facultyCoordinatorName.trim(),
        facultyCoordinatorPhone: calEventForm.facultyCoordinatorPhone.trim(),
        eventPosterUrl
      };

      await updateEventDetails(selectedCalEvent.eventId, updates);
      
      // Update local state for modal display
      setSelectedCalEvent(prev => ({ ...prev, ...updates }));
      setIsEditingCalEvent(false);
      showNotification('Event details updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to update event details.', 'error');
    } finally {
      setCalEventSaving(false);
    }
  };

  const [startCalMonth, setStartCalMonth] = useState(new Date());
  const [endCalMonth, setEndCalMonth] = useState(new Date());
  const [activePopover, setActivePopover] = useState(null); // 'startDate' | 'endDate' | null
  const popoverRef = useRef(null);

  // Close calendar popover on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setActivePopover(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCouncilMembers((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);

        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Call backend to update order
        updateCouncilMembersOrder(newOrder).catch(err => {
          console.error("Failed to update order in DB", err);
          // Assuming showNotification is in scope (it's defined below in the file though)
          // We can use alert if showNotification is not available yet or just log error.
        });

        return newOrder;
      });
    }
  };

  // Real-time Council Members Subscription
  useEffect(() => {
    if (!council?.id) return;
    const unsubscribe = subscribeToCouncilMembers(council.id, (data) => {
      setCouncilMembers(data);
    });
    return () => unsubscribe();
  }, [council?.id]);

  // Real-time All-Events Subscription for Calendar (all councils, read-only)
  useEffect(() => {
    const unsubscribe = subscribeToAllEvents((data) => {
      setAllCalEvents(data);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Blocked Dates Subscription
  useEffect(() => {
    const unsubscribe = subscribeToBlockedDates((data) => {
      setBlockedDates(data);
    });
    return () => unsubscribe();
  }, []);

  const openAddMemberModal = () => {
    setEditingMember(null);
    setMemberForm({ name: '', designation: '', contactNumber: '' });
    setMemberErrors({});
    setMemberModalOpen(true);
  };

  const openEditMemberModal = (member) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name || '',
      designation: member.designation || '',
      contactNumber: member.contactNumber || ''
    });
    setMemberErrors({});
    setMemberModalOpen(true);
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!memberForm.name.trim()) errs.name = 'Full Name is required.';
    if (!memberForm.designation.trim()) errs.designation = 'Designation is required.';
    if (!memberForm.contactNumber.trim()) errs.contactNumber = 'Contact Number is required.';

    if (Object.keys(errs).length > 0) {
      setMemberErrors(errs);
      return;
    }

    const targetCouncilId = council?.id || (sessionStorage.getItem('active_council') ? JSON.parse(sessionStorage.getItem('active_council')).id : null);
    const targetCouncilName = council?.name || (sessionStorage.getItem('active_council') ? JSON.parse(sessionStorage.getItem('active_council')).name : '');

    if (!targetCouncilId) {
      showNotification('Active council session missing. Please re-login.', 'error');
      return;
    }

    setMemberSubmitting(true);
    try {
      if (editingMember) {
        await updateCouncilMember(editingMember.id, memberForm);
        showNotification('Council member updated successfully!', 'success');
      } else {
        await addCouncilMember({
          councilId: targetCouncilId,
          councilName: targetCouncilName,
          ...memberForm
        });
        showNotification('Council member added successfully!', 'success');
      }
      setMemberModalOpen(false);
      setMemberForm({ name: '', designation: '', contactNumber: '' });
    } catch (err) {
      console.error('Member save error:', err);
      showNotification(err.message || 'Failed to save council member.', 'error');
    } finally {
      setMemberSubmitting(false);
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (window.confirm('Are you sure you want to remove this member from the council roster?')) {
      try {
        await deleteCouncilMember(memberId);
        showNotification('Council member removed successfully.', 'success');
      } catch (err) {
        console.error('Member delete error:', err);
        showNotification('Failed to delete council member.', 'error');
      }
    }
  };

  // 30-minute interval time options generator for clean dropdowns
  const timeOptions = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 23; h++) {
      const hr12 = h % 12 === 0 ? 12 : h % 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      slots.push({ label: `${String(hr12).padStart(2, '0')}:00 ${ampm}`, value: `${String(h).padStart(2, '0')}:00` });
      slots.push({ label: `${String(hr12).padStart(2, '0')}:30 ${ampm}`, value: `${String(h).padStart(2, '0')}:30` });
    }
    return slots;
  }, []);

  // Firebase Auth State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthChange((user) => {
      if (user && user.email) {
        const matchingCouncil = getCouncilByEmail(user.email);
        if (matchingCouncil) {
          setCouncil(matchingCouncil);
          sessionStorage.setItem('active_council', JSON.stringify(matchingCouncil));
        } else {
          setCouncil(null);
          sessionStorage.removeItem('active_council');
          setAuthError(`UNAUTHORIZED: ${user.email} IS NOT ASSIGNED TO ANY COUNCIL. CONTACT ADMIN.`);
          logoutUser().catch(console.error);
        }
      } else {
        setCouncil(null);
        sessionStorage.removeItem('active_council');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!council) return;
    setLoadingEvents(true);

    const unsubscribe = subscribeToEventsByCouncil(council.id, (data) => {
      const processed = data.map(event => {
        if (event.status === 'approved') {
          const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
          if (endDate < new Date()) {
            return { ...event, status: 'report_pending' };
          }
        }
        return event;
      });

      setEvents(processed);
      setLoadingEvents(false);
    });

    return () => unsubscribe();
  }, [council]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const getSplitDateTime = (datetimeStr) => {
    if (!datetimeStr) return { date: '', time: '' };
    const parts = datetimeStr.split('T');
    return {
      date: parts[0] || '',
      time: parts[1] || ''
    };
  };

  const handleSplitDateTimeChange = (field, type, val) => {
    const current = getSplitDateTime(formData[field]);
    current[type] = val;

    if (current.date) {
      const combined = `${current.date}T${current.time || '00:00'}`;
      if (field === 'startDate') {
        handleStartDateChange(combined);
      } else {
        setFormData(p => ({ ...p, [field]: combined }));
      }
    } else {
      setFormData(p => ({ ...p, [field]: '' }));
    }
  };

  const handleStartDateChange = (newStartStr) => {
    setFormData(prev => {
      const updates = { ...prev, startDate: newStartStr };

      if (newStartStr) {
        const startJS = new Date(newStartStr);
        if (!isNaN(startJS.getTime())) {
          const endJS = prev.endDate ? new Date(prev.endDate) : null;
          if (!endJS || isNaN(endJS.getTime()) || endJS <= startJS) {
            const defaultEndJS = new Date(startJS.getTime() + 60 * 60 * 1000); // +1 hour
            const year = defaultEndJS.getFullYear();
            const month = String(defaultEndJS.getMonth() + 1).padStart(2, '0');
            const day = String(defaultEndJS.getDate()).padStart(2, '0');
            const hours = String(defaultEndJS.getHours()).padStart(2, '0');
            const minutes = String(defaultEndJS.getMinutes()).padStart(2, '0');
            updates.endDate = `${year}-${month}-${day}T${hours}:${minutes}`;
          }
        }
      }
      return updates;
    });
  };

  const getEventDuration = () => {
    if (!formData.startDate || !formData.endDate) return null;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffMs = end - start;
    if (diffMs < 0) return { isInvalid: true, text: 'End date/time must be after start date/time.' };

    const diffMins = Math.round(diffMs / (1000 * 60));
    const days = Math.floor(diffMins / (24 * 60));
    const hours = Math.floor((diffMins % (24 * 60)) / 60);
    const minutes = diffMins % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

    const durationStr = parts.join(', ') || '0 minutes';

    const isSameDay = start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    const tagStr = isSameDay ? 'single day' : `${days + (hours > 0 || minutes > 0 ? 1 : 0)} days span`;

    return { isInvalid: false, text: `${durationStr} (${tagStr})` };
  };

  // Helper: check if a specific day is blocked by admin
  const isDateBlocked = (dateObj) => {
    if (!dateObj) return null;
    const dStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
    const dEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);
    return blockedDates.find(bd => {
      const bdStart = bd.startDate?.toDate ? bd.startDate.toDate() : new Date(bd.startDate);
      const bdEnd = bd.endDate?.toDate ? bd.endDate.toDate() : new Date(bd.endDate);
      return bdStart <= dEnd && bdEnd >= dStart;
    }) || null;
  };

  // Helper: check if a date range overlaps with any admin-blocked period
  const getBlockedOverlap = (startStr, endStr) => {
    if (!startStr) return null;
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : start;
    if (isNaN(start.getTime())) return null;

    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);

    return blockedDates.find(bd => {
      const bdStart = bd.startDate?.toDate ? bd.startDate.toDate() : new Date(bd.startDate);
      const bdEnd = bd.endDate?.toDate ? bd.endDate.toDate() : new Date(bd.endDate);
      return startDay <= bdEnd && endDay >= bdStart;
    }) || null;
  };

  const handleSelectCalendarDate = (field, dateObj) => {
    if (!dateObj) return;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    const current = getSplitDateTime(formData[field]);
    const timePart = current.time || '09:00';

    const combined = `${year}-${month}-${day}T${timePart}`;

    if (field === 'startDate') {
      handleStartDateChange(combined);
    } else {
      setFormData(prev => ({ ...prev, endDate: combined }));
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail.trim() || !authPassword) {
      setAuthError('EMAIL AND PASSWORD ARE REQUIRED.');
      return;
    }

    setAuthSubmitting(true);
    try {
      await loginWithEmail(authEmail, authPassword);
      showNotification('AUTHENTICATED SUCCESSFULLY!');
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setAuthError('INVALID EMAIL OR PASSWORD. ACCESS DENIED.');
      } else {
        setAuthError(err.message || 'AUTHENTICATION FAILED.');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error(err);
    }
    setCouncil(null);
    sessionStorage.removeItem('active_council');
    handleResetForm();
  };

  const handleSendResetLink = async (e) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim() || authEmail.trim();
    if (!targetEmail) {
      setResetMessage({ type: 'error', text: 'Please enter your registered email address.' });
      return;
    }

    setResetSubmitting(true);
    setResetMessage(null);
    try {
      await sendPasswordReset(targetEmail);
      setResetMessage({ type: 'success', text: `Password reset link sent to ${targetEmail}. Please check your Inbox and Spam/Junk folder!` });
      showNotification(`Password reset link sent to ${targetEmail}. Check Inbox & Spam folder!`);
    } catch (err) {
      console.error(err);
      setResetMessage({ type: 'error', text: err.message || 'Failed to send password reset email.' });
    } finally {
      setResetSubmitting(false);
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

  const renderDualApprovalBadges = (event) => {
    const isStage1Pending = event.status === 'submitted' || event.status === 'proposal_approved';
    const isStage2Pending = event.status === 'permissions_submitted' || event.status === 'approved';

    if (!isStage1Pending && !isStage2Pending) return null;

    const stageNum = isStage1Pending ? 1 : 2;
    const approvals = stageNum === 1 ? (event.stage1Approvals || {}) : (event.stage2Approvals || {});
    const dosw = approvals.dosw?.approved;
    const stuco = approvals.stuco?.approved;

    let count = 0;
    if (dosw) count++;
    if (stuco) count++;

    return (
      <div className="p-3 bg-[#171e19]/5 border border-[#171e19]/20 rounded-none space-y-1.5 font-satoshi">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-bold text-[10px] uppercase tracking-wider text-[#171e19]/70">
            Stage {stageNum} Administrative Approvals ({count}/2):
          </span>
          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border ${count === 2 ? 'bg-emerald-950 text-white border-emerald-900' : 'bg-[#ffe17c] text-[#171e19] border-[#171e19]'
            }`}>
            {count === 2 ? 'FULLY APPROVED' : '1/2 APPROVALS PENDING'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold uppercase tracking-wide">
          <div className={`p-2 border flex items-center justify-between ${dosw ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-white border-[#171e19]/20 text-[#171e19]/60'
            }`}>
            <span>Dean of Students' Welfare (DOSW)</span>
            <span>{dosw ? '✓ Approved' : '⏳ Pending'}</span>
          </div>

          <div className={`p-2 border flex items-center justify-between ${stuco ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-white border-[#171e19]/20 text-[#171e19]/60'
            }`}>
            <span>Students' Council (StuCo)</span>
            <span>{stuco ? '✓ Approved' : '⏳ Pending'}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderReviewHistory = (event) => {
    if (!event.reviewHistory || event.reviewHistory.length === 0) return null;

    return (
      <div className="space-y-2 border-t-2 border-dashed border-[#171e19] pt-3 mt-3">
        <span className="font-satoshi text-[10px] font-bold uppercase tracking-widest text-[#171e19]/70 block">
          Admin Review Comments &amp; Suggestions ({event.reviewHistory.length}):
        </span>
        <div className="space-y-2">
          {event.reviewHistory.slice().reverse().map((rev, idx) => (
            <div key={idx} className="p-3 bg-white border-2 border-[#171e19] text-xs font-satoshi space-y-1.5 shadow-[2px_2px_0px_0px_#171e19]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-anton text-sm text-[#171e19] tracking-tight uppercase">
                    {rev.adminName}
                  </span>
                  <span className="font-satoshi text-[9px] font-bold uppercase tracking-wider bg-[#171e19] text-white px-2 py-0.5">
                    {rev.adminRole?.toUpperCase() || 'ADMIN'}
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#ffe17c] text-[#171e19] border border-[#171e19]">
                  {rev.status?.replace(/_/g, ' ')}
                </span>
              </div>
              {rev.notes && (
                <p className="text-[#171e19] font-semibold text-xs bg-[#ffe17c]/20 p-2.5 border border-[#171e19]/20 leading-relaxed">
                  &ldquo;{rev.notes}&rdquo;
                </p>
              )}
              {rev.timestamp && (
                <p className="text-[9px] text-[#171e19]/50 font-bold uppercase tracking-wide">
                  {formatEventDate(rev.timestamp)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
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
        <span className="font-bold text-[9px] uppercase tracking-wider text-[#b7c6c2] block">Event Progression Flow</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {stages.map((stg) => {
            const isCompleted = currentStage > stg.num || (stg.num === 3 && status === 'closed');
            const isActive = currentStage === stg.num && status !== 'closed';

            let bgColor = 'bg-white border-[#171e19]/15 text-[#171e19]/40';
            if (isActive) {
              bgColor = 'bg-[#ffe17c] border-[#171e19] text-[#171e19] font-bold shadow-[2px_2px_0px_0px_#171e19]';
            } else if (isCompleted) {
              bgColor = 'bg-[#171e19] border-[#171e19] text-[#ffe17c]';
            }

            return (
              <div key={stg.num} className={`p-2.5 border-2 flex flex-col items-center text-center justify-between gap-1 transition-brutal ${bgColor}`}>
                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                  <span className={`w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center font-bold ${isCompleted ? 'bg-[#ffe17c] text-[#171e19]' : isActive ? 'bg-[#171e19] text-[#ffe17c]' : 'bg-[#171e19]/10 text-[#171e19]/50'
                    }`}>
                    {isCompleted ? '✓' : stg.num}
                  </span>
                  <span className="font-anton text-[10px] uppercase tracking-wide">{stg.name}</span>
                </div>
                <span className="text-[8px] uppercase tracking-wide block opacity-80 mt-1 font-semibold">{stg.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Date local string generator for editing pre-fills
  const toDatetimeLocalString = (dateField) => {
    if (!dateField) return '';
    let dateJS = dateField;
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      dateJS = dateField.toDate();
    } else if (dateField.seconds) {
      dateJS = new Date(dateField.seconds * 1000);
    } else {
      dateJS = new Date(dateField);
    }
    try {
      const tzOffset = dateJS.getTimezoneOffset() * 60000;
      return (new Date(dateJS.getTime() - tzOffset)).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  // Convert dates to human readable string
  const formatEventDate = (dateField) => {
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
      return format(dateJS, 'MMM dd, yyyy hh:mm a');
    } catch {
      return String(dateField);
    }
  };

  // Dynamic report pending and color calculations
  const getStatusDetails = (event) => {
    const status = event.status;

    switch (status) {
      case 'submitted':
        return { label: 'proposal submitted', colorClass: 'bg-[#b7c6c2]/50 text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold border border-[#171e19]/20' };
      case 'proposal_approved':
        return { label: 'proposal accepted', colorClass: 'bg-indigo-900 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
      case 'permissions_submitted':
        return { label: 'permissions pending', colorClass: 'bg-blue-900 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
      case 'permissions_revision_needed':
        return { label: 'permissions revision needed', colorClass: 'bg-[#ffe17c] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold border border-[#171e19]' };
      case 'approved':
        return {
          label: 'fully approved',
          colorClass: 'bg-emerald-950 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold',
          isReportPending: true
        };
      case 'rejected':
        return { label: 'rejected', colorClass: 'bg-red-800 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
      case 'revision_needed':
        return { label: 'revision needed', colorClass: 'bg-[#ffe17c] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold border border-[#171e19]' };
      case 'report_pending':
        return {
          label: 'report pending',
          colorClass: 'bg-[#171e19] text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold',
          isReportPending: true
        };
      case 'closed':
        return { label: 'closed', colorClass: 'bg-[#b7c6c2] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold border border-[#171e19]/10' };
      default:
        return { label: status, colorClass: 'bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.eventName.trim()) newErrors.eventName = 'Event Name is required.';
    if (!formData.expectedFootfall || isNaN(formData.expectedFootfall) || Number(formData.expectedFootfall) <= 0) {
      newErrors.expectedFootfall = 'Approximate footfall is required and must be greater than 0.';
    }
    if (!formData.startDate) newErrors.startDate = 'Start date and time is required.';
    if (!formData.endDate) newErrors.endDate = 'End date and time is required.';
    if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after the start date.';
    }

    // Admin-blocked date range validation
    const blockedConflict = getBlockedOverlap(formData.startDate, formData.endDate);
    if (blockedConflict) {
      const msg = `Selected date(s) fall within an Admin-Blocked period (${blockedConflict.reason}). Proposing events on blocked dates is restricted.`;
      newErrors.startDate = msg;
      newErrors.endDate = msg;
    }
    // File description validation - Single required PDF
    if (!files.eventDescription && !existingUrls.eventDescriptionUrl) {
      newErrors.eventDescription = 'Proposal description PDF is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showNotification('Please correct validation errors in the form.', 'error');
      return;
    }

    setSubmitting(true);
    setUploadProgress(editingEventId ? 'Modifying event files...' : 'Generating Event ID...');

    try {
      const eventId = editingEventId || await generateEventId();
      const uploadPath = `events/${eventId}/proposals`;

      let eventDescriptionUrl = existingUrls.eventDescriptionUrl;
      if (files.eventDescription) {
        setUploadProgress('Uploading event proposal description PDF...');
        eventDescriptionUrl = await uploadFile(files.eventDescription, uploadPath);
      }

      let eventOutcomeUrl = existingUrls.eventOutcomeUrl || null;

      // Preserve existing permission letters if editing, otherwise null
      const doswPermissionLetterUrl = existingUrls.doswPermissionLetterUrl || null;
      const councilPermissionLetterUrl = existingUrls.councilPermissionLetterUrl || null;
      const venuePermissionLetterUrl = existingUrls.venuePermissionLetterUrl || null;

      let attendanceWaiverUrl = formData.attendanceWaiverApplicable ? existingUrls.attendanceWaiverUrl : null;
      if (formData.attendanceWaiverApplicable && files.waiverLetter) {
        setUploadProgress('Uploading waiver request PDF...');
        attendanceWaiverUrl = await uploadFile(files.waiverLetter, uploadPath);
      }

      setUploadProgress('Updating database...');

      const payload = {
        eventId,
        councilId: council.id,
        councilName: council.name,
        councilEmail: auth.currentUser?.email || '',
        eventName: formData.eventName.trim(),
        expectedFootfall: Number(formData.expectedFootfall),
        startDate: formData.startDate,
        endDate: formData.endDate,
        eventDescriptionUrl,
        eventOutcomeUrl,
        doswPermissionLetterUrl,
        councilPermissionLetterUrl,
        venuePermissionLetterUrl,
        attendanceWaiverUrl
      };

      await createEventRequest(payload);
      // Fire-and-forget email notification
      if (editingEventId) {
        notifyProposalResubmitted(payload, council.name).catch(console.error);
      } else {
        notifyProposalSubmitted(payload, council.name).catch(console.error);
      }
      setSubmittedEventId(eventId);
      showNotification(editingEventId ? 'Proposal updated & resubmitted successfully!' : 'Event proposal request filed successfully!');
      setEditingEventId(null);
    } catch (err) {
      console.error(err);
      showNotification(err.message || 'Submission failed.', 'error');
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  const handleEditClick = (event, e) => {
    e.stopPropagation();

    setFormData({
      eventName: event.eventName || '',
      category: event.category || 'technical',
      startDate: toDatetimeLocalString(event.startDate),
      endDate: toDatetimeLocalString(event.endDate),
      venue: event.venue || '',
      venuePermissionApplicable: Boolean(event.venuePermissionApplicable),
      expectedFootfall: event.expectedFootfall ? String(event.expectedFootfall) : '',
      prizeMoneyApplicable: Boolean(event.prizeMoneyApplicable),
      prizeMoneyAmount: event.prizeMoneyAmount ? String(event.prizeMoneyAmount) : '',
      registrationFeeApplicable: Boolean(event.registrationFeeApplicable),
      registrationFeeAmount: event.registrationFeeAmount ? String(event.registrationFeeAmount) : '',
      attendanceWaiverApplicable: Boolean(event.attendanceWaiverApplicable),
      collaborators: event.collaborators || ''
    });

    const startJS = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    const endJS = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
    if (!isNaN(startJS.getTime())) setStartCalMonth(startJS);
    if (!isNaN(endJS.getTime())) setEndCalMonth(endJS);

    setExistingUrls({
      eventDescriptionUrl: event.eventDescriptionUrl || '',
      eventOutcomeUrl: event.eventOutcomeUrl || '',
      doswPermissionLetterUrl: event.doswPermissionLetterUrl || '',
      councilPermissionLetterUrl: event.councilPermissionLetterUrl || '',
      venuePermissionLetterUrl: event.venuePermissionLetterUrl || ''
    });

    setFiles({
      eventDescription: null,
      eventOutcome: null
    });

    setErrors({});
    setEditingEventId(event.eventId);
    setActiveTab('new-request');
  };

  const handleDeleteProposal = async (eventOrId, e) => {
    e.stopPropagation();
    const eventId = typeof eventOrId === 'string' ? eventOrId : eventOrId?.eventId;
    const status = typeof eventOrId === 'object' ? eventOrId?.status : null;

    if (status && !['submitted', 'revision_needed', 'rejected'].includes(status)) {
      showNotification('Deletion prohibited once Stage 1 has been approved.', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to permanently delete this proposal? This action cannot be undone.')) {
      try {
        await deleteEventRequest(eventId);
        showNotification('Proposal deleted successfully.', 'success');
        if (expandedEventId === eventId) setExpandedEventId(null);
      } catch (err) {
        console.error('Error deleting proposal:', err);
        showNotification(err.message || 'Failed to delete proposal.', 'error');
      }
    }
  };

  const handleResetForm = () => {
    setFormData({
      eventName: '',
      category: 'technical',
      startDate: '',
      endDate: '',
      venue: '',
      venuePermissionApplicable: false,
      expectedFootfall: '',
      prizeMoneyApplicable: false,
      prizeMoneyAmount: '',
      registrationFeeApplicable: false,
      registrationFeeAmount: '',
      attendanceWaiverApplicable: false,
      collaborators: ''
    });
    setFiles({
      eventDescription: null,
      eventOutcome: null
    });
    setErrors({});
    setSubmittedEventId(null);
    setEditingEventId(null);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportPdf) {
      showNotification('Please upload the Event Summary PDF report.', 'error');
      return;
    }
    if (reportImages.length === 0) {
      showNotification('At least one event photo is required.', 'error');
      return;
    }

    setSubmitting(true);
    setUploadProgress('Uploading report PDF...');

    try {
      const eventId = reportingEvent.eventId;
      const pdfUrl = await uploadFile(reportPdf, `events/${eventId}/report`);

      const imageUrls = [];
      setUploadProgress('Uploading report images...');
      for (let i = 0; i < reportImages.length; i++) {
        const img = reportImages[i];
        const imgUrl = await uploadFile(img, `events/${eventId}/report`);
        imageUrls.push(imgUrl);
      }

      setUploadProgress('Closing event in database...');
      await submitReport(reportingEvent.id, pdfUrl, imageUrls);
      // Fire-and-forget email notification
      notifyReportSubmitted(reportingEvent, council.name).catch(console.error);

      showNotification('Event report submitted successfully and status closed!');
      setReportingEvent(null);
      setReportPdf(null);
      setReportImages([]);
      setActiveTab('my-events');
    } catch (err) {
      console.error(err);
      showNotification('Failed to submit report assets.', 'error');
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  const handlePermissionsSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!permissionsFiles.doswLetter) {
      errors.doswLetter = 'DoSW & Principal clearance letter PDF is required.';
    }

    if (Object.keys(errors).length > 0) {
      setPermissionsErrors(errors);
      return;
    }

    setPermissionsSubmitting(true);
    setUploadProgress('Uploading permission letters...');
    try {
      const uploadPath = `events/${permissionsUploadEvent.eventId}/permissions`;

      setUploadProgress('Uploading DoSW clearance letter PDF...');
      const doswPermissionLetterUrl = await uploadFile(permissionsFiles.doswLetter, uploadPath);

      const customPermissionLetters = [];
      for (let i = 0; i < customPermissionDocs.length; i++) {
        const item = customPermissionDocs[i];
        if (item.file) {
          const docTitle = item.name.trim() || `Additional Clearance ${i + 1}`;
          setUploadProgress(`Uploading ${docTitle}...`);
          const url = await uploadFile(item.file, uploadPath);
          customPermissionLetters.push({ title: docTitle, url });
        }
      }

      setUploadProgress('Saving to database...');
      await submitPermissionLetters(permissionsUploadEvent.eventId, {
        doswPermissionLetterUrl,
        customPermissionLetters
      });
      // Fire-and-forget email notification
      notifyPermissionsSubmitted(permissionsUploadEvent, council.name).catch(console.error);

      showNotification('Permission letters uploaded successfully! Awaiting review.');
      setPermissionsUploadEvent(null);
      setPermissionsFiles({ doswLetter: null });
      setCustomPermissionDocs([]);
      setPermissionsErrors({});
    } catch (err) {
      console.error(err);
      showNotification(err.message || 'Failed to upload permission letters.', 'error');
    } finally {
      setPermissionsSubmitting(false);
      setUploadProgress('');
    }
  };

  // 1. LANDING / LOGIN SCREEN (Email & Password Auth Gate)
  if (!council) {
    return (
      <div className="min-h-screen grid-pattern-charcoal flex items-center justify-center px-4 py-12">
        <div className="bg-white border-4 border-[#171e19] p-8 md:p-10 max-w-md w-full space-y-6 shadow-[8px_8px_0px_0px_#ffe17c] rounded-none">
          <div className="text-center space-y-2">
            <h1 className="font-anton text-5xl md:text-6xl text-[#171e19] tracking-tight">
              CRCE COUNCILS<span className="text-[#ffe17c]">.</span>
            </h1>
            <p className="font-satoshi text-xs uppercase tracking-widest text-[#b7c6c2] font-bold">
              Council Authentication Portal
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 border-2 border-red-500 p-3 text-red-700 font-satoshi text-xs font-bold uppercase tracking-wide flex items-center gap-2">
              <IconWarning className="w-4 h-4 shrink-0 text-red-500" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2] block">
                Council Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="Enter your official email address"
                value={authEmail}
                onChange={(e) => {
                  setAuthEmail(e.target.value);
                  setAuthError('');
                }}
                className="w-full bg-white border-2 border-[#171e19] px-4 py-3 text-sm text-[#171e19] font-satoshi font-semibold focus:outline-none focus:border-[#ffe17c] rounded-none transition-brutal"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2] block">
                  Account Password *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(authEmail);
                    setResetMessage(null);
                    setShowResetModal(true);
                  }}
                  className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => {
                  setAuthPassword(e.target.value);
                  setAuthError('');
                }}
                className="w-full bg-white border-2 border-[#171e19] px-4 py-3 text-sm text-[#171e19] font-satoshi font-semibold focus:outline-none focus:border-[#ffe17c] rounded-none transition-brutal"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full bg-[#ffe17c] hover:bg-[#ffe17c]/90 text-[#171e19] font-anton text-lg py-3.5 uppercase tracking-wider transition-brutal border-2 border-[#171e19] rounded-none hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#171e19] active:translate-x-0 active:translate-y-0 disabled:bg-[#ffe17c]/50"
            >
              {authSubmitting ? 'AUTHENTICATING...' : 'LOGIN TO PORTAL'}
            </button>
          </form>

        </div>

        {/* FORGOT PASSWORD MODAL OVERLAY */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 bg-[#171e19]/70 backdrop-blur-sm flex justify-center items-center px-4">
            <div className="bg-white border-4 border-[#171e19] rounded-none w-full max-w-md p-6 space-y-4 shadow-[8px_8px_0px_0px_#ffe17c] text-[#171e19]">
              <div>
                <p className="font-satoshi text-[10px] uppercase font-bold text-[#b7c6c2]">Password Recovery</p>
                <h3 className="font-anton text-2xl text-[#171e19] mt-1 tracking-tight">
                  RESET ACCOUNT PASSWORD
                </h3>
                <p className="font-satoshi text-xs text-[#6b7280] mt-1 font-medium leading-relaxed">
                  Enter your assigned council email address. We will send you an official Firebase password reset link.
                </p>
              </div>

              {resetMessage && (
                <div className={`p-3 border-2 text-xs font-bold uppercase ${resetMessage.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  }`}>
                  {resetMessage.text}
                </div>
              )}

              <form onSubmit={handleSendResetLink} className="space-y-4">
                <div className="space-y-1">
                  <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2] block">
                    Registered Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your official email address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] font-satoshi font-semibold focus:outline-none focus:border-[#ffe17c] rounded-none transition-brutal"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-[#171e19]/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetMessage(null);
                    }}
                    className="px-4 py-2 border-2 border-[#171e19] hover:bg-slate-100 font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] rounded-none transition-brutal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="px-5 py-2 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] font-anton text-sm uppercase tracking-widest rounded-none border-2 border-[#171e19] transition-brutal disabled:bg-slate-400"
                  >
                    {resetSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. MAIN LOGGED IN SCREEN
  return (
    <div className="max-w-[1550px] mx-auto px-4 md:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center p-4 border transition-all duration-300 transform translate-y-0 rounded-none ${notification.type === 'error'
            ? 'bg-red-50 border-red-500 text-red-800'
            : 'bg-emerald-50 border-emerald-500 text-emerald-800'
          }`}>
          <div className="font-satoshi text-xs font-bold uppercase tracking-wide">{notification.message}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-[#171e19] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[#ffe17c] border border-[#171e19]" />
            <p className="font-satoshi text-[10px] uppercase tracking-widest text-[#171e19] font-bold">Active Session ({council?.category ? council.category.toUpperCase() : 'COUNCIL'})</p>
          </div>
          <h1 className="font-anton text-4xl text-[#171e19] mt-2 tracking-tight">
            {council?.name ? council.name.toUpperCase() : 'COUNCIL PORTAL'}
          </h1>
          <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold mt-1">Faculty Coordinator: {council?.coordinator ? council.coordinator.toUpperCase() : 'N/A'}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-[#171e19] hover:bg-[#ffe17c]/10 font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] transition-brutal"
          >
            Logout / Switch
          </button>
        </div>
      </div>

      {/* Tabs folderSwitcher */}
      <div className="flex overflow-x-auto border-b-2 border-[#171e19] no-scrollbar scroll-smooth">
        <button
          onClick={() => {
            setActiveTab('new-request');
            setSubmittedEventId(null);
            setReportingEvent(null);
          }}
          className={`font-anton text-xs sm:text-sm md:text-xl px-3 sm:px-4 md:px-8 py-2.5 sm:py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-[#171e19] tracking-wider transition-brutal shrink-0 whitespace-nowrap ${activeTab === 'new-request'
              ? 'bg-[#171e19] text-white border-b-transparent'
              : 'bg-white text-[#171e19] hover:bg-[#ffe17c]/20'
            }`}
        >
          {editingEventId ? 'Edit Event Request' : 'New Event Request'}
        </button>

        <button
          onClick={() => {
            setActiveTab('my-events');
            setSubmittedEventId(null);
            setReportingEvent(null);
          }}
          className={`font-anton text-xs sm:text-sm md:text-xl px-3 sm:px-4 md:px-8 py-2.5 sm:py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-[#171e19] ml-[-2px] tracking-wider transition-brutal shrink-0 whitespace-nowrap ${activeTab === 'my-events'
              ? 'bg-[#171e19] text-white border-b-transparent'
              : 'bg-white text-[#171e19] hover:bg-[#ffe17c]/20'
            }`}
        >
          My Events
        </button>

        <button
          onClick={() => {
            setActiveTab('members');
            setSubmittedEventId(null);
            setReportingEvent(null);
          }}
          className={`font-anton text-xs sm:text-sm md:text-xl px-3 sm:px-4 md:px-8 py-2.5 sm:py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-[#171e19] ml-[-2px] tracking-wider transition-brutal shrink-0 whitespace-nowrap ${activeTab === 'members'
              ? 'bg-[#171e19] text-white border-b-transparent'
              : 'bg-white text-[#171e19] hover:bg-[#ffe17c]/20'
            }`}
        >
          Council Members ({councilMembers.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('calendar');
            setSubmittedEventId(null);
            setReportingEvent(null);
          }}
          className={`font-anton text-xs sm:text-sm md:text-xl px-3 sm:px-4 md:px-8 py-2.5 sm:py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-[#171e19] ml-[-2px] tracking-wider transition-brutal shrink-0 whitespace-nowrap flex items-center gap-1.5 sm:gap-2 ${activeTab === 'calendar'
              ? 'bg-[#171e19] text-[#ffe17c] border-b-transparent'
              : 'bg-white text-[#171e19] hover:bg-[#ffe17c]/20'
            }`}
        >
          <IconCalendar className="w-4 h-4 sm:w-5 sm:h-5" /> Calendar
        </button>

        {reportingEvent && (
          <button
            onClick={() => setActiveTab('report')}
            className={`font-anton text-xs sm:text-sm md:text-xl px-3 sm:px-4 md:px-8 py-2.5 sm:py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-dashed border-[#ffe17c] bg-[#171e19] text-[#ffe17c] ml-[-2px] tracking-wider transition-brutal shrink-0 whitespace-nowrap`}
          >
            Submit Report ({reportingEvent.eventId})
          </button>
        )}
      </div>


      {/* Main Content Pane */}
      <div className="pt-2">
        {/* TAB: NEW EVENT REQUEST */}
        {activeTab === 'new-request' && (
          submittedEventId ? (
            /* Success Screen */
            <div className="bg-white border-2 border-[#171e19] p-12 text-center space-y-6 animate-fade-in shadow-[8px_8px_0px_0px_#ffe17c] rounded-none">
              <div className="mx-auto w-16 h-16 bg-[#ffe17c] text-[#171e19] rounded-full flex items-center justify-center text-3xl border-2 border-[#171e19]">
                ✓
              </div>
              <div className="space-y-2">
                <h2 className="font-anton text-3xl text-[#171e19] tracking-tight">
                  {editingEventId ? 'PROPOSAL UPDATED!' : 'PROPOSAL FILED SUCCESSFULLY!'}
                </h2>
                <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold max-w-md mx-auto uppercase tracking-wide">
                  Your request has been queued in Firestore for administrative review.
                </p>
              </div>

              <div className="bg-white border-2 border-[#171e19] p-4 max-w-sm mx-auto space-y-1 rounded-none">
                <p className="font-satoshi text-[9px] uppercase font-bold tracking-widest text-[#b7c6c2]">Event ID Reference</p>
                <p className="font-satoshi text-xl font-bold tracking-widest text-[#171e19] select-all">{submittedEventId}</p>
              </div>

              <div className="flex justify-center gap-4 pt-4">
                <button
                  onClick={() => {
                    setSubmittedEventId(null);
                    setActiveTab('my-events');
                  }}
                  className="px-6 py-3 bg-white border-2 border-[#171e19] hover:bg-[#ffe17c] text-[#171e19] font-satoshi font-bold text-xs uppercase tracking-wider transition-brutal"
                >
                  View My Proposals
                </button>
                <button
                  onClick={handleResetForm}
                  className="px-6 py-3 bg-[#ffe17c] border-2 border-[#171e19] hover:bg-[#ffe17c]/90 text-[#171e19] font-satoshi font-bold text-xs uppercase tracking-wider transition-brutal"
                >
                  Propose Another
                </button>
              </div>
            </div>
          ) : (
            /* Form Layout */
            <div className="bg-white border-2 border-[#171e19] p-6 md:p-8 space-y-8 rounded-none">
              <div className="flex justify-between items-start gap-4 border-b border-[#171e19]/10 pb-4">
                <div>
                  <h2 className="font-anton text-3xl text-[#171e19] tracking-tight">
                    {editingEventId ? `EDIT PROPOSAL: ${editingEventId}` : 'PROPOSE NEW ACTIVITY'}
                  </h2>
                  <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold uppercase tracking-wider mt-1">
                    {editingEventId
                      ? 'Modify variables. Files not re-uploaded will reuse existing documents.'
                      : 'Provide activity details. All fields marked with * are required.'}
                  </p>
                </div>
                {editingEventId && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-3 py-1.5 border-2 border-[#171e19] hover:bg-red-50 text-red-500 font-satoshi text-[10px] font-bold uppercase tracking-wider transition-brutal"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {submitting && (
                <div className="bg-[#ffe17c]/20 border-2 border-[#171e19] p-4 rounded-none flex items-center gap-3 animate-pulse">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#171e19] shrink-0" />
                  <div className="font-satoshi text-xs font-bold uppercase tracking-wider">
                    <p className="text-[#171e19]">Uploading files & updating registry...</p>
                    <p className="text-[#b7c6c2] mt-0.5">{uploadProgress}</p>
                  </div>
                </div>
              )}              <form onSubmit={handleSubmit} className="space-y-8">
                {/* SECTION 1: General Details */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">EVENT DETAILS</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Event Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. INNOVATEX HACKATHON"
                        value={formData.eventName}
                        onChange={e => setFormData(p => ({ ...p, eventName: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                      />
                      {errors.eventName && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.eventName}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Venue *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Main Auditorium"
                        value={formData.venue}
                        onChange={e => setFormData(p => ({ ...p, venue: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                      />
                      {errors.venue && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.venue}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Approximate Footfall / Expected Attendees *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 250"
                        value={formData.expectedFootfall}
                        onChange={e => setFormData(p => ({ ...p, expectedFootfall: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                      />
                      {errors.expectedFootfall && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.expectedFootfall}</p>}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Logistics - Schedule & Timings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">SCHEDULE & TIMINGS</h3>
                  </div>

                  {/* Overlap Error Alert */}
                  {(() => {
                    const overlap = getBlockedOverlap(formData.startDate, formData.endDate);
                    if (!overlap) return null;
                    return (
                      <div className="p-3.5 bg-red-100 border-2 border-red-500 text-red-900 font-satoshi text-xs font-bold uppercase tracking-wide flex items-center gap-2.5">
                        <IconBan className="w-5 h-5 text-red-600 shrink-0" />
                        <span>DATE RESTRICTED: Selected timing overlaps with Admin-Blocked period "{overlap.reason}". You cannot submit proposals for blocked dates.</span>
                      </div>
                    );
                  })()}

                  <div className="bg-[#b7c6c2]/5 border-2 border-[#171e19] p-5 shadow-[4px_4px_0px_0px_#ffe17c] relative" ref={popoverRef}>
                    {/* Compact 4-Field Row Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                      {/* 1. START DATE */}
                      <div className="flex flex-col gap-1.5 relative">
                        <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Start Date *</label>
                        <button
                          type="button"
                          onClick={() => {
                            const dateObj = formData.startDate ? new Date(formData.startDate) : new Date();
                            if (!isNaN(dateObj.getTime())) setStartCalMonth(dateObj);
                            setActivePopover(prev => prev === 'startDate' ? null : 'startDate');
                          }}
                          className="w-full bg-white border-2 border-[#171e19] px-3 py-2.5 text-xs font-bold text-[#171e19] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal flex items-center justify-between font-satoshi uppercase"
                        >
                          <span>
                            {formData.startDate ? format(new Date(formData.startDate), 'MMM dd, yyyy') : 'SELECT START DATE'}
                          </span>
                          <IconCalendar className="w-4 h-4 text-[#171e19] shrink-0" />
                        </button>

                        {/* Calendar Popover for Start Date */}
                        {activePopover === 'startDate' && (
                          <div className="absolute z-50 top-full mt-2 left-0 w-64 bg-white border-2 border-[#171e19] shadow-[4px_4px_0px_0px_#171e19] p-3 animate-fade-in">
                            <div className="flex items-center justify-between border-b-2 border-[#171e19] pb-2 mb-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStartCalMonth(new Date(startCalMonth.getFullYear(), startCalMonth.getMonth() - 1, 1));
                                }}
                                className="w-6 h-6 border-2 border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-xs rounded-none transition-brutal"
                              >
                                &larr;
                              </button>
                              <span className="font-anton text-xs uppercase tracking-wider text-[#171e19]">
                                {format(startCalMonth, 'MMMM yyyy')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStartCalMonth(new Date(startCalMonth.getFullYear(), startCalMonth.getMonth() + 1, 1));
                                }}
                                className="w-6 h-6 border-2 border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-xs rounded-none transition-brutal"
                              >
                                &rarr;
                              </button>
                            </div>

                            <div className="grid grid-cols-7 text-center font-bold text-[9px] uppercase tracking-wider text-[#b7c6c2] mb-1.5">
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => <div key={idx}>{w}</div>)}
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center font-satoshi text-xs font-bold">
                              {(() => {
                                const year = startCalMonth.getFullYear();
                                const month = startCalMonth.getMonth();
                                const firstDay = new Date(year, month, 1);
                                const startWeekDay = firstDay.getDay();
                                const totalDays = new Date(year, month + 1, 0).getDate();

                                const dayButtons = [];
                                for (let i = 0; i < startWeekDay; i++) {
                                  dayButtons.push(<div key={`pad-${i}`} className="h-6" />);
                                }

                                const selectedDateStr = getSplitDateTime(formData.startDate).date;
                                for (let i = 1; i <= totalDays; i++) {
                                  const currentDayObj = new Date(year, month, i);
                                  const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                                  const isSelected = selectedDateStr === currentDayStr;
                                  const isToday = currentDayObj.toDateString() === new Date().toDateString();
                                  const blocked = isDateBlocked(currentDayObj);

                                  dayButtons.push(
                                    <button
                                      type="button"
                                      key={`day-${i}`}
                                      disabled={!!blocked}
                                      title={blocked ? `BLOCKED BY ADMIN: ${blocked.reason}` : undefined}
                                      onClick={(e) => {
                                        if (blocked) return;
                                        e.stopPropagation();
                                        handleSelectCalendarDate('startDate', currentDayObj);
                                        setActivePopover(null);
                                      }}
                                      className={`h-6 w-full flex items-center justify-center transition-all rounded-none border-2 ${blocked
                                          ? 'bg-red-100 border-red-300 text-red-700 font-bold opacity-80 cursor-not-allowed'
                                          : isSelected
                                            ? 'bg-[#171e19] border-[#171e19] text-[#ffe17c] font-black'
                                            : isToday
                                              ? 'border-[#ffe17c] bg-[#ffe17c]/20 text-[#171e19]'
                                              : 'border-transparent hover:border-[#171e19] text-[#171e19]'
                                        }`}
                                    >
                                      {i}
                                    </button>
                                  );
                                }
                                return dayButtons;
                              })()}
                            </div>
                          </div>
                        )}
                        {errors.startDate && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.startDate}</p>}
                      </div>

                      {/* 2. START TIME */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Start Time *</label>
                        <select
                          value={getSplitDateTime(formData.startDate).time || '09:00'}
                          onChange={(e) => handleSplitDateTimeChange('startDate', 'time', e.target.value)}
                          className="w-full bg-white border-2 border-[#171e19] px-3 py-2.5 text-xs font-bold text-[#171e19] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal font-satoshi uppercase"
                        >
                          {timeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. END DATE */}
                      <div className="flex flex-col gap-1.5 relative">
                        <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">End Date *</label>
                        <button
                          type="button"
                          onClick={() => {
                            const dateObj = formData.endDate ? new Date(formData.endDate) : new Date();
                            if (!isNaN(dateObj.getTime())) setEndCalMonth(dateObj);
                            setActivePopover(prev => prev === 'endDate' ? null : 'endDate');
                          }}
                          className="w-full bg-white border-2 border-[#171e19] px-3 py-2.5 text-xs font-bold text-[#171e19] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal flex items-center justify-between font-satoshi uppercase"
                        >
                          <span>
                            {formData.endDate ? format(new Date(formData.endDate), 'MMM dd, yyyy') : 'SELECT END DATE'}
                          </span>
                          <IconCalendar className="w-4 h-4 text-[#171e19] shrink-0" />
                        </button>

                        {/* Calendar Popover for End Date */}
                        {activePopover === 'endDate' && (
                          <div className="absolute z-50 top-full mt-2 left-0 w-64 bg-white border-2 border-[#171e19] shadow-[4px_4px_0px_0px_#171e19] p-3 animate-fade-in">
                            <div className="flex items-center justify-between border-b-2 border-[#171e19] pb-2 mb-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEndCalMonth(new Date(endCalMonth.getFullYear(), endCalMonth.getMonth() - 1, 1));
                                }}
                                className="w-6 h-6 border-2 border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-xs rounded-none transition-brutal"
                              >
                                &larr;
                              </button>
                              <span className="font-anton text-xs uppercase tracking-wider text-[#171e19]">
                                {format(endCalMonth, 'MMMM yyyy')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEndCalMonth(new Date(endCalMonth.getFullYear(), endCalMonth.getMonth() + 1, 1));
                                }}
                                className="w-6 h-6 border-2 border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-xs rounded-none transition-brutal"
                              >
                                &rarr;
                              </button>
                            </div>

                            <div className="grid grid-cols-7 text-center font-bold text-[9px] uppercase tracking-wider text-[#b7c6c2] mb-1.5">
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => <div key={idx}>{w}</div>)}
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center font-satoshi text-xs font-bold">
                              {(() => {
                                const year = endCalMonth.getFullYear();
                                const month = endCalMonth.getMonth();
                                const firstDay = new Date(year, month, 1);
                                const startWeekDay = firstDay.getDay();
                                const totalDays = new Date(year, month + 1, 0).getDate();

                                const dayButtons = [];
                                for (let i = 0; i < startWeekDay; i++) {
                                  dayButtons.push(<div key={`pad-${i}`} className="h-6" />);
                                }

                                const selectedDateStr = getSplitDateTime(formData.endDate).date;
                                for (let i = 1; i <= totalDays; i++) {
                                  const currentDayObj = new Date(year, month, i);
                                  const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                                  const isSelected = selectedDateStr === currentDayStr;
                                  const isToday = currentDayObj.toDateString() === new Date().toDateString();
                                  const blocked = isDateBlocked(currentDayObj);

                                  dayButtons.push(
                                    <button
                                      type="button"
                                      key={`day-${i}`}
                                      disabled={!!blocked}
                                      title={blocked ? `BLOCKED BY ADMIN: ${blocked.reason}` : undefined}
                                      onClick={(e) => {
                                        if (blocked) return;
                                        e.stopPropagation();
                                        handleSelectCalendarDate('endDate', currentDayObj);
                                        setActivePopover(null);
                                      }}
                                      className={`h-6 w-full flex items-center justify-center transition-all rounded-none border-2 ${blocked
                                          ? 'bg-red-100 border-red-300 text-red-700 font-bold opacity-80 cursor-not-allowed'
                                          : isSelected
                                            ? 'bg-[#171e19] border-[#171e19] text-[#ffe17c] font-black'
                                            : isToday
                                              ? 'border-[#ffe17c] bg-[#ffe17c]/20 text-[#171e19]'
                                              : 'border-transparent hover:border-[#171e19] text-[#171e19]'
                                        }`}
                                    >
                                      {i}
                                    </button>
                                  );
                                }
                                return dayButtons;
                              })()}
                            </div>
                          </div>
                        )}
                        {errors.endDate && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.endDate}</p>}
                      </div>

                      {/* 4. END TIME */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">End Time *</label>
                        <select
                          value={getSplitDateTime(formData.endDate).time || '17:00'}
                          onChange={(e) => handleSplitDateTimeChange('endDate', 'time', e.target.value)}
                          className={`w-full bg-white border-2 px-3 py-2.5 text-xs font-bold text-[#171e19] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal font-satoshi uppercase ${getEventDuration()?.isInvalid ? 'border-red-500 bg-red-50/30' : 'border-[#171e19]'
                            }`}
                        >
                          {timeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {/* Inline error for End < Start */}
                        {getEventDuration()?.isInvalid && (
                          <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide mt-1">
                            End date/time must be after start date/time.
                          </p>
                        )}
                      </div>

                    </div>

                    {/* Computed Duration Summary Line */}
                    {(() => {
                      const dur = getEventDuration();
                      if (!dur || dur.isInvalid) return null;
                      return (
                        <div className="mt-4 pt-3 border-t border-[#171e19]/15 flex items-center gap-2 font-satoshi text-xs font-bold text-[#171e19]">
                          <span className="w-2.5 h-2.5 bg-[#ffe17c] border border-[#171e19] shrink-0" />
                          <span className="uppercase tracking-wide">Calculated Duration: {dur.text}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* SECTION 3: Required Attachments */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">REQUIRED DOCUMENTS</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {/* Single Comprehensive Description/Proposal PDF */}
                    <DragDropUpload
                      id="eventDescription"
                      label={`Event Description & Proposal Summary PDF ${editingEventId ? '(Optional)' : '*'}`}
                      helperText="Please upload a single PDF file that details what the event exactly is, the timeline, schedule, flow, expected outcomes, benefits, key takeaways, and other important aspects of the event."
                      accept="application/pdf"
                      file={files.eventDescription}
                      onChange={(file) => setFiles(prev => ({ ...prev, eventDescription: file }))}
                      error={errors.eventDescription}
                      cachedUrl={existingUrls.eventDescriptionUrl}
                    />
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t-2 border-[#171e19]">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-6 py-3 bg-white border-2 border-[#171e19] hover:bg-[#ffe17c]/10 text-[#171e19] font-satoshi font-bold text-xs uppercase tracking-wider transition-brutal rounded-none"
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] font-anton text-lg uppercase tracking-widest transition-brutal border-2 border-[#171e19] rounded-none disabled:bg-[#171e19]/60 disabled:text-slate-400"
                  >
                    {submitting ? 'UPLOADING...' : (editingEventId ? 'RESUBMIT PROPOSAL' : 'SUBMIT PROPOSAL')}
                  </button>
                </div>
              </form>
            </div>
          )
        )}

        {/* TAB: MY EVENTS LIST */}
        {activeTab === 'my-events' && (
          <div className="space-y-6">
            <h2 className="font-anton text-3xl text-[#171e19] tracking-tight">SUBMITTED PROPOSALS</h2>

            {loadingEvents ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white border-2 border-[#171e19] p-5 space-y-3 rounded-none animate-pulse">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2 flex-grow">
                        <div className="h-6 bg-[#b7c6c2]/30 w-3/4 rounded-none" />
                        <div className="flex gap-4 mt-2">
                          <div className="h-4 bg-[#b7c6c2]/20 w-1/3 rounded-none" />
                          <div className="h-4 bg-[#b7c6c2]/20 w-1/4 rounded-none" />
                        </div>
                      </div>
                      <div className="h-8 bg-[#b7c6c2]/30 w-24 rounded-none shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white border-2 border-[#171e19] p-12 text-center space-y-4 rounded-none shadow-[4px_4px_0px_0px_#171e19]">
                <p className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#b7c6c2]">No events yet.</p>
                <button
                  onClick={() => setActiveTab('new-request')}
                  className="px-6 py-3 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-wide transition-brutal rounded-none"
                >
                  Propose Your First Event
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => {
                  const isExpanded = expandedEventId === event.eventId;
                  const statusInfo = getStatusDetails(event);

                  return (
                    <div
                      key={event.eventId}
                      onClick={() => expandedEventId === event.eventId ? setExpandedEventId(null) : setExpandedEventId(event.eventId)}
                      className={`border-2 transition-brutal cursor-pointer rounded-none overflow-hidden ${(event.status === 'revision_needed' || event.status === 'permissions_revision_needed')
                          ? isExpanded
                            ? 'bg-red-50 border-red-500 shadow-[4px_4px_0px_0px_#ef4444]'
                            : 'bg-red-50 border-red-500 hover:shadow-[4px_4px_0px_0px_#ef4444]'
                          : event.status === 'rejected'
                            ? isExpanded
                              ? 'bg-white border-red-800 shadow-[4px_4px_0px_0px_#991b1b]'
                              : 'bg-white border-red-800 hover:shadow-[4px_4px_0px_0px_#991b1b]'
                            : isExpanded
                              ? 'bg-white border-[#171e19] shadow-[4px_4px_0px_0px_#ffe17c]'
                              : 'bg-white border-[#171e19] hover:shadow-[4px_4px_0px_0px_#171e19]'
                        }`}
                    >
                      {/* ===== REVISION / REJECTION ALERT BANNER ===== */}
                      {(event.status === 'revision_needed' || event.status === 'permissions_revision_needed' || event.status === 'rejected') && (
                        <div className={`flex flex-col gap-3 px-5 py-3 border-b-2 ${event.status === 'rejected'
                            ? 'bg-red-800 border-red-900'
                            : 'bg-red-500 border-red-600'
                          }`} onClick={e => e.stopPropagation()}>
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <span className="font-anton text-white text-sm uppercase tracking-wider block">
                                {event.status === 'rejected'
                                  ? 'PROPOSAL REJECTED'
                                  : event.status === 'permissions_revision_needed'
                                    ? 'ACTION REQUIRED — PERMISSION DOCUMENTS NEED CHANGES'
                                    : 'ACTION REQUIRED — PROPOSAL REVISION REQUESTED'}
                              </span>
                              {event.reviewNotes && (
                                <p className="font-satoshi text-white/90 text-xs font-semibold mt-1 leading-relaxed">
                                  Latest note: &ldquo;{event.reviewNotes}&rdquo;
                                </p>
                              )}
                            </div>
                            {(event.status === 'revision_needed') && (
                              <button
                                onClick={(e) => handleEditClick(event, e)}
                                className="shrink-0 px-3 py-1.5 bg-white text-red-600 border-2 border-white hover:bg-red-50 font-anton text-[10px] uppercase tracking-wider transition-brutal rounded-none"
                              >
                                Edit &amp; Resubmit
                              </button>
                            )}
                          </div>
                          {renderReviewHistory(event)}
                        </div>
                      )}
                      {/* Stage 3 — Report Due Banner (always visible when approved) */}
                      {(event.status === 'approved' || event.status === 'report_pending') && event.reportDueDate && (() => {
                        const due = event.reportDueDate.toDate ? event.reportDueDate.toDate() : new Date(event.reportDueDate);
                        const diffDays = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
                        const isOverdue = diffDays < 0;
                        const isUrgent = !isOverdue && diffDays <= 3;
                        return (
                          <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#171e19] flex-wrap ${isOverdue ? 'bg-red-600' : isUrgent ? 'bg-amber-400' : 'bg-emerald-800'
                            }`} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3">
                              <span className="text-white text-lg leading-none shrink-0">
                                {isOverdue ? '🚨' : isUrgent ? '⚠️' : '📋'}
                              </span>
                              <div>
                                <span className={`font-anton text-sm uppercase tracking-wider block ${isOverdue || isUrgent ? 'text-white' : 'text-emerald-100'
                                  }`}>
                                  STAGE 3 — POST-EVENT REPORT {isOverdue ? 'OVERDUE' : 'DUE'}
                                </span>
                                <span className={`font-satoshi text-xs font-semibold block mt-0.5 ${isOverdue || isUrgent ? 'text-white/90' : 'text-emerald-200'
                                  }`}>
                                  Submit your post-event report by {due.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`font-mono text-sm font-bold px-3 py-1 border uppercase ${isOverdue
                                  ? 'bg-red-900 border-red-950 text-red-100'
                                  : isUrgent
                                    ? 'bg-amber-600 border-amber-700 text-white'
                                    : 'bg-emerald-900 border-emerald-700 text-emerald-100'
                                }`}>
                                {isOverdue ? `${Math.abs(diffDays)}d overdue` : diffDays === 0 ? 'Due Today!' : `${diffDays}d left`}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportingEvent(event);
                                  setReportPdf(null);
                                  setReportImages([]);
                                  setActiveTab('report');
                                }}
                                className="px-4 py-2 bg-white border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider hover:bg-[#ffe17c] transition-brutal rounded-none"
                              >
                                Submit Report
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Summary Header */}
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-anton text-xl text-[#171e19] tracking-tight">
                              {event.jointWith
                                ? `${(event.eventName || '').toUpperCase()} (${(council?.name || '').toUpperCase()} x ${(event.jointWith || '').toUpperCase()})`
                                : (event.eventName || '').toUpperCase()}
                            </h3>

                            {/* Signature Element Event ID */}
                            <span className="font-satoshi text-[10px] font-bold tracking-widest border border-[#171e19] px-2 py-0.5 bg-white text-[#171e19] shrink-0">
                              {event.eventId}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-x-5 gap-y-1 font-satoshi text-xs text-[#b7c6c2] font-semibold uppercase tracking-wider">
                            <span className="flex items-center gap-1.5"><IconCalendar className="w-3 h-3" /> START: {formatEventDate(event.startDate)}</span>
                            {event.venue && <span className="flex items-center gap-1.5"><IconMapPin className="w-3 h-3" /> VENUE: {String(event.venue).toUpperCase()}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Stage Indicator Badge */}
                          {(() => {
                            const stage = getEventStage(event.status);
                            return (
                              <span className={`px-2 py-0.5 font-satoshi text-[9px] font-bold uppercase tracking-widest border border-[#171e19]/25 rounded-none ${stage.colorClass}`}>
                                {stage.label}
                              </span>
                            );
                          })()}
                          {/* Color Badge Pill */}
                          <span className={statusInfo.colorClass}>
                            {statusInfo.label}
                          </span>
                          {/* Show Upload Permissions only (report submit button moved to Stage 3 banner above) */}
                          {(event.status === 'proposal_approved' || event.status === 'permissions_revision_needed') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPermissionsUploadEvent(event);
                                setPermissionsFiles({ doswLetter: null, councilLetter: null, venueLetter: null });
                                setPermissionsErrors({});
                              }}
                              className="px-4 py-2 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                            >
                              Upload Permissions
                            </button>
                          )}

                          {/* Delete Proposal Button - Only allowed before Stage 1 approval */}
                          {['submitted', 'revision_needed', 'rejected'].includes(event.status) && (
                            <button
                              onClick={(e) => handleDeleteProposal(event, e)}
                              title="Delete Proposal"
                              className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition-colors rounded-none shrink-0"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <div className="px-5 pb-6 pt-4 border-t-2 border-[#171e19] bg-[#b7c6c2]/5 space-y-5 text-xs text-[#171e19]/90 font-satoshi">
                          {/* Event Progress Tracker */}
                          {renderStageTracker(event.status)}

                          {/* Dual Approval Status Badges */}
                          {renderDualApprovalBadges(event)}

                          {/* Review History Notes */}
                          {renderReviewHistory(event)}

                          {/* Report due date banner in expanded drawer — still shown for context */}
                          {(event.status === 'approved' || event.status === 'report_pending') && event.reportDueDate && (
                            <div className="bg-amber-50 border border-amber-300 p-4 text-amber-800 flex items-center justify-between gap-3 flex-wrap font-medium">
                              <div>
                                <span className="font-bold text-xs uppercase tracking-wider text-amber-600 block mb-1">Report Submission Deadline</span>
                                <span className="text-sm uppercase">Submit your post-event report by {formatEventDate(event.reportDueDate)}.</span>
                              </div>
                              <span className="font-mono text-sm font-bold bg-amber-200 border border-amber-400 px-3 py-1 uppercase shrink-0">
                                {(() => {
                                  const due = event.reportDueDate.toDate ? event.reportDueDate.toDate() : new Date(event.reportDueDate);
                                  const diffDays = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
                                  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
                                  if (diffDays === 0) return 'Due Today!';
                                  return `${diffDays} days remaining`;
                                })()}
                              </span>
                            </div>
                          )}

                          {/* Logistical Grid — only rendered when legacy metadata exists */}
                          {(event.facultyCoordinatorName || event.venue || event.expectedFootfall) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-[#171e19]/10 p-4 rounded-none">
                              {event.venue && (
                                <div>
                                  <span className="font-bold text-[#b7c6c2] uppercase block text-xs tracking-wide mb-1">Venue</span>
                                  <span className="font-bold text-sm">{String(event.venue).toUpperCase()}</span>
                                </div>
                              )}
                              {event.facultyCoordinatorName && (
                                <div>
                                  <span className="font-bold text-[#b7c6c2] uppercase block text-xs tracking-wide mb-1">Faculty Coordinator</span>
                                  <span className="font-bold text-sm">{String(event.facultyCoordinatorName).toUpperCase()}</span>
                                </div>
                              )}
                              {event.studentContactName && (
                                <div>
                                  <span className="font-bold text-[#b7c6c2] uppercase block text-xs tracking-wide mb-1">Student Lead</span>
                                  <span className="font-bold text-sm">{String(event.studentContactName).toUpperCase()}</span>
                                </div>
                              )}
                              {event.studentContactPhone && (
                                <div>
                                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] tracking-wide mb-1">Student Contact</span>
                                  <span className="font-semibold">{event.studentContactPhone}</span>
                                </div>
                              )}
                              {event.expectedFootfall && (
                                <div>
                                  <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] tracking-wide mb-1">Expected Footfall</span>
                                  <span className="font-bold">{event.expectedFootfall} ATTENDEES</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Documents grid */}
                          <div className="space-y-3">
                            <span className="font-bold text-[#b7c6c2] uppercase tracking-wider block text-xs">Clearance Documents</span>
                            <div className="flex flex-wrap gap-3 font-bold text-sm uppercase">
                              {event.eventDescriptionUrl && (
                                <a href={event.eventDescriptionUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4 shrink-0" /> PROPOSAL DOCUMENT
                                </a>
                              )}
                              {event.eventOutcomeUrl && (
                                <a href={event.eventOutcomeUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4 shrink-0" /> EVENT OUTCOME
                                </a>
                              )}
                              {event.doswPermissionLetterUrl && (
                                <a href={event.doswPermissionLetterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4" /> DOSW & PRINCIPAL CLEARANCE PDF
                                </a>
                              )}
                              {event.customPermissionLetters && event.customPermissionLetters.map((docItem, idx) => (
                                <a key={idx} href={docItem.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4" /> {String(docItem.title || `ADDITIONAL LETTER ${idx + 1}`).toUpperCase()} PDF
                                </a>
                              ))}
                              {event.otherDocumentUrl && (
                                <a href={event.otherDocumentUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4" /> OTHER RELEVANT DOCUMENT PDF
                                </a>
                              )}
                              {event.attendanceWaiverUrl && (
                                <a href={event.attendanceWaiverUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4" /> WAIVER ATTENDANCE PDF
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Toggle specifics details */}
                          {(event.prizeMoneyApplicable || event.registrationFeeApplicable || event.guestApplicable || event.externalParticipantsApplicable || event.resourcesNeeded) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-semibold uppercase text-sm tracking-wider text-[#171e19]">
                              {/* Left parameters */}
                              <div className="space-y-2">
                                {event.prizeMoneyApplicable && event.prizeMoneyAmount && (
                                  <p><span className="inline-flex items-center gap-1"><IconMoney className="w-4 h-4" /> <span className="text-[#b7c6c2]">Prize Pool:</span></span> ${event.prizeMoneyAmount} funded via {event.prizeMoneySource ? <em>{String(event.prizeMoneySource).toUpperCase()}</em> : ''}</p>
                                )}
                                {event.registrationFeeApplicable && event.registrationFeeAmount !== undefined && (
                                  <p><span className="inline-flex items-center gap-1"><IconTicket className="w-3 h-3" /> <span className="text-[#b7c6c2]">Registration Fee:</span></span> ${event.registrationFeeAmount} per participant</p>
                                )}
                                {event.guestApplicable && event.guestName && (
                                  <p><span className="inline-flex items-center gap-1"><IconUser className="w-3 h-3" /> <span className="text-[#b7c6c2]">Chief Guest:</span></span> {String(event.guestName).toUpperCase()} {event.guestDesignation ? `(${String(event.guestDesignation).toUpperCase()})` : ''}</p>
                                )}
                              </div>

                              {/* Right parameters */}
                              <div className="space-y-1">
                                {event.externalParticipantsApplicable && event.externalParticipantsExpected !== undefined && (
                                  <p><span className="inline-flex items-center gap-1"><IconGlobe className="w-3 h-3" /> <span className="text-[#b7c6c2]">Externals Expected:</span></span> {event.externalParticipantsExpected} students</p>
                                )}
                                {event.resourcesNeeded && (
                                  <p><span className="inline-flex items-center gap-1"><IconTool className="w-3 h-3" /> <span className="text-[#b7c6c2]">Resources:</span></span> "{String(event.resourcesNeeded).toUpperCase()}"</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Safety arrangements */}
                          {event.safetyArrangementNeeded && event.safetyArrangementDetails && (
                            <div className="space-y-1 border-t border-[#171e19]/10 pt-3">
                              <span className="font-bold text-red-500 uppercase block text-[9px] tracking-wide mb-1">Safety & Crowd Control Plan</span>
                              <p className="italic text-[#171e19]/80 leading-relaxed">"{String(event.safetyArrangementDetails).toUpperCase()}"</p>
                            </div>
                          )}

                          {/* Review Notes — shown in expanded details as secondary reference */}
                          {event.reviewNotes && (event.status === 'rejected' || event.status === 'revision_needed' || event.status === 'permissions_revision_needed') && (
                            <div className={`rounded-none border-l-4 p-4 flex gap-3 items-start ${event.status === 'rejected'
                                ? 'border-l-red-800 bg-red-900/10'
                                : 'border-l-red-500 bg-red-500/10'
                              }`}>
                              <span className="text-red-500 text-base mt-0.5 shrink-0">{event.status === 'rejected' ? '✕' : '⚠'}</span>
                              <div>
                                <span className="font-bold text-red-600 uppercase tracking-widest block text-[9px] mb-1">
                                  {event.status === 'rejected' ? 'Rejection Reason' : 'Admin Revision Notes'}
                                </span>
                                <p className="font-satoshi text-[#171e19] text-xs font-semibold leading-relaxed italic">&ldquo;{event.reviewNotes}&rdquo;</p>
                              </div>
                            </div>
                          )}

                          {/* Closed details */}
                          {event.status === 'closed' && event.reportPdfUrl && (
                            <div className="space-y-2 border-t border-[#171e19]/10 pt-3 bg-[#ffe17c]/5 p-3">
                              <span className="font-bold text-[#171e19] uppercase text-[9px] tracking-wide block">Archived Event Wrap-up Summary</span>
                              <div className="flex flex-wrap gap-4 items-center uppercase font-bold text-xs">
                                <a href={event.reportPdfUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-[#171e19] hover:underline">
                                  <IconDownload className="w-3.5 h-3.5" /> Download final PDF Report
                                </a>
                                {event.reportImageUrls && event.reportImageUrls.length > 0 && (
                                  <span className="flex items-center gap-1 text-[10px] text-[#b7c6c2]"><IconPhoto className="w-3 h-3" /> Images Uploaded: {event.reportImageUrls.length}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bottom Right Action Bar inside Drawer for Stage 2 Upload Permissions */}
                          {(event.status === 'proposal_approved' || event.status === 'permissions_revision_needed') && (
                            <div className="flex justify-end pt-4 border-t-2 border-[#171e19]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPermissionsUploadEvent(event);
                                  setPermissionsFiles({ doswLetter: null });
                                  setCustomPermissionDocs([]);
                                  setPermissionsErrors({});
                                }}
                                className="px-5 py-2.5 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider hover:shadow-[3px_3px_0px_0px_#171e19] transition-all rounded-none"
                              >
                                Upload Permissions
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: COUNCIL MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#171e19] pb-4">
              <div>
                <h2 className="font-anton text-3xl text-[#171e19] tracking-tight uppercase">COUNCIL MEMBERS & EXECUTIVES</h2>
                <p className="font-satoshi text-xs text-[#171e19]/60 font-semibold uppercase tracking-wider mt-0.5">
                  Manage core team members, designations, and contact numbers for official communication.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddMemberModal}
                className="px-5 py-3 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-sm uppercase tracking-widest hover:shadow-[4px_4px_0px_0px_#171e19] transition-all rounded-none self-start sm:self-center"
              >
                + Add New Member
              </button>
            </div>

            {councilMembers.length === 0 ? (
              <div className="bg-white border-2 border-[#171e19] p-12 text-center rounded-none shadow-[4px_4px_0px_0px_#ffe17c] space-y-4">
                <div className="w-16 h-16 bg-[#ffe17c]/30 border-2 border-[#171e19] rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                  👥
                </div>
                <div>
                  <h3 className="font-anton text-xl text-[#171e19] uppercase tracking-wide">NO COUNCIL MEMBERS ADDED YET</h3>
                  <p className="font-satoshi text-xs text-[#171e19]/60 font-semibold uppercase tracking-wider mt-1">
                    Add your president, general secretary, leads, and event coordinators to build your roster.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddMemberModal}
                  className="px-5 py-2.5 bg-[#171e19] text-white hover:bg-[#ffe17c] hover:text-[#171e19] font-anton text-xs uppercase tracking-widest border-2 border-[#171e19] transition-all rounded-none inline-block mt-2"
                >
                  + Add First Member
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pl-4">
                  <SortableContext
                    items={councilMembers.map(m => m.id)}
                    strategy={rectSortingStrategy}
                  >
                    {councilMembers.map((member) => (
                      <SortableMemberCard
                        key={member.id}
                        member={member}
                        openEditMemberModal={openEditMemberModal}
                        handleDeleteMember={handleDeleteMember}
                        IconUser={IconUser}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            )}
          </div>
        )}

        {/* TAB: COUNCIL CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#171e19] pb-4">
              <div>
                <h2 className="font-anton text-3xl text-[#171e19] tracking-tight uppercase">Event Calendar</h2>
                <p className="font-satoshi text-xs text-[#171e19]/60 font-semibold uppercase tracking-wider mt-0.5">
                  All councils' approved & pending events. Use this to pick available dates for your next proposal.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                  className="px-3 py-1.5 border-2 border-[#171e19] hover:bg-[#ffe17c]/10 text-xs font-bold uppercase transition-brutal rounded-none"
                >
                  &larr; Prev
                </button>
                <span className="font-anton text-xl text-[#171e19] select-none tracking-wide">
                  {format(calMonth, 'MMMM yyyy').toUpperCase()}
                </span>
                <button
                  onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                  className="px-3 py-1.5 border-2 border-[#171e19] hover:bg-[#ffe17c]/10 text-xs font-bold uppercase transition-brutal rounded-none"
                >
                  Next &rarr;
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 items-center font-satoshi text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-600"></span> Approved</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#ffe17c] border border-[#171e19]/25"></span> Pending / Under Review</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#b7c6c2] border border-[#171e19]/20"></span> Your Council's Event</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-200 border border-red-400"></span> Blocked by Admin</div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="min-w-[650px] bg-white border-2 border-[#171e19] overflow-hidden shadow-[4px_4px_0px_0px_#ffe17c]">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 bg-[#171e19] font-satoshi text-[10px] font-bold uppercase tracking-wider text-white text-center py-2.5">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 border-t border-l border-[#171e19]">

                {(() => {
                  const year = calMonth.getFullYear();
                  const month = calMonth.getMonth();
                  const firstDayIdx = new Date(year, month, 1).getDay();
                  const totalDays = new Date(year, month + 1, 0).getDate();
                  const days = [];
                  for (let i = 0; i < firstDayIdx; i++) days.push(null);
                  for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));

                  return days.map((day, idx) => {
                    const isToday = day && day.toDateString() === new Date().toDateString();

                    // Check if admin-blocked
                    const blockedInfo = day ? blockedDates.find(bd => {
                      const bdStart = bd.startDate?.toDate ? bd.startDate.toDate() : new Date(bd.startDate);
                      const bdEnd = bd.endDate?.toDate ? bd.endDate.toDate() : new Date(bd.endDate);
                      const dStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
                      const dEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
                      return bdStart <= dEnd && bdEnd >= dStart;
                    }) : null;

                    // All events (all councils) occurring on this day — include all statuses from Stage 1
                    const dayEvents = day ? allCalEvents.filter(event => {
                      const relevantStatuses = ['submitted', 'revision_needed', 'proposal_approved', 'permissions_submitted', 'permissions_revision_needed', 'approved', 'report_pending', 'closed'];
                      if (!relevantStatuses.includes(event.status)) return false;
                      const eStart = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                      const eEnd = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
                      const dStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
                      const dEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
                      return eStart <= dEnd && eEnd >= dStart;
                    }) : [];

                    return (
                      <div
                        key={idx}
                        className={`min-h-[100px] p-1.5 border-r border-b border-[#171e19] flex flex-col font-satoshi relative ${!day ? 'bg-slate-50/70' : blockedInfo ? 'bg-red-50' : 'bg-white'
                          } ${isToday ? 'ring-2 ring-inset ring-[#ffe17c]' : ''}`}
                      >
                        {day && (
                          <>
                            {/* Blocked diagonal stripes */}
                            {blockedInfo && (
                              <div
                                className="absolute inset-0 pointer-events-none opacity-15"
                                style={{
                                  backgroundImage: 'repeating-linear-gradient(45deg, #ef4444 0, #ef4444 2px, transparent 0, transparent 50%)',
                                  backgroundSize: '10px 10px'
                                }}
                              />
                            )}

                            <span className={`text-[11px] font-bold z-10 relative shrink-0 mb-1 ${isToday
                                ? 'text-[#171e19] bg-[#ffe17c] px-1.5 py-0.5 font-anton tracking-wide self-start'
                                : blockedInfo
                                  ? 'text-red-700'
                                  : 'text-[#171e19]'
                              }`}>
                              {day.getDate()}
                            </span>

                            {blockedInfo && (
                              <div className="z-10 relative mt-1 mb-1">
                                <div
                                  className="text-[9px] font-bold uppercase tracking-tight text-red-900 bg-red-100 border border-red-400 p-1 leading-tight flex items-start gap-1 rounded-none shadow-xs whitespace-normal break-words"
                                  title={blockedInfo.reason}
                                >
                                  <IconBan className="w-3 h-3 shrink-0 text-red-600 mt-0.5" />
                                  <span className="break-words font-extrabold">{blockedInfo.reason}</span>
                                </div>
                              </div>
                            )}

                            <div className="space-y-0.5 flex-grow overflow-y-auto z-10 relative">
                              {dayEvents.map(event => {
                                const isOwnCouncil = event.councilId === council?.id;
                                const isApproved = ['approved', 'report_pending', 'closed'].includes(event.status);
                                const isStage2 = ['proposal_approved', 'permissions_submitted', 'permissions_revision_needed'].includes(event.status);

                                let chipClass = 'bg-[#ffe17c] text-[#171e19]'; // pending
                                if (isApproved) chipClass = 'bg-emerald-600 text-white';
                                else if (isStage2) chipClass = 'bg-indigo-700 text-white';
                                if (isOwnCouncil) chipClass += ' ring-1 ring-offset-0 ring-[#171e19]';

                                return (
                                  <button
                                    key={event.id || event.eventId}
                                    onClick={() => handleOpenCalEventModal(event)}
                                    className={`w-full text-left px-1.5 py-1 text-[9px] font-bold uppercase tracking-tight break-words whitespace-normal leading-tight rounded-none border border-[#171e19]/20 transition-all ${chipClass}`}
                                    title={`${event.councilName}: ${event.eventName} (${event.status.replace(/_/g, ' ')})`}
                                  >
                                    {isOwnCouncil ? '★ ' : ''}{event.councilName?.split(' ')[0]}: {event.eventName}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  });
                })()}

              </div>
            </div>
          </div>



            {/* Stats Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border-2 border-[#171e19] p-4 rounded-none shadow-[3px_3px_0px_0px_#171e19]">
                <p className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Total Events This Month</p>
                <p className="font-anton text-3xl text-[#171e19] mt-1">
                  {allCalEvents.filter(ev => {
                    const eStart = ev.startDate?.toDate ? ev.startDate.toDate() : new Date(ev.startDate);
                    return eStart.getMonth() === calMonth.getMonth() && eStart.getFullYear() === calMonth.getFullYear();
                  }).length}
                </p>
              </div>
              <div className="bg-white border-2 border-[#171e19] p-4 rounded-none shadow-[3px_3px_0px_0px_#ffe17c]">
                <p className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Your Council's Events</p>
                <p className="font-anton text-3xl text-[#171e19] mt-1">
                  {events.length}
                </p>
              </div>
              <div className="bg-white border-2 border-[#171e19] p-4 rounded-none shadow-[3px_3px_0px_0px_#171e19]">
                <p className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Blocked Periods</p>
                <p className="font-anton text-3xl text-red-600 mt-1">{blockedDates.length}</p>
              </div>
              <div className="bg-white border-2 border-[#171e19] p-4 rounded-none shadow-[3px_3px_0px_0px_#171e19]">
                <p className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/60">Pending Proposals (All)</p>
                <p className="font-anton text-3xl text-[#171e19] mt-1">
                  {allCalEvents.filter(ev => ev.status === 'submitted').length}
                </p>
              </div>
            </div>

            {/* Blocked Dates Info Panel */}
            {blockedDates.length > 0 && (
              <div className="bg-red-50 border-2 border-red-400 p-5 space-y-3 rounded-none">
                <h3 className="font-anton text-lg text-red-800 uppercase tracking-tight flex items-center gap-2"><IconBan className="w-5 h-5" /> Admin-Blocked Periods</h3>
                <p className="font-satoshi text-xs text-red-700 font-semibold uppercase tracking-wide">Avoid proposing events on these dates.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {blockedDates.map(bd => {
                    const start = bd.startDate?.toDate ? bd.startDate.toDate() : new Date(bd.startDate);
                    const end = bd.endDate?.toDate ? bd.endDate.toDate() : new Date(bd.endDate);
                    const isSameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
                    return (
                      <div key={bd.id} className="flex items-start gap-3 p-3 bg-white border border-red-300 rounded-none">
                        <IconBan className="text-red-500 w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-anton text-sm text-[#171e19] tracking-tight">{bd.reason}</p>
                          <p className="font-satoshi text-[10px] text-red-700 font-bold uppercase mt-0.5">
                            {isSameDay
                              ? format(start, 'MMM dd, yyyy')
                              : `${format(start, 'MMM dd')} – ${format(end, 'MMM dd, yyyy')}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: SUBMIT REPORT */}
        {activeTab === 'report' && reportingEvent && (
          <div className="bg-white border-2 border-[#171e19] p-8 space-y-6 rounded-none shadow-[8px_8px_0px_0px_#ffe17c] animate-fade-in max-h-[90vh] overflow-y-auto">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 bg-[#ffe17c] border border-[#171e19]" />
                <span className="font-satoshi text-[10px] font-bold text-[#171e19] uppercase tracking-widest">Report Filing Console</span>
              </div>
              <h2 className="font-anton text-2xl text-[#171e19] tracking-tight">
                ARCHIVE EVENT: {reportingEvent.eventName.toUpperCase()}
              </h2>
              <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold uppercase tracking-wider mt-1">
                Upload the final wrap-up PDF and event photos to close out the event. Both fields are required.
              </p>
            </div>

            {submitting && (
              <div className="bg-[#ffe17c]/20 border-2 border-[#171e19] p-4 rounded-none flex items-center gap-3 animate-pulse">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#171e19] shrink-0" />
                <div className="font-satoshi text-xs font-bold uppercase tracking-wider">
                  <p className="text-[#171e19]">Uploading wrap-up files...</p>
                  <p className="text-[#b7c6c2] mt-0.5">{uploadProgress}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-6">
              <div className="flex flex-col gap-2">
                <DragDropUpload
                  id="reportPdf"
                  label="Upload Final Report PDF *"
                  helperText="This single PDF must cover: actual attendance/turnout figures, expense summaries, any incidents/issues, and notes/learnings from the event."
                  accept="application/pdf"
                  file={reportPdf}
                  onChange={(file) => setReportPdf(file)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <DragDropUpload
                  id="reportImages"
                  label="Attach Event Photos (At least 1 required) *"
                  accept="image/*"
                  multiple={true}
                  filesList={reportImages}
                  onChange={(files) => setReportImages(files)}
                />
              </div>

              <div className="flex justify-end pt-3 gap-3 border-t-2 border-[#171e19]">
                <button
                  type="button"
                  onClick={() => {
                    setReportingEvent(null);
                    setReportPdf(null);
                    setReportImages([]);
                    setActiveTab('my-events');
                  }}
                  className="px-5 py-2.5 rounded-none border-2 border-[#171e19] hover:bg-[#ffe17c]/10 text-sm font-bold uppercase tracking-wider text-[#171e19] transition-brutal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] rounded-none font-anton text-lg uppercase tracking-wider transition-brutal border-2 border-[#171e19]"
                >
                  Submit Report & Close Event
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL OVERLAY: STAGE 2 PERMISSIONS UPLOAD */}
        {permissionsUploadEvent && (
          <div className="fixed inset-0 z-50 bg-[#171e19]/70 backdrop-blur-sm flex justify-center items-center px-4">
            <div className="bg-white border-4 border-[#171e19] rounded-none w-full max-w-lg p-6 space-y-4 shadow-[8px_8px_0px_0px_#ffe17c] animate-fade-in text-[#171e19] max-h-[90vh] overflow-y-auto">
              <div>
                <p className="font-satoshi text-[10px] uppercase font-bold text-[#b7c6c2]">Stage 2: Upload Permission Letters</p>
                <h3 className="font-anton text-2xl text-[#171e19] mt-1 tracking-tight">
                  {permissionsUploadEvent.eventName.toUpperCase()}
                </h3>
                <div className="mt-3 bg-[#ffe17c]/30 border-2 border-[#171e19] p-3 text-[#171e19] shadow-[2px_2px_0px_0px_#171e19]">
                  <p className="font-satoshi text-[10px] font-bold uppercase tracking-wider mb-1">⚠️ IMPORTANT INSTRUCTION</p>
                  <p className="font-satoshi text-xs font-semibold leading-relaxed">
                    Please ensure that you have mentioned the Event ID <span className="font-bold underline bg-white px-1 border border-[#171e19]">{permissionsUploadEvent.eventId}</span> (received in Stage 1) on all physical permission documents before scanning and uploading them.
                  </p>
                </div>
              </div>

              {permissionsSubmitting && (
                <div className="bg-[#ffe17c]/20 border-2 border-[#171e19] p-4 rounded-none flex items-center gap-3 animate-pulse">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#171e19] shrink-0" />
                  <div className="font-satoshi text-xs font-bold uppercase tracking-wider">
                    <p className="text-[#171e19]">Uploading permission files...</p>
                    <p className="text-[#b7c6c2] mt-0.5">{uploadProgress}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handlePermissionsSubmit} className="space-y-4">
                {/* Mandatory DoSW Letter File */}
                <DragDropUpload
                  id="doswLetter"
                  label="DoSW & Principal Clearance (PDF) *"
                  accept="application/pdf"
                  file={permissionsFiles.doswLetter}
                  onChange={(file) => setPermissionsFiles(prev => ({ ...prev, doswLetter: file }))}
                  error={permissionsErrors.doswLetter}
                />

                {/* Optional Custom Permission Letters Section */}
                <div className="space-y-3 pt-3 border-t-2 border-[#171e19]">
                  <div className="flex items-center justify-between">
                    <span className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19]">
                      Additional Permission Letters (Optional)
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomPermissionDocs(prev => [...prev, { id: Date.now() + Math.random(), name: '', file: null }])}
                      className="px-3 py-1 bg-[#ffe17c] border border-[#171e19] text-[#171e19] font-satoshi font-bold text-[10px] uppercase tracking-wider hover:shadow-[2px_2px_0px_0px_#171e19] transition-all rounded-none"
                    >
                      + Add Custom Document
                    </button>
                  </div>

                  {customPermissionDocs.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-[#b7c6c2]/10 border-2 border-[#171e19] space-y-2 relative rounded-none">
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/70">
                          Document #{idx + 1} Title
                        </label>
                        <button
                          type="button"
                          onClick={() => setCustomPermissionDocs(prev => prev.filter(d => d.id !== item.id))}
                          className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 border border-[#171e19] text-[10px] font-bold uppercase transition-colors"
                        >
                          Remove
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="e.g. Police NOC, Lab Clearance, Venue Permission..."
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomPermissionDocs(prev => prev.map(d => d.id === item.id ? { ...d, name: val } : d));
                        }}
                        className="w-full bg-white border border-[#171e19] px-3 py-1.5 text-xs font-bold text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />

                      <DragDropUpload
                        id={`customDoc-${item.id}`}
                        label={`Upload PDF for "${item.name.trim() || 'Custom Document ' + (idx + 1)}"`}
                        accept="application/pdf"
                        file={item.file}
                        onChange={(file) => setCustomPermissionDocs(prev => prev.map(d => d.id === item.id ? { ...d, file } : d))}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#171e19]/10">
                  <button
                    type="button"
                    disabled={permissionsSubmitting}
                    onClick={() => {
                      setPermissionsUploadEvent(null);
                      setPermissionsFiles({ doswLetter: null });
                      setCustomPermissionDocs([]);
                      setPermissionsErrors({});
                    }}
                    className="px-4 py-2 border-2 border-[#171e19] hover:bg-slate-100 font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] rounded-none transition-brutal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={permissionsSubmitting}
                    className="px-5 py-2 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] font-anton text-sm uppercase tracking-widest rounded-none border-2 border-[#171e19] transition-brutal"
                  >
                    Submit Letters
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CALENDAR EVENT DETAIL & EDIT MODAL */}
        {selectedCalEvent && (
          <div className="fixed inset-0 z-50 bg-[#171e19]/70 backdrop-blur-sm flex justify-center items-center px-4">
            <div className="bg-white border-4 border-[#171e19] rounded-none w-full max-w-lg p-6 space-y-4 shadow-[8px_8px_0px_0px_#ffe17c] animate-fade-in text-[#171e19] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="font-satoshi text-[10px] uppercase font-bold text-[#171e19]/60">{selectedCalEvent.councilName} Event Details</p>
                  <h3 className="font-anton text-2xl text-[#171e19] mt-1 tracking-tight">
                    {selectedCalEvent.eventName.toUpperCase()}
                  </h3>
                </div>
                <button
                  onClick={() => { setSelectedCalEvent(null); setIsEditingCalEvent(false); }}
                  className="w-8 h-8 border border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-sm"
                >
                  &times;
                </button>
              </div>

              {!isEditingCalEvent ? (
                <div className="space-y-4 font-satoshi text-xs text-[#171e19]">
                  {/* Poster Preview */}
                  {selectedCalEvent.eventPosterUrl ? (
                    <div className="border border-[#171e19]/25 p-2 bg-[#b7c6c2]/10 flex justify-center">
                      <img src={selectedCalEvent.eventPosterUrl} alt="Event Poster" className="max-h-60 object-contain" />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-[#171e19]/25 p-6 text-center uppercase tracking-wide font-bold text-[#171e19]/50">
                      No Poster Added
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 border-t border-[#171e19]/10 pt-3">
                    <div>
                      <span className="font-bold text-[#171e19]/60 uppercase block text-[9px] mb-0.5">Venue</span>
                      <span className="font-bold">{selectedCalEvent.venue || 'TBD'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-[#171e19]/60 uppercase block text-[9px] mb-0.5">Status</span>
                      <span className="font-bold uppercase">{selectedCalEvent.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <span className="font-bold text-[#171e19]/60 uppercase block text-[9px] mb-0.5">Registration Fee</span>
                      <span className="font-bold">
                        {selectedCalEvent.registrationFeeApplicable && selectedCalEvent.registrationFeeAmount
                          ? `₹${selectedCalEvent.registrationFeeAmount}`
                          : 'FREE'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-[#171e19]/60 uppercase block text-[9px] mb-0.5">Student Coordinator</span>
                      <span className="font-bold block">{selectedCalEvent.studentContactName || 'N/A'}</span>
                      {selectedCalEvent.studentContactPhone && (
                        <span className="text-[10px] block mt-0.5">📞 {selectedCalEvent.studentContactPhone}</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold text-[#171e19]/60 uppercase block text-[9px] mb-0.5">Faculty Coordinator</span>
                      <span className="font-bold block">{selectedCalEvent.facultyCoordinatorName || 'N/A'}</span>
                      {selectedCalEvent.facultyCoordinatorPhone && (
                        <span className="text-[10px] block mt-0.5">📞 {selectedCalEvent.facultyCoordinatorPhone}</span>
                      )}
                    </div>
                  </div>

                  {selectedCalEvent.councilId === council?.id && (
                    <div className="pt-3 border-t border-[#171e19]/10">
                      <button
                        type="button"
                        onClick={() => setIsEditingCalEvent(true)}
                        className="w-full py-2 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] font-anton text-xs uppercase tracking-widest rounded-none border-2 border-[#171e19] transition-brutal"
                      >
                        Edit Poster & Details
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleCalEventSave} className="space-y-4 font-satoshi text-xs text-[#171e19]">
                  {/* Poster upload */}
                  <DragDropUpload
                    id="posterFile"
                    label="Upload Event Poster (Image/PDF)"
                    accept="image/*,application/pdf"
                    file={calEventForm.posterFile}
                    onChange={(file) => setCalEventForm(p => ({ ...p, posterFile: file }))}
                    cachedUrl={selectedCalEvent.eventPosterUrl}
                  />

                  {/* Registration Fee */}
                  <div className="space-y-2 border-t border-[#171e19]/10 pt-3">
                    <label className="flex items-center gap-2 font-bold uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={calEventForm.registrationFeeApplicable}
                        onChange={(e) => setCalEventForm(p => ({ ...p, registrationFeeApplicable: e.target.checked }))}
                        className="w-4 h-4 border-2 border-[#171e19] focus:ring-0 accent-[#171e19]"
                      />
                      Registration Fee Applicable?
                    </label>

                    {calEventForm.registrationFeeApplicable && (
                      <div className="flex flex-col gap-1">
                        <span className="font-bold uppercase text-[9px] text-[#171e19]/60">Fee Amount (INR)</span>
                        <input
                          type="number"
                          required
                          value={calEventForm.registrationFeeAmount}
                          onChange={(e) => setCalEventForm(p => ({ ...p, registrationFeeAmount: e.target.value }))}
                          placeholder="e.g. 100"
                          className="w-full bg-white border border-[#171e19] px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#ffe17c]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Student Coordinator */}
                  <div className="grid grid-cols-2 gap-3 border-t border-[#171e19]/10 pt-3">
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <span className="font-bold uppercase text-[9px] text-[#171e19]/60">Student Coordinator Name</span>
                      <input
                        type="text"
                        value={calEventForm.studentContactName}
                        onChange={(e) => setCalEventForm(p => ({ ...p, studentContactName: e.target.value }))}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full bg-white border border-[#171e19] px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#ffe17c]"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <span className="font-bold uppercase text-[9px] text-[#171e19]/60">Student Phone</span>
                      <input
                        type="tel"
                        value={calEventForm.studentContactPhone}
                        onChange={(e) => setCalEventForm(p => ({ ...p, studentContactPhone: e.target.value }))}
                        placeholder="e.g. +91 9876543210"
                        className="w-full bg-white border border-[#171e19] px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#ffe17c]"
                      />
                    </div>
                  </div>

                  {/* Faculty Coordinator */}
                  <div className="grid grid-cols-2 gap-3 border-t border-[#171e19]/10 pt-3">
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <span className="font-bold uppercase text-[9px] text-[#171e19]/60">Faculty Coordinator Name</span>
                      <input
                        type="text"
                        value={calEventForm.facultyCoordinatorName}
                        onChange={(e) => setCalEventForm(p => ({ ...p, facultyCoordinatorName: e.target.value }))}
                        placeholder="e.g. Prof. Mehta"
                        className="w-full bg-white border border-[#171e19] px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#ffe17c]"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <span className="font-bold uppercase text-[9px] text-[#171e19]/60">Faculty Phone</span>
                      <input
                        type="tel"
                        value={calEventForm.facultyCoordinatorPhone}
                        onChange={(e) => setCalEventForm(p => ({ ...p, facultyCoordinatorPhone: e.target.value }))}
                        placeholder="e.g. +91 9876543210"
                        className="w-full bg-white border border-[#171e19] px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#ffe17c]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[#171e19]/10">
                    <button
                      type="button"
                      disabled={calEventSaving}
                      onClick={() => setIsEditingCalEvent(false)}
                      className="px-4 py-2 border-2 border-[#171e19] hover:bg-slate-100 font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] rounded-none transition-brutal"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={calEventSaving}
                      className="px-5 py-2 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] font-anton text-xs uppercase tracking-widest rounded-none border-2 border-[#171e19] transition-brutal disabled:opacity-50"
                    >
                      {calEventSaving ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ADD / EDIT MEMBER MODAL */}
        {memberModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#171e19]/70 backdrop-blur-sm flex justify-center items-center px-4">
            <div className="bg-white border-4 border-[#171e19] rounded-none w-full max-w-md p-6 space-y-5 shadow-[8px_8px_0px_0px_#ffe17c] animate-fade-in text-[#171e19] max-h-[90vh] overflow-y-auto">
              <div>
                <p className="font-satoshi text-[10px] uppercase font-bold text-[#b7c6c2]">Council Member Management</p>
                <h3 className="font-anton text-2xl text-[#171e19] mt-1 tracking-tight">
                  {editingMember ? 'EDIT MEMBER' : 'ADD NEW MEMBER'}
                </h3>
              </div>

              <form onSubmit={handleMemberSubmit} className="space-y-4">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/70">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={memberForm.name}
                    onChange={(e) => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                  />
                  {memberErrors.name && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{memberErrors.name}</p>}
                </div>

                {/* Designation */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/70">
                    Designation / Role *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. President, Vice President, General Secretary, Event Coordinator"
                    value={memberForm.designation}
                    onChange={(e) => setMemberForm(prev => ({ ...prev, designation: e.target.value }))}
                    className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                  />
                  {memberErrors.designation && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{memberErrors.designation}</p>}
                </div>

                {/* Contact Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#171e19]/70">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 9876543210"
                    value={memberForm.contactNumber}
                    onChange={(e) => setMemberForm(prev => ({ ...prev, contactNumber: e.target.value }))}
                    className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                  />
                  {memberErrors.contactNumber && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{memberErrors.contactNumber}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#171e19]/10">
                  <button
                    type="button"
                    disabled={memberSubmitting}
                    onClick={() => setMemberModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#171e19] hover:bg-slate-100 font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] rounded-none transition-brutal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={memberSubmitting}
                    className="px-5 py-2 bg-[#171e19] hover:bg-[#ffe17c] text-white hover:text-[#171e19] font-anton text-sm uppercase tracking-widest rounded-none border-2 border-[#171e19] transition-brutal disabled:opacity-50"
                  >
                    {memberSubmitting ? 'SAVING...' : (editingMember ? 'UPDATE MEMBER' : 'ADD MEMBER')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
