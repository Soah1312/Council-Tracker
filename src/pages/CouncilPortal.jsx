import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { generateEventId, createEventRequest, uploadFile, subscribeToEventsByCouncil, submitReport, submitPermissionLetters } from '../lib/events';
import { COUNCILS, loginWithEmail, logoutUser, sendPasswordReset, onAuthChange, getCouncilByEmail } from '../lib/auth';
import { format } from 'date-fns';
import { notifyProposalSubmitted, notifyProposalResubmitted, notifyPermissionsSubmitted, notifyReportSubmitted } from '../lib/emailService';
import {
  IconFile, IconCalendar, IconMapPin, IconWarning, IconX, IconCheck,
  IconPhoto, IconMoney, IconTicket, IconUser, IconGlobe, IconTool, IconDownload, IconMail
} from '../lib/icons';



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
        className={`border-2 border-dashed p-4 flex flex-col items-center justify-center transition-all cursor-pointer rounded-none relative ${
          dragActive 
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
    doswLetter: null,
    councilLetter: null,
    venueLetter: null
  });
  const [permissionsErrors, setPermissionsErrors] = useState({});
  const [permissionsSubmitting, setPermissionsSubmitting] = useState(false);
  const [startCalMonth, setStartCalMonth] = useState(new Date());
  const [endCalMonth, setEndCalMonth] = useState(new Date());

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
    if (!formData.startDate || !formData.endDate) return '';
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
    const diffMs = end - start;
    if (diffMs < 0) return 'Invalid: End is before Start';
    
    const diffMins = Math.round(diffMs / (1000 * 60));
    const days = Math.floor(diffMins / (24 * 60));
    const hours = Math.floor((diffMins % (24 * 60)) / 60);
    const minutes = diffMins % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    
    return `Duration: ${parts.join(', ') || '0 minutes'}`;
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

  const handleSelectTimeSlot = (field, timeVal) => {
    const current = getSplitDateTime(formData[field]);
    const datePart = current.date || format(new Date(), 'yyyy-MM-dd');
    
    const combined = `${datePart}T${timeVal}`;
    
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
      console.error(err);
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
        <div className="grid grid-cols-3 gap-2">
          {stages.map((stg) => {
            const isCompleted = currentStage > stg.num || (stg.num === 3 && status === 'closed');
            const isActive = currentStage === stg.num && status !== 'closed';
            const isFuture = !isCompleted && !isActive;

            let bgColor = 'bg-white border-[#171e19]/15 text-[#171e19]/40';
            if (isActive) {
              bgColor = 'bg-[#ffe17c] border-[#171e19] text-[#171e19] font-bold shadow-[2px_2px_0px_0px_#171e19]';
            } else if (isCompleted) {
              bgColor = 'bg-[#171e19] border-[#171e19] text-[#ffe17c]';
            }

            return (
              <div key={stg.num} className={`p-2.5 border-2 flex flex-col items-center text-center justify-between gap-1 transition-brutal ${bgColor}`}>
                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                  <span className={`w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center font-bold ${
                    isCompleted ? 'bg-[#ffe17c] text-[#171e19]' : isActive ? 'bg-[#171e19] text-[#ffe17c]' : 'bg-[#171e19]/10 text-[#171e19]/50'
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

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showNotification('File exceeds the 10MB size limit.', 'error');
        e.target.value = null;
        return;
      }
      if (file.type !== 'application/pdf') {
        showNotification('Only PDF uploads are permitted.', 'error');
        e.target.value = null;
        return;
      }
      setFiles(p => ({ ...p, [field]: file }));
      setErrors(p => ({ ...p, [field]: null }));
    }
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
    } catch (err) {
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
    } catch (err) {
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
    // File description validation
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
        eventName: formData.eventName.trim(),
        expectedFootfall: Number(formData.expectedFootfall),
        startDate: formData.startDate,
        endDate: formData.endDate,
        eventDescriptionUrl,
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
      expectedFootfall: event.expectedFootfall ? String(event.expectedFootfall) : '',
      startDate: toDatetimeLocalString(event.startDate),
      endDate: toDatetimeLocalString(event.endDate)
    });

    const startJS = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    const endJS = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);
    if (!isNaN(startJS.getTime())) setStartCalMonth(startJS);
    if (!isNaN(endJS.getTime())) setEndCalMonth(endJS);

    setExistingUrls({
      eventDescriptionUrl: event.eventDescriptionUrl || '',
      doswPermissionLetterUrl: event.doswPermissionLetterUrl || '',
      councilPermissionLetterUrl: event.councilPermissionLetterUrl || '',
      venuePermissionLetterUrl: event.venuePermissionLetterUrl || ''
    });

    setFiles({
      eventDescription: null
    });

    setErrors({});
    setEditingEventId(event.eventId);
    setActiveTab('new-request');
  };

  const handleResetForm = () => {
    setFormData({
      eventName: '',
      expectedFootfall: '',
      startDate: '',
      endDate: ''
    });
    setFiles({
      eventDescription: null
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
      fetchMyEvents();
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
    if (!permissionsFiles.councilLetter) {
      errors.councilLetter = 'Student Council permission letter PDF is required.';
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
      
      setUploadProgress('Uploading Student Council letter PDF...');
      const councilPermissionLetterUrl = await uploadFile(permissionsFiles.councilLetter, uploadPath);
      
      let venuePermissionLetterUrl = null;
      if (permissionsFiles.venueLetter) {
        setUploadProgress('Uploading venue permission letter PDF...');
        venuePermissionLetterUrl = await uploadFile(permissionsFiles.venueLetter, uploadPath);
      }

      setUploadProgress('Saving to database...');
      await submitPermissionLetters(permissionsUploadEvent.eventId, {
        doswPermissionLetterUrl,
        councilPermissionLetterUrl,
        venuePermissionLetterUrl
      });
      // Fire-and-forget email notification
      notifyPermissionsSubmitted(permissionsUploadEvent, council.name).catch(console.error);

      showNotification('Permission letters uploaded successfully! Awaiting review.');
      setPermissionsUploadEvent(null);
      setPermissionsFiles({ doswLetter: null, councilLetter: null, venueLetter: null });
      setPermissionsErrors({});
      fetchMyEvents();
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
              COUNCILTRACK<span className="text-[#ffe17c]">.</span>
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
                placeholder="e.g. frcrce.stuco@gmail.com"
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

          <div className="text-center pt-4 border-t border-[#171e19]/10">
            <Link to="/admin" className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] hover:underline">
              DOSW / DEAN LOGIN &rarr;
            </Link>
          </div>
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
                <div className={`p-3 border-2 text-xs font-bold uppercase ${
                  resetMessage.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-emerald-50 border-emerald-500 text-emerald-800'
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
                    placeholder="frcrce.stuco@gmail.com"
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
        <div className={`fixed bottom-5 right-5 z-50 flex items-center p-4 border transition-all duration-300 transform translate-y-0 rounded-none ${
          notification.type === 'error' 
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
          <Link
            to="/admin"
            className="px-4 py-2 border-2 border-[#171e19] hover:bg-[#ffe17c] font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] transition-brutal"
          >
            Admin Panel &rarr;
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-[#171e19] hover:bg-[#ffe17c]/10 font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] transition-brutal"
          >
            Logout / Switch
          </button>
        </div>
      </div>

      {/* Tabs folderSwitcher */}
      <div className="flex flex-wrap border-b-2 border-[#171e19]">
        <button
          onClick={() => {
            setActiveTab('new-request');
            setSubmittedEventId(null);
            setReportingEvent(null);
          }}
          className={`font-anton text-sm md:text-xl px-4 md:px-8 py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-[#171e19] tracking-wider transition-brutal ${
            activeTab === 'new-request'
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
          className={`font-anton text-sm md:text-xl px-4 md:px-8 py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-[#171e19] ml-[-2px] tracking-wider transition-brutal ${
            activeTab === 'my-events'
              ? 'bg-[#171e19] text-white border-b-transparent'
              : 'bg-white text-[#171e19] hover:bg-[#ffe17c]/20'
          }`}
        >
          My Events
        </button>

        {reportingEvent && (
          <button
            onClick={() => setActiveTab('report')}
            className={`font-anton text-sm md:text-xl px-4 md:px-8 py-3 md:py-4 uppercase border-t-2 border-r-2 border-l-2 border-dashed border-[#ffe17c] bg-[#171e19] text-[#ffe17c] ml-[-2px] tracking-wider transition-brutal`}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                {/* SECTION 2: Logistics */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">SCHEDULE & TIMINGS</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#b7c6c2]/5 border-2 border-[#171e19] p-5 shadow-[4px_4px_0px_0px_#ffe17c]">
                    
                    {/* START TIMINGS */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-[#ffe17c] border-2 border-[#171e19] px-3 py-1.5 shadow-[2px_2px_0px_0px_#171e19]">
                        <span className="font-anton text-sm text-[#171e19] uppercase tracking-wider">Start Schedule</span>
                        <span className="font-satoshi text-[10px] font-bold text-[#171e19] bg-white px-2 py-0.5 border border-[#171e19]">
                          {formData.startDate ? format(new Date(formData.startDate), 'MMM dd, yyyy @ hh:mm a') : 'Not Set'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Mini Calendar Column (7 cols) */}
                        <div className="sm:col-span-7 space-y-2">
                          <span className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2] block">Select Start Date</span>
                          {/* Render Mini Calendar for Start Date */}
                          <div className="bg-white border-2 border-[#171e19] p-2.5">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between border-b border-[#171e19] pb-1.5 mb-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const prevM = new Date(startCalMonth.getFullYear(), startCalMonth.getMonth() - 1, 1);
                                  setStartCalMonth(prevM);
                                }}
                                className="w-5 h-5 border border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-[10px] rounded-none transition-brutal"
                              >
                                &larr;
                              </button>
                              <span className="font-anton text-[10px] uppercase tracking-wider text-[#171e19]">
                                {format(startCalMonth, 'MMMM yyyy')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextM = new Date(startCalMonth.getFullYear(), startCalMonth.getMonth() + 1, 1);
                                  setStartCalMonth(nextM);
                                }}
                                className="w-5 h-5 border border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-[10px] rounded-none transition-brutal"
                              >
                                &rarr;
                              </button>
                            </div>
                            
                            {/* Weekday Labels */}
                            <div className="grid grid-cols-7 text-center font-bold text-[8px] uppercase tracking-wider text-[#b7c6c2] mb-1">
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => <div key={idx}>{w}</div>)}
                            </div>
                            
                            {/* Days Grid */}
                            <div className="grid grid-cols-7 gap-0.5 text-center font-satoshi text-[10px] font-bold">
                              {(() => {
                                const year = startCalMonth.getFullYear();
                                const month = startCalMonth.getMonth();
                                const firstDay = new Date(year, month, 1);
                                const startWeekDay = firstDay.getDay();
                                const totalDays = new Date(year, month + 1, 0).getDate();
                                
                                const dayButtons = [];
                                for (let i = 0; i < startWeekDay; i++) {
                                  dayButtons.push(<div key={`pad-${i}`} className="h-5" />);
                                }
                                
                                const selected = getSplitDateTime(formData.startDate).date;
                                for (let i = 1; i <= totalDays; i++) {
                                  const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                                  const isSelected = selected === currentDayStr;
                                  const isToday = new Date(year, month, i).toDateString() === new Date().toDateString();
                                  
                                  dayButtons.push(
                                    <button
                                      type="button"
                                      key={`day-${i}`}
                                      onClick={() => {
                                        const newDateObj = new Date(year, month, i);
                                        handleSelectCalendarDate('startDate', newDateObj);
                                      }}
                                      className={`h-5 w-full flex items-center justify-center transition-all rounded-none border ${
                                        isSelected 
                                          ? 'bg-[#171e19] border-[#171e19] text-[#ffe17c] font-black' 
                                          : isToday
                                            ? 'border-[#ffe17c] bg-[#ffe17c]/15 text-[#171e19]' 
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
                        </div>
                        
                        {/* Time Slots Column (5 cols) */}
                        <div className="sm:col-span-5 flex flex-col space-y-2">
                          <span className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2] block">Select Start Time</span>
                          
                          {/* Scrollable preset slots */}
                          <div className="bg-white border-2 border-[#171e19] h-[138px] overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
                            {(() => {
                              const selectedTime = getSplitDateTime(formData.startDate).time;
                              const slots = [];
                              for (let h = 8; h <= 22; h++) {
                                const hr12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                                const ampm = h >= 12 ? 'PM' : 'AM';
                                slots.push({ label: `${hr12}:00 ${ampm}`, value: `${String(h).padStart(2, '0')}:00` });
                                slots.push({ label: `${hr12}:30 ${ampm}`, value: `${String(h).padStart(2, '0')}:30` });
                              }
                              return slots.map(slot => {
                                const isSelected = selectedTime && selectedTime.slice(0, 5) === slot.value;
                                return (
                                  <button
                                    type="button"
                                    key={slot.value}
                                    onClick={() => handleSelectTimeSlot('startDate', slot.value)}
                                    className={`w-full text-left px-2 py-1 transition-all rounded-none border text-[10px] font-bold uppercase flex justify-between ${
                                      isSelected
                                        ? 'bg-[#ffe17c] border-[#171e19] text-[#171e19]'
                                        : 'bg-white border-transparent hover:border-[#171e19]/30 text-[#171e19]'
                                    }`}
                                  >
                                    <span>{slot.label}</span>
                                    {isSelected && <span>✓</span>}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                          
                          {/* Custom time fallback input */}
                          <div className="flex gap-1.5 items-center">
                            <span className="font-satoshi text-[8px] font-bold uppercase text-[#b7c6c2] shrink-0">Custom:</span>
                            <input
                              type="time"
                              required
                              value={getSplitDateTime(formData.startDate).time}
                              onChange={e => handleSplitDateTimeChange('startDate', 'time', e.target.value)}
                              className="w-full bg-white border border-[#171e19]/30 px-2 py-1 text-[10px] text-[#171e19] font-bold focus:border-[#ffe17c] focus:outline-none rounded-none"
                            />
                          </div>
                        </div>
                      </div>
                      {errors.startDate && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.startDate}</p>}
                    </div>
                    
                    {/* END TIMINGS */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-[#ffe17c] border-2 border-[#171e19] px-3 py-1.5 shadow-[2px_2px_0px_0px_#171e19]">
                        <span className="font-anton text-sm text-[#171e19] uppercase tracking-wider">End Schedule</span>
                        <span className="font-satoshi text-[10px] font-bold text-[#171e19] bg-white px-2 py-0.5 border border-[#171e19]">
                          {formData.endDate ? format(new Date(formData.endDate), 'MMM dd, yyyy @ hh:mm a') : 'Not Set'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Mini Calendar Column (7 cols) */}
                        <div className="sm:col-span-7 space-y-2">
                          <span className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2] block">Select End Date</span>
                          {/* Render Mini Calendar for End Date */}
                          <div className="bg-white border-2 border-[#171e19] p-2.5">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between border-b border-[#171e19] pb-1.5 mb-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const prevM = new Date(endCalMonth.getFullYear(), endCalMonth.getMonth() - 1, 1);
                                  setEndCalMonth(prevM);
                                }}
                                className="w-5 h-5 border border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-[10px] rounded-none transition-brutal"
                              >
                                &larr;
                              </button>
                              <span className="font-anton text-[10px] uppercase tracking-wider text-[#171e19]">
                                {format(endCalMonth, 'MMMM yyyy')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextM = new Date(endCalMonth.getFullYear(), endCalMonth.getMonth() + 1, 1);
                                  setEndCalMonth(nextM);
                                }}
                                className="w-5 h-5 border border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-[10px] rounded-none transition-brutal"
                              >
                                &rarr;
                              </button>
                            </div>
                            
                            {/* Weekday Labels */}
                            <div className="grid grid-cols-7 text-center font-bold text-[8px] uppercase tracking-wider text-[#b7c6c2] mb-1">
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => <div key={idx}>{w}</div>)}
                            </div>
                            
                            {/* Days Grid */}
                            <div className="grid grid-cols-7 gap-0.5 text-center font-satoshi text-[10px] font-bold">
                              {(() => {
                                const year = endCalMonth.getFullYear();
                                const month = endCalMonth.getMonth();
                                const firstDay = new Date(year, month, 1);
                                const startWeekDay = firstDay.getDay();
                                const totalDays = new Date(year, month + 1, 0).getDate();
                                
                                const dayButtons = [];
                                for (let i = 0; i < startWeekDay; i++) {
                                  dayButtons.push(<div key={`pad-${i}`} className="h-5" />);
                                }
                                
                                const selected = getSplitDateTime(formData.endDate).date;
                                for (let i = 1; i <= totalDays; i++) {
                                  const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                                  const isSelected = selected === currentDayStr;
                                  const isToday = new Date(year, month, i).toDateString() === new Date().toDateString();
                                  
                                  dayButtons.push(
                                    <button
                                      type="button"
                                      key={`day-${i}`}
                                      onClick={() => {
                                        const newDateObj = new Date(year, month, i);
                                        handleSelectCalendarDate('endDate', newDateObj);
                                      }}
                                      className={`h-5 w-full flex items-center justify-center transition-all rounded-none border ${
                                        isSelected 
                                          ? 'bg-[#171e19] border-[#171e19] text-[#ffe17c] font-black' 
                                          : isToday
                                            ? 'border-[#ffe17c] bg-[#ffe17c]/15 text-[#171e19]' 
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
                        </div>
                        
                        {/* Time Slots Column (5 cols) */}
                        <div className="sm:col-span-5 flex flex-col space-y-2">
                          <span className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2] block">Select End Time</span>
                          
                          {/* Scrollable preset slots */}
                          <div className="bg-white border-2 border-[#171e19] h-[138px] overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
                            {(() => {
                              const selectedTime = getSplitDateTime(formData.endDate).time;
                              const slots = [];
                              for (let h = 8; h <= 22; h++) {
                                const hr12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                                const ampm = h >= 12 ? 'PM' : 'AM';
                                slots.push({ label: `${hr12}:00 ${ampm}`, value: `${String(h).padStart(2, '0')}:00` });
                                slots.push({ label: `${hr12}:30 ${ampm}`, value: `${String(h).padStart(2, '0')}:30` });
                              }
                              return slots.map(slot => {
                                const isSelected = selectedTime && selectedTime.slice(0, 5) === slot.value;
                                return (
                                  <button
                                    type="button"
                                    key={slot.value}
                                    onClick={() => handleSelectTimeSlot('endDate', slot.value)}
                                    className={`w-full text-left px-2 py-1 transition-all rounded-none border text-[10px] font-bold uppercase flex justify-between ${
                                      isSelected
                                        ? 'bg-[#ffe17c] border-[#171e19] text-[#171e19]'
                                        : 'bg-white border-transparent hover:border-[#171e19]/30 text-[#171e19]'
                                    }`}
                                  >
                                    <span>{slot.label}</span>
                                    {isSelected && <span>✓</span>}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                          
                          {/* Custom time fallback input */}
                          <div className="flex gap-1.5 items-center">
                            <span className="font-satoshi text-[8px] font-bold uppercase text-[#b7c6c2] shrink-0">Custom:</span>
                            <input
                              type="time"
                              required
                              value={getSplitDateTime(formData.endDate).time}
                              onChange={e => handleSplitDateTimeChange('endDate', 'time', e.target.value)}
                              className="w-full bg-white border border-[#171e19]/30 px-2 py-1 text-[10px] text-[#171e19] font-bold focus:border-[#ffe17c] focus:outline-none rounded-none"
                            />
                          </div>
                        </div>
                      </div>
                      {errors.endDate && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.endDate}</p>}
                    </div>
                  </div>

                  {/* DURATION & LIVE VALIDATION BANNER */}
                  {(() => {
                    const durationText = getEventDuration();
                    const isInvalid = durationText.includes('Invalid');
                    if (isInvalid) {
                      return (
                        <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                          ⚠️ {durationText}
                        </p>
                      );
                    }
                    return durationText ? (
                      <p className="font-satoshi text-[10px] text-[#171e19] font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                        <IconCalendar className="w-3 h-3" /> {durationText}
                      </p>
                    ) : null;
                  })()}
                </div>

                {/* SECTION 3: Required Attachments */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">REQUIRED DOCUMENTS</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    {/* Description file */}
                    <DragDropUpload
                      id="eventDescription"
                      label={`Event Description/Proposal PDF ${editingEventId ? '(Optional)' : '*'}`}
                      helperText="Please upload a single PDF file that details what the event exactly is, the timeline, schedule, flow, and other important aspects of the event."
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
                      className={`border-2 transition-brutal cursor-pointer rounded-none overflow-hidden ${
                        (event.status === 'revision_needed' || event.status === 'permissions_revision_needed')
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
                        <div className={`flex items-start gap-3 px-5 py-3 border-b-2 ${
                          event.status === 'rejected'
                            ? 'bg-red-800 border-red-900'
                            : 'bg-red-500 border-red-600'
                        }`} onClick={e => e.stopPropagation()}>
                          <span className="text-white text-lg leading-none mt-0.5 shrink-0">
                            {event.status === 'rejected' ? '✕' : '⚠'}
                          </span>
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
                                Admin note: &ldquo;{event.reviewNotes}&rdquo;
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
                      )}
                      {/* Stage 3 — Report Due Banner (always visible when approved) */}
                      {(event.status === 'approved' || event.status === 'report_pending') && event.reportDueDate && (() => {
                        const due = event.reportDueDate.toDate ? event.reportDueDate.toDate() : new Date(event.reportDueDate);
                        const diffDays = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
                        const isOverdue = diffDays < 0;
                        const isUrgent = !isOverdue && diffDays <= 3;
                        return (
                          <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#171e19] flex-wrap ${
                            isOverdue ? 'bg-red-600' : isUrgent ? 'bg-amber-400' : 'bg-emerald-800'
                          }`} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3">
                              <span className="text-white text-lg leading-none shrink-0">
                                {isOverdue ? '🚨' : isUrgent ? '⚠️' : '📋'}
                              </span>
                              <div>
                                <span className={`font-anton text-sm uppercase tracking-wider block ${
                                  isOverdue || isUrgent ? 'text-white' : 'text-emerald-100'
                                }`}>
                                  STAGE 3 — POST-EVENT REPORT {isOverdue ? 'OVERDUE' : 'DUE'}
                                </span>
                                <span className={`font-satoshi text-xs font-semibold block mt-0.5 ${
                                  isOverdue || isUrgent ? 'text-white/90' : 'text-emerald-200'
                                }`}>
                                  Submit your post-event report by {due.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`font-mono text-sm font-bold px-3 py-1 border uppercase ${
                                isOverdue
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

                        </div>
                      </div>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <div className="px-5 pb-6 pt-4 border-t-2 border-[#171e19] bg-[#b7c6c2]/5 space-y-5 text-xs text-[#171e19]/90 font-satoshi">
                           {/* Event Progress Tracker */}
                           {renderStageTracker(event.status)}
                           
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
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-[#171e19]/10 p-4 rounded-none">
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
                              <a href={event.eventDescriptionUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                <IconFile className="w-4 h-4" /> PROPOSAL SUMMARY PDF
                              </a>
                              {event.doswPermissionLetterUrl && (
                                <a href={event.doswPermissionLetterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4" /> DOSW CLEARANCE PDF
                                </a>
                              )}
                              {event.councilPermissionLetterUrl && (
                                <a href={event.councilPermissionLetterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4" /> COUNCIL APPROVAL PDF
                                </a>
                              )}
                              {event.venuePermissionLetterUrl && (
                                <a href={event.venuePermissionLetterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-3 py-2 transition-brutal">
                                  <IconFile className="w-4 h-4" /> VENUE BOOKING SLIP PDF
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
                            <div className={`rounded-none border-l-4 p-4 flex gap-3 items-start ${
                              event.status === 'rejected'
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: SUBMIT REPORT */}
        {activeTab === 'report' && reportingEvent && (
          <div className="bg-white border-2 border-[#171e19] p-8 space-y-6 rounded-none shadow-[8px_8px_0px_0px_#ffe17c] animate-fade-in">
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
            <div className="bg-white border-4 border-[#171e19] rounded-none w-full max-w-lg p-6 space-y-4 shadow-[8px_8px_0px_0px_#ffe17c] animate-fade-in text-[#171e19]">
              <div>
                <p className="font-satoshi text-[10px] uppercase font-bold text-[#b7c6c2]">Stage 2: Upload Permission Letters</p>
                <h3 className="font-anton text-2xl text-[#171e19] mt-1 tracking-tight">
                  {permissionsUploadEvent.eventName.toUpperCase()}
                </h3>
                <p className="font-satoshi text-xs uppercase font-semibold mt-1">
                  ID: <span className="underline">{permissionsUploadEvent.eventId}</span>
                </p>
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
                {/* DoSW Letter File */}
                <DragDropUpload
                  id="doswLetter"
                  label="DoSW & Principal Clearance (PDF) *"
                  accept="application/pdf"
                  file={permissionsFiles.doswLetter}
                  onChange={(file) => setPermissionsFiles(prev => ({ ...prev, doswLetter: file }))}
                  error={permissionsErrors.doswLetter}
                />

                {/* Student Council Letter File */}
                <DragDropUpload
                  id="councilLetter"
                  label="Student Council Clearance (PDF) *"
                  accept="application/pdf"
                  file={permissionsFiles.councilLetter}
                  onChange={(file) => setPermissionsFiles(prev => ({ ...prev, councilLetter: file }))}
                  error={permissionsErrors.councilLetter}
                />

                {/* Venue Letter File */}
                <DragDropUpload
                  id="venueLetter"
                  label="Venue booking permission / booking slip (PDF) (Optional)"
                  accept="application/pdf"
                  file={permissionsFiles.venueLetter}
                  onChange={(file) => setPermissionsFiles(prev => ({ ...prev, venueLetter: file }))}
                  error={permissionsErrors.venueLetter}
                />

                <div className="flex justify-end gap-3 pt-3 border-t border-[#171e19]/10">
                  <button
                    type="button"
                    disabled={permissionsSubmitting}
                    onClick={() => {
                      setPermissionsUploadEvent(null);
                      setPermissionsFiles({ doswLetter: null, councilLetter: null, venueLetter: null });
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
      </div>
    </div>
  );
}
