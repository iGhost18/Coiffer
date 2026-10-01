import { useEffect, useMemo, useState } from "react";
import api from "../../api"; // Adjust the import path as needed
import './dateAndTime.css';

// Services store duration as free text ("30 mins", "1 hr", "1 hr 30 mins"),
// occasionally as a bare number of minutes. Normalize it once so the rest
// of the component only ever deals with an integer.
function parseDurationToMinutes(duration) {
    if (!duration) return 30;
    if (typeof duration === "number") return duration;

    const str = String(duration).toLowerCase();
    const hourMatch = str.match(/(\d+)\s*(?:hr|hour)/);
    const minMatch = str.match(/(\d+)\s*(?:min)/);

    let minutes = 0;
    if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);

    if (!hourMatch && !minMatch) {
        const bareNumber = parseInt(str, 10);
        if (!isNaN(bareNumber)) minutes = bareNumber;
    }

    return minutes || 30;
}

// Build a "YYYY-MM-DD" string from the date's LOCAL components — never
// use toISOString() for this, since it converts to UTC first and can
// shift the date by a day depending on the user's timezone offset.
function toLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Display-only: "13:00" -> "1:00 PM". The value passed to setSelectedTime
// and the backend stays the 24hr string — this only changes what's rendered.
function formatTo12Hour(time24) {
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function TimeSlots({
    selectedDate,
    selectedTime,
    setSelectedTime,
    staffId,
    serviceId,
    duration, // e.g. "30 mins", "1 hr", or already-parsed minutes
    refreshKey,
}) {

    const [timeSlots, setTimeSlots] = useState([]);
    const [exactNextAvailable, setExactNextAvailable] = useState(null);
    const [loading, setLoading] = useState(false);
    

    const durationMinutes = useMemo(
        () => parseDurationToMinutes(duration),
        [duration]
    );

    useEffect(() => {

        if (!selectedDate || !staffId || !serviceId) {
            setTimeSlots([]);
            setExactNextAvailable(null);
            return;
        }

        const loadSlots = async () => {

            try {

                setLoading(true);

                const res = await api.get(
                    "/api/booking/available-slots",
                    {
                        params: {
                            staffId,
                            serviceId,
                            date: toLocalDateString(selectedDate),
                            duration: durationMinutes,
                        },
                    }
                );

                setTimeSlots(res.data.slots || []);
                setExactNextAvailable(res.data.exactNextAvailable || null);

            } catch (err) {
                console.log(err);
                setTimeSlots([]);
                setExactNextAvailable(null);
            } finally {
                setLoading(false);
            }

        };

        loadSlots();

    }, [selectedDate, staffId, serviceId, durationMinutes, refreshKey]);

    return (

        <div className="TimeSlotsSection">

            {selectedDate && (
                <p className="SelectedDateLabel">
                    {formatSelectedDate(selectedDate)}
                </p>
            )}

            {loading && (
                <p>Loading available times...</p>
            )}

            {!loading && exactNextAvailable && (
                <button
                    type="button"
                    className="NextAvailableBanner"
                    onClick={() => setSelectedTime(exactNextAvailable)}
                >
                    <span className="NextAvailableLabel">Next available</span>
                    <span className="NextAvailableTime">{formatTo12Hour(exactNextAvailable)}</span>
                    <span className="NextAvailableDuration">({durationMinutes} min)</span>
                </button>
            )}

            {!loading && selectedDate && timeSlots.length > 0 && !exactNextAvailable && (
                <p className="NoSlotsMessage">
                    No slots long enough for this service on this day.
                </p>
            )}

            <div className="TimeGrid">

                {timeSlots.map((slot) => (

                    <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`TimeSlot
                            ${selectedTime === slot.time ? "active" : ""}
                            ${!slot.available ? "disabled" : ""}
                            ${exactNextAvailable && slot.time === exactNextAvailable ? "nextAvailable" : ""}
                            ${slot.reason}
                        `}
                    >

                        {formatTo12Hour(slot.time)}

                    </button>

                ))}

            </div>

        </div>

    );

}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatSelectedDate(date) {
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
}

export function DatePicker({ selectedDate, setSelectedDate }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isPast = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getFullYear() === viewYear;
  };

  const isToday = (day) => {
    return today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear;
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="CalendarWrapper">
      <div className="CalendarHeader">
        <span className="CalendarMonthTitle">{MONTHS[viewMonth]} {viewYear}</span>
        <div className="CalendarNavBtns">
          <button type='button' className="NavBtn" onClick={prevMonth}>&#8249;</button>
          <button type='button' className="NavBtn" onClick={nextMonth}>&#8250;</button>
        </div>
      </div>

      <div className="CalendarGrid">
        {DAYS.map(d => (
          <span key={d} className={`DayLabel ${d === 'Sun' ? 'sunday' : ''}`}>{d}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const past = isPast(day);
          const selected = isSelected(day);
          const todayDay = isToday(day);
          const col = (i % 7);
          const isSun = col === 0;
          return (
            <button
              type='button'
              key={day}
              disabled={past}
              onClick={() => setSelectedDate(new Date(viewYear, viewMonth, day))}
              className={[
                'DayCell',
                selected ? 'selected' : '',
                past ? 'past' : '',
                isSun && !selected ? 'sunday' : '',
                todayDay && !selected ? 'today' : '',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}