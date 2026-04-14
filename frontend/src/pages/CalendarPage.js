import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const PRIORITY_STYLES = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-slate-300',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getTasksForDate = (dateStr) => tasks.filter(t => t.due_date?.startsWith(dateStr));

  const formatDateStr = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const selectedDateStr = selectedDate ? formatDateStr(selectedDate) : null;
  const selectedTasks = selectedDateStr ? getTasksForDate(selectedDateStr) : [];

  const toggleComplete = async (task) => {
    await api.put(`/tasks/${task.id}`, { completed: !task.completed });
    fetchTasks();
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5" data-testid="calendar-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">View tasks and follow-ups by date</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-sm p-5" data-testid="calendar-grid">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={prevMonth} data-testid="calendar-prev-month"><ChevronLeft className="w-4 h-4" /></Button>
            <h2 className="text-lg font-semibold text-slate-900">{MONTHS[month]} {year}</h2>
            <Button variant="ghost" size="sm" onClick={nextMonth} data-testid="calendar-next-month"><ChevronRight className="w-4 h-4" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
            {DAYS.map(d => (
              <div key={d} className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="bg-white min-h-[80px] sm:min-h-[100px]" />;
              const dateStr = formatDateStr(day);
              const dayTasks = getTasksForDate(dateStr);
              const isToday = dateStr === today;
              const isSelected = day === selectedDate;
              const hasOverdue = dayTasks.some(t => !t.completed && dateStr < today);

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                  className={`bg-white min-h-[80px] sm:min-h-[100px] p-1.5 text-left hover:bg-slate-50 transition-colors relative ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                  data-testid={`calendar-day-${day}`}
                >
                  <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-700'}`}>{day}</span>
                  {dayTasks.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayTasks.slice(0, 3).map((t, idx) => (
                        <div key={idx} className={`text-xs px-1 py-0.5 rounded truncate ${t.completed ? 'bg-green-100 text-green-700 line-through' : hasOverdue && !t.completed ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.title.length > 15 ? t.title.slice(0, 15) + '...' : t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && <div className="text-xs text-slate-400 px-1">+{dayTasks.length - 3} more</div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Selected date tasks or upcoming */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5" data-testid="calendar-sidebar">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {selectedDateStr ? new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Upcoming Tasks'}
          </h3>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {(selectedDateStr ? selectedTasks : tasks.filter(t => !t.completed).slice(0, 15)).map(task => (
                <div
                  key={task.id}
                  className={`flex items-start gap-2 p-3 border border-slate-200 rounded-lg border-l-4 ${PRIORITY_STYLES[task.priority] || 'border-l-slate-200'} ${task.completed ? 'opacity-50' : ''}`}
                  data-testid={`calendar-task-${task.id}`}
                >
                  <button onClick={() => toggleComplete(task)} className="mt-0.5 flex-shrink-0">
                    {task.completed ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-300 hover:text-slate-500" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.due_date && <span className="text-xs text-slate-500 flex items-center gap-0.5"><Clock className="w-3 h-3" /> {new Date(task.due_date).toLocaleDateString()}</span>}
                      <Badge className={`text-xs ${task.priority === 'high' ? 'bg-red-100 text-red-800' : task.priority === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{task.priority}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {(selectedDateStr ? selectedTasks : tasks.filter(t => !t.completed)).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">{selectedDateStr ? 'No tasks on this date.' : 'No upcoming tasks.'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
