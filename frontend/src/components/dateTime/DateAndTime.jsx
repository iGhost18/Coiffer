import { useEffect, useState } from "react";
import api from "../../api"; // Adjust the import path as needed
import './dateAndTime.css';

export function TimeSlots({
    selectedDate,
    selectedTime,
    setSelectedTime,
    staffId,
    serviceId,
}) {

    const [timeSlots, setTimeSlots] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {

        if (!selectedDate || !staffId || !serviceId) {
            setTimeSlots([]);
            return;
        }

        const loadSlots = async () => {

            try {

                setLoading(true);
                console.log({
                  selectedDate,
                  staffId,
                  serviceId,
                });

                const res = await api.get(
                    "/api/booking/available-slots",
                    {
                        params: {
                            staffId,
                            serviceId,
                            date: selectedDate.toISOString().split("T")[0],
                        },
                    }
                );
                console.log(res.data);
                setTimeSlots(res.data);

            } catch (err) {
                console.log(err);
            } finally {
                setLoading(false);
            }

        };

        loadSlots();

    }, [selectedDate, staffId, serviceId]);

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
                            ${slot.reason}
                        `}
                    >

                        {slot.time}

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


