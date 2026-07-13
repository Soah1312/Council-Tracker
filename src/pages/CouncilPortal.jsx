import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { generateEventId, createEventRequest, uploadFile, getEventsByCouncil, submitReport } from '../lib/events';
import { format } from 'date-fns';

const COUNCILS = [
  // Professional Chapters
  { id: 'ieee-wie', name: 'IEEE & WIE', category: 'Professional Chapters', coordinator: 'Prof. Archana Lopes' },
  { id: 'csi', name: 'CSI', category: 'Professional Chapters', coordinator: 'Prof. Prajakta Dhamanskar' },
  { id: 'acm', name: 'ACM', category: 'Professional Chapters', coordinator: 'Prof. Sarika Davare' },
  { id: 'asme', name: 'ASME', category: 'Professional Chapters', coordinator: 'Dr. Dipali Bhise' },
  { id: 'e-cell', name: 'E-Cell', category: 'Professional Chapters', coordinator: 'Dr. Prajakta Bhangale' },
  { id: 'fsai', name: 'FSAI', category: 'Professional Chapters', coordinator: 'Dr. Swapnali Makdey' },
  
  // Technical Teams
  { id: 'team-robix', name: 'Team Robix', category: 'Technical Teams', coordinator: 'Dr. K. Sailakshmi Parvathi' },
  { id: 'team-abadha', name: 'Team Abadha', category: 'Technical Teams', coordinator: 'Dr. V.B. Rao' },
  { id: 'team-cfr', name: 'Team CFR', category: 'Technical Teams', coordinator: 'Dr. Graham Koyeerath' },
  { id: 'team-vaayushastra', name: 'Team Vaayushastra', category: 'Technical Teams', coordinator: 'Dr. Deepali Bhise' },
  { id: 'team-mavericks', name: 'Team Mavericks', category: 'Technical Teams', coordinator: 'Prof. Saurabh Kulkarni' },
  { id: 'project-cell', name: 'Project Cell', category: 'Technical Teams', coordinator: 'Prof. Vaibhav Godbole' },
  
  // Technical Student Clubs
  { id: 'mozilla-codelabs', name: 'Mozilla & Codelabs', category: 'Technical Student Clubs', coordinator: 'Dr. Roshni Padate' },
  { id: 'gdsc', name: 'GDSC', category: 'Technical Student Clubs', coordinator: 'Dr. Kalpana Deorukhkar' },
  { id: 'gda', name: 'GDA', category: 'Technical Student Clubs', coordinator: 'Prof. Heenakausar Pendhari' },
  
  // Additional Societies
  { id: 'nss', name: 'NSS', category: 'Societies & Clubs', coordinator: 'Prof. Pradeep Singh' },
  { id: 'rotaract-club', name: 'Rotaract Club', category: 'Societies & Clubs', coordinator: 'Dr. Ketaki Joshi' },
  { id: 'tedx', name: 'TEDx', category: 'Societies & Clubs', coordinator: 'Prof. Savita Borole' }
];

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

  // Fetch events for active council
  const fetchMyEvents = async () => {
    if (!council) return;
    setLoadingEvents(true);
    try {
      const data = await getEventsByCouncil(council.id);
      
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

      setEvents(processed);
    } catch (err) {
      console.error(err);
      showNotification('Failed to retrieve events.', 'error');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (council) {
      fetchMyEvents();
    }
  }, [council, activeTab]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleSelectCouncil = (selectedCouncil) => {
    setCouncil(selectedCouncil);
    sessionStorage.setItem('active_council', JSON.stringify(selectedCouncil));
    showNotification(`Active session set: ${selectedCouncil.name}`);
  };

  const handleLogout = () => {
    setCouncil(null);
    sessionStorage.removeItem('active_council');
    handleResetForm();
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
        return { label: 'submitted', colorClass: 'bg-[#b7c6c2] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
      case 'approved':
        return { label: 'approved', colorClass: 'bg-emerald-950 text-white px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
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
        return { label: 'closed', colorClass: 'bg-[#b7c6c2] text-[#171e19] px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
      default:
        return { label: status, colorClass: 'bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-[10px] uppercase font-bold' };
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.eventName.trim()) newErrors.eventName = 'Event Name is required.';
    if (!formData.category) newErrors.category = 'Category is required.';
    if (!formData.startDate) newErrors.startDate = 'Start date and time is required.';
    if (!formData.endDate) newErrors.endDate = 'End date and time is required.';
    if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after the start date.';
    }
    if (!formData.venue.trim()) newErrors.venue = 'Venue is required.';
    
    const footfall = Number(formData.expectedFootfall);
    if (!formData.expectedFootfall) {
      newErrors.expectedFootfall = 'Expected footfall is required.';
    } else if (isNaN(footfall) || footfall <= 0) {
      newErrors.expectedFootfall = 'Expected footfall must be a positive number.';
    }

    if (!formData.studentContactName.trim()) newErrors.studentContactName = 'Student POC Name is required.';
    if (!formData.studentContactPhone.trim()) newErrors.studentContactPhone = 'Student POC Phone is required.';
    if (!formData.facultyCoordinatorName.trim()) newErrors.facultyCoordinatorName = 'Faculty coordinator name is required.';

    // File attachments validation (allow existing URLs if editing)
    if (!files.eventDescription && !existingUrls.eventDescriptionUrl) {
      newErrors.eventDescription = 'Proposal description PDF is required.';
    }
    if (!files.doswLetter && !existingUrls.doswPermissionLetterUrl) {
      newErrors.doswLetter = 'DoSW & Principal clearance letter PDF is required.';
    }
    if (!files.councilLetter && !existingUrls.councilPermissionLetterUrl) {
      newErrors.councilLetter = 'Student Council permission letter PDF is required.';
    }

    // Conditional switches validations
    if (formData.venuePermissionApplicable && !files.venueLetter && !existingUrls.venuePermissionLetterUrl) {
      newErrors.venueLetter = 'Venue permission slip PDF is required.';
    }
    if (formData.prizeMoneyApplicable) {
      if (!formData.prizeMoneyAmount || Number(formData.prizeMoneyAmount) <= 0) {
        newErrors.prizeMoneyAmount = 'Prize pool amount must be positive.';
      }
      if (!formData.prizeMoneySource.trim()) {
        newErrors.prizeMoneySource = 'Funding source is required.';
      }
    }
    if (formData.registrationFeeApplicable) {
      if (!formData.registrationFeeAmount || Number(formData.registrationFeeAmount) < 0) {
        newErrors.registrationFeeAmount = 'Fee cannot be negative.';
      }
    }
    if (formData.attendanceWaiverApplicable && !files.waiverLetter && !existingUrls.attendanceWaiverUrl) {
      newErrors.waiverLetter = 'Waiver request list PDF is required.';
    }
    if (formData.guestApplicable) {
      if (!formData.guestName.trim()) newErrors.guestName = 'Guest name is required.';
      if (!formData.guestDesignation.trim()) newErrors.guestDesignation = 'Guest designation is required.';
    }
    if (formData.externalParticipantsApplicable) {
      if (!formData.externalParticipantsExpected || Number(formData.externalParticipantsExpected) <= 0) {
        newErrors.externalParticipantsExpected = 'Expected external participant count must be positive.';
      }
    }
    if (formData.safetyArrangementNeeded && !formData.safetyArrangementDetails.trim()) {
      newErrors.safetyArrangementDetails = 'Details on safety arrangements are required.';
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
      
      let doswPermissionLetterUrl = existingUrls.doswPermissionLetterUrl;
      if (files.doswLetter) {
        setUploadProgress('Uploading DoSW clearance letter PDF...');
        doswPermissionLetterUrl = await uploadFile(files.doswLetter, uploadPath);
      }
      
      let councilPermissionLetterUrl = existingUrls.councilPermissionLetterUrl;
      if (files.councilLetter) {
        setUploadProgress('Uploading Student Council letter PDF...');
        councilPermissionLetterUrl = await uploadFile(files.councilLetter, uploadPath);
      }

      let venuePermissionLetterUrl = formData.venuePermissionApplicable ? existingUrls.venuePermissionLetterUrl : null;
      if (formData.venuePermissionApplicable && files.venueLetter) {
        setUploadProgress('Uploading venue permission letter PDF...');
        venuePermissionLetterUrl = await uploadFile(files.venueLetter, uploadPath);
      }

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
        jointWith: formData.jointWith.trim() || null,
        category: formData.category,
        startDate: formData.startDate,
        endDate: formData.endDate,
        venue: formData.venue.trim(),
        expectedFootfall: Number(formData.expectedFootfall),
        studentContactName: formData.studentContactName.trim(),
        studentContactPhone: formData.studentContactPhone.trim(),
        facultyCoordinatorName: formData.facultyCoordinatorName.trim(),
        resourcesNeeded: formData.resourcesNeeded.trim() || null,
        
        eventDescriptionUrl,
        doswPermissionLetterUrl,
        councilPermissionLetterUrl,
        
        venuePermissionApplicable: formData.venuePermissionApplicable,
        venuePermissionLetterUrl,
        
        prizeMoneyApplicable: formData.prizeMoneyApplicable,
        prizeMoneyAmount: formData.prizeMoneyApplicable ? Number(formData.prizeMoneyAmount) : null,
        prizeMoneySource: formData.prizeMoneyApplicable ? formData.prizeMoneySource.trim() : null,
        
        registrationFeeApplicable: formData.registrationFeeApplicable,
        registrationFeeAmount: formData.registrationFeeApplicable ? Number(formData.registrationFeeAmount) : null,
        
        attendanceWaiverApplicable: formData.attendanceWaiverApplicable,
        attendanceWaiverUrl,
        
        guestApplicable: formData.guestApplicable,
        guestName: formData.guestApplicable ? formData.guestName.trim() : null,
        guestDesignation: formData.guestApplicable ? formData.guestDesignation.trim() : null,
        
        externalParticipantsApplicable: formData.externalParticipantsApplicable,
        externalParticipantsExpected: formData.externalParticipantsApplicable ? Number(formData.externalParticipantsExpected) : null,
        
        safetyArrangementNeeded: formData.safetyArrangementNeeded,
        safetyArrangementDetails: formData.safetyArrangementNeeded ? formData.safetyArrangementDetails.trim() : null
      };

      await createEventRequest(payload);
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
      jointWith: event.jointWith || '',
      category: event.category || 'technical',
      startDate: toDatetimeLocalString(event.startDate),
      endDate: toDatetimeLocalString(event.endDate),
      venue: event.venue || '',
      expectedFootfall: event.expectedFootfall || '',
      studentContactName: event.studentContactName || '',
      studentContactPhone: event.studentContactPhone || '',
      facultyCoordinatorName: event.facultyCoordinatorName || '',
      resourcesNeeded: event.resourcesNeeded || '',
      
      venuePermissionApplicable: !!event.venuePermissionApplicable,
      prizeMoneyApplicable: !!event.prizeMoneyApplicable,
      prizeMoneyAmount: event.prizeMoneyAmount || '',
      prizeMoneySource: event.prizeMoneySource || '',
      registrationFeeApplicable: !!event.registrationFeeApplicable,
      registrationFeeAmount: event.registrationFeeAmount || '',
      attendanceWaiverApplicable: !!event.attendanceWaiverApplicable,
      guestApplicable: !!event.guestApplicable,
      guestName: event.guestName || '',
      guestDesignation: event.guestDesignation || '',
      externalParticipantsApplicable: !!event.externalParticipantsApplicable,
      externalParticipantsExpected: event.externalParticipantsExpected || '',
      safetyArrangementNeeded: !!event.safetyArrangementNeeded,
      safetyArrangementDetails: event.safetyArrangementDetails || ''
    });

    setExistingUrls({
      eventDescriptionUrl: event.eventDescriptionUrl || '',
      doswPermissionLetterUrl: event.doswPermissionLetterUrl || '',
      councilPermissionLetterUrl: event.councilPermissionLetterUrl || '',
      venuePermissionLetterUrl: event.venuePermissionLetterUrl || '',
      attendanceWaiverUrl: event.attendanceWaiverUrl || ''
    });

    setFiles({
      eventDescription: null,
      doswLetter: null,
      councilLetter: null,
      venueLetter: null,
      waiverLetter: null
    });

    setErrors({});
    setEditingEventId(event.eventId);
    setActiveTab('new-request');
  };

  const handleResetForm = () => {
    setFormData({
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
    setFiles({
      eventDescription: null,
      doswLetter: null,
      councilLetter: null,
      venueLetter: null,
      waiverLetter: null
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

  // 1. LANDING SCREEN (Select Council code entry/dropdown)
  if (!council) {
    return (
      <div className="min-h-screen grid-pattern-charcoal flex items-center justify-center px-4 py-12">
        <div className="bg-white border-4 border-[#171e19] p-8 md:p-10 max-w-md w-full space-y-8 shadow-[8px_8px_0px_0px_#ffe17c] rounded-none">
          <div className="text-center space-y-2">
            <h1 className="font-anton text-5xl md:text-6xl text-[#171e19] tracking-tight">
              COUNCILTRACK<span className="text-[#ffe17c]">.</span>
            </h1>
            <p className="font-satoshi text-xs uppercase tracking-widest text-[#b7c6c2] font-bold">
              Student Activity Portal
            </p>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const selectedId = e.target.councilSelect.value;
            if (!selectedId) {
              setErrors({ login: 'Please select a council/committee.' });
              return;
            }
            const found = COUNCILS.find(c => c.id === selectedId);
            handleSelectCouncil(found);
          }} className="space-y-6">
            <div className="space-y-2">
              <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2] block">
                Select Council / Committee *
              </label>
              <select
                name="councilSelect"
                className={`w-full bg-white border-2 px-4 py-3 text-sm text-[#171e19] font-satoshi font-semibold focus:outline-none focus:border-[#ffe17c] rounded-none transition-brutal ${
                  errors.login ? 'border-red-500' : 'border-[#171e19]'
                }`}
                defaultValue=""
                onChange={() => setErrors({})}
              >
                <option value="" disabled>CHOOSE YOUR COUNCIL...</option>
                {COUNCILS.map(c => (
                  <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                ))}
              </select>
              {errors.login && (
                <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide mt-1">
                  {errors.login}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-[#ffe17c] hover:bg-[#ffe17c]/90 text-[#171e19] font-anton text-lg py-3.5 uppercase tracking-wider transition-brutal border-2 border-[#171e19] rounded-none hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#171e19] active:translate-x-0 active:translate-y-0 active:shadow-none"
            >
              ENTER PORTAL
            </button>
          </form>

          <div className="text-center pt-4 border-t border-[#171e19]/10">
            <Link to="/admin" className="font-satoshi text-xs font-bold uppercase tracking-wider text-[#171e19] hover:underline">
              DOSW / DEAN LOGIN &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. MAIN LOGGED IN SCREEN
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-[#171e19] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[#ffe17c] border border-[#171e19]" />
            <p className="font-satoshi text-[10px] uppercase tracking-widest text-[#171e19] font-bold">Active Session ({council.category.toUpperCase()})</p>
          </div>
          <h1 className="font-anton text-4xl text-[#171e19] mt-2 tracking-tight">
            {council.name.toUpperCase()}
          </h1>
          <p className="font-satoshi text-xs text-[#b7c6c2] font-semibold mt-1">Faculty Coordinator: {council.coordinator.toUpperCase()}</p>
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
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* SECTION 1: General Details */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">GENERAL DETAILS</h3>
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
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Joint Collaboration with (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. ROBOTICS CLUB"
                        value={formData.jointWith}
                        onChange={e => setFormData(p => ({ ...p, jointWith: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                      />
                      <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase tracking-wide">
                        Renders as "{council.name.toUpperCase()} x {formData.jointWith.toUpperCase() || '...'}"
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Category *</label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-3 py-2.5 text-sm text-[#171e19] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                      >
                        <option value="technical">TECHNICAL</option>
                        <option value="cultural">CULTURAL</option>
                        <option value="sports">SPORTS</option>
                        <option value="workshop">WORKSHOP</option>
                        <option value="guest_lecture">GUEST LECTURE</option>
                        <option value="competition">COMPETITION</option>
                        <option value="other">OTHER</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Resources Needed from College (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 5 TABLES, 2 MICS, AV SETUP"
                        value={formData.resourcesNeeded}
                        onChange={e => setFormData(p => ({ ...p, resourcesNeeded: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2.5 text-sm text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none transition-brutal"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Logistics */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">LOGISTICS & SCHEDULE</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Start Date & Time *</label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.startDate}
                        onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2 text-xs text-[#171e19] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />
                      {errors.startDate && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.startDate}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">End Date & Time *</label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.endDate}
                        onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2 text-xs text-[#171e19] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />
                      {errors.endDate && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.endDate}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Expected Footfall *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 200"
                        value={formData.expectedFootfall}
                        onChange={e => setFormData(p => ({ ...p, expectedFootfall: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2 text-xs text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />
                      {errors.expectedFootfall && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.expectedFootfall}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Venue Location *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AUDITORIUM / ROOM 102"
                        value={formData.venue}
                        onChange={e => setFormData(p => ({ ...p, venue: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2 text-xs text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />
                      {errors.venue && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.venue}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Student POC Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="POC NAME"
                        value={formData.studentContactName}
                        onChange={e => setFormData(p => ({ ...p, studentContactName: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2 text-xs text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />
                      {errors.studentContactName && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.studentContactName}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Student POC Phone *</label>
                      <input
                        type="tel"
                        required
                        placeholder="POC PHONE"
                        value={formData.studentContactPhone}
                        onChange={e => setFormData(p => ({ ...p, studentContactPhone: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2 text-xs text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />
                      {errors.studentContactPhone && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.studentContactPhone}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Faculty Coordinator Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.facultyCoordinatorName}
                        onChange={e => setFormData(p => ({ ...p, facultyCoordinatorName: e.target.value }))}
                        className="w-full bg-white border-2 border-[#171e19] px-4 py-2 text-xs text-[#171e19] placeholder-[#b7c6c2] focus:border-[#ffe17c] focus:outline-none rounded-none"
                      />
                      {errors.facultyCoordinatorName && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.facultyCoordinatorName}</p>}
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Required Attachments */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">REQUIRED DOCUMENTS</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Description file */}
                    <div className="flex flex-col gap-2">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">
                        Event Description/Proposal {editingEventId ? '(Optional)' : '*'}
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={e => handleFileChange(e, 'eventDescription')}
                        className="font-satoshi text-xs text-[#171e19] file:mr-3 file:py-2 file:px-3 file:rounded-none file:border-2 file:border-[#171e19] file:bg-[#ffe17c] file:text-[#171e19] file:font-bold file:uppercase cursor-pointer file:transition-brutal hover:file:bg-[#ffe17c]/80"
                      />
                      {existingUrls.eventDescriptionUrl && (
                        <p className="font-satoshi text-[9px] text-[#ffe17c] font-bold uppercase bg-[#171e19] px-2 py-0.5 self-start">✓ CACHED</p>
                      )}
                      {errors.eventDescription && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.eventDescription}</p>}
                    </div>

                    {/* DOSW file */}
                    <div className="flex flex-col gap-2">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">
                        DoSW & Principal Clearance {editingEventId ? '(Optional)' : '*'}
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={e => handleFileChange(e, 'doswLetter')}
                        className="font-satoshi text-xs text-[#171e19] file:mr-3 file:py-2 file:px-3 file:rounded-none file:border-2 file:border-[#171e19] file:bg-[#ffe17c] file:text-[#171e19] file:font-bold file:uppercase cursor-pointer file:transition-brutal hover:file:bg-[#ffe17c]/80"
                      />
                      {existingUrls.doswPermissionLetterUrl && (
                        <p className="font-satoshi text-[9px] text-[#ffe17c] font-bold uppercase bg-[#171e19] px-2 py-0.5 self-start">✓ CACHED</p>
                      )}
                      {errors.doswLetter && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.doswLetter}</p>}
                    </div>

                    {/* Council file */}
                    <div className="flex flex-col gap-2">
                      <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">
                        Student Council Clearance {editingEventId ? '(Optional)' : '*'}
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={e => handleFileChange(e, 'councilLetter')}
                        className="font-satoshi text-xs text-[#171e19] file:mr-3 file:py-2 file:px-3 file:rounded-none file:border-2 file:border-[#171e19] file:bg-[#ffe17c] file:text-[#171e19] file:font-bold file:uppercase cursor-pointer file:transition-brutal hover:file:bg-[#ffe17c]/80"
                      />
                      {existingUrls.councilPermissionLetterUrl && (
                        <p className="font-satoshi text-[9px] text-[#ffe17c] font-bold uppercase bg-[#171e19] px-2 py-0.5 self-start">✓ CACHED</p>
                      )}
                      {errors.councilLetter && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.councilLetter}</p>}
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Specific Toggles */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-7 bg-[#ffe17c] border border-[#171e19]" />
                    <h3 className="font-anton text-2xl text-[#171e19] tracking-tight">SPECIFIC CONFIGURATIONS</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column Toggles */}
                    <div className="space-y-4">
                      {/* Toggle 1: Venue permission */}
                      <div className="space-y-3 p-4 bg-white border-2 border-[#171e19] rounded-none">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-satoshi text-xs font-bold text-[#171e19] uppercase tracking-wide">Venue Permission Letter?</p>
                            <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-0.5">Is slot reservation file required?</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.venuePermissionApplicable}
                              onChange={e => setFormData(p => ({ ...p, venuePermissionApplicable: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-12 h-6.5 bg-[#171e19] border-2 border-[#171e19] rounded-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:bg-[#ffe17c] after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#171e19]" />
                          </label>
                        </div>
                        {formData.venuePermissionApplicable && (
                          <div className="pt-3 animate-fade-in flex flex-col gap-1.5 border-t border-[#171e19]/10">
                            <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">
                              Upload booking slip {editingEventId ? '(Optional)' : '*'}
                            </label>
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={e => handleFileChange(e, 'venueLetter')}
                              className="font-satoshi text-xs text-[#171e19] file:mr-2 file:py-1 file:px-2 file:rounded-none file:border-2 file:border-[#171e19] file:bg-[#ffe17c] file:text-[#171e19] file:font-bold file:uppercase cursor-pointer"
                            />
                            {existingUrls.venuePermissionLetterUrl && (
                              <p className="font-satoshi text-[9px] text-[#ffe17c] font-bold uppercase bg-[#171e19] px-2 py-0.5 self-start mt-1">✓ CACHED</p>
                            )}
                            {errors.venueLetter && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.venueLetter}</p>}
                          </div>
                        )}
                      </div>

                      {/* Toggle 2: Prize Money */}
                      <div className="space-y-3 p-4 bg-white border-2 border-[#171e19] rounded-none">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-satoshi text-xs font-bold text-[#171e19] uppercase tracking-wide">Prize Money Involved?</p>
                            <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-0.5">Are cash pools/awards included?</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.prizeMoneyApplicable}
                              onChange={e => setFormData(p => ({ ...p, prizeMoneyApplicable: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-12 h-6.5 bg-[#171e19] border-2 border-[#171e19] rounded-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:bg-[#ffe17c] after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#171e19]" />
                          </label>
                        </div>
                        {formData.prizeMoneyApplicable && (
                          <div className="pt-3 animate-fade-in grid grid-cols-2 gap-3 border-t border-[#171e19]/10">
                            <div className="flex flex-col gap-1">
                              <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">Amount ($) *</label>
                              <input
                                type="number"
                                placeholder="Amount"
                                value={formData.prizeMoneyAmount}
                                onChange={e => setFormData(p => ({ ...p, prizeMoneyAmount: e.target.value }))}
                                className="bg-white border-2 border-[#171e19] rounded-none px-3 py-1.5 text-xs text-[#171e19] focus:outline-none"
                              />
                              {errors.prizeMoneyAmount && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.prizeMoneyAmount}</p>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">Funding Source *</label>
                              <input
                                type="text"
                                placeholder="e.g. SPONSORSHIP"
                                value={formData.prizeMoneySource}
                                onChange={e => setFormData(p => ({ ...p, prizeMoneySource: e.target.value }))}
                                className="bg-white border-2 border-[#171e19] rounded-none px-3 py-1.5 text-xs text-[#171e19] focus:outline-none"
                              />
                              {errors.prizeMoneySource && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.prizeMoneySource}</p>}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Toggle 3: Registration fee */}
                      <div className="space-y-3 p-4 bg-white border-2 border-[#171e19] rounded-none">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-satoshi text-xs font-bold text-[#171e19] uppercase tracking-wide">Registration Fee?</p>
                            <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-0.5">Is ticket price collected?</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.registrationFeeApplicable}
                              onChange={e => setFormData(p => ({ ...p, registrationFeeApplicable: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-12 h-6.5 bg-[#171e19] border-2 border-[#171e19] rounded-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:bg-[#ffe17c] after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#171e19]" />
                          </label>
                        </div>
                        {formData.registrationFeeApplicable && (
                          <div className="pt-3 animate-fade-in flex flex-col gap-1 border-t border-[#171e19]/10">
                            <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">Fee per participant ($) *</label>
                            <input
                              type="number"
                              placeholder="Fee amount"
                              value={formData.registrationFeeAmount}
                              onChange={e => setFormData(p => ({ ...p, registrationFeeAmount: e.target.value }))}
                              className="bg-white border-2 border-[#171e19] rounded-none px-3 py-1.5 text-xs text-[#171e19] focus:outline-none w-1/2"
                            />
                            {errors.registrationFeeAmount && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.registrationFeeAmount}</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column Toggles */}
                    <div className="space-y-4">
                      {/* Toggle 4: Attendance Waiver */}
                      <div className="space-y-3 p-4 bg-white border-2 border-[#171e19] rounded-none">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-satoshi text-xs font-bold text-[#171e19] uppercase tracking-wide">Attendance Leave Waiver?</p>
                            <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-0.5">Do students require duty leaves?</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.attendanceWaiverApplicable}
                              onChange={e => setFormData(p => ({ ...p, attendanceWaiverApplicable: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-12 h-6.5 bg-[#171e19] border-2 border-[#171e19] rounded-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:bg-[#ffe17c] after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#171e19]" />
                          </label>
                        </div>
                        {formData.attendanceWaiverApplicable && (
                          <div className="pt-3 animate-fade-in flex flex-col gap-1.5 border-t border-[#171e19]/10">
                            <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">
                              Upload Waiver request list {editingEventId ? '(Optional)' : '*'}
                            </label>
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={e => handleFileChange(e, 'waiverLetter')}
                              className="font-satoshi text-xs text-[#171e19] file:mr-2 file:py-1 file:px-2 file:rounded-none file:border-2 file:border-[#171e19] file:bg-[#ffe17c] file:text-[#171e19] file:font-bold file:uppercase cursor-pointer"
                            />
                            {existingUrls.attendanceWaiverUrl && (
                              <p className="font-satoshi text-[9px] text-[#ffe17c] font-bold uppercase bg-[#171e19] px-2 py-0.5 self-start mt-1">✓ CACHED</p>
                            )}
                            {errors.waiverLetter && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.waiverLetter}</p>}
                          </div>
                        )}
                      </div>

                      {/* Toggle 5: Guest speaker */}
                      <div className="space-y-3 p-4 bg-white border-2 border-[#171e19] rounded-none">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-satoshi text-xs font-bold text-[#171e19] uppercase tracking-wide">Guest Speakers?</p>
                            <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-0.5">Are external chief guests invited?</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.guestApplicable}
                              onChange={e => setFormData(p => ({ ...p, guestApplicable: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-12 h-6.5 bg-[#171e19] border-2 border-[#171e19] rounded-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:bg-[#ffe17c] after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#171e19]" />
                          </label>
                        </div>
                        {formData.guestApplicable && (
                          <div className="pt-3 animate-fade-in grid grid-cols-2 gap-3 border-t border-[#171e19]/10">
                            <div className="flex flex-col gap-1">
                              <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">Guest Name *</label>
                              <input
                                type="text"
                                placeholder="Guest Name"
                                value={formData.guestName}
                                onChange={e => setFormData(p => ({ ...p, guestName: e.target.value }))}
                                className="bg-white border-2 border-[#171e19] rounded-none px-3 py-1.5 text-xs text-[#171e19] focus:outline-none"
                              />
                              {errors.guestName && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.guestName}</p>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">Designation *</label>
                              <input
                                type="text"
                                placeholder="Affiliation"
                                value={formData.guestDesignation}
                                onChange={e => setFormData(p => ({ ...p, guestDesignation: e.target.value }))}
                                className="bg-white border-2 border-[#171e19] rounded-none px-3 py-1.5 text-xs text-[#171e19] focus:outline-none"
                              />
                              {errors.guestDesignation && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.guestDesignation}</p>}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Toggle 6: External colleges */}
                      <div className="space-y-3 p-4 bg-white border-2 border-[#171e19] rounded-none">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-satoshi text-xs font-bold text-[#171e19] uppercase tracking-wide">External Participants?</p>
                            <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-0.5">Is it open to other colleges?</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.externalParticipantsApplicable}
                              onChange={e => setFormData(p => ({ ...p, externalParticipantsApplicable: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-12 h-6.5 bg-[#171e19] border-2 border-[#171e19] rounded-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:bg-[#ffe17c] after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#171e19]" />
                          </label>
                        </div>
                        {formData.externalParticipantsApplicable && (
                          <div className="pt-3 animate-fade-in flex flex-col gap-1 border-t border-[#171e19]/10">
                            <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">Expected Count *</label>
                            <input
                              type="number"
                              placeholder="Expected count"
                              value={formData.externalParticipantsExpected}
                              onChange={e => setFormData(p => ({ ...p, externalParticipantsExpected: e.target.value }))}
                              className="bg-white border-2 border-[#171e19] rounded-none px-3 py-1.5 text-xs text-[#171e19] focus:outline-none w-1/2"
                            />
                            {errors.externalParticipantsExpected && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.externalParticipantsExpected}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle 7: Safety Arrangements */}
                  <div className="space-y-3 p-4 bg-white border-2 border-[#171e19] rounded-none w-full mt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-satoshi text-xs font-bold text-[#171e19] uppercase tracking-wide">Barricading / Safety Arrangements?</p>
                        <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-0.5">Are guards, first-aid, or control barricades required?</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.safetyArrangementNeeded}
                          onChange={e => setFormData(p => ({ ...p, safetyArrangementNeeded: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6.5 bg-[#171e19] border-2 border-[#171e19] rounded-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:bg-[#ffe17c] after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#171e19]" />
                      </label>
                    </div>
                    {formData.safetyArrangementNeeded && (
                      <div className="pt-3 animate-fade-in flex flex-col gap-1 border-t border-[#171e19]/10">
                        <label className="font-satoshi text-[9px] font-bold uppercase tracking-wider text-[#b7c6c2]">Arrangement Details *</label>
                        <textarea
                          rows="2"
                          placeholder="Provide custom safety details..."
                          value={formData.safetyArrangementDetails}
                          onChange={e => setFormData(p => ({ ...p, safetyArrangementDetails: e.target.value }))}
                          className="bg-white border-2 border-[#171e19] rounded-none px-3 py-2 text-xs text-[#171e19] focus:outline-none resize-none"
                        />
                        {errors.safetyArrangementDetails && <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide">{errors.safetyArrangementDetails}</p>}
                      </div>
                    )}
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
                      className={`bg-white border-2 border-[#171e19] transition-brutal cursor-pointer rounded-none overflow-hidden ${
                        isExpanded ? 'shadow-[4px_4px_0px_0px_#ffe17c]' : 'hover:shadow-[4px_4px_0px_0px_#171e19]'
                      }`}
                    >
                      {/* Summary Header */}
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-anton text-xl text-[#171e19] tracking-tight">
                              {event.jointWith ? `${event.eventName.toUpperCase()} (${council.name.toUpperCase()} x ${event.jointWith.toUpperCase()})` : event.eventName.toUpperCase()}
                            </h3>
                            
                            {/* Signature Element Event ID */}
                            <span className="font-satoshi text-[10px] font-bold tracking-widest border border-[#171e19] px-2 py-0.5 bg-white text-[#171e19] shrink-0">
                              {event.eventId}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-5 gap-y-1 font-satoshi text-xs text-[#b7c6c2] font-semibold uppercase tracking-wider">
                            <span>📅 START: {formatEventDate(event.startDate)}</span>
                            <span>📍 VENUE: {event.venue.toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Color Badge Pill */}
                          <span className={statusInfo.colorClass}>
                            {statusInfo.label}
                          </span>
                          
                          {statusInfo.isReportPending && (
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setReportingEvent(event);
                                  setReportPdf(null);
                                  setReportImages([]);
                                  setActiveTab('report');
                              }}
                              className="px-4 py-2 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                            >
                              Submit Report
                            </button>
                          )}

                          {event.status === 'revision_needed' && (
                            <button
                              onClick={(e) => handleEditClick(event, e)}
                              className="px-4 py-2 bg-[#ffe17c] border-2 border-[#171e19] text-[#171e19] font-anton text-xs uppercase tracking-wider transition-brutal rounded-none"
                            >
                              Edit & Resubmit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <div className="px-5 pb-6 pt-4 border-t-2 border-[#171e19] bg-[#b7c6c2]/5 space-y-5 text-xs text-[#171e19]/90 font-satoshi">
                          {/* Logistical Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-[#171e19]/10 p-4 rounded-none">
                            <div>
                              <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] tracking-wide mb-1">Faculty Coordinator</span>
                              <span className="font-bold">{event.facultyCoordinatorName.toUpperCase()}</span>
                            </div>
                            <div>
                              <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] tracking-wide mb-1">Student Lead</span>
                              <span className="font-bold">{event.studentContactName.toUpperCase()}</span>
                            </div>
                            <div>
                              <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] tracking-wide mb-1">Student Contact</span>
                              <span className="font-semibold">{event.studentContactPhone}</span>
                            </div>
                            <div>
                              <span className="font-bold text-[#b7c6c2] uppercase block text-[9px] tracking-wide mb-1">Expected Footfall</span>
                              <span className="font-bold">{event.expectedFootfall} ATTENDEES</span>
                            </div>
                          </div>

                          {/* Documents grid */}
                          <div className="space-y-2">
                            <span className="font-bold text-[#b7c6c2] uppercase tracking-wider block text-[9px]">Clearance Documents</span>
                            <div className="flex flex-wrap gap-4 font-bold text-xs uppercase">
                              <a href={event.eventDescriptionUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-2.5 py-1.5 transition-brutal">
                                📄 PROPOSAL SUMMARY PDF
                              </a>
                              <a href={event.doswPermissionLetterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-2.5 py-1.5 transition-brutal">
                                📄 DOSW CLEARANCE PDF
                              </a>
                              <a href={event.councilPermissionLetterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-2.5 py-1.5 transition-brutal">
                                📄 COUNCIL APPROVAL PDF
                              </a>
                              {event.venuePermissionLetterUrl && (
                                <a href={event.venuePermissionLetterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-2.5 py-1.5 transition-brutal">
                                  📄 VENUE BOOKING SLIP PDF
                                </a>
                              )}
                              {event.attendanceWaiverUrl && (
                                <a href={event.attendanceWaiverUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#171e19] hover:text-[#ffe17c] hover:bg-[#171e19] border border-[#171e19] px-2.5 py-1.5 transition-brutal">
                                  📄 WAIVER ATTENDANCE PDF
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Toggle specifics details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-semibold uppercase text-[10px] tracking-wider text-[#171e19]">
                            {/* Left parameters */}
                            <div className="space-y-1">
                              {event.prizeMoneyApplicable && (
                                <p>💵 <span className="text-[#b7c6c2]">Prize Pool:</span> ${event.prizeMoneyAmount} funded via <em>{event.prizeMoneySource.toUpperCase()}</em></p>
                              )}
                              {event.registrationFeeApplicable && (
                                <p>🎟️ <span className="text-[#b7c6c2]">Registration Fee:</span> ${event.registrationFeeAmount} per participant</p>
                              )}
                              {event.guestApplicable && (
                                <p>👤 <span className="text-[#b7c6c2]">Chief Guest:</span> {event.guestName.toUpperCase()} ({event.guestDesignation.toUpperCase()})</p>
                              )}
                            </div>

                            {/* Right parameters */}
                            <div className="space-y-1">
                              {event.externalParticipantsApplicable && (
                                <p>🌍 <span className="text-[#b7c6c2]">Externals Expected:</span> {event.externalParticipantsExpected} students</p>
                              )}
                              {event.resourcesNeeded && (
                                <p>🛠️ <span className="text-[#b7c6c2]">Resources:</span> "{event.resourcesNeeded.toUpperCase()}"</p>
                              )}
                            </div>
                          </div>

                          {/* Safety arrangements */}
                          {event.safetyArrangementNeeded && (
                            <div className="space-y-1 border-t border-[#171e19]/10 pt-3">
                              <span className="font-bold text-red-500 uppercase block text-[9px] tracking-wide mb-1">Safety & Crowd Control Plan</span>
                              <p className="italic text-[#171e19]/80 leading-relaxed">"{event.safetyArrangementDetails.toUpperCase()}"</p>
                            </div>
                          )}

                          {/* Review Notes (rejections or revisions) */}
                          {event.reviewNotes && (event.status === 'rejected' || event.status === 'revision_needed') && (
                            <div className="space-y-1 border-t-2 border-dashed border-[#171e19] pt-3 bg-red-50/50 p-3">
                              <span className="font-bold text-red-600 uppercase tracking-widest block text-[9px] mb-1">Administrative Revision Guidelines</span>
                              <p className="italic text-[#171e19] leading-relaxed">"{event.reviewNotes}"</p>
                            </div>
                          )}

                          {/* Closed details */}
                          {event.status === 'closed' && event.reportPdfUrl && (
                            <div className="space-y-2 border-t border-[#171e19]/10 pt-3 bg-[#ffe17c]/5 p-3">
                              <span className="font-bold text-[#171e19] uppercase text-[9px] tracking-wide block">Archived Event Wrap-up Summary</span>
                              <div className="flex flex-wrap gap-4 items-center uppercase font-bold text-xs">
                                <a href={event.reportPdfUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#171e19] hover:underline">
                                  📄 Download final PDF Report
                                </a>
                                {event.reportImageUrls && event.reportImageUrls.length > 0 && (
                                  <span className="text-[10px] text-[#b7c6c2]">📷 Images Uploaded: {event.reportImageUrls.length}</span>
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
                <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Upload Final Report PDF *</label>
                <input
                  type="file"
                  required
                  accept="application/pdf"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        showNotification('Report file exceeds 10MB.', 'error');
                        e.target.value = null;
                        return;
                      }
                      setReportPdf(file);
                    }
                  }}
                  className="font-satoshi text-xs text-[#171e19] file:mr-3 file:py-2 file:px-3 file:rounded-none file:border-2 file:border-[#171e19] file:bg-[#ffe17c] file:text-[#171e19] file:font-bold file:uppercase cursor-pointer"
                />
                <p className="font-satoshi text-[10px] text-[#b7c6c2] font-semibold uppercase mt-1">
                  <strong>Note:</strong> This single PDF must cover: actual attendance/turnout figures, expense summaries, any incidents/issues, and notes/learnings from the event.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">Attach Event Photos (At least 1 required) *</label>
                <input
                  type="file"
                  multiple
                  required
                  accept="image/*"
                  onChange={e => {
                    const selectedFiles = Array.from(e.target.files);
                    const filtered = selectedFiles.filter(file => {
                      if (file.size > 10 * 1024 * 1024) {
                        showNotification(`Image ${file.name} is too large (>10MB).`, 'error');
                        return false;
                      }
                      return true;
                    });
                    setReportImages(filtered);
                  }}
                  className="font-satoshi text-xs text-[#171e19] file:mr-3 file:py-2 file:px-3 file:rounded-none file:border-2 file:border-[#171e19] file:bg-[#ffe17c] file:text-[#171e19] file:font-bold file:uppercase cursor-pointer"
                />
                {reportImages.length > 0 && (
                  <p className="font-satoshi text-xs text-[#171e19] font-bold uppercase mt-1">
                    Selected {reportImages.length} images for upload.
                  </p>
                )}
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
      </div>
    </div>
  );
}
