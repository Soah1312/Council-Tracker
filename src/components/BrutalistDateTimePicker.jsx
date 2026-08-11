import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { IconCalendar } from '../lib/icons';

export default function BrutalistDateTimePicker({ label, value, onChange, isDateBlocked, timeOptions: customTimeOptions, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Is this an end-date picker?
  const isEndPicker = label?.toLowerCase().includes('end');

  // Generate default 30-min interval slots + Full Day option
  const defaultTimeOptions = useMemo(() => {
    const fullDayValue = isEndPicker ? '23:59' : '00:00';
    const slots = [
      { label: '☀️ FULL DAY (ALL DAY)', value: fullDayValue }
    ];
    for (let h = 7; h <= 23; h++) {
      const hr12 = h % 12 === 0 ? 12 : h % 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      slots.push({ label: `${String(hr12).padStart(2, '0')}:00 ${ampm}`, value: `${String(h).padStart(2, '0')}:00` });
      slots.push({ label: `${String(hr12).padStart(2, '0')}:30 ${ampm}`, value: `${String(h).padStart(2, '0')}:30` });
    }
    return slots;
  }, [isEndPicker]);

  const timeSlots = customTimeOptions || defaultTimeOptions;

  // Split ISO string value into date and time
  const parts = value ? String(value).split('T') : ['', ''];
  const dateStr = parts[0] || '';
  const timeStr = parts[1] || (isEndPicker ? '17:00' : '09:00');

  const isFullDay = timeStr === '00:00' || timeStr === '23:59' || timeStr === 'FULL_DAY';

  const [calMonth, setCalMonth] = useState(() => {
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDateSelect = (dayObj) => {
    const y = dayObj.getFullYear();
    const m = String(dayObj.getMonth() + 1).padStart(2, '0');
    const d = String(dayObj.getDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${d}`;
    const targetTime = isFullDay ? (isEndPicker ? '23:59' : '00:00') : (timeStr || (isEndPicker ? '17:00' : '09:00'));
    const newCombined = `${newDateStr}T${targetTime}`;
    onChange(newCombined);
    setIsOpen(false);
  };

  const handleTimeSelect = (newTimeStr) => {
    const targetDate = dateStr || (() => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();
    onChange(`${targetDate}T${newTimeStr}`);
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={popoverRef}>
      {label && (
        <label className="font-satoshi text-[10px] font-bold uppercase tracking-wider text-[#b7c6c2]">
          {label}
        </label>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Date Selector Button */}
        <button
          type="button"
          onClick={() => {
            if (dateStr) {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) setCalMonth(d);
            }
            setIsOpen(prev => !prev);
          }}
          className={`w-full bg-white border-2 ${error ? 'border-red-500 bg-red-50/20' : 'border-[#171e19] focus:border-[#ffe17c]'} px-3 py-2 text-xs font-bold text-[#171e19] focus:outline-none rounded-none transition-brutal flex items-center justify-between font-satoshi uppercase shrink-0 cursor-pointer`}
        >
          <span className="truncate">
            {dateStr ? format(new Date(dateStr), 'MMM dd, yyyy') : 'SELECT DATE'}
          </span>
          <IconCalendar className="w-4 h-4 text-[#171e19] shrink-0 ml-1" />
        </button>

        {/* Time Selector Dropdown */}
        <select
          value={isFullDay ? (isEndPicker ? '23:59' : '00:00') : (timeStr || '09:00')}
          onChange={(e) => handleTimeSelect(e.target.value)}
          className={`w-full bg-white border-2 ${error ? 'border-red-500 bg-red-50/20' : 'border-[#171e19] focus:border-[#ffe17c]'} px-3 py-2 text-xs font-bold focus:outline-none rounded-none transition-brutal font-satoshi uppercase cursor-pointer ${
            isFullDay ? 'bg-[#ffe17c]/30 text-[#171e19]' : 'text-[#171e19]'
          }`}
        >
          {timeSlots.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Brutalist Calendar Popover */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-2 left-0 w-64 bg-white border-2 border-[#171e19] shadow-[4px_4px_0px_0px_#171e19] p-3 animate-fade-in">
          <div className="flex items-center justify-between border-b-2 border-[#171e19] pb-2 mb-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1));
              }}
              className="w-6 h-6 border-2 border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-xs rounded-none transition-brutal cursor-pointer"
            >
              &larr;
            </button>
            <span className="font-anton text-xs uppercase tracking-wider text-[#171e19]">
              {format(calMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1));
              }}
              className="w-6 h-6 border-2 border-[#171e19] hover:bg-[#ffe17c] flex items-center justify-center font-bold text-xs rounded-none transition-brutal cursor-pointer"
            >
              &rarr;
            </button>
          </div>

          <div className="grid grid-cols-7 text-center font-bold text-[9px] uppercase tracking-wider text-[#b7c6c2] mb-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => <div key={idx}>{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-satoshi text-xs font-bold">
            {(() => {
              const year = calMonth.getFullYear();
              const month = calMonth.getMonth();
              const firstDay = new Date(year, month, 1);
              const startWeekDay = firstDay.getDay();
              const totalDays = new Date(year, month + 1, 0).getDate();

              const dayButtons = [];
              for (let i = 0; i < startWeekDay; i++) {
                dayButtons.push(<div key={`pad-${i}`} className="h-6" />);
              }

              for (let i = 1; i <= totalDays; i++) {
                const currentDayObj = new Date(year, month, i);
                const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const isSelected = dateStr === currentDayStr;
                const isToday = currentDayObj.toDateString() === new Date().toDateString();
                const blocked = isDateBlocked ? isDateBlocked(currentDayObj) : null;

                dayButtons.push(
                  <button
                    type="button"
                    key={`day-${i}`}
                    disabled={!!blocked}
                    title={blocked ? `BLOCKED BY ADMIN: ${blocked.reason}` : undefined}
                    onClick={(e) => {
                      if (blocked) return;
                      e.stopPropagation();
                      handleDateSelect(currentDayObj);
                    }}
                    className={`h-6 w-full flex items-center justify-center transition-all rounded-none border-2 cursor-pointer ${
                      blocked
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
      {error && (
        <p className="font-satoshi text-[10px] text-red-500 font-bold uppercase tracking-wide mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
