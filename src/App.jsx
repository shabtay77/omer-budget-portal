import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  LayoutDashboard, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users,
  Megaphone, TableProperties, ShieldAlert, CheckCircle2, Clock, AlertTriangle,
  HelpCircle, Save, Menu, X, Loader2, MessageSquare, History, MinusCircle,
  Download, ChevronDown, Filter, Search, TrendingUp, TrendingDown,
  Target, ArrowUp, ArrowDown, ArrowUpDown, RefreshCw, Upload, FileSpreadsheet, SkipForward, ClipboardList, LogOut,
  Phone, Plus, ChevronRight, ImagePlus, ExternalLink, UserCheck
} from 'lucide-react';

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2Y4QkJxnqapKne4Q5TSAC5ZVBE1oPjKYKRKE1MFqiDfxSBZdWJQgbFnJbKz_H98q6WvS6NtKKjHM2/pub?output=csv";
const GAS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzPjDK_Enpt5dqW_soJrxs9y6fU5-cKMqsKzNJNouXvNxGnI8Xrxl9nGL51mG3smACV2A/exec";
const CACHE_KEY = 'omer_portal_v3';
const SESSION_KEY = 'omer_session_v1';
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 שעות

const QUARTER_LOCK_DATES = {
  1: new Date('2026-05-05T00:00:00'),
  2: new Date('2026-08-05T00:00:00'),
  3: new Date('2026-11-05T00:00:00'),
  4: new Date('2027-02-05T00:00:00'),
};
// תחילת חלון התזכורת = יום ראשון אחרי סוף כל רבעון
const QUARTER_REMINDER_START = {
  1: new Date('2026-04-01T00:00:00'),
  2: new Date('2026-07-01T00:00:00'),
  3: new Date('2026-10-01T00:00:00'),
  4: new Date('2027-01-01T00:00:00'),
};
const isQuarterLocked = (q) => !!QUARTER_LOCK_DATES[q] && new Date() >= QUARTER_LOCK_DATES[q];
const QUARTER_LOCK_LABEL = { 1: '5/5/2026', 2: '5/8/2026', 3: '5/11/2026', 4: '5/2/2027' };
const getActiveReminderQuarter = () => {
  const now = new Date();
  for (const q of [1, 2, 3, 4]) {
    if (now >= QUARTER_REMINDER_START[q] && now < QUARTER_LOCK_DATES[q]) return Number(q);
  }
  return null;
};

const ICONS = {
  'ראש הרשות': UserRound,
  'הנהלה': Building2,
  'גזברות': Wallet,
  'הנדסה': HardHat,
  'חינוך': GraduationCap,
  'שפ"ה': Truck,
  'מרכז קהילתי': Users,
  'הון אנושי': Users,
  'שירות לתושב ודוברות': Megaphone,
  'פארק הייטק ועסקים': Building2
};

const STATUS_CONFIG = {
  1: { label: "בוצע", color: "#10b981", bg: "bg-emerald-50", hoverBg: "hover:bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  2: { label: "עיכוב", color: "#f59e0b", bg: "bg-amber-50", hoverBg: "hover:bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  3: { label: "עצירה", color: "#ef4444", bg: "bg-red-50", hoverBg: "hover:bg-red-100", text: "text-red-700", border: "border-red-200" },
  4: { label: "ממתין", color: "#94a3b8", bg: "bg-slate-100", hoverBg: "hover:bg-slate-200", text: "text-slate-600", border: "border-slate-200" }
};

const PIE_COLORS = ['#0d9488', '#0284c7', '#6366f1', '#ea580c', '#e11d48', '#475569', '#16a34a'];

const formatDate = (val) => {
  if (!val) return "-";
  if (String(val).includes('/')) return val;
  const serial = parseFloat(val);
  if (isNaN(serial)) return val;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const parseDateLogic = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  // DD/MM/YYYY or DD.MM.YYYY (Hebrew locale uses dots)
  if (/^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4}$/.test(s)) {
    const parts = s.split(/[\/\.]/);
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  // Excel serial number (pure integer > 1000 only, to avoid confusing short strings)
  if (/^\d+$/.test(s)) {
    const serial = Number(s);
    if (serial > 1000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  return null;
};

const formatILS = (val) => {
  const absVal = Math.abs(val || 0);
  const formatted = new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(absVal);
  return (val || 0) < 0 ? `-${formatted}` : formatted;
};

const cleanStr = (s) => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/[״”״]/g, '"')   
    .replace(/''+/g, '"')     
    .replace(/"{2,}/g, '"')   
    .trim();
};

const normalizeKey = (s) =>
  cleanStr(s).replace(/["'`]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').toLowerCase();

const sameKey = (a, b) => normalizeKey(a) === normalizeKey(b);

const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val || val === "") return 0;
  
  let str = String(val).trim();
  // זיהוי מספר שלילי (למקרה שהאקסל מייצא מינוס או סוגריים חשבונאיים)
  const isNegative = str.includes('-') || (str.includes('(') && str.includes(')'));
  
  // מסיר הכל חוץ מספרות ונקודה עשרונית (מעיף ₪, פסיקים, רווחים וכו')
  str = str.replace(/[^\d.]/g, '');
  
  let n = parseFloat(str);
  if (isNaN(n)) return 0;
  
  return isNegative ? -Math.abs(n) : Math.abs(n);
};

const getOverallRating = (task) => {
  if ([1, 2, 3, 4].includes(task.q4)) return task.q4;
  if ([1, 2, 3, 4].includes(task.q3)) return task.q3;
  if ([1, 2, 3, 4].includes(task.q2)) return task.q2;
  if ([1, 2, 3, 4].includes(task.q1)) return task.q1;
  return null;
};

const isTaskOverdue = (t, quarter) => {
  const taskDate = parseDateLogic(t.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!taskDate || taskDate >= today) return false;
  // אם הוזן עדכון "בוצע" בכל רבעון שהוא — המשימה אינה בחריגה
  if ([t.q1, t.q2, t.q3, t.q4].includes(1)) return false;
  return true;
};

const ensureOk = async (res, label = "Request") => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${label} failed: ${res.status} ${text}`);
  }
  return res;
};

const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"'; i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
};

const csvEscape = (value) => {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const downloadCsv = (rows, filename) => {
  const csv = '\uFEFF' + rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function StatusDropdown({ value, onChange, open, setOpen }) {
  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all border ${
          value ? `${STATUS_CONFIG[value].bg} ${STATUS_CONFIG[value].text} ${STATUS_CONFIG[value].border}` : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <span>{value ? STATUS_CONFIG[value].label : 'בחר סטטוס'}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[100] mt-1.5 w-full bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 p-1.5 space-y-0.5">
          {Object.entries(STATUS_CONFIG).map(([v, c]) => {
            const isSelected = value === parseInt(v);
            return (
              <button
                key={v}
                onClick={() => onChange(parseInt(v, 10))}
                className={`w-full text-right px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                  isSelected 
                    ? `${c.bg} ${c.text} border ${c.border}` 
                    : `bg-transparent ${c.text} ${c.hoverBg} border border-transparent`
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: c.color }}></div>
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const StatCard = ({ title, value, subtext, icon: Icon, isHighlight, progress }) => (
  <div className={`p-5 rounded-2xl border transition-all duration-300 hover:shadow-md relative overflow-hidden group flex flex-col justify-center min-h-[110px] ${isHighlight ? 'bg-emerald-900 border-emerald-800 text-white shadow-emerald-900/20' : 'bg-white border-slate-200 shadow-sm'}`}>
    {Icon && (
      <div className={`absolute -left-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 pointer-events-none`}>
        <Icon size={120} />
      </div>
    )}
    <div className="relative z-10">
      <div className="flex justify-between items-start mb-2">
        <p className={`text-[11px] font-bold tracking-wide uppercase ${isHighlight ? 'text-emerald-100' : 'text-slate-500'}`}>{title}</p>
        {Icon && <div className={`p-1.5 rounded-lg ${isHighlight ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-50 text-slate-400'}`}><Icon size={14} /></div>}
      </div>
      <p className={`text-2xl lg:text-3xl font-black ${isHighlight ? 'text-white' : 'text-slate-800'}`}>{value}</p>
      {subtext && <p className={`text-xs mt-1 font-medium ${isHighlight ? 'text-emerald-200/80' : 'text-slate-400'}`}>{subtext}</p>}
      {progress !== undefined && (
        <div className="mt-3">
          <div className={`w-full h-1.5 rounded-full ${isHighlight ? 'bg-emerald-800' : 'bg-slate-100'}`}>
            <div
              className={`h-1.5 rounded-full transition-all duration-700 ${progress > 90 ? 'bg-red-400' : progress > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className={`text-[10px] font-bold mt-1 ${isHighlight ? 'text-emerald-200' : progress > 90 ? 'text-red-500' : 'text-slate-400'}`}>{progress}% מהתקציב</p>
        </div>
      )}
    </div>
  </div>
);

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uInput, setUInput] = useState("");
  const [pInput, setPInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [staticData, setStaticData] = useState([]);
  const [workPlans, setWorkPlans] = useState([]);
  const [executionMap, setExecutionMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const [pendingChanges, setPendingChanges] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error'|'saving' }
  const toastTimerRef = useRef(null);
  const showToast = (msg, type = 'success', duration = 3000) => {
    clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    if (type !== 'saving') {
      toastTimerRef.current = setTimeout(() => setToast(null), duration);
    }
  };

  const [mainTab, setMainTab] = useState('budget');
  const [viewMode, setViewMode] = useState('dashboard');
  const [activeWingId, setActiveWingId] = useState(null);

  const [workplanQuarter, setWorkplanQuarter] = useState(0);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('הכל');
  const [sortOrder, setSortOrder] = useState('default');
  const [activePopup, setActivePopup] = useState(null);
  const [popupCount, setPopupCount] = useState(0);
  const [showQuarterPicker, setShowQuarterPicker] = useState(false);
  const [showOnlyOverdueTasks, setShowOnlyOverdueTasks] = useState(false);
  const [filterStatus, setFilterStatus] = useState(null);
  const [showOnlyBudgetAlerts, setShowOnlyBudgetAlerts] = useState(false);
  const [hasSeenWorkplanPopup, setHasSeenWorkplanPopup] = useState(false);
  const [hasSeenBudgetPopup, setHasSeenBudgetPopup] = useState(false);
  const [quarterUpdateReminder, setQuarterUpdateReminder] = useState(null); // { quarter, count, daysLeft }
  const [hasSeenQuarterReminder, setHasSeenQuarterReminder] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());

  const [budgetSearch, setBudgetSearch] = useState('');
  const [budgetFilterDept, setBudgetFilterDept] = useState('הכל');
  const [budgetTypeFilter, setBudgetTypeFilter] = useState('הכל');
  const [budgetVisibleColumns, setBudgetVisibleColumns] = useState({
    a2024: false, b2025: false, b2026: true, a2026: false, commitTotal2026: false
  });
  const [controlCompareBy, setControlCompareBy] = useState('a2026');

  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // שים לב שהוספתי את ה-email: ''
  const [userForm, setUserForm] = useState({ username: '', password: '', email: '', role: 'WING', permissions: 'EDIT', addUser: '', target1: '', target2: '', active: 'TRUE', complaintsRole: '' });
  const [openStatusMenuId, setOpenStatusMenuId] = useState(null);

  // Upload wizard state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState('drop'); // drop | unknowns-warning | unknowns-review | uploading | post-validation | done
  const [uploadRows, setUploadRows] = useState([]);        // all parsed rows from file
  const [uploadUnknowns, setUploadUnknowns] = useState([]); // indices of rows not in staticData
  const [uploadUnknownIdx, setUploadUnknownIdx] = useState(0);
  const [uploadCorrections, setUploadCorrections] = useState({}); // {rowIndex: {targetId, a2026, commit, skip}}
  const [uploadSearch, setUploadSearch] = useState('');
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploadCurrentEdit, setUploadCurrentEdit] = useState({ a2026: '', commit: '' });
  const [uploadValidation, setUploadValidation] = useState(null); // תוצאות בדיקה אחרי הטעינה
  const uploadFileRef = useRef(null);

  // Complaints module state
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsView, setComplaintsView] = useState('list'); // 'list' | 'form'
  const [complaintForm, setComplaintForm] = useState({ date: '', address: '', landmark: '', subject: 'תשתיות', description: '', priority: 'רגיל', assignedTo: '' });
  const [complaintImageFiles, setComplaintImageFiles] = useState([]);
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null); // complaint object being edited
  const [editComplaintForm, setEditComplaintForm] = useState({});
  const [complaintFilters, setComplaintFilters] = useState({ status: 'הכל', priority: 'הכל', assignee: 'הכל', receiver: 'הכל' });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const complaintImageRef = useRef(null);

  const isAharony = currentUser?.user === 'aharony';
  const canEdit   = currentUser?.permissions !== 'VIEW';
  const canUpload = !!currentUser?.addUser;
  const complaintsRole = (() => {
    const r = currentUser?.complaintsRole || (currentUser?.role === 'ADMIN' ? 'admin' : null);
    return r === 'input' ? 'manager' : r; // backward compat: 'input' → 'manager'
  })();

  const visibleComplaints = useMemo(() => {
    if (!complaintsRole) return [];
    if (complaintsRole === 'admin' || complaintsRole === 'manager') return complaints;
    const myUser = currentUser?.user;
    const myTargets = [currentUser?.target1, currentUser?.target2].filter(Boolean);
    const subordinates = usersList
      .filter(u => myTargets.length > 0 && (myTargets.includes(u.target1) || myTargets.includes(u.target2)))
      .map(u => u.username);
    const allInScope = new Set([myUser, ...subordinates].filter(Boolean));
    return complaints.filter(c => allInScope.has(c.assignedTo) || c.submittedBy === myUser);
  }, [complaints, complaintsRole, currentUser, usersList]);

  const canEditQuarter = (q) => {
    if (currentUser?.role === 'ADMIN') return true;
    if (!canEdit) return false;
    if (!isQuarterLocked(q)) return true;
    return !!(currentUser?.[`q${q}`]);
  };

  const toggleQuarterPermission = async (user, q) => {
    const updated = { ...user, [`q${q}`]: !user[`q${q}`] };
    setUsersList(prev => prev.map(u => u.id === user.id ? updated : u));
    try {
      await fetch(GAS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateUser', ...updated,
          target1: updated.role === 'ADMIN' ? '' : updated.target1,
          target2: updated.role === 'ADMIN' ? '' : updated.target2,
          active: String(updated.active || 'TRUE').toUpperCase()
        })
      });
    } catch (err) {
      console.error('שגיאה בשמירת הרשאת רבעון:', err);
      setUsersList(prev => prev.map(u => u.id === user.id ? user : u));
    }
  };

  const userTargets = (user) => [user?.target1, user?.target2].map(normalizeKey).filter(Boolean);
  const matchesUserTargets = (value, user) => {
    const targets = userTargets(user);
    if (!targets.length) return true;
    return targets.includes(normalizeKey(value));
  };

  const [sessionRestored, setSessionRestored] = useState(false);

  // שחזור session אוטומטי בטעינה
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const { user, lastActive } = JSON.parse(saved);
        if (Date.now() - lastActive < SESSION_TIMEOUT) {
          setCurrentUser(user);
          setIsLoggedIn(true);
          setSessionRestored(true);
          if (user.role === 'WING') setActiveWingId(cleanStr(user.target1) || null);
          localStorage.setItem(SESSION_KEY, JSON.stringify({ user, lastActive: Date.now() }));
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (_) {}
  }, []);

  // עדכון lastActive בכל ניווט
  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, lastActive: Date.now() }));
      }
    } catch (_) {}
  }, [mainTab, viewMode, isLoggedIn]);

  // ניקוי סינונים בעת החלפת טאב — כולל filterStatus
  useEffect(() => {
    setShowOnlyBudgetAlerts(false);
    setShowOnlyOverdueTasks(false);
    setFilterStatus(null);
  }, [mainTab]);

  // ניקוי חיפוש ומיון בעת החלפת טאב או תצוגה
  useEffect(() => {
    setSearch('');
    setBudgetSearch('');
    setFilterDept('הכל');
    setBudgetFilterDept('הכל');
    setBudgetTypeFilter('הכל');
    setSortOrder('default');
  }, [mainTab, viewMode]);

  useEffect(() => {
    if (mainTab === 'workplan' && viewMode === 'table' && workplanQuarter === 0) {
      setShowQuarterPicker(true);
    }
  }, [mainTab, viewMode]);

  // Warm-up: מעיר את GAS כשהמשתמש בדף הלוגין כדי לחסוך cold start
  useEffect(() => {
    if (!isLoggedIn) {
      fetch(`${GAS_SCRIPT_URL}?action=warmup`).catch(() => {});
    }
  }, []);

  // מנגנון שמירה אוטומטית (Auto-Save)
  useEffect(() => {
    if (pendingChanges.length === 0) return;
    const timer = setTimeout(async () => {
      const changesToSave = [...pendingChanges];
      setPendingChanges([]);
      setSaveStatus('saving');
      showToast('שומר שינויים...', 'saving');
      try {
        const res = await fetch(GAS_SCRIPT_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'batchUpdate', changes: changesToSave })
        });
        await ensureOk(res, 'Batch update');
        const data = await res.json();
        if (data.success) {
          setSaveStatus('saved');
          showToast('השינויים נשמרו בהצלחה', 'success', 3000);
          setTimeout(() => setSaveStatus(''), 2500);
        } else {
          throw new Error(data.error || 'שגיאה בעדכון');
        }
      } catch (e) {
        console.error("Auto-save error:", e);
        setSaveStatus('error');
        showToast('שגיאה בשמירה — ננסה שוב', 'error', 5000);
        setPendingChanges((prev) => [...prev, ...changesToSave]);
        setTimeout(() => setSaveStatus(''), 4000);
      }
    }, 1000); 
    return () => clearTimeout(timer);
  }, [pendingChanges]);

  const applyData = (bJson, wJson, liveData, csvText) => {
    const staticParsed = (bJson || []).map(b => ({
      ...b, wing: cleanStr(b.wing), dept: cleanStr(b.dept), name: cleanStr(b.name), type: cleanStr(b.type)
    }));
    const workPlansParsed = (wJson || []).map((t) => {
      const live = liveData?.[String(t.id)] || {};
      return {
        ...t, wing: cleanStr(t.wing), dept: cleanStr(t.dept), activity: cleanStr(t.activity), task: cleanStr(t.task),
        q1: live.q1 ?? t.q1, q2: live.q2 ?? t.q2, q3: live.q3 ?? t.q3, q4: live.q4 ?? t.q4,
        n1: live.n1 || "", n2: live.n2 || "", n3: live.n3 || "", n4: live.n4 || ""
      };
    });
    const rows = csvText.trim().split(/\r?\n/).map(parseCsvLine);
    const headers = (rows[0] || []).map((h) => h.trim().toLowerCase());
    const map = {};
    const idIdx   = headers.findIndex((h) => h.includes('id') || h === 'מזהה' || h === 'קוד');
    const a26Idx  = headers.findIndex((h) => h.includes('a2026') || (h.includes('ביצוע') && h.includes('2026')));
    const c26Idx  = headers.findIndex((h) => h.includes('commit') || h.includes('שריון'));
    const typeIdx = headers.findIndex((h) => h === 'סוג');
    const wingIdx = headers.findIndex((h) => h === 'אגף');
    const deptIdx = headers.findIndex((h) => h === 'מחלקה');
    const nameIdx = headers.findIndex((h) => h.includes('שם סעיף') || h === 'שם');
    const a24Idx  = headers.findIndex((h) => h.includes('ביצוע') && h.includes('2024'));
    const b25Idx  = headers.findIndex((h) => h.includes('תקציב') && h.includes('2025'));
    const b26Idx  = headers.findIndex((h) => h.includes('תקציב') && h.includes('2026'));

    const knownIds = new Set(staticParsed.map(s => String(s.id).trim().split('.')[0]));

    rows.slice(1).forEach((cols) => {
      if (!cols[idIdx]) return;
      const normalizedId = String(cols[idIdx]).trim().split('.')[0];
      map[normalizedId] = { a2026: cleanNum(cols[a26Idx]), commit: cleanNum(cols[c26Idx]) };

      // סעיף שקיים בשיט עם מטאדאטה (D-J) אבל לא ב-budget_data.json — הוסף ל-staticParsed
      if (!knownIds.has(normalizedId) && nameIdx !== -1 && cols[nameIdx]) {
        staticParsed.push({
          id: normalizedId,
          name: cleanStr(cols[nameIdx]),
          wing: wingIdx !== -1 ? cleanStr(cols[wingIdx]) : '',
          dept: deptIdx !== -1 ? cleanStr(cols[deptIdx]) : '',
          type: typeIdx !== -1 ? cleanStr(cols[typeIdx]) : 'הוצאה',
          a2024: a24Idx !== -1 ? cleanNum(cols[a24Idx]) : 0,
          b2025: b25Idx !== -1 ? cleanNum(cols[b25Idx]) : 0,
          b2026: b26Idx !== -1 ? cleanNum(cols[b26Idx]) : 0,
        });
        knownIds.add(normalizedId);
      }
    });
    return { staticParsed, workPlansParsed, execMap: map };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // טעינה מהקאש מיד — הממשק עולה אינסטנט
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { staticParsed, workPlansParsed, execMap } = JSON.parse(cached);
          setStaticData(staticParsed);
          setWorkPlans(workPlansParsed);
          setExecutionMap(execMap);
          setLoading(false); // הסרנו את מסך הטעינה מיד
        } catch (_) {}
      }

      // קבצים מקומיים — חובה
      const [bRes, wRes] = await Promise.all([
        fetch('/budget_data.json').then((res) => ensureOk(res, 'Budget data')),
        fetch('/workplans_data.json').then((res) => ensureOk(res, 'Workplans data')),
      ]);
      const [bJson, wJson] = await Promise.all([bRes.json(), wRes.json()]);

      // GAS ו-CSV — אופציונלי, כישלון לא עוצר
      let liveData = {}, csvText = '';
      try {
        const gasRes = await fetch(`${GAS_SCRIPT_URL}?t=${Date.now()}`).then(r => ensureOk(r, 'GAS'));
        liveData = await gasRes.json();
      } catch (e) { console.warn('GAS fetch failed:', e.message); }
      try {
        const csvRes = await fetch(`${SHEETS_CSV_URL}&t=${Date.now()}`).then(r => ensureOk(r, 'CSV'));
        csvText = await csvRes.text();
      } catch (e) { console.warn('CSV fetch failed:', e.message); }

      const { staticParsed, workPlansParsed, execMap } = applyData(bJson, wJson, liveData, csvText);
      setStaticData(staticParsed);
      setWorkPlans(workPlansParsed);
      setExecutionMap(execMap);

      // שמירה לקאש לכניסה הבאה
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ staticParsed, workPlansParsed, execMap }));
      } catch (_) {}
      setLastRefreshedAt(new Date());
      return { staticParsed, execMap }; // מחזיר נתונים טריים לשימוש הקורא
    } catch (e) {
      console.error("loadData error:", e);
      if (!localStorage.getItem(CACHE_KEY)) {
        alert('שגיאה בטעינת הנתונים: ' + e.message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  // טעינת נתונים אחרי שחזור session
  useEffect(() => {
    if (sessionRestored) loadData();
  }, [sessionRestored]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!uInput.trim()) { setLoginError('נא להזין שם משתמש'); return; }
    if (!pInput.trim()) { setLoginError('נא להזין סיסמה'); return; }
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${GAS_SCRIPT_URL}?action=login&username=${encodeURIComponent(uInput)}&password=${encodeURIComponent(pInput)}`).then((r) => ensureOk(r, 'Login'));
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user: data.user, lastActive: Date.now() })); } catch (_) {}
        setShowOnlyBudgetAlerts(false);
        setShowOnlyOverdueTasks(false);
        setMainTab('budget');
        setViewMode('dashboard');
        setHasSeenBudgetPopup(false);
        setHasSeenWorkplanPopup(false);
        setHasSeenQuarterReminder(false);
        setWorkplanQuarter(0);
        if (data.user.role === 'WING') setActiveWingId(cleanStr(data.user.target1) || null);
        else setActiveWingId(null);
        await loadData();
      } else {
        setLoginError('שם משתמש או סיסמה שגויים');
      }
    } catch (err) {
      console.error(err); setLoginError('שגיאה בהתחברות לשרת');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setIsLoggedIn(false);
    setCurrentUser(null);
    setWorkplanQuarter(0);
    setHasSeenQuarterReminder(false);
    setHasSeenWorkplanPopup(false);
    setHasSeenBudgetPopup(false);
    setUInput('');
    setPInput('');
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${GAS_SCRIPT_URL}?action=listUsers&t=${Date.now()}`).then((r) => ensureOk(r, 'List users'));
      const data = await res.json();
      if (data.success) {
        setUsersList((data.users || []).map((u) => ({ ...u, active: String(u.active || 'TRUE').toUpperCase() })));
      } else alert('שגיאה בטעינת משתמשים:\n' + (data.error || JSON.stringify(data)));
    } catch (err) {
      console.error(err); alert('שגיאה בטעינת משתמשים:\n' + err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const addUser = async () => {
    if (!cleanStr(userForm.username) || !cleanStr(userForm.password)) return alert('יש למלא שם משתמש וסיסמה');
    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addUser', ...userForm, email: userForm.email, permissions: userForm.permissions || 'EDIT', addUser: userForm.addUser || '', target1: userForm.role === 'ADMIN' ? '' : userForm.target1, target2: userForm.role === 'ADMIN' ? '' : userForm.target2 })
      }).then((r) => ensureOk(r, 'Add user'));
      const data = await res.json();
      if (data.success) {
        await loadUsers();
        setUserForm({ username: '', password: '', email: '', role: 'WING', permissions: 'EDIT', addUser: '', target1: '', target2: '', active: 'TRUE', complaintsRole: '' });
        alert('המשתמש נוסף בהצלחה');
      } else alert(`שגיאה: ${data.error || 'שגיאה כללית'}`);
    } catch (err) { alert(`שגיאה: ${err.message || ''}`); }
  };

  const updateUserRow = async (user) => {
    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateUser', ...user, email: user.email, permissions: user.permissions || 'EDIT', addUser: user.addUser || '', target1: user.role === 'ADMIN' ? '' : user.target1, target2: user.role === 'ADMIN' ? '' : user.target2, active: String(user.active || 'TRUE').toUpperCase() })
      }).then((r) => ensureOk(r, 'Update user'));
      const data = await res.json();
      if (data.success) { await loadUsers(); alert('המשתמש עודכן בהצלחה'); } else alert(`שגיאה: ${data.error || 'שגיאה כללית'}`);
    } catch (err) { alert(`שגיאה: ${err.message || ''}`); }
  };

  const deactivateUserRow = async (id) => {
    try {
      const res = await fetch(GAS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'deactivateUser', id }) }).then((r) => ensureOk(r, 'Deactivate user'));
      const data = await res.json();
      if (data.success) { await loadUsers(); alert('המשתמש הושבת בהצלחה'); } else alert(`שגיאה: ${data.error || 'שגיאה כללית'}`);
    } catch (err) { alert(`שגיאה: ${err.message || ''}`); }
  };

  const loadComplaints = async () => {
    setComplaintsLoading(true);
    try {
      const res = await fetch(`${GAS_SCRIPT_URL}?action=listComplaints&t=${Date.now()}`);
      const data = await res.json();
      if (data.success) setComplaints(data.complaints || []);
      else showToast('שגיאת GAS (פניות): ' + (data.error || JSON.stringify(data)), 'error', 8000);
    } catch (err) { console.error('loadComplaints error:', err); showToast('שגיאה בטעינת פניות: ' + err.message, 'error', 6000); }
    finally { setComplaintsLoading(false); }
  };

  const uploadComplaintImageFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(',')[1];
          const res = await fetch(GAS_SCRIPT_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'uploadComplaintImage', fileName: file.name, mimeType: file.type, base64 })
          });
          const data = await res.json();
          if (data.success) resolve(data.url); else reject(new Error(data.error || 'שגיאת העלאה'));
        } catch (err) { reject(err); }
      };
      reader.readAsDataURL(file);
    });
  };

  const submitComplaint = async () => {
    if (!complaintForm.description.trim()) return alert('יש להזין תיאור פנייה');
    if (!complaintForm.address.trim() && !complaintForm.landmark.trim()) return alert('יש להזין כתובת או נקודת ציון');
    setIsSubmittingComplaint(true);
    showToast('שומר פנייה...', 'saving');
    try {
      const imageUrls = [];
      for (const file of complaintImageFiles) {
        const url = await uploadComplaintImageFile(file);
        imageUrls.push(url);
      }
      const payload = {
        action: 'addComplaint',
        date: complaintForm.date || new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        address: complaintForm.address, landmark: complaintForm.landmark,
        subject: complaintForm.subject, description: complaintForm.description,
        priority: complaintForm.priority, assignedTo: complaintForm.assignedTo,
        images: imageUrls.join(','), submittedBy: currentUser?.user || ''
      };
      const res = await fetch(GAS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        showToast(`הפנייה נשמרה — ${data.id}`, 'success');
        setComplaintsView('list');
        setComplaintForm({ date: '', address: '', landmark: '', subject: 'תשתיות', description: '', priority: 'רגיל', assignedTo: '' });
        setComplaintImageFiles([]);
        await loadComplaints();
      } else throw new Error(data.error || 'שגיאה כללית');
    } catch (err) { showToast('שגיאה בשמירת פנייה: ' + err.message, 'error', 5000); }
    finally { setIsSubmittingComplaint(false); }
  };

  const saveEditedComplaint = async () => {
    if (!editingComplaint) return;
    try {
      showToast('שומר...', 'saving');
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateComplaint', id: editingComplaint.id, ...editComplaintForm })
      });
      const data = await res.json();
      if (data.success) {
        showToast('הפנייה עודכנה', 'success');
        setEditingComplaint(null);
        setEditComplaintForm({});
        await loadComplaints();
      } else throw new Error(data.error);
    } catch (err) { showToast('שגיאה בעדכון: ' + err.message, 'error', 5000); }
  };

  const closeComplaint = async (c) => {
    if (!window.confirm(`לסגור פנייה ${c.id}? פעולה זו אינה הפיכה.`)) return;
    try {
      showToast('סוגר פנייה...', 'saving');
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateComplaint', id: c.id, status: 'סגור', closed: 'סגור' })
      });
      const data = await res.json();
      if (data.success) { showToast('הפנייה נסגרה', 'success'); await loadComplaints(); }
      else throw new Error(data.error);
    } catch (err) { showToast('שגיאה בסגירה: ' + err.message, 'error', 5000); }
  };

  const wingsOptions = useMemo(() => {
    const fromBudget = staticData.map((r) => cleanStr(r.wing));
    const fromWorkplan = workPlans.map((r) => cleanStr(r.wing));
    return Array.from(new Set([...fromBudget, ...fromWorkplan].filter(Boolean))).sort();
  }, [staticData, workPlans]);

  const deptsOptions = useMemo(() => {
    const fromBudget = staticData.map((r) => cleanStr(r.dept));
    const fromWorkplan = workPlans.map((r) => cleanStr(r.dept));
    return Array.from(new Set([...fromBudget, ...fromWorkplan].filter(Boolean))).sort();
  }, [staticData, workPlans]);

  const wingDeptsList = useMemo(() => {
    if (currentUser?.role !== 'WING') return [];
    const wDepts = workPlans.filter(t => matchesUserTargets(t.wing, currentUser)).map(t => cleanStr(t.dept));
    const bDepts = staticData.filter(b => matchesUserTargets(b.wing, currentUser)).map(b => cleanStr(b.dept));
    return Array.from(new Set([...wDepts, ...bDepts].filter(Boolean))).sort();
  }, [workPlans, staticData, currentUser]);

  const userTargetOptions = (role) => {
    if (role === 'WING') return wingsOptions;
    if (role === 'DEPT') return deptsOptions;
    return [];
  };

  useEffect(() => {
    // לא מציג popup חריגות אם המשתמש כבר בחר סינון אחר
    if (!loading && mainTab === 'workplan' && viewMode === 'table' && !hasSeenWorkplanPopup && filterStatus === null && !showOnlyOverdueTasks) {
      const overdue = workPlans.filter((t) => {
        if (currentUser?.role === 'WING' && !matchesUserTargets(t.wing, currentUser)) return false;
        if (currentUser?.role === 'DEPT' && !matchesUserTargets(t.dept, currentUser)) return false;
        if (activeWingId && !sameKey(t.wing, activeWingId)) return false;
        return isTaskOverdue(t, workplanQuarter);
      }).length;
      if (overdue > 0) { setPopupCount(overdue); setActivePopup('workplan'); setHasSeenWorkplanPopup(true); }
    }
  }, [loading, mainTab, viewMode, activeWingId, workPlans, hasSeenWorkplanPopup, currentUser, workplanQuarter, filterStatus, showOnlyOverdueTasks]);

  // תזכורת עדכון רבעוני — מוצגת פעם אחת בסשן בכניסה לתכניות עבודה
  useEffect(() => {
    if (loading || mainTab !== 'workplan' || hasSeenQuarterReminder || !workPlans.length || !currentUser) return;
    const q = getActiveReminderQuarter();
    if (!q) return;
    const missing = workPlans.filter(t => {
      if (currentUser.role === 'WING' && !matchesUserTargets(t.wing, currentUser)) return false;
      if (currentUser.role === 'DEPT' && !matchesUserTargets(t.dept, currentUser)) return false;
      return !t[`q${q}`];
    }).length;
    if (missing === 0) return;
    const lockDate = QUARTER_LOCK_DATES[q];
    const daysLeft = Math.ceil((lockDate - new Date()) / (1000 * 60 * 60 * 24));
    setQuarterUpdateReminder({ quarter: q, count: missing, daysLeft });
    setHasSeenQuarterReminder(true);
  }, [loading, mainTab, workPlans, currentUser, hasSeenQuarterReminder]);

    const fullBudgetData = useMemo(() => {
    let data = staticData;
    if (currentUser?.role === 'WING') data = data.filter((i) => matchesUserTargets(i.wing, currentUser));
    if (currentUser?.role === 'DEPT') data = data.filter((i) => matchesUserTargets(i.dept, currentUser));
    if (activeWingId) data = data.filter((i) => sameKey(i.wing, activeWingId));
    
    return data.map((item) => {
      const normalizedId = String(item.id).trim().split('.')[0];
      const e = executionMap[normalizedId] || { a2026: 0, commit: 0 };
      const b2026 = cleanNum(item.b2026);
      const a2026 = cleanNum(e.a2026);
      const commit = cleanNum(e.commit);
      
      // החישוב שתוקן:
      const commitTotal2026 = a2026 + commit;

      return { ...item, a2024: cleanNum(item.a2024), b2025: cleanNum(item.b2025), b2026, a2026, commit, commitTotal2026 };
    });
  }, [staticData, executionMap, activeWingId, currentUser]);

  const budgetDeptOptions = useMemo(() => Array.from(new Set(fullBudgetData.map((r) => cleanStr(r.dept)).filter(Boolean))).sort(), [fullBudgetData]);

  const filteredBudgetData = useMemo(() => {
    let data = [...fullBudgetData];
    if (budgetFilterDept !== 'הכל') data = data.filter((r) => sameKey(r.dept, budgetFilterDept));
    if (budgetTypeFilter !== 'הכל') data = data.filter((r) => sameKey(r.type, budgetTypeFilter));
    if (cleanStr(budgetSearch)) {
      const q = cleanStr(budgetSearch).toLowerCase();
      data = data.filter((r) => cleanStr(r.name).toLowerCase().includes(q));
    }
    if (showOnlyBudgetAlerts) {
      data = data.filter((r) => {
        const balance = r.b2026 - r.a2026;
        return (sameKey(r.type, 'הכנסה') && balance > 0) || (sameKey(r.type, 'הוצאה') && balance < 0);
      });
    }
    return data;
  }, [fullBudgetData, budgetFilterDept, budgetTypeFilter, budgetSearch, showOnlyBudgetAlerts]);

  useEffect(() => {
    if (mainTab === 'complaints' && usersList.length === 0) loadUsers();
  }, [mainTab]);

  useEffect(() => {
    if (!loading && mainTab === 'budget' && viewMode === 'control' && !hasSeenBudgetPopup) {
      const redItems = filteredBudgetData.filter((r) => {
        const balance = r.b2026 - r.a2026;
        return (sameKey(r.type, 'הכנסה') && balance > 0) || (sameKey(r.type, 'הוצאה') && balance < 0);
      }).length;
      if (redItems > 0) { setPopupCount(redItems); setActivePopup('budget'); setHasSeenBudgetPopup(true); }
    }
  }, [loading, mainTab, viewMode, filteredBudgetData, hasSeenBudgetPopup]);

  const budgetStats = useMemo(() => {
    const expenses = fullBudgetData.filter((r) => sameKey(r.type, 'הוצאה'));
    const incomes = fullBudgetData.filter((r) => sameKey(r.type, 'הכנסה'));
    const sumRows = (rows, key) => rows.reduce((acc, curr) => acc + cleanNum(curr[key]), 0);
    return {
      expA24: sumRows(expenses, 'a2024'), expB25: sumRows(expenses, 'b2025'), expB26: sumRows(expenses, 'b2026'),
      expExec26: sumRows(expenses, 'a2026'), expCommit26: expenses.reduce((acc, curr) => acc + curr.commitTotal2026, 0),
      incB26: sumRows(incomes, 'b2026'), incExec26: sumRows(incomes, 'a2026')
    };
  }, [fullBudgetData]);

  const budgetByDeptChart = useMemo(() => {
    const expensesOnly = fullBudgetData.filter((r) => sameKey(r.type, 'הוצאה'));
    const groups = {};
    expensesOnly.forEach((row) => {
      const groupKey = cleanStr(row.dept) || 'ללא מחלקה';
      groups[groupKey] = (groups[groupKey] || 0) + cleanNum(row.b2026);
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fullBudgetData]);

  const budgetByTypePie = useMemo(() => {
    const expenses = fullBudgetData.filter((r) => sameKey(r.type, 'הוצאה')).reduce((acc, curr) => acc + curr.b2026, 0);
    const incomes = fullBudgetData.filter((r) => sameKey(r.type, 'הכנסה')).reduce((acc, curr) => acc + curr.b2026, 0);
    return [{ name: 'הוצאה', value: expenses }, { name: 'הכנסה', value: incomes }].filter((i) => i.value > 0);
  }, [fullBudgetData]);

  const budgetExecutionPie = useMemo(() => {
    const expensesOnly = fullBudgetData.filter((r) => sameKey(r.type, 'הוצאה'));
    const executed = expensesOnly.reduce((acc, curr) => acc + curr.a2026, 0);
    const totalBudget = expensesOnly.reduce((acc, curr) => acc + curr.b2026, 0);
    const remain = Math.max(totalBudget - executed, 0);
    return [{ name: 'בוצע 2026 (הוצאות)', value: executed }, { name: 'יתרה לתקציב (הוצאות)', value: remain }].filter((i) => i.value > 0);
  }, [fullBudgetData]);

  const controlData = useMemo(() => {
    return filteredBudgetData.map((row) => {
      const compareValue = controlCompareBy === 'a2026' ? row.a2026 : row.commitTotal2026;
      const balance = row.b2026 - compareValue;
      const isRed = (sameKey(row.type, 'הכנסה') && balance > 0) || (sameKey(row.type, 'הוצאה') && balance < 0);
      return { ...row, compareValue, balance, isRed };
    });
  }, [filteredBudgetData, controlCompareBy]);

  const top5Overages = useMemo(() =>
    fullBudgetData
      .map(r => ({ ...r, balance: r.b2026 - r.a2026, isRed: (sameKey(r.type,'הכנסה') && r.b2026 - r.a2026 > 0) || (sameKey(r.type,'הוצאה') && r.b2026 - r.a2026 < 0) }))
      .filter(r => r.isRed)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 5)
  , [fullBudgetData]);

  const budgetAlertsCount = useMemo(() => fullBudgetData.filter(row => {
    const balance = row.b2026 - row.a2026;
    return (sameKey(row.type, 'הכנסה') && balance > 0) || (sameKey(row.type, 'הוצאה') && balance < 0);
  }).length, [fullBudgetData]);

  const availableDepts = useMemo(() => {
    let pool = workPlans;
    if (currentUser?.role === 'WING') pool = pool.filter((t) => matchesUserTargets(t.wing, currentUser));
    if (currentUser?.role === 'DEPT') pool = pool.filter((t) => matchesUserTargets(t.dept, currentUser));
    if (activeWingId) pool = pool.filter((t) => sameKey(t.wing, activeWingId));
    return Array.from(new Set(pool.map((t) => t.dept))).filter(Boolean).sort();
  }, [workPlans, activeWingId, currentUser]);

  // נתוני בסיס ללא פילטר סטטוס — לסטטיסטיקות ולגרפים בדשבורד
  const baseWorkData = useMemo(() => {
    let data = workPlans;
    if (currentUser?.role === 'WING') data = data.filter((t) => matchesUserTargets(t.wing, currentUser));
    if (currentUser?.role === 'DEPT') data = data.filter((t) => matchesUserTargets(t.dept, currentUser));
    if (activeWingId) data = data.filter((t) => sameKey(t.wing, activeWingId));
    if (filterDept !== 'הכל') data = data.filter((t) => sameKey(t.dept, filterDept));
    if (search) {
      const q = cleanStr(search).toLowerCase();
      data = data.filter((t) =>
        cleanStr(t.task).toLowerCase().includes(q) ||
        cleanStr(t.activity).toLowerCase().includes(q) ||
        cleanStr(t.dept).toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    }
    if (showOnlyOverdueTasks) data = data.filter((t) => isTaskOverdue(t, workplanQuarter));
    return data;
  }, [workPlans, currentUser, activeWingId, filterDept, search, showOnlyOverdueTasks, workplanQuarter]);

  // נתונים לטבלה — כולל פילטר סטטוס (0 = טרם עודכן)
  const filteredWorkData = useMemo(() => {
    if (filterStatus === null) return baseWorkData;
    if (filterStatus === 0) return baseWorkData.filter((t) => !(workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]));
    return baseWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === filterStatus);
  }, [baseWorkData, filterStatus, workplanQuarter]);

  const sortedWorkData = useMemo(() => {
    if (sortOrder === 'default') return filteredWorkData;
    return [...filteredWorkData].sort((a, b) => {
      const dateA = parseDateLogic(a.deadline) || new Date(2100, 0, 1);
      const dateB = parseDateLogic(b.deadline) || new Date(2100, 0, 1);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [filteredWorkData, sortOrder]);

  // סטטיסטיקות תמיד מנתוני הבסיס (ללא פילטר סטטוס) — כדי שהכרטיסיות יציגו נתון אמיתי
  const workStats = useMemo(() => {
    const total = baseWorkData.length || 0;
    const s1 = baseWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 1).length;
    const s2 = baseWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 2).length;
    const s3 = baseWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 3).length;
    const s4 = baseWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 4).length;
    const overdueCount = baseWorkData.filter((t) => isTaskOverdue(t, workplanQuarter)).length;
    const m = total - (s1 + s2 + s3 + s4);
    return {
      total, s1, s2, s3, s4, m, overdue: overdueCount,
      p1: Math.round((s1 / total) * 100) || 0, p2: Math.round((s2 / total) * 100) || 0, p3: Math.round((s3 / total) * 100) || 0, pM: Math.round((m / total) * 100) || 0
    };
  }, [baseWorkData, workplanQuarter]);

  // מטריצת השלמת רבעונים לפי אגף/מחלקה
  const quarterCompletionMatrix = useMemo(() => {
    const scopeData = workPlans.filter(t => {
      if (currentUser?.role === 'WING') return matchesUserTargets(t.wing, currentUser);
      if (currentUser?.role === 'DEPT') return matchesUserTargets(t.dept, currentUser);
      return true;
    }).filter(t => activeWingId ? sameKey(t.wing, activeWingId) : true);

    const groupKey = (activeWingId || currentUser?.role === 'WING' || currentUser?.role === 'DEPT') ? 'dept' : 'wing';
    const units = Array.from(new Set(scopeData.map(t => cleanStr(t[groupKey])))).filter(Boolean).sort();

    return units.map(unit => {
      const tasks = scopeData.filter(t => sameKey(t[groupKey], unit));
      const total = tasks.length;
      if (!total) return null;
      const pct = (q) => Math.round(tasks.filter(t => !!t[`q${q}`]).length / total * 100);
      return { name: unit, total, q1: pct(1), q2: pct(2), q3: pct(3), q4: pct(4) };
    }).filter(Boolean);
  }, [workPlans, currentUser, activeWingId]);

  // ספירת משימות בפיגור לכלל המשימות של המשתמש — לbadge בניווט
  const overdueTasksCount = useMemo(() => {
    if (!workPlans.length) return 0;
    return workPlans.filter(t => {
      if (currentUser?.role === 'WING' && !matchesUserTargets(t.wing, currentUser)) return false;
      if (currentUser?.role === 'DEPT' && !matchesUserTargets(t.dept, currentUser)) return false;
      if (activeWingId && cleanStr(t.wing) !== cleanStr(activeWingId)) return false;
      return isTaskOverdue(t, workplanQuarter);
    }).length;
  }, [workPlans, currentUser, activeWingId, workplanQuarter]);

  const orphanedDataAlert = useMemo(() => {
    if (currentUser?.user !== 'aharony') return null;
    const orphanedBudgets = staticData.filter(b => !cleanStr(b.wing) || !cleanStr(b.dept));
    const orphanedWorks = workPlans.filter(w => !cleanStr(w.wing) || !cleanStr(w.dept));
    if (orphanedBudgets.length === 0 && orphanedWorks.length === 0) return null;
    return { budgets: orphanedBudgets.length, works: orphanedWorks.length };
  }, [staticData, workPlans, currentUser]);

  const updateTaskLocal = (taskId, field, value) => {
    // בדיקת רציפות רבעונים: אי אפשר לעדכן רבעון N אם רבעון N-1 לא עודכן
    const q = parseInt(field.charAt(1), 10);
    if ((field.startsWith('q') || field.startsWith('n')) && q > 1) {
      const task = workPlans.find((t) => t.id === taskId);
      if (task && !task[`q${q - 1}`]) {
        alert(`לא ניתן לעדכן רבעון ${q} לפני שרבעון ${q - 1} עודכן`);
        return;
      }
    }
    setWorkPlans((prev) => prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)));
    setPendingChanges((prev) => {
      const qNum = field.startsWith('q') ? q : workplanQuarter;
      const existing = prev.find((c) => c.id === taskId && c.quarter === qNum);
      const update = { id: taskId, quarter: qNum, [field.startsWith('q') ? 'rating' : 'note']: value };
      return existing ? [...prev.filter((c) => !(c.id === taskId && c.quarter === qNum)), { ...existing, ...update }] : [...prev, update];
    });
  };

  const toggleBudgetColumn = (key) => setBudgetVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  const visibleBudgetColumnDefs = [
    { key: 'a2024', label: 'ביצוע 2024', value: (r) => r.a2024 },
    { key: 'b2025', label: 'תקציב 2025', value: (r) => r.b2025 },
    { key: 'b2026', label: 'תקציב 2026', value: (r) => r.b2026 },
    { key: 'a2026', label: 'ביצוע 2026', value: (r) => r.a2026 },
    { key: 'commitTotal2026', label: 'שריון+ביצוע 2026', value: (r) => r.commitTotal2026 }
  ].filter((c) => budgetVisibleColumns[c.key]);

  const exportCurrentView = () => {
    let rows = []; let filename = '';
    if (mainTab === 'budget') {
      if (viewMode === 'control') {
        rows = [['סעיף', 'תיאור', 'מחלקה', 'סוג', 'תקציב 2026', controlCompareBy === 'a2026' ? 'ביצוע 2026' : 'ביצוע+שריון 2026', 'יתרה']];
        controlData.forEach((row) => rows.push([row.id, row.name, row.dept, row.type, row.b2026, row.compareValue, row.balance]));
        filename = 'budget_control_export.csv';
      } else if (viewMode === 'table') {
        rows = [['סעיף', 'תיאור', 'מחלקה', 'סוג', ...visibleBudgetColumnDefs.map((c) => c.label)]];
        filteredBudgetData.forEach((row) => rows.push([row.id, row.name, row.dept, row.type, ...visibleBudgetColumnDefs.map((c) => c.value(row))]));
        filename = 'budget_table_export.csv';
      } else {
        rows = [
          ['מדד', 'ערך'], ['ביצוע 24 (הוצאות)', budgetStats.expA24], ['תקציב 25 (הוצאות)', budgetStats.expB25], ['תקציב 26 (הוצאות)', budgetStats.expB26],
          ['ביצוע+שריון 26 (הוצאות)', budgetStats.expCommit26], ['ביצוע בפועל 26 (הוצאות)', budgetStats.expExec26], ['תקציב 26 (הכנסות)', budgetStats.incB26], ['ביצוע 26 (הכנסות)', budgetStats.incExec26]
        ];
        filename = 'budget_dashboard_export.csv';
      }
    }
    if (mainTab === 'workplan') {
      rows = [['מזהה', 'אגף', 'מחלקה', 'פעילות', 'משימה', 'יעד', 'רבעון 1', 'הערה 1', 'רבעון 2', 'הערה 2', 'רבעון 3', 'הערה 3', 'רבעון 4', 'הערה 4']];
      sortedWorkData.forEach((t) => {
        rows.push([t.id, t.wing, t.dept, t.activity || '', t.task, formatDate(t.deadline), STATUS_CONFIG[t.q1]?.label || '', t.n1 || '', STATUS_CONFIG[t.q2]?.label || '', t.n2 || '', STATUS_CONFIG[t.q3]?.label || '', t.n3 || '', STATUS_CONFIG[t.q4]?.label || '', t.n4 || '']);
      });
      filename = 'workplan_export.csv';
    }
    if (mainTab === 'users' && isAharony) {
      rows = [['id', 'username', 'password', 'role', 'target1', 'target2', 'active']];
      usersList.forEach((u) => rows.push([u.id, u.username, u.password, u.role, u.target1, u.target2, u.active]));
      filename = 'users_export.csv';
    }
    if (!rows.length) return; downloadCsv(rows, filename);
  };

  // ===== Upload Wizard Functions =====
  const resetUpload = () => {
    setUploadStep('drop');
    setUploadRows([]);
    setUploadUnknowns([]);
    setUploadUnknownIdx(0);
    setUploadCorrections({});
    setUploadSearch('');
    setUploadCurrentEdit({ a2026: '', commit: '' });
  };

  const parseUploadFile = async (file) => {
    try {
      const ab = await file.arrayBuffer();
      const ext = file.name.split('.').pop().toLowerCase();
      let wb;
      if (ext === 'csv') {
        const bytes = new Uint8Array(ab);
        const isUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
        let text;
        if (isUtf8Bom) {
          text = new TextDecoder('utf-8').decode(ab);
        } else {
          // נסה UTF-8 strict — אם נכשל סימן שזה Windows-1255
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(ab);
          } catch {
            text = new TextDecoder('windows-1255').decode(ab);
          }
        }
        wb = XLSX.read(text, { type: 'string' });
      } else {
        wb = XLSX.read(ab, { type: 'array' });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (raw.length < 2) return alert('הקובץ ריק או לא תקין');

      const hdrs = raw[0].map(h => String(h).toLowerCase().trim());

      // מיפוי עמודות — header-based עם fallback למיקום קבוע
      const findCol = (matchers, fixedIdx) => {
        const i = hdrs.findIndex(h => matchers.some(m => h === m || h.includes(m)));
        return i !== -1 ? i : fixedIdx;
      };
      const idIdx   = findCol(['id', 'מזהה', 'קוד'], 0);
      const nameIdx = findCol(['name', 'שם', 'תיאור'], 1);
      const a26Idx  = findCol(['a2026', 'ביצוע 2026'], 9);   // J
      const cIdx    = findCol(['commit', 'שריון', 'התחייבות'], 11); // L
      const wingIdx = findCol(['הקבצה', 'wing', 'אגף'], 24);   // Y — "תיאור הקבצה"
      const deptIdx = findCol(['תיאור מחלקה', 'תיואר מחלקה', 'dept'], 22); // W — "תיואר מחלקה" (לא "מחלקה" שהוא קוד)

      // זיהוי סוג לפי קידומת המזהה: 10–15 = הכנסה, 16–19 = הוצאה
      const detectType = (id) => {
        const prefix = parseInt(String(id).replace(/\D/g, '').substring(0, 2));
        return (prefix >= 10 && prefix <= 15) ? 'הכנסה' : 'הוצאה';
      };

      // Debug — הדפס שורה ראשונה לזיהוי עמודות
      console.log('Headers (first row):', raw[0]);
      console.log(`raw[0][21]="${raw[0][21]}"  raw[0][22]="${raw[0][22]}"`);
      console.log('Sample row[1]:', raw[1]);
      console.log(`idIdx=${idIdx}, nameIdx=${nameIdx}, deptIdx=${deptIdx}, wingIdx=${wingIdx}, a26Idx=${a26Idx}, cIdx=${cIdx}`);
      // הדפס fileDept לכמה שורות לדוגמה
      const sampleDepts = raw.slice(1, 6).map((row, i) => `row${i+1}[${deptIdx}]="${row[deptIdx]}"`);
      console.log('Sample fileDept values:', sampleDepts.join(' | '));

      const rows = raw.slice(1)
        .map((row, i) => {
          const fileId = String(row[idIdx] || '').trim().split('.')[0];
          return {
            rowIndex: i,
            fileId,
            fileName: String(row[nameIdx] || '').trim(),
            fileWing: String(wingIdx !== -1 ? row[wingIdx] : '').trim(),
            fileDept: String(row[deptIdx] || '').trim(),
            fileType: detectType(fileId),
            a2026:    cleanNum(row[a26Idx]),
            commit:   cleanNum(row[cIdx]),
            col10:    cleanNum(row[9]),   // עמודה 10 לפי מיקום קבוע — ביצוע
            col12:    cleanNum(row[11]),  // עמודה 12 לפי מיקום קבוע — ביצוע+שריון
          };
        })
        .filter(r => r.fileId);

      const knownIds = new Set(staticData.map(s => String(s.id).trim().split('.')[0]));
      const unknowns = rows.map((r, i) => i).filter(i => !knownIds.has(rows[i].fileId));

      setUploadRows(rows);
      setUploadUnknowns(unknowns);
      setUploadCorrections({});
      setUploadUnknownIdx(0);
      setUploadSearch('');

      if (unknowns.length > 0) {
        const first = rows[unknowns[0]];
        setUploadCurrentEdit({ wing: first.fileWing, dept: first.fileDept, type: first.fileType || 'הוצאה', a2024: '0', b2025: '0', b2026: '0' });
        setUploadStep('unknowns-warning');
      } else {
        setUploadStep('uploading');
        await doUpload(rows, {});
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה בקריאת הקובץ: ' + e.message);
    }
  };

  const handleUploadFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) return alert('יש לבחור קובץ Excel או CSV');
    parseUploadFile(file);
  };

  // בדיקת אחרי טעינה — משווה נתוני קובץ לפורטל שנטען
  const runPostUploadValidation = (rows, payload, freshStatic, freshExecMap) => {
    const isIncome  = (id) => { const p = parseInt(String(id).replace(/\D/g,'').substring(0,2)); return p >= 11 && p <= 15; };
    const isExpense = (id) => { const p = parseInt(String(id).replace(/\D/g,'').substring(0,2)); return p >= 16 && p <= 19; };

    // סכומי קובץ — עמודה 10 ו-12 לפי מיקום קבוע
    const fileIncomeExec    = rows.filter(r => isIncome(r.fileId)).reduce((s,r) => s + r.col10, 0);
    const fileIncomeCommit  = rows.filter(r => isIncome(r.fileId)).reduce((s,r) => s + r.col12, 0);
    const fileExpenseExec   = rows.filter(r => isExpense(r.fileId)).reduce((s,r) => s + r.col10, 0);
    const fileExpenseCommit = rows.filter(r => isExpense(r.fileId)).reduce((s,r) => s + r.col12, 0);

    // מיפוי payload לפי ID לבדיקה מה נשלח בפועל לשרת
    const payloadMap = {};
    payload.forEach(p => { payloadMap[String(p.id)] = p; });

    // סכומי פורטל אחרי טעינה
    const getE = (id) => { const e = freshExecMap[String(id).trim().split('.')[0]] || {}; return cleanNum(e.a2026); };
    const getC = (id) => { const e = freshExecMap[String(id).trim().split('.')[0]] || {}; return cleanNum(e.a2026) + cleanNum(e.commit); };
    const portalIncomeExec    = freshStatic.filter(s => isIncome(s.id)).reduce((s,i) => s + getE(i.id), 0);
    const portalIncomeCommit  = freshStatic.filter(s => isIncome(s.id)).reduce((s,i) => s + getC(i.id), 0);
    const portalExpenseExec   = freshStatic.filter(s => isExpense(s.id)).reduce((s,i) => s + getE(i.id), 0);
    const portalExpenseCommit = freshStatic.filter(s => isExpense(s.id)).reduce((s,i) => s + getC(i.id), 0);

    // בדיקה פרטנית: לכל שורה בקובץ — האם הפורטל קלט נכון?
    const knownIds = new Set(freshStatic.map(s => String(s.id).trim().split('.')[0]));
    const rowDetails = rows.map(r => {
      const sid = r.fileId;
      const inPortal = knownIds.has(sid);
      const sent = payloadMap[sid]; // מה נשלח לשרת
      const wasNotSent = !sent;     // לא היה ב-payload כלל
      const e = freshExecMap[sid] || {};
      const portalA = cleanNum(e.a2026);
      const portalC = cleanNum(e.a2026) + cleanNum(e.commit);
      const execMatch   = Math.abs(r.col10 - portalA) < 1;
      const commitMatch = Math.abs(r.col12 - portalC) < 1;
      const sentA = sent ? cleanNum(sent.a2026) : null;
      const sentC = sent ? cleanNum(sent.a2026) + cleanNum(sent.commit) : null;
      return { id: sid, name: r.fileName, inPortal, wasNotSent, execMatch, commitMatch, fileA: r.col10, fileC: r.col12, portalA, portalC, sentA, sentC };
    });

    const notLoaded  = rowDetails.filter(r => !r.inPortal);
    const mismatched = rowDetails.filter(r => r.inPortal && (!r.execMatch || !r.commitMatch));

    const checks = [
      { label: 'ביצוע הכנסות (11–15)',       fileVal: fileIncomeExec,    portalVal: portalIncomeExec    },
      { label: 'ביצוע+שריון הכנסות (11–15)', fileVal: fileIncomeCommit,  portalVal: portalIncomeCommit  },
      { label: 'ביצוע הוצאות (16–19)',        fileVal: fileExpenseExec,   portalVal: portalExpenseExec   },
      { label: 'ביצוע+שריון הוצאות (16–19)', fileVal: fileExpenseCommit, portalVal: portalExpenseCommit },
    ].map(c => ({ ...c, ok: Math.abs(c.fileVal - c.portalVal) < 1 }));

    const allOk = notLoaded.length === 0 && mismatched.length === 0 && checks.every(c => c.ok);
    setUploadValidation({ checks, notLoaded, mismatched, allOk });
    setUploadStep('post-validation');
  };

  const inferWingFromDept = (dept) => {
    if (!dept) return '';
    const match = staticData.find(s => sameKey(s.dept, dept));
    return match ? cleanStr(match.wing) : '';
  };

  const buildEditForRow = (row) => {
    const matchedWing = fuzzyMatchList(row.fileWing, uploadAllWings);
    const matchedDept = fuzzyMatchList(row.fileDept, uploadAllDepts);
    const inferredWing = matchedWing || inferWingFromDept(matchedDept);
    return {
      wing: inferredWing,
      dept: matchedDept,
      type: row.fileType || 'הוצאה',
      a2024: '0', b2025: '0', b2026: '0'
    };
  };

  const proceedUnknownReview = () => {
    const cur = uploadRows[uploadUnknowns[0]];
    setUploadCurrentEdit(buildEditForRow(cur));
    setUploadUnknownIdx(0);
    setUploadSearch('');
    setUploadStep('unknowns-review');
  };

  // targetId = מזהה סעיף קיים שנבחר מהחיפוש (אופציונלי). אם null — מוסיפים כסעיף חדש
  const confirmUnknown = (targetId = null) => {
    const rowIdx = uploadUnknowns[uploadUnknownIdx];
    const row = uploadRows[rowIdx];
    const newCorr = {
      ...uploadCorrections,
      [rowIdx]: {
        targetId: targetId || row.fileId,
        isNew: !targetId,
        wing: uploadCurrentEdit.wing,
        dept: uploadCurrentEdit.dept,
        type: uploadCurrentEdit.type,
        a2024: cleanNum(uploadCurrentEdit.a2024),
        b2025: cleanNum(uploadCurrentEdit.b2025),
        b2026: cleanNum(uploadCurrentEdit.b2026),
      }
    };
    setUploadCorrections(newCorr);
    advanceUnknown(newCorr);
  };

  const advanceUnknown = async (corrections) => {
    const nextIdx = uploadUnknownIdx + 1;
    if (nextIdx < uploadUnknowns.length) {
      setUploadUnknownIdx(nextIdx);
      const next = uploadRows[uploadUnknowns[nextIdx]];
      setUploadCurrentEdit(buildEditForRow(next));
      setUploadSearch('');
    } else {
      setUploadStep('uploading');
      await doUpload(uploadRows, corrections);
    }
  };

  const doUpload = async (rows, corrections) => {
    const knownIds = new Set(staticData.map(s => String(s.id).trim().split('.')[0]));
    const payload = rows
      .map((row, i) => {
        const corr = corrections[i];
        const id = corr?.targetId || (knownIds.has(row.fileId) ? row.fileId : null);
        if (!id) return null;
        return {
          id,
          a2026: row.a2026,
          commit: row.commit,
          isNew: corr?.isNew || false,
          name: row.fileName,
          wing: corr?.wing || row.fileWing || '',
          dept: corr?.dept || row.fileDept || '',
          type: corr?.type || row.fileType || 'הוצאה',
          a2024: corr?.a2024 ?? 0,
          b2025: corr?.b2025 ?? 0,
          b2026: corr?.b2026 ?? 0,
        };
      })
      .filter(Boolean);

    // סעיפים שקיימים ב-staticData אך לא הופיעו בקובץ המועלה — מאפסים ביצוע ושריון ל-0
    const uploadedIdsSet = new Set(rows.map(r => String(r.fileId).trim().split('.')[0]));
    staticData.forEach(s => {
      const sid = String(s.id).trim().split('.')[0];
      if (!uploadedIdsSet.has(sid) && !payload.find(p => String(p.id) === sid)) {
        payload.push({ id: sid, a2026: 0, commit: 0, isNew: false, name: s.name || '', wing: s.wing || '', dept: s.dept || '', type: s.type || 'הוצאה', a2024: 0, b2025: 0, b2026: 0 });
      }
    });

    // Debug: הצג את הסעיפים החדשים בלבד
    const newItems = payload.filter(p => p.isNew);
    console.log('isNew items to add:', newItems.length, JSON.stringify(newItems));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 שניות
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'uploadExecution', rows: payload }),
        signal: controller.signal
      }).then(r => { clearTimeout(timeout); return ensureOk(r, 'Upload execution'); });
      const data = await res.json();
      console.log('GAS uploadExecution response:', JSON.stringify(data));
      if (data.success) {
        setUploadStep('uploading'); // נשאר בטעינה בזמן reload
        // ממתינים 2 שניות כדי לאפשר ל-Google Sheet להתעדכן לפני שמושכים CSV
        await new Promise(r => setTimeout(r, 2000));
        const fresh = await loadData();
        if (fresh) {
          runPostUploadValidation(rows, payload, fresh.staticParsed, fresh.execMap);
        } else {
          setUploadStep('done');
        }
      } else {
        alert('שגיאה בהעלאה: ' + (data.error || 'שגיאה כללית'));
        setUploadStep('drop');
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        alert('הבקשה לשרת ארכה יותר מ-30 שניות. ודא שה-GAS פרוס עם גרסה חדשה ונסה שוב.');
      } else {
        alert('שגיאה: ' + e.message);
      }
      setUploadStep('drop');
    }
  };

  const uploadAllWings = useMemo(() => [...new Set(staticData.map(s => cleanStr(s.wing)).filter(Boolean))].sort(), [staticData]);
  const uploadAllDepts = useMemo(() => [...new Set(staticData.map(s => cleanStr(s.dept)).filter(Boolean))].sort(), [staticData]);
  // מחלקות לפי אגף נבחר
  const uploadDeptsForWing = useMemo(() => {
    if (!uploadCurrentEdit?.wing) return uploadAllDepts;
    return [...new Set(staticData.filter(s => sameKey(s.wing, uploadCurrentEdit.wing)).map(s => cleanStr(s.dept)).filter(Boolean))].sort();
  }, [staticData, uploadCurrentEdit?.wing, uploadAllDepts]);

  // התאמה מקסימלית לרשימה קיימת — מחזיר ריק אם אין התאמה טובה
  const fuzzyMatchList = (value, options) => {
    if (!value) return '';
    const norm = normalizeKey(value);
    return options.find(o => normalizeKey(o) === norm) ||
           options.find(o => normalizeKey(o).includes(norm) || norm.includes(normalizeKey(o))) ||
           '';
  };

  const uploadSearchResults = useMemo(() => {
    if (!uploadSearch.trim()) return [];
    const q = uploadSearch.toLowerCase();
    return staticData
      .filter(s => s.id.includes(q) || s.name.toLowerCase().includes(q) || s.dept.toLowerCase().includes(q))
      .slice(0, 8);
  }, [uploadSearch, staticData]);
  // ===== End Upload Wizard Functions =====

  const scopeTitle = useMemo(() => {
    if (!currentUser) return 'כלל המועצה';
    if (currentUser.role === 'ADMIN') return activeWingId || 'כלל המועצה';
    const targets = [currentUser.target1, currentUser.target2].filter(Boolean).map(cleanStr);
    return targets.join(' / ') || activeWingId || 'כלל המועצה';
  }, [currentUser, activeWingId]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-200 flex items-center justify-center p-4 text-right" dir="rtl">
        <div className="bg-white/80 backdrop-blur-xl p-8 lg:p-12 rounded-[2rem] shadow-2xl shadow-slate-200/50 w-full max-w-md border border-white/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-600"></div>
          {isLoggingIn && (
             <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center backdrop-blur-sm rounded-[2rem]">
                <Loader2 className="animate-spin text-emerald-600 mb-3" size={40} strokeWidth={2.5} />
                <span className="font-bold text-slate-600 text-sm tracking-wide">מתחבר...</span>
             </div>
          )}
          <div className="mb-10 text-center flex flex-col items-center">
            <img src="/logo.png" alt="מועצת עומר" className="h-24 object-contain drop-shadow-sm mb-4" />
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">פורטל מועצת עומר</h1>
            <p className="text-slate-500 font-medium text-sm mt-2">ניהול תקציב, תכניות עבודה ובקרה</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input type="text" placeholder="שם משתמש" className="w-full p-4 rounded-xl bg-slate-50/50 border border-slate-200 outline-none font-bold text-right transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 placeholder:text-slate-400" value={uInput} onChange={(e) => setUInput(e.target.value)} />
            </div>
            <div>
              <input type="password" placeholder="סיסמה" className="w-full p-4 rounded-xl bg-slate-50/50 border border-slate-200 outline-none font-bold text-right transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 placeholder:text-slate-400" value={pInput} onChange={(e) => setPInput(e.target.value)} />
            </div>
            {loginError && <div className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-100 text-center animate-in fade-in zoom-in">{loginError}</div>}
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 text-white p-4 rounded-xl font-black text-lg shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] mt-2">כניסה למערכת</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50/50 text-slate-800 flex flex-col font-sans text-right overflow-hidden" dir="rtl">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-700 text-white' :
          toast.type === 'error'   ? 'bg-red-600 text-white' :
                                     'bg-slate-800 text-white'
        }`}>
          {toast.type === 'saving' && <Loader2 size={16} className="animate-spin shrink-0" />}
          {toast.type === 'success' && <span className="shrink-0">✓</span>}
          {toast.type === 'error' && <AlertTriangle size={16} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Global Spinner */}
      {loading && (
        <div className="fixed inset-0 z-[2000] bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100 animate-in zoom-in-95 duration-200">
            <Loader2 className="animate-spin text-emerald-600 mb-3" size={32} />
            <span className="font-bold text-slate-600 text-sm">מרענן נתונים...</span>
          </div>
        </div>
      )}

      {/* Quarter Picker Popup */}
      {showQuarterPicker && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5 text-blue-500">
                <Target size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black mb-1">עדכון תכנית עבודה</h3>
              <p className="text-slate-500 text-sm mb-7">לאיזה רבעון תרצה לעדכן?</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[1, 2, 3, 4].map(q => {
                  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);
                  const isCurrent = q === currentQ;
                  const locked = isQuarterLocked(q);
                  const editAllowed = canEditQuarter(q);
                  return (
                    <button
                      key={q}
                      onClick={() => { setWorkplanQuarter(q); setShowQuarterPicker(false); }}
                      className={`py-4 rounded-2xl font-black text-lg transition-all hover:scale-[1.03] active:scale-[0.97] ${isCurrent ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      רבעון {q}
                      {isCurrent && <div className="text-[10px] font-bold text-blue-200 mt-0.5">נוכחי</div>}
                      {locked && <div className={`text-[10px] font-bold mt-0.5 ${isCurrent ? 'text-blue-200' : editAllowed ? 'text-emerald-600' : 'text-slate-400'}`}>{editAllowed ? '🔓 פתוח' : '🔒 נעול'}</div>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowQuarterPicker(false)} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* תזכורת עדכון רבעוני */}
      {quarterUpdateReminder && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-center text-white">
              <div className="text-4xl mb-3">⏰</div>
              <h3 className="text-xl font-black">תזכורת עדכון רבעון {quarterUpdateReminder.quarter}</h3>
              <p className="text-amber-100 text-sm mt-1 font-bold">
                {quarterUpdateReminder.daysLeft > 0
                  ? `נותרו ${quarterUpdateReminder.daysLeft} ימים עד לנעילה (${QUARTER_LOCK_LABEL[quarterUpdateReminder.quarter]})`
                  : `מועד הנעילה: ${QUARTER_LOCK_LABEL[quarterUpdateReminder.quarter]}`}
              </p>
            </div>
            <div className="p-7 text-center">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
                <p className="text-4xl font-black text-amber-600 mb-1">{quarterUpdateReminder.count}</p>
                <p className="text-sm font-bold text-slate-600">
                  משימות שטרם עודכנו לרבעון {quarterUpdateReminder.quarter}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setQuarterUpdateReminder(null);
                    setHasSeenWorkplanPopup(true);
                    setWorkplanQuarter(quarterUpdateReminder.quarter);
                    setFilterStatus(0);
                    setViewMode('table');
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3.5 rounded-2xl transition-colors shadow-md shadow-amber-200"
                >
                  עבור לעדכון רבעון {quarterUpdateReminder.quarter} ←
                </button>
                <button
                  onClick={() => setQuarterUpdateReminder(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-3 rounded-2xl transition-colors text-sm"
                >
                  סגור — אעדכן מאוחר יותר
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {(activePopup === 'workplan' || activePopup === 'budget') && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500"><AlertTriangle size={32} strokeWidth={2.5} /></div>
              <h3 className="text-xl font-black mb-2">{activePopup === 'workplan' ? 'משימות בפיגור' : 'סעיפים בחריגה'}</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                נמצאו <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md mx-1">{popupCount}</span> 
                {activePopup === 'workplan' ? ' משימות שעבר תאריך היעד שלהן.' : ' סעיפים החורגים מתקציב 2026.'}
              </p>
              <div className="space-y-3">
                <button onClick={() => { if(activePopup === 'workplan') setShowOnlyOverdueTasks(true); else setShowOnlyBudgetAlerts(true); setActivePopup(null); }} className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors">הצג חריגות בלבד</button>
                <button onClick={() => setActivePopup(null)} className="w-full py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">המשך כרגיל</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 px-4 py-3 flex justify-between items-center shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><Menu size={22} /></button>
          
          {/* ----- תוספת הלוגו של המועצה ----- */}
          <div className="flex items-center border-l border-slate-200 pl-4 ml-1">
            <img src="/logo.png" alt="מועצת עומר" className="h-14 lg:h-32 object-contain drop-shadow-sm" />
          </div>
          {/* ---------------------------------- */}

          <div className="hidden sm:flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button onClick={() => { setMainTab('budget'); setViewMode('dashboard'); }} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${mainTab === 'budget' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>תקציב</button>
            <button onClick={() => { setMainTab('workplan'); setViewMode('dashboard'); }} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${mainTab === 'workplan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>תכניות עבודה</button>
            {complaintsRole && <button onClick={async () => { setMainTab('complaints'); await loadComplaints(); if (usersList.length === 0) loadUsers(); }} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${mainTab === 'complaints' ? 'bg-white text-purple-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>פניות ציבור</button>}
            {isAharony && <button onClick={async () => { setMainTab('users'); await loadUsers(); }} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${mainTab === 'users' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>משתמשים</button>}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          
          {/* אינדיקטור שמירה — נקודה עדינה בלבד, ה-toast מספק את ההודעה הברורה */}
          {saveStatus === 'saving' && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
          {saveStatus === 'saved' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
          {saveStatus === 'error' && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}

          <button onClick={loadData} disabled={loading} title={lastRefreshedAt ? `רענון אחרון: ${lastRefreshedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : 'טרם רוענן'} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">רענן נתונים</span>
            {lastRefreshedAt && <span className="hidden sm:inline text-slate-400 font-medium">{lastRefreshedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>}
          </button>
          <button onClick={exportCurrentView} title={`ייצוא CSV — ${mainTab === 'budget' ? (viewMode === 'control' ? 'בקרת חריגות' : 'תקציב') : 'תכנית עבודה'}`} className="hidden sm:flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-bold text-xs shadow-sm hover:bg-slate-50 hover:text-emerald-700 transition-colors">
            <Download size={14} /> ייצוא
          </button>
          <div className="flex flex-col items-end mr-2">
            <span className="text-xs font-black text-slate-800">{currentUser.user}</span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wide">מועצת עומר</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-800 flex items-center justify-center font-black border border-emerald-200 shadow-sm shrink-0">
            {currentUser.user.charAt(0).toUpperCase()}
          </div>
          <button onClick={handleLogout} title="יציאה" className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {isMenuOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[550] lg:hidden" onClick={() => setIsMenuOpen(false)} />}
        <aside className={`fixed lg:static top-0 right-0 h-[100dvh] lg:h-full w-72 bg-white z-[600] lg:z-10 transition-transform duration-300 transform border-l border-slate-100 flex flex-col ${isMenuOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="p-5 lg:hidden flex justify-between items-center border-b border-slate-100 shrink-0">
            <span className="font-black text-lg text-slate-800">תפריט ניווט</span>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={18}/></button>
          </div>
          <div className="p-4 border-b border-slate-100 sm:hidden space-y-2 shrink-0">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">מודולים</p>
             {['budget', 'workplan', ...(complaintsRole ? ['complaints'] : []), ...(isAharony ? ['users'] : [])].map(tab => (
                <button key={tab} onClick={() => { setMainTab(tab); if (tab === 'users') loadUsers(); else if (tab === 'complaints') { loadComplaints(); if (usersList.length === 0) loadUsers(); } else setViewMode('dashboard'); setIsMenuOpen(false); }} className={`w-full text-right px-4 py-3 rounded-xl text-sm font-bold transition-all ${mainTab === tab ? (tab === 'complaints' ? 'bg-purple-50 text-purple-800 border border-purple-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100') : 'text-slate-600 hover:bg-slate-50'}`}>
                  {tab === 'budget' ? 'תקציב' : tab === 'workplan' ? 'תכניות עבודה' : tab === 'complaints' ? 'פניות ציבור' : 'ניהול משתמשים'}
                </button>
             ))}
          </div>
          
          {mainTab !== 'users' && (
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="p-4 space-y-1.5 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">תצוגות</p>
                <button onClick={() => { setViewMode('dashboard'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all border-r-4 ${viewMode === 'dashboard' ? 'bg-slate-900 text-white shadow-md border-emerald-400' : 'text-slate-600 hover:bg-slate-50 border-transparent'}`}>
                  <LayoutDashboard size={18} className={viewMode === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'} /> תמונת מצב
                </button>
                <button onClick={() => { setViewMode('table'); if (mainTab === 'workplan' && workplanQuarter === 0) setShowQuarterPicker(true); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all border-r-4 ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-md border-blue-400' : 'text-slate-600 hover:bg-slate-50 border-transparent'}`}>
                  <TableProperties size={18} className={viewMode === 'table' ? 'text-blue-400' : 'text-slate-400'} /> {mainTab === 'budget' ? 'פירוט תקציב' : 'עדכון משימות'}
                  {mainTab === 'workplan' && overdueTasksCount > 0 && (
                    <span className="mr-auto bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">{overdueTasksCount}</span>
                  )}
                </button>
                {mainTab === 'budget' && (
                  <>
                  <button onClick={() => { setViewMode('control'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all border-r-4 ${viewMode === 'control' ? 'bg-red-50 text-red-700 border-red-400' : 'text-slate-600 hover:bg-slate-50 hover:text-red-600 border-transparent'}`}>
                    <ShieldAlert size={18} className={viewMode === 'control' ? 'text-red-600' : 'text-slate-400'} />
                    <span>בקרת חריגות</span>
                    {budgetAlertsCount > 0 && (
                      <span className="mr-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">{budgetAlertsCount}</span>
                    )}
                  </button>
                  {canUpload && (
                    <button onClick={() => { resetUpload(); setShowUploadModal(true); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-emerald-700 hover:bg-emerald-50 border border-dashed border-emerald-200 hover:border-emerald-400">
                      <Upload size={18} className="text-emerald-500" />
                      <span>טעינת נתוני תקציב</span>
                    </button>
                  )}
                  </>
                )}
              </div>
              <div className="p-4 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">
               {currentUser.role === 'ADMIN' ? 'סינון לפי אגף' : currentUser.role === 'WING' ? 'סינון לפי מחלקה' : 'המחלקה שלי'}
            </p>
            {currentUser.role === 'ADMIN' && (
              <>
                <button onClick={() => { setActiveWingId(null); setFilterDept('הכל'); setBudgetFilterDept('הכל'); setIsMenuOpen(false); }} className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${!activeWingId ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}>כלל המועצה</button>
                {wingsOptions.map((name) => {
                  const Icon = ICONS[name] || Building2;
                  return (
                    <button key={name} onClick={() => { setActiveWingId(name); setFilterDept('הכל'); setBudgetFilterDept('הכל'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${sameKey(activeWingId, name) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <Icon size={14} className={sameKey(activeWingId, name) ? 'text-emerald-600' : 'text-slate-400'} /> <span className="truncate">{name}</span>
                    </button>
                  );
                })}
              </>
            )}
            {currentUser.role === 'WING' && (
              <>
                <button onClick={() => { setFilterDept('הכל'); setBudgetFilterDept('הכל'); setIsMenuOpen(false); }} className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${(filterDept === 'הכל' && budgetFilterDept === 'הכל') ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}>{currentUser.target1} (כל המחלקות)</button>
                {wingDeptsList.map((name) => {
                  const isActive = filterDept === name || budgetFilterDept === name;
                  return (
                    <button key={name} onClick={() => { setFilterDept(name); setBudgetFilterDept(name); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} /> <span className="truncate">{name}</span>
                    </button>
                  );
                })}
              </>
            )}
            {currentUser.role === 'DEPT' && (
              <div className="flex flex-col gap-2">
                {[currentUser.target1, currentUser.target2].filter(Boolean).length > 1 && (
                  <button 
                    onClick={() => { setFilterDept('הכל'); setBudgetFilterDept('הכל'); setIsMenuOpen(false); }} 
                    className={`w-full text-right px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${(filterDept === 'הכל' && budgetFilterDept === 'הכל') ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
                  >
                    כל המחלקות שלי
                  </button>
                )}
                {[currentUser.target1, currentUser.target2].filter(Boolean).map(deptName => {
                  const nameStr = cleanStr(deptName);
                  const isActive = sameKey(filterDept, nameStr) || sameKey(budgetFilterDept, nameStr);
                  // אם יש רק מחלקה אחת, היא תוצג ככפתור כהה וללא אפשרות לחיצה
                  const isSingleDept = [currentUser.target1, currentUser.target2].filter(Boolean).length === 1;

                  return (
                    <button 
                      key={nameStr} 
                      onClick={() => { 
                        if (!isSingleDept) {
                          setFilterDept(nameStr); 
                          setBudgetFilterDept(nameStr); 
                          setIsMenuOpen(false); 
                        }
                      }} 
                      className={`w-full flex items-center justify-start gap-3 px-4 py-2.5 rounded-xl text-xs transition-all ${isSingleDept ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-100 cursor-default' : isActive ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-200 shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
                    >
                      <Building2 size={16} className={isSingleDept || isActive ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'} />
                      <span className="truncate">{nameStr}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 scroll-smooth relative">
          {orphanedDataAlert && (
            <div className="mb-6 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full"><ShieldAlert className="text-red-600" size={20} /></div>
                <div>
                  <h4 className="font-black text-red-800 text-sm">התראת מנהל: נתונים ללא שיוך מזהה (יתומים)</h4>
                  <p className="text-xs text-red-600 font-bold mt-1">נמצאו {orphanedDataAlert.budgets} סעיפי תקציב ו-{orphanedDataAlert.works} משימות שחסר להם שיוך תקין לאגף או מחלקה בקובץ המקור.</p>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 mt-2">
              <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {mainTab === 'users' ? 'ניהול גישה והרשאות' : mainTab === 'complaints' ? (
                  <><MessageSquare className="text-purple-500 hidden sm:block" size={28} />פניות ציבור</>
                ) : (
                  <>{mainTab === 'budget' && <Wallet className="text-emerald-500 hidden sm:block" size={28} />}{mainTab === 'workplan' && <Target className="text-blue-500 hidden sm:block" size={28} />}{scopeTitle}</>
                )}
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1.5 flex items-center gap-2">
                {mainTab === 'budget' && viewMode === 'dashboard' && 'תקציר ביצועים פיננסיים והתפלגות לפי מחלקות.'}
                {mainTab === 'budget' && viewMode === 'table' && 'פירוט סעיפים מלא וניתוח שורות תקציב.'}
                {mainTab === 'budget' && viewMode === 'control' && 'זיהוי חריגות וניהול סיכונים תקציביים.'}
                {mainTab === 'workplan' && viewMode === 'dashboard' && 'מעקב התקדמות ויעדים אסטרטגיים.'}
                {mainTab === 'workplan' && viewMode === 'table' && 'עדכון סטטוסים והערות למשימות שוטפות.'}
                {mainTab === 'complaints' && 'רישום, מעקב וטיפול בפניות תושבים.'}
              </p>
            </div>

            {/* --------- USERS TAB --------- */}
            {mainTab === 'users' && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-5">הוספת משתמש חדש</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input type="text" placeholder="שם משתמש" value={userForm.username} onChange={(e) => setUserForm(p => ({ ...p, username: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  <input type="text" placeholder="סיסמה" value={userForm.password} onChange={(e) => setUserForm(p => ({ ...p, password: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  <input type="email" placeholder="אימייל" value={userForm.email || ''} onChange={(e) => setUserForm(p => ({ ...p, email: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  <select value={userForm.role} onChange={(e) => setUserForm(p => ({ ...p, role: e.target.value, target1: '', target2: '' }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                    <option value="ADMIN">מנהל (ADMIN)</option><option value="WING">ראש אגף (WING)</option><option value="DEPT">מנהל מחלקה (DEPT)</option>
                  </select>
                  <select value={userForm.permissions} onChange={(e) => setUserForm(p => ({ ...p, permissions: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                    <option value="VIEW">צפייה בלבד</option>
                    <option value="EDIT">צפייה + עריכה</option>
                  </select>
                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <input type="checkbox" id="newUserAddUser" checked={!!userForm.addUser} onChange={(e) => setUserForm(p => ({ ...p, addUser: e.target.checked ? 'budget' : '' }))} className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                    <label htmlFor="newUserAddUser" className="text-sm font-bold text-slate-700 cursor-pointer select-none flex-1">טעינת נתונים</label>
                    {userForm.addUser && (
                      <select value={userForm.addUser} onChange={(e) => setUserForm(p => ({ ...p, addUser: e.target.value }))} className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="budget">נתוני תקציב</option>
                      </select>
                    )}
                  </div>
                  <select value={userForm.active} onChange={(e) => setUserForm(p => ({ ...p, active: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                    <option value="TRUE">סטטוס: פעיל</option><option value="FALSE">סטטוס: מושהה</option>
                  </select>
                  <select value={userForm.complaintsRole || ''} onChange={(e) => setUserForm(p => ({ ...p, complaintsRole: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500/20">
                    <option value="">פניות ציבור: ללא גישה</option>
                    <option value="viewer">פניות ציבור: צפייה</option>
                    <option value="editor">פניות ציבור: עריכה</option>
                    <option value="manager">פניות ציבור: ניהול רגיל</option>
                    <option value="admin">פניות ציבור: ניהול מלא</option>
                  </select>
              </div>
                  {userForm.role !== 'ADMIN' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-50">
                      <select value={userForm.target1} onChange={(e) => setUserForm(p => ({ ...p, target1: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                        <option value="">בחר יעד הרשאה 1 (חובה)</option>{userTargetOptions(userForm.role).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <select value={userForm.target2} onChange={(e) => setUserForm(p => ({ ...p, target2: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                        <option value="">בחר יעד הרשאה 2 (אופציונלי)</option>{userTargetOptions(userForm.role).filter(opt => opt !== userForm.target1).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={addUser} className="mt-5 w-full md:w-auto bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-800 shadow-md transition-colors">+ צור משתמש</button>
                </div>
                {usersLoading ? ( <div className="flex flex-col items-center py-12"><Loader2 className="animate-spin text-slate-300 mb-2" size={32} /></div> ) : (
                  <div className="space-y-3">
                    {usersList.map((u) => {
                      const isAd = u.role === 'ADMIN';
                      return (
                        <div key={u.id} className="bg-white p-3 lg:p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col xl:flex-row gap-3 xl:items-center">
                          <div className="bg-slate-50 text-slate-400 font-mono text-[10px] py-1 px-2 rounded-md shrink-0 self-start xl:self-center">#{u.id}</div>
                          
                          {/* גריד דינמי: 6 עמודות לאדמין, 8 עמודות לאחרים */}
                          <div className="flex-1 flex flex-col gap-0 min-w-0">
                          <div className={`grid gap-2 w-full ${isAd ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-8'}`}>

                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">שם משתמש</span>
                              <input value={u.username} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, username: e.target.value } : x))} className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500" />
                            </div>

                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">סיסמה</span>
                              <input value={u.password} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, password: e.target.value } : x))} className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500" />
                            </div>

                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">אימייל</span>
                              <input type="email" value={u.email || ''} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, email: e.target.value } : x))} className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500" placeholder="mail@example.com" />
                            </div>

                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">תפקיד</span>
                              <select value={u.role} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, role: e.target.value, target1: '', target2: '' } : x))} className="w-full py-1.5 px-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none"><option value="ADMIN">ADMIN</option><option value="WING">WING</option><option value="DEPT">DEPT</option></select>
                            </div>

                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">הרשאות</span>
                              <select value={u.permissions || 'EDIT'} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, permissions: e.target.value } : x))} className="w-full py-1.5 px-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none">
                                <option value="VIEW">צפייה</option>
                                <option value="EDIT">עריכה</option>
                              </select>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">טעינת נתונים</span>
                              <div className="flex items-center gap-1.5 py-1.5">
                                <input type="checkbox" checked={!!u.addUser} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, addUser: e.target.checked ? 'budget' : '' } : x))} className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer" />
                                {u.addUser && (
                                  <select value={u.addUser} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, addUser: e.target.value } : x))} className="py-1 px-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none">
                                    <option value="budget">תקציב</option>
                                  </select>
                                )}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">סטטוס</span>
                              <select value={String(u.active).toUpperCase()} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, active: e.target.value } : x))} className="w-full py-1.5 px-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none"><option value="TRUE">פעיל</option><option value="FALSE">לא פעיל</option></select>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">פניות ציבור</span>
                              <select value={u.complaintsRole || ''} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, complaintsRole: e.target.value } : x))} className="w-full py-1.5 px-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none focus:ring-1 focus:ring-purple-500">
                                <option value="">ללא גישה</option>
                                <option value="viewer">צפייה</option>
                                <option value="editor">עריכה</option>
                                <option value="manager">ניהול רגיל</option>
                                <option value="admin">ניהול מלא</option>
                              </select>
                            </div>

                            {!isAd && (
                              <>
                                <div className="min-w-0">
                                  <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">יעד 1</span>
                                  <select value={u.target1 || ''} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, target1: e.target.value } : x))} className="w-full py-1.5 px-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none"><option value="">יעד 1</option>{userTargetOptions(u.role).map(o => <option key={o} value={o}>{o}</option>)}</select>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[9px] font-bold text-slate-400 block mb-0.5 truncate">יעד 2</span>
                                  <select value={u.target2 || ''} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, target2: e.target.value } : x))} className="w-full py-1.5 px-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none"><option value="">יעד 2</option>{userTargetOptions(u.role).filter(o => o !== u.target1).map(o => <option key={o} value={o}>{o}</option>)}</select>
                                </div>
                              </>
                            )}
                          </div>

                          {u.role !== 'ADMIN' && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 block mb-1.5 uppercase tracking-widest">עריכה לאחר נעילת רבעון</span>
                              <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4].map(q => {
                                  const locked = isQuarterLocked(q);
                                  const unlocked = !!(u[`q${q}`]);
                                  return (
                                    <button
                                      key={q}
                                      onClick={() => locked && toggleQuarterPermission(u, q)}
                                      title={locked ? (unlocked ? 'לחץ לנעילה' : 'לחץ לפתיחת עריכה') : `יינעל ב-${QUARTER_LOCK_LABEL[q]}`}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                                        !locked
                                          ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-default'
                                          : unlocked
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                      }`}
                                    >
                                      <span>{!locked ? '⏳' : unlocked ? '🔓' : '🔒'}</span>
                                      <span>ר{q}</span>
                                      {locked && <span className="opacity-60">{unlocked ? 'פתוח' : 'נעול'}</span>}
                                      {!locked && <span className="opacity-50">{QUARTER_LOCK_LABEL[q]}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          </div>{/* /flex-1 wrapper */}

                          <div className="flex w-full xl:w-auto gap-2 shrink-0 mt-2 xl:mt-0">
                            <button onClick={() => updateUserRow(u)} className="flex-1 xl:flex-none bg-blue-50 text-blue-700 px-5 py-2 rounded-md font-bold text-xs border border-blue-200 transition-colors hover:bg-blue-100">שמור</button>
                            <button onClick={() => deactivateUserRow(u.id)} className="flex-1 xl:flex-none bg-white text-red-600 px-5 py-2 rounded-md font-bold text-xs border border-red-200 transition-colors hover:bg-red-50">מחק</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* --------- BUDGET TAB --------- */}
            {mainTab === 'budget' && (
              <div className="space-y-6">
                
                {viewMode === 'dashboard' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                      <StatCard title="תקציב 2026 (הוצאות)" value={formatILS(budgetStats.expB26)} icon={Wallet} isHighlight={true} />
                      <StatCard title="ביצוע + שריון 2026" value={formatILS(budgetStats.expCommit26)} icon={TrendingUp} progress={budgetStats.expB26 > 0 ? Math.round((budgetStats.expCommit26 / budgetStats.expB26) * 100) : 0} />
                      <StatCard title="ביצוע בפועל 2026" value={formatILS(budgetStats.expExec26)} icon={TrendingDown} progress={budgetStats.expB26 > 0 ? Math.round((budgetStats.expExec26 / budgetStats.expB26) * 100) : 0} />
                      <StatCard title="הכנסות (תקציב 2026)" value={formatILS(budgetStats.incB26)} />
                      <StatCard title="הכנסות (ביצוע בפועל)" value={formatILS(budgetStats.incExec26)} progress={budgetStats.incB26 > 0 ? Math.round((budgetStats.incExec26 / budgetStats.incB26) * 100) : 0} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] p-6 min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-end mb-6"><h3 className="font-black text-slate-800 text-lg">פילוח תקציב הוצאות למחלקות (2026)</h3></div>
                        <div dir="ltr" style={{flex:1, minHeight: Math.max(300, budgetByDeptChart.length * 38)}}>
                          <ResponsiveContainer width="100%" height="100%" minHeight={Math.max(300, budgetByDeptChart.length * 38)}>
                            <BarChart layout="vertical" data={budgetByDeptChart} margin={{ top: 0, right: 70, left: 0, bottom: 0 }}>
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={165} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} tickFormatter={(v) => v.length > 20 ? v.slice(0, 19) + '…' : v} />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 'bold' }} formatter={(v) => formatILS(v)} />
                              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} label={{ position: 'right', fontSize: 10, fontWeight: 700, fill: '#64748b', formatter: (v) => formatILS(v) }}>
                                {budgetByDeptChart.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="grid grid-rows-2 gap-6 h-full">
                         <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] p-6 flex flex-col items-center justify-center relative">
                            <h3 className="font-bold text-slate-400 text-xs tracking-widest uppercase absolute top-5 right-6">הכנסות מול הוצאות</h3>
                            {budgetByTypePie.length > 0 ? (
                               <div className="w-full h-full flex items-center justify-center mt-6">
                                  <ResponsiveContainer width="100%" height={160}>
                                    <PieChart><Pie data={budgetByTypePie} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70} stroke="none" paddingAngle={5}>{budgetByTypePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => formatILS(v)} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 'bold' }} /></PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute bottom-5 flex gap-4">{budgetByTypePie.map((item, i) => (<div key={item.name} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: PIE_COLORS[i % PIE_COLORS.length]}}></div> {item.name}</div>))}</div>
                               </div>
                            ) : (<span className="text-slate-300 font-bold text-sm">אין נתונים</span>)}
                         </div>
                         <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] p-6 flex flex-col items-center justify-center relative">
                            <h3 className="font-bold text-slate-400 text-xs tracking-widest uppercase absolute top-5 right-6">ביצוע הוצאות 2026</h3>
                            {budgetStats.expB26 > 0 ? (() => {
                              const pct = Math.min(Math.round((budgetStats.expExec26 / budgetStats.expB26) * 100), 100);
                              const gaugeColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#0d9488';
                              return (
                                <div className="relative flex flex-col items-center mt-2" style={{height: 130}}>
                                  <ResponsiveContainer width={180} height={100}>
                                    <PieChart>
                                      <Pie data={[{ value: pct }, { value: 100 - pct }]} startAngle={180} endAngle={0} cx="50%" cy="100%" innerRadius={52} outerRadius={72} dataKey="value" stroke="none">
                                        <Cell fill={gaugeColor} />
                                        <Cell fill="#e2e8f0" />
                                      </Pie>
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="text-center -mt-2">
                                    <p className="text-3xl font-black" style={{ color: gaugeColor }}>{pct}%</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">מהתקציב בוצע</p>
                                    <p className="text-[10px] text-slate-400">{formatILS(budgetStats.expExec26)} מתוך {formatILS(budgetStats.expB26)}</p>
                                  </div>
                                </div>
                              );
                            })() : (<span className="text-slate-300 font-bold text-sm">אין נתונים</span>)}
                         </div>
                      </div>
                    </div>
                    {top5Overages.length > 0 && (
                      <div className="bg-white rounded-3xl border border-red-100 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-black text-slate-800 text-base flex items-center gap-2"><ShieldAlert size={18} className="text-red-500"/> 5 החריגות הגדולות</h3>
                          <button onClick={() => setViewMode('control')} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors">לכל החריגות ←</button>
                        </div>
                        <div className="space-y-2">
                          {top5Overages.map((r, i) => (
                            <div key={r.id} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                              <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-slate-800 truncate">{r.name}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{r.dept} · {r.type}</p>
                              </div>
                              <div className="text-left shrink-0">
                                <p className="text-sm font-black text-red-600 tabular-nums" dir="ltr">{formatILS(Math.abs(r.balance))}</p>
                                <p className="text-[10px] text-slate-400 font-medium">חריגה</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {viewMode === 'table' && (
                  <div className="space-y-4">
                    <div className="bg-white p-2 pl-4 pr-2 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col lg:flex-row gap-3 items-center justify-between sticky top-20 z-40">
                       <div className="flex w-full lg:w-auto items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all flex-1 lg:max-w-xs">
                          <Search size={16} className="text-slate-400 mr-2 shrink-0" /><input type="text" placeholder="חיפוש סעיף..." value={budgetSearch} onChange={(e) => setBudgetSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full" />
                       </div>
                       <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
                          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 shrink-0"><div className="px-3 text-slate-400"><Filter size={14} /></div><select value={budgetFilterDept} onChange={(e) => setBudgetFilterDept(e.target.value)} className="bg-transparent py-2.5 pl-4 pr-1 text-sm font-bold text-slate-700 outline-none appearance-none"><option value="הכל">כל המחלקות</option>{budgetDeptOptions.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 shrink-0"><select value={budgetTypeFilter} onChange={(e) => setBudgetTypeFilter(e.target.value)} className="bg-transparent py-2.5 px-4 text-sm font-bold text-slate-700 outline-none appearance-none"><option value="הכל">הכנסה/הוצאה</option><option value="הכנסה">הכנסה בלבד</option><option value="הוצאה">הוצאה בלבד</option></select></div>
                       </div>
                       <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                         <span className="text-[9px] font-black text-slate-400 px-2 uppercase tracking-widest whitespace-nowrap">עמודות:</span>
                         {[ { k: 'a2024', l: 'ביצוע 24' }, { k: 'b2025', l: 'תקציב 25' }, { k: 'b2026', l: 'תקציב 26' }, { k: 'a2026', l: 'ביצוע 26' }, { k: 'commitTotal2026', l: 'שריון+ביצוע' } ].map((col) => (<button key={col.k} onClick={() => toggleBudgetColumn(col.k)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${budgetVisibleColumns[col.k] ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'}`}>{col.l}</button>))}
                       </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 py-1 text-xs font-bold text-slate-500">
                      <span>מציג <span className="text-slate-800">{filteredBudgetData.length}</span> סעיפים</span>
                      <span className="text-slate-200 hidden sm:inline">|</span>
                      <span className="hidden sm:inline">הוצאות: <span className="text-orange-600">{formatILS(filteredBudgetData.filter(r => sameKey(r.type,'הוצאה')).reduce((s,r) => s + r.b2026, 0))}</span></span>
                      <span className="text-slate-200 hidden sm:inline">|</span>
                      <span className="hidden sm:inline">הכנסות: <span className="text-emerald-600">{formatILS(filteredBudgetData.filter(r => sameKey(r.type,'הכנסה')).reduce((s,r) => s + r.b2026, 0))}</span></span>
                    </div>
                    <div className="hidden lg:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="py-4 px-5 w-24">מזהה</th><th className="py-4 px-5">שם סעיף תקציבי</th><th className="py-4 px-5 w-32">מחלקה</th><th className="py-4 px-5 w-24 text-center">סוג</th>{visibleBudgetColumnDefs.map((col) => <th key={col.key} className="py-4 px-5 w-32 text-left">{col.label}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredBudgetData.length === 0 ? (
                            <tr><td colSpan={4 + visibleBudgetColumnDefs.length} className="py-20 text-center">
                              <div className="flex flex-col items-center gap-3 text-slate-300">
                                <Search size={36} strokeWidth={1.5} />
                                <p className="font-black text-slate-400 text-base">לא נמצאו סעיפים</p>
                                <p className="text-sm text-slate-400">נסה לשנות את פרמטרי החיפוש</p>
                              </div>
                            </td></tr>
                          ) : filteredBudgetData.map((row) => {
                            const rowBalance = row.b2026 - row.a2026;
                            const rowIsRed = (sameKey(row.type,'הכנסה') && rowBalance > 0) || (sameKey(row.type,'הוצאה') && rowBalance < 0);
                            return (
                            <tr key={row.id} className={`transition-colors group ${rowIsRed ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/50'}`}>
                              <td className="py-3 px-5 text-[10px] font-mono cursor-pointer select-none transition-colors" onClick={() => { navigator.clipboard.writeText(String(row.id)); setCopiedId(row.id); setTimeout(() => setCopiedId(null), 1500); }} title="לחץ להעתקה"><span className={copiedId === row.id ? 'text-emerald-600 font-bold' : 'text-slate-400 group-hover:text-slate-600'}>{copiedId === row.id ? '✓ הועתק' : row.id}</span></td><td className="py-3 px-5 text-sm font-black text-slate-800">{row.name}</td><td className="py-3 px-5 text-xs font-bold text-slate-500">{row.dept}</td>
                              <td className="py-3 px-5 text-center"><span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold ${sameKey(row.type, 'הכנסה') ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>{row.type}</span></td>
                              {visibleBudgetColumnDefs.map((col) => (<td key={col.key} className="py-3 px-5 text-sm font-bold text-slate-700 text-left tabular-nums">{formatILS(col.value(row))}</td>))}
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="lg:hidden space-y-3 pb-10">
                       <div className="text-xs font-bold text-slate-400 mb-2 px-1">מציג {filteredBudgetData.length} סעיפים</div>
                       {filteredBudgetData.map((row) => (
                          <div key={row.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                             <div className={`absolute top-0 right-0 w-1 h-full ${sameKey(row.type, 'הכנסה') ? 'bg-emerald-400' : 'bg-orange-400'}`}></div>
                             <div className="flex justify-between items-start mb-3">
                               <div className="pr-2"><div className="text-[10px] font-mono text-slate-400 mb-0.5">{row.id}</div><div className="font-black text-slate-800 text-sm leading-snug">{row.name}</div><div className="text-xs text-slate-500 font-medium mt-1">{row.dept}</div></div>
                               <div className={`text-[9px] font-bold px-2 py-1 rounded-md shrink-0 ${sameKey(row.type, 'הכנסה') ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>{row.type}</div>
                             </div>
                             <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-y-3 gap-x-2">
                                {visibleBudgetColumnDefs.map((col) => (<div key={col.key} className="flex flex-col"><span className="text-[9px] uppercase font-bold text-slate-400">{col.label}</span><span className="text-xs font-black text-slate-700 tabular-nums mt-0.5">{formatILS(col.value(row))}</span></div>))}
                             </div>
                          </div>
                       ))}
                    </div>
                  </div>
                )}

                {viewMode === 'control' && (
                  <div className="space-y-4">
                    <div className="bg-white p-2 pl-4 pr-2 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col lg:flex-row gap-3 items-center justify-between sticky top-20 z-40">
                       <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-full lg:w-auto shrink-0">
                         <button onClick={() => setControlCompareBy('a2026')} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${controlCompareBy === 'a2026' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>מול ביצוע</button>
                         <button onClick={() => setControlCompareBy('commitTotal2026')} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${controlCompareBy === 'commitTotal2026' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>מול ביצוע+שריון</button>
                       </div>
                       <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
                          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 shrink-0"><div className="px-3 text-slate-400"><Filter size={14} /></div><select value={budgetFilterDept} onChange={(e) => setBudgetFilterDept(e.target.value)} className="bg-transparent py-2.5 pl-4 pr-1 text-sm font-bold text-slate-700 outline-none appearance-none"><option value="הכל">כל המחלקות</option>{budgetDeptOptions.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 shrink-0"><select value={budgetTypeFilter} onChange={(e) => setBudgetTypeFilter(e.target.value)} className="bg-transparent py-2.5 px-4 text-sm font-bold text-slate-700 outline-none appearance-none"><option value="הכל">הכנסה/הוצאה</option><option value="הכנסה">הכנסה בלבד</option><option value="הוצאה">הוצאה בלבד</option></select></div>
                       </div>
                       <button onClick={() => setShowOnlyBudgetAlerts(p => !p)} className={`w-full lg:w-auto px-4 py-2 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border ${showOnlyBudgetAlerts ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}>
                         <ShieldAlert size={14} /> {showOnlyBudgetAlerts ? 'מציג חריגות בלבד' : 'סנן חריגות בלבד'}
                         {showOnlyBudgetAlerts && <X size={13} className="mr-1 opacity-80" />}
                       </button>
                    </div>
                    <div className="hidden lg:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="py-4 px-5 w-24">מזהה</th><th className="py-4 px-5">שם סעיף</th><th className="py-4 px-5 w-24 text-center">סוג</th><th className="py-4 px-5 text-left w-32">תקציב 2026</th><th className="py-4 px-5 text-left w-32">{controlCompareBy === 'a2026' ? 'ביצוע' : 'ביצוע+שריון'}</th><th className="py-4 px-5 text-left w-32">יתרה</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {controlData.map((row) => (
                            <tr key={row.id} className={`transition-colors group ${row.isRed ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/50'}`}>
                              <td className="py-3 px-5 text-[10px] font-mono text-slate-400">{row.id}</td>
                              <td className="py-3 px-5 text-sm font-black text-slate-800">
                                {row.name}
                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">{row.dept}</div>
                              </td>
                              <td className="py-3 px-5 text-center"><span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${sameKey(row.type, 'הכנסה') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.type}</span></td>
                              <td className="py-3 px-5 text-sm font-bold text-slate-600 text-left tabular-nums">{formatILS(row.b2026)}</td>
                              <td className="py-3 px-5 text-sm font-bold text-slate-600 text-left tabular-nums">{formatILS(row.compareValue)}</td>
                              <td className={`py-3 px-5 text-sm font-black text-left tabular-nums ${row.isRed ? 'text-red-600' : 'text-emerald-600'}`}>
                                <div className="flex items-center justify-end gap-1.5">
                                  {row.isRed ? <TrendingDown size={14} className="text-red-400"/> : <CheckCircle2 size={14} className="text-emerald-400"/>}
                                  <span dir="ltr">{formatILS(row.balance)}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="lg:hidden space-y-3 pb-10">
                       {controlData.map((row) => (
                          <div key={row.id} className={`p-4 rounded-2xl border shadow-sm relative overflow-hidden ${row.isRed ? 'bg-red-50/30 border-red-100' : 'bg-white border-slate-100'}`}>
                             <div className={`absolute top-0 right-0 w-1.5 h-full ${row.isRed ? 'bg-red-500' : 'bg-slate-200'}`}></div>
                             <div className="pr-3 mb-3"><div className="font-black text-slate-800 text-sm leading-tight">{row.name}</div><div className="text-[10px] font-mono text-slate-400 mt-1">{row.id} &bull; {row.dept}</div></div>
                             <div className="bg-white/60 rounded-xl p-3 grid grid-cols-3 gap-2 text-center items-center border border-slate-50/50">
                                <div><div className="text-[9px] uppercase font-bold text-slate-400 mb-1">תקציב</div><div className="text-xs font-bold text-slate-700">{formatILS(row.b2026)}</div></div>
                                <div><div className="text-[9px] uppercase font-bold text-slate-400 mb-1">{controlCompareBy === 'a2026' ? 'ביצוע' : 'שריון+ביצוע'}</div><div className="text-xs font-bold text-slate-700">{formatILS(row.compareValue)}</div></div>
                                <div className={`p-1.5 rounded-lg ${row.isRed ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}><div className="text-[9px] uppercase font-black mb-0.5">יתרה</div><div className="text-xs font-black tabular-nums" dir="ltr">{formatILS(row.balance)}</div></div>
                             </div>
                          </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --------- WORKPLAN TAB --------- */}
            {mainTab === 'workplan' && (
              <div className="space-y-6">
                <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 w-full max-w-2xl mx-auto mb-6">
                   {viewMode === 'dashboard' && ( <button onClick={() => setWorkplanQuarter(0)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${workplanQuarter === 0 ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>שנתי</button> )}
                   {[1, 2, 3, 4].map(q => {
                     const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);
                     const isCurrent = q === currentQ;
                     const qEndMonth = q * 3;
                     const qEnd = new Date(new Date().getFullYear(), qEndMonth, 0);
                     const daysLeft = isCurrent ? Math.max(0, Math.ceil((qEnd - new Date()) / 86400000)) : null;
                     return (
                       <button key={q} onClick={() => setWorkplanQuarter(q)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex flex-col items-center leading-tight ${workplanQuarter === q ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                         <span>רבעון {q}</span>
                         {isCurrent && <span className={`text-[9px] font-bold mt-0.5 ${workplanQuarter === q ? 'text-blue-400' : 'text-orange-400'}`}>עוד {daysLeft} ימים</span>}
                       </button>
                     );
                   })}
                </div>

                {viewMode === 'dashboard' && (currentUser.role === 'ADMIN' || currentUser.role === 'WING') && (
                  <div className="bg-white p-2 pl-4 pr-2 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center mb-6 w-full lg:w-1/3">
                    <div className="px-3 text-slate-400"><Filter size={16} /></div>
                    <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-full bg-transparent py-2 text-sm font-bold text-slate-700 outline-none">
                      <option value="הכל">כל המחלקות המורשות</option>
                      {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                {viewMode === 'dashboard' ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 lg:gap-4 mb-6">
                      <div
                        className={`p-5 rounded-2xl shadow-lg flex flex-col justify-center text-center cursor-pointer transition-all ${filterStatus === null && !showOnlyOverdueTasks ? 'bg-slate-900 text-white shadow-slate-900/10' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                        onClick={() => { setFilterStatus(null); setShowOnlyOverdueTasks(false); }}
                        title="הצג הכל — נקה סינון"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-400">סה"כ</p>
                        <p className="text-3xl font-black">{workStats.total}</p>
                        <p className={`text-[9px] font-bold mt-1 ${filterStatus === null && !showOnlyOverdueTasks ? 'text-slate-400' : 'text-slate-400'}`}>{filterStatus !== null || showOnlyOverdueTasks ? 'לחץ לנקות סינון' : 'כל המשימות'}</p>
                      </div>
                      <div
                        className={`p-5 rounded-2xl border flex flex-col justify-center text-center shadow-sm cursor-pointer transition-all ${showOnlyOverdueTasks ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-400 ring-offset-2' : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'}`}
                        onClick={() => setShowOnlyOverdueTasks(p => !p)}
                      >
                        <div className="flex justify-center items-center gap-1.5 mb-1">
                          <AlertTriangle size={14} className={showOnlyOverdueTasks ? 'text-red-200' : 'text-red-500'} />
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${showOnlyOverdueTasks ? 'text-red-200' : 'text-red-600'}`}>בחריגה</p>
                        </div>
                        <p className="text-3xl font-black">{workStats.overdue}</p>
                        <p className={`text-[9px] font-bold mt-1 ${showOnlyOverdueTasks ? 'text-red-200' : 'text-red-400'}`}>{showOnlyOverdueTasks ? 'סינון פעיל — לחץ לביטול' : 'לחץ לסינון'}</p>
                      </div>
                      <div
                        className={`p-5 rounded-2xl border flex flex-col justify-center text-center shadow-sm cursor-pointer transition-all ${filterStatus === 0 ? 'bg-violet-600 text-white border-violet-600 ring-2 ring-violet-400 ring-offset-2 scale-[1.02]' : 'bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100'}`}
                        onClick={() => setFilterStatus(filterStatus === 0 ? null : 0)}
                      >
                        <div className="flex justify-center items-center gap-1.5 mb-1">
                          <ClipboardList size={14} className={filterStatus === 0 ? 'text-violet-200' : 'text-violet-500'} />
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${filterStatus === 0 ? 'text-violet-200' : 'text-violet-600'}`}>טרם עודכן</p>
                        </div>
                        <p className="text-3xl font-black">{workStats.m}</p>
                        <p className={`text-[9px] font-bold mt-1 ${filterStatus === 0 ? 'text-violet-200' : 'text-violet-400'}`}>{filterStatus === 0 ? 'סינון פעיל — לחץ לביטול' : 'לחץ לסינון'}</p>
                      </div>
                      {[
                        { s: 1, title: 'בוצע',    icon: CheckCircle2, val: `${workStats.p1}%`, count: workStats.s1,  ring: 'ring-emerald-400' },
                        { s: 2, title: 'בעיכוב',  icon: Clock,        val: `${workStats.p2}%`, count: workStats.s2,  ring: 'ring-amber-400'   },
                        { s: 3, title: 'בהקפאה',  icon: MinusCircle,  val: `${workStats.p3}%`, count: workStats.s3,  ring: 'ring-red-400'     },
                        { s: 4, title: 'ממתין',   icon: HelpCircle,   val: workStats.s4,       count: workStats.s4,  ring: 'ring-slate-400'   },
                      ].map(({ s, title, icon, val, count, ring }) => (
                        <div
                          key={s}
                          className={`cursor-pointer transition-all rounded-2xl ${filterStatus === s ? `ring-2 ${ring} ring-offset-2 shadow-lg scale-[1.02]` : 'hover:scale-[1.02]'}`}
                          onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                        >
                          <StatCard
                            title={title}
                            value={val}
                            subtext={filterStatus === s ? 'סינון פעיל — לחץ לביטול' : `${count} משימות — לחץ לסינון`}
                            icon={icon}
                          />
                        </div>
                      ))}
                    </div>

                    {(filterStatus !== null || showOnlyOverdueTasks) && (
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-[11px] font-bold text-slate-500">הדאשבורד מציג:</span>
                        {filterStatus !== null && (
                          filterStatus === 0
                            ? <span className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                                טרם עודכן בלבד
                                <button onClick={() => setFilterStatus(null)}><X size={11} /></button>
                              </span>
                            : <span className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full ${STATUS_CONFIG[filterStatus].bg} ${STATUS_CONFIG[filterStatus].text} border ${STATUS_CONFIG[filterStatus].border}`}>
                                {STATUS_CONFIG[filterStatus].label} בלבד
                                <button onClick={() => setFilterStatus(null)}><X size={11} /></button>
                              </span>
                        )}
                        {showOnlyOverdueTasks && (
                          <span className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                            חריגות בלבד
                            <button onClick={() => setShowOnlyOverdueTasks(false)}><X size={11} /></button>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[350px]">
                          <h3 className="font-black text-slate-800 mb-6 text-sm">התפלגות סטטוס משימות ({workplanQuarter === 0 ? 'שנתי' : `רבעון ${workplanQuarter}`})</h3>
                          <ResponsiveContainer width="100%" height={260}>
                             <BarChart data={[{ n: 'בוצע', v: workStats.s1 }, { n: 'עיכוב', v: workStats.s2 }, { n: 'עצירה', v: workStats.s3 }, { n: 'ממתין', v: workStats.s4 }]} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="n" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#64748b' }} />
                                <YAxis hide />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius:'10px', border:'none', boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}} />
                                <Bar dataKey="v" radius={[8, 8, 0, 0]} barSize={48}>{[1, 2, 3, 4].map((_, i) => <Cell key={i} fill={STATUS_CONFIG[i + 1].color} />)}</Bar>
                             </BarChart>
                          </ResponsiveContainer>
                       </div>
                       <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[350px]">
                          <h3 className="font-black text-slate-800 mb-6 text-sm">עומס משימות לפי {activeWingId ? 'מחלקה' : 'אגף'}</h3>
                          <div dir="ltr">
                            <ResponsiveContainer width="100%" height={260}>
                               <BarChart layout="vertical" data={Array.from(new Set(baseWorkData.map((t) => (activeWingId ? t.dept : t.wing)))).map((name) => ({ n: name, v: baseWorkData.filter((t) => (activeWingId ? t.dept : t.wing) === name).length }))} margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="n" type="category" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#475569' }} tickFormatter={(v) => v.length > 16 ? v.slice(0, 15) + '…' : v} />
                                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'10px', border:'none', boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}} />
                                  <Bar dataKey="v" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                               </BarChart>
                            </ResponsiveContainer>
                          </div>
                       </div>
                    </div>

                    {/* מטריצת השלמת רבעונים */}
                    {quarterCompletionMatrix.length > 0 && (
                      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                        <h3 className="font-black text-slate-800 mb-5 text-sm">
                          השלמת עדכון רבעוני — לפי {(activeWingId || currentUser?.role === 'WING' || currentUser?.role === 'DEPT') ? 'מחלקה' : 'אגף'}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-sm">
                            <thead>
                              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="pb-3 pr-0 font-black">{(activeWingId || currentUser?.role === 'WING' || currentUser?.role === 'DEPT') ? 'מחלקה' : 'אגף'}</th>
                                <th className="pb-3 px-4 text-center">משימות</th>
                                {[1, 2, 3, 4].map(q => (
                                  <th key={q} className="pb-3 px-4 text-center">
                                    ר{q}
                                    {isQuarterLocked(q) && <span className="mr-1 text-slate-300">🔒</span>}
                                    {!isQuarterLocked(q) && <span className="mr-1 opacity-40">⏳</span>}
                                    <div className="text-[8px] font-bold text-slate-300 normal-case tracking-normal">{QUARTER_LOCK_LABEL[q]}</div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {quarterCompletionMatrix.map(row => (
                                <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 pr-0 font-bold text-slate-700 text-xs">{row.name}</td>
                                  <td className="py-3 px-4 text-center text-[11px] font-bold text-slate-400">{row.total}</td>
                                  {[1, 2, 3, 4].map(q => {
                                    const pct = row[`q${q}`];
                                    const color = pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : pct > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400';
                                    return (
                                      <td key={q} className="py-3 px-4 text-center">
                                        <span className={`inline-block min-w-[52px] px-2 py-1 rounded-lg text-[11px] font-black ${color}`}>
                                          {pct === 100 ? '✓ הושלם' : pct > 0 ? `${pct}%` : '—'}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 inline-block"></span>הושלם (100%)</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 inline-block"></span>חלקי (50%+)</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-100 inline-block"></span>התחיל (&lt;50%)</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 inline-block"></span>טרם הוזן</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white p-2 pl-4 pr-2 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between sticky top-20 z-40">
                       <div className="flex w-full md:w-auto items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all flex-1 md:max-w-md">
                          <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                          <input type="text" placeholder="חיפוש משימה, פעילות או מזהה..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full" />
                       </div>
                       <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                          <div className="flex-1 md:flex-none relative min-w-[150px]">
                            <div className={`flex items-center bg-slate-50 rounded-xl border shrink-0 ${showOnlyOverdueTasks ? 'border-slate-100 opacity-50' : 'border-slate-200'}`}>
                             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Filter size={14} /></div>
                             <select disabled={showOnlyOverdueTasks} value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-full bg-transparent py-2.5 pl-4 pr-9 text-sm font-bold text-slate-700 outline-none appearance-none disabled:cursor-not-allowed">
                               <option value="הכל">כל המחלקות באגף</option>
                               {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
                             </select>
                            </div>
                            {showOnlyOverdueTasks && <p className="text-[9px] text-slate-400 font-bold mt-0.5 pr-1">מושבת בזמן סינון חריגות</p>}
                          </div>
                          <button onClick={() => setShowOnlyOverdueTasks(!showOnlyOverdueTasks)} className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${showOnlyOverdueTasks ? 'bg-red-500 text-white border-red-500' : 'bg-slate-50 border-red-200 text-red-600 hover:bg-red-50'}`}>
                             <AlertTriangle size={13}/> {showOnlyOverdueTasks ? <><span>חריגות</span><X size={12} className="mr-1"/></> : 'חריגות'}
                          </button>
                          <button onClick={() => { setFilterStatus(null); setShowOnlyOverdueTasks(false); }}
                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                              filterStatus === null && !showOnlyOverdueTasks
                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            הכל
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${filterStatus === null && !showOnlyOverdueTasks ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
                              {workStats.total}
                            </span>
                          </button>
                          <button onClick={() => setFilterStatus(filterStatus === 0 ? null : 0)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                              filterStatus === 0 ? 'bg-violet-100 text-violet-700 border-violet-300 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            טרם עודכן
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${filterStatus === 0 ? 'bg-violet-200 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>{workStats.m}</span>
                            {filterStatus === 0 && <X size={11} className="mr-0.5 opacity-70"/>}
                          </button>
                          {[1,2,3,4].map(s => (
                            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                                filterStatus === s
                                  ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} ${STATUS_CONFIG[s].border} shadow-sm`
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {STATUS_CONFIG[s].label}
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${filterStatus === s ? 'bg-white/50' : 'bg-slate-200 text-slate-500'}`}>
                                {[workStats.s1, workStats.s2, workStats.s3, workStats.s4][s-1]}
                              </span>
                              {filterStatus === s && <X size={11} className="mr-0.5 opacity-70"/>}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 py-1 text-xs font-bold text-slate-500">
                      <span>מציג <span className="text-slate-800">{sortedWorkData.length}</span> מתוך <span className="text-slate-800">{workStats.total}</span> משימות</span>
                      <span className="text-slate-200 hidden sm:inline">|</span>
                      <span className="hidden sm:inline text-emerald-600">{workStats.s1} בוצע</span>
                      <span className="text-slate-200 hidden sm:inline">|</span>
                      <span className="hidden sm:inline text-amber-500">{workStats.s2} עיכוב</span>
                      <span className="text-slate-200 hidden sm:inline">|</span>
                      <span className="hidden sm:inline text-red-500">{workStats.s3} עצירה</span>
                      {workStats.overdue > 0 && <><span className="text-slate-200 hidden sm:inline">|</span><span className="hidden sm:inline text-red-600 font-black">{workStats.overdue} בחריגת תאריך</span></>}
                    </div>

                    {/* באנר סינון פעיל */}
                    {(filterStatus !== null || showOnlyOverdueTasks || filterDept !== 'הכל' || search) && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200 animate-in fade-in duration-200">
                        <Filter size={15} className="shrink-0 text-blue-200" />
                        <span className="text-xs font-black text-blue-100 shrink-0">סינון פעיל:</span>
                        <div className="flex flex-wrap gap-2 flex-1">
                          {filterStatus === 0 && (
                            <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-lg text-xs font-black">
                              טרם עודכן <button onClick={() => setFilterStatus(null)}><X size={10} className="opacity-70 hover:opacity-100"/></button>
                            </span>
                          )}
                          {filterStatus !== null && filterStatus !== 0 && (
                            <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-lg text-xs font-black">
                              {STATUS_CONFIG[filterStatus].label} <button onClick={() => setFilterStatus(null)}><X size={10} className="opacity-70 hover:opacity-100"/></button>
                            </span>
                          )}
                          {showOnlyOverdueTasks && (
                            <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-lg text-xs font-black">
                              חריגות בלבד <button onClick={() => setShowOnlyOverdueTasks(false)}><X size={10} className="opacity-70 hover:opacity-100"/></button>
                            </span>
                          )}
                          {filterDept !== 'הכל' && (
                            <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-lg text-xs font-black">
                              {filterDept} <button onClick={() => setFilterDept('הכל')}><X size={10} className="opacity-70 hover:opacity-100"/></button>
                            </span>
                          )}
                          {search && (
                            <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-lg text-xs font-black">
                              "{search}" <button onClick={() => setSearch('')}><X size={10} className="opacity-70 hover:opacity-100"/></button>
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => { setFilterStatus(null); setShowOnlyOverdueTasks(false); setFilterDept('הכל'); setSearch(''); }}
                          className="shrink-0 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-black transition-colors"
                        >
                          נקה הכל
                        </button>
                      </div>
                    )}

                    {workplanQuarter > 0 && isQuarterLocked(workplanQuarter) && (
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold ${currentUser?.role === 'ADMIN' ? 'bg-blue-50 border-blue-200 text-blue-700' : canEditQuarter(workplanQuarter) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                        <span className="text-base">{currentUser?.role === 'ADMIN' || canEditQuarter(workplanQuarter) ? '🔓' : '🔒'}</span>
                        <span>
                          {currentUser?.role === 'ADMIN'
                            ? `רבעון ${workplanQuarter} נעול (מ-${QUARTER_LOCK_LABEL[workplanQuarter]}) — לך כמנהל יש גישת עריכה מלאה`
                            : canEditQuarter(workplanQuarter)
                              ? `רבעון ${workplanQuarter} נעול (מ-${QUARTER_LOCK_LABEL[workplanQuarter]}) — הגישה שלך נפתחה על-ידי המנהל`
                              : `רבעון ${workplanQuarter} נעול החל מ-${QUARTER_LOCK_LABEL[workplanQuarter]} — לפתיחת גישה פנה למנהל`
                          }
                        </span>
                      </div>
                    )}

                    <div className="hidden lg:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden pb-32">
                       <table className="w-full text-right relative">
                          <thead>
                             <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="py-4 px-5 w-16">מזהה</th>
                                <th className="py-4 px-5 w-40">מחלקה</th>
                                <th className="py-4 px-5 cursor-pointer hover:bg-slate-100 transition-colors group select-none" onClick={() => setSortOrder(prev => prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default')}>
                                   <div className="flex items-center gap-1.5 w-max">תיאור המשימה ויעד<div className={`p-1 rounded-md transition-colors ${sortOrder !== 'default' ? 'bg-blue-50 text-blue-600' : 'text-slate-300 group-hover:bg-slate-200'}`}>{sortOrder === 'asc' ? <ArrowUp size={12}/> : sortOrder === 'desc' ? <ArrowDown size={12}/> : <ArrowUpDown size={12}/>}</div></div>
                                </th>
                                <th className="py-4 px-5 w-32 text-center">סטטוס קודם</th>
                                <th className="py-4 px-5 w-40 text-center">עדכון רבעון {workplanQuarter}</th>
                                <th className="py-4 px-5 w-64">הערות / חסמים</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                             {sortedWorkData.length === 0 ? (
                               <tr><td colSpan={6} className="py-20 text-center">
                                 <div className="flex flex-col items-center gap-3 text-slate-300">
                                   <Target size={36} strokeWidth={1.5} />
                                   <p className="font-black text-slate-400 text-base">לא נמצאו משימות</p>
                                   <p className="text-sm text-slate-400">נסה לשנות את פרמטרי החיפוש</p>
                                 </div>
                               </td></tr>
                             ) : sortedWorkData.map(t => {
                                const prevStatuses = [1, 2, 3, 4].filter((q) => q < workplanQuarter && t[`q${q}`]);
                                const latestPrev = prevStatuses.length > 0 ? t[`q${prevStatuses[prevStatuses.length - 1]}`] : null;
                                const currentStatus = t[`q${workplanQuarter}`];
                                const isOverdue = isTaskOverdue(t, workplanQuarter);
                                const isPrevQuarterMissing = workplanQuarter > 1 && !t[`q${workplanQuarter - 1}`];

                                return (
                                   <tr key={t.id} className={`transition-colors group border-r-4 ${currentStatus ? `${STATUS_CONFIG[currentStatus].bg} hover:brightness-95` : 'hover:bg-slate-50/40 border-transparent'}`} style={{ borderRightColor: currentStatus ? STATUS_CONFIG[currentStatus].color : 'transparent' }}>
                                      <td className="py-4 px-5 text-[10px] font-mono text-slate-400">{t.id}</td>
                                      <td className="py-4 px-5 text-xs font-bold text-slate-600">{t.dept}</td>
                                      <td className="py-4 px-5">
                                         {t.activity && <div className="text-[10px] font-bold text-blue-600 mb-1">{t.activity}</div>}
                                         <p className="text-sm font-black text-slate-800 leading-snug mb-1.5">{t.task}</p>
                                         <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 ${isOverdue ? 'text-red-600 bg-red-50' : 'text-slate-500'}`}><Clock size={10} /> יעד: {formatDate(t.deadline)}</div>
                                      </td>
                                      <td className="py-4 px-5 text-center">
                                         {latestPrev ? (<div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${STATUS_CONFIG[latestPrev].bg} ${STATUS_CONFIG[latestPrev].text} ${STATUS_CONFIG[latestPrev].border}`}><History size={10} className="opacity-70" />{STATUS_CONFIG[latestPrev].label} <span className="opacity-50 font-normal">(ר{prevStatuses[prevStatuses.length - 1]})</span></div>) : <span className="text-slate-300 text-xl leading-none">-</span>}
                                      </td>
                                      <td className="py-4 px-5">
                                        {isPrevQuarterMissing
                                          ? <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border bg-amber-50 text-amber-600 border-amber-200 cursor-not-allowed" title={`לא ניתן לעדכן — רבעון ${workplanQuarter - 1} טרם עודכן`}>🔒 לא ניתן לעדכן — יש לעדכן תחילה רבעון {workplanQuarter - 1}</div>
                                          : canEditQuarter(workplanQuarter)
                                            ? <StatusDropdown value={currentStatus} open={openStatusMenuId === t.id} setOpen={(open) => setOpenStatusMenuId(open ? t.id : null)} onChange={(val) => { updateTaskLocal(t.id, `q${workplanQuarter}`, val); setOpenStatusMenuId(null); }} />
                                            : isQuarterLocked(workplanQuarter) && canEdit
                                              ? <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed">🔒 רבעון {workplanQuarter} נעול</div>
                                              : <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${STATUS_CONFIG[currentStatus]?.bg} ${STATUS_CONFIG[currentStatus]?.text} ${STATUS_CONFIG[currentStatus]?.border}`}>{STATUS_CONFIG[currentStatus]?.label || '-'}</div>
                                        }
                                      </td>
                                      <td className="py-4 px-5">
                                         {canEditQuarter(workplanQuarter) && !isPrevQuarterMissing
                                           ? <div className="relative group-hover:shadow-inner bg-slate-50 rounded-xl transition-all" title="לחץ לעריכת הערה"><MessageSquare size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-slate-400 transition-colors" /><input type="text" placeholder="הוסף הערה..." value={t[`n${workplanQuarter}`] || ""} onChange={(e) => updateTaskLocal(t.id, `n${workplanQuarter}`, e.target.value)} className="w-full bg-transparent border border-transparent focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl py-2 pl-3 pr-9 text-xs font-medium text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:placeholder:text-slate-400" /></div>
                                           : <span className="text-xs text-slate-500">{t[`n${workplanQuarter}`] || ''}</span>
                                         }
                                      </td>
                                   </tr>
                                )
                             })}
                          </tbody>
                       </table>
                    </div>

                    <div className="lg:hidden space-y-4 pb-24">
                       <div className="flex justify-between items-center px-2">
                          <div className="text-xs font-bold text-slate-400">מציג {sortedWorkData.length} משימות</div>
                          <button onClick={() => setSortOrder(prev => prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default')} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${sortOrder !== 'default' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>מיון לפי יעד {sortOrder === 'asc' ? <ArrowUp size={12}/> : sortOrder === 'desc' ? <ArrowDown size={12}/> : <ArrowUpDown size={12}/>}</button>
                       </div>
                       
                       {sortedWorkData.map(t => {
                          const prevStatuses = [1, 2, 3, 4].filter((q) => q < workplanQuarter && t[`q${q}`]);
                          const latestPrev = prevStatuses.length > 0 ? t[`q${prevStatuses[prevStatuses.length - 1]}`] : null;
                          const currentStatus = t[`q${workplanQuarter}`];
                          const isOverdue = isTaskOverdue(t, workplanQuarter);
                          const isPrevQuarterMissing = workplanQuarter > 1 && !t[`q${workplanQuarter - 1}`];
                          const isExpanded = expandedCards.has(t.id);
                          const toggleExpand = () => setExpandedCards(prev => { const next = new Set(prev); next.has(t.id) ? next.delete(t.id) : next.add(t.id); return next; });

                          return (
                             <div key={t.id} className={`rounded-3xl border shadow-[0_2px_15px_-5px_rgba(0,0,0,0.05)] overflow-hidden transition-all ${currentStatus ? STATUS_CONFIG[currentStatus].bg : 'bg-white'} ${currentStatus ? STATUS_CONFIG[currentStatus].border : 'border-slate-100'}`}>
                                {/* כותרת — תמיד מוצגת */}
                                <button onClick={toggleExpand} className="w-full p-4 text-right flex items-center gap-3">
                                   <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        {currentStatus && <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: STATUS_CONFIG[currentStatus].color}}/>}
                                        <span className="text-[9px] font-bold text-slate-400 bg-white/60 px-1.5 py-0.5 rounded font-mono">{t.dept}</span>
                                        {isOverdue && <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">בחריגה</span>}
                                        {isPrevQuarterMissing && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">🔒 לא ניתן לעדכן — חסר ר{workplanQuarter - 1}</span>}
                                      </div>
                                      {t.activity && <p className="text-[10px] font-bold text-blue-600 mb-0.5 leading-snug">{t.activity}</p>}
                                      <h4 className="font-black text-slate-800 text-sm leading-snug">{t.task}</h4>
                                   </div>
                                   <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {/* פרטים — מוצגים רק כשפתוח */}
                                {isExpanded && (
                                   <div className="px-4 pb-4 space-y-3 border-t border-black/5 pt-3">
                                      <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md ${isOverdue ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-white/70'}`}><Clock size={12} /> יעד: {formatDate(t.deadline)}</div>
                                      <div className="grid grid-cols-2 gap-3 items-start">
                                         <div>
                                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">סטטוס קודם</p>
                                            {latestPrev ? (<div className="inline-flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400"></div><span className="text-[11px] font-bold text-slate-600">{STATUS_CONFIG[latestPrev].label}</span></div>) : <span className="text-[11px] text-slate-400">אין מידע</span>}
                                         </div>
                                         <div>
                                            <p className="text-[9px] font-black uppercase text-blue-500 mb-1.5">עדכון ר{workplanQuarter}</p>
                                            {isPrevQuarterMissing
                                              ? <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border bg-slate-50 text-slate-400 border-slate-200">🔒 טרם עודכן ר{workplanQuarter - 1}</div>
                                              : canEditQuarter(workplanQuarter)
                                                ? <StatusDropdown value={currentStatus} open={openStatusMenuId === t.id} setOpen={(open) => setOpenStatusMenuId(open ? t.id : null)} onChange={(val) => { updateTaskLocal(t.id, `q${workplanQuarter}`, val); setOpenStatusMenuId(null); }} />
                                                : isQuarterLocked(workplanQuarter) && canEdit
                                                  ? <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border bg-slate-50 text-slate-500 border-slate-200">🔒 רבעון {workplanQuarter} נעול</div>
                                                  : <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${STATUS_CONFIG[currentStatus]?.bg} ${STATUS_CONFIG[currentStatus]?.text} ${STATUS_CONFIG[currentStatus]?.border}`}>{STATUS_CONFIG[currentStatus]?.label || '-'}</div>
                                            }
                                         </div>
                                      </div>
                                      <div>
                                         <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">הערות</p>
                                         {canEditQuarter(workplanQuarter) && !isPrevQuarterMissing
                                           ? <textarea rows={2} placeholder="הקלד כאן..." value={t[`n${workplanQuarter}`] || ""} onChange={(e) => updateTaskLocal(t.id, `n${workplanQuarter}`, e.target.value)} className="w-full bg-white/80 border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-xl py-2 px-3 text-xs font-medium text-slate-700 outline-none transition-all resize-none" />
                                           : <p className="text-xs text-slate-600">{t[`n${workplanQuarter}`] || <span className="text-slate-400">אין הערות</span>}</p>
                                         }
                                      </div>
                                   </div>
                                )}
                             </div>
                          );
                       })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --------- COMPLAINTS TAB --------- */}
            {mainTab === 'complaints' && (
              <div className="space-y-6">

                {/* Edit complaint modal */}
                {editingComplaint && (
                  <div className="fixed inset-0 z-[1400] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 text-base">עדכון פנייה — {editingComplaint.id}</h3>
                        <button onClick={() => { setEditingComplaint(null); setEditComplaintForm({}); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">סטטוס</label>
                          <select value={editComplaintForm.status || ''} onChange={e => setEditComplaintForm(p => ({ ...p, status: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20">
                            <option value="פתוח">פתוח</option>
                            <option value="בטיפול">בטיפול</option>
                            <option value="סגור">סגור</option>
                          </select>
                        </div>
                        {complaintsRole !== 'editor' && (
                          <div>
                            <label className="text-xs font-black text-slate-500 mb-1.5 block">מטפל</label>
                            <select value={editComplaintForm.assignedTo || ''} onChange={e => setEditComplaintForm(p => ({ ...p, assignedTo: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20">
                              <option value="">— בחר מטפל —</option>
                              {usersList.filter(u => u.active === 'TRUE').map(u => (
                                <option key={u.id} value={u.username}>{u.fullName || u.username}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">הערת טיפול</label>
                          <textarea value={editComplaintForm.note || ''} onChange={e => setEditComplaintForm(p => ({ ...p, note: e.target.value }))} rows={3} placeholder="פרט את הטיפול שנעשה..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20 resize-none" />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button onClick={saveEditedComplaint} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-sm transition-colors">שמור עדכון</button>
                          <button onClick={() => { setEditingComplaint(null); setEditComplaintForm({}); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-sm transition-colors">ביטול</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- COMPLAINT DETAIL MODAL ---- */}
                {selectedComplaint && (() => {
                  const c = selectedComplaint;
                  const fmtD = (v) => { if (!v) return '—'; const d = parseDateLogic(v) || new Date(v); return (!d || isNaN(d.getTime())) ? String(v) : d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
                  const isClosed = (c.closed && String(c.closed).trim() !== '' && String(c.closed).toUpperCase() !== 'FALSE') || c.status === 'סגור';
                  const effStatus = isClosed ? 'סגור' : (c.status || 'פתוח');
                  const sla = c.slaDate ? (parseDateLogic(c.slaDate) || new Date(c.slaDate)) : null;
                  const slaOverdue = sla && !isNaN(sla.getTime()) && !isClosed && new Date() > sla;
                  const canClose = !isClosed && (complaintsRole === 'admin' || complaintsRole === 'manager' || c.submittedBy === currentUser?.user);
                  const priorityBar = c.priority === 'דחוף' ? 'bg-red-500' : c.priority === 'נמוך' ? 'bg-slate-400' : 'bg-amber-400';
                  const statusCls = isClosed ? 'bg-emerald-100 text-emerald-700' : effStatus === 'בטיפול' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
                  const priorityLabelCls = c.priority === 'דחוף' ? 'bg-red-100 text-red-700' : c.priority === 'נמוך' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700';
                  const notesLines = (c.description || '').split('\n').filter(Boolean);
                  return (
                    <div className="fixed inset-0 z-[1500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl" onClick={e => { if (e.target === e.currentTarget) setSelectedComplaint(null); }}>
                      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[92vh]">
                        <div className={`h-1.5 ${priorityBar} rounded-t-3xl`} />
                        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{c.id}</span>
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${statusCls}`}>{effStatus}</span>
                              {c.priority && <span className={`text-xs font-black px-2 py-0.5 rounded-full ${priorityLabelCls}`}>{c.priority}</span>}
                            </div>
                            <h3 className="font-black text-slate-800 text-base">{c.subject}</h3>
                          </div>
                          <button onClick={() => setSelectedComplaint(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl mt-1 shrink-0"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-5">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            {[
                              { label: 'תאריך פנייה', value: fmtD(c.date) },
                              { label: 'מועד יעד (SLA)', value: fmtD(c.slaDate) + (slaOverdue ? ' ⚠' : ''), cls: slaOverdue ? 'text-red-600' : '' },
                              c.address     ? { label: 'כתובת',         value: c.address }     : null,
                              c.landmark    ? { label: 'נקודת ציון',    value: c.landmark }    : null,
                              c.assignedTo  ? { label: 'מטפל',          value: usersList.find(u => u.username === c.assignedTo)?.fullName || c.assignedTo }  : null,
                              c.submittedBy ? { label: 'מקבל הפנייה',  value: usersList.find(u => u.username === c.submittedBy)?.fullName || c.submittedBy } : null,
                              c.residentName ? { label: 'שם התושב',     value: c.residentName } : null,
                              c.phone       ? { label: 'טלפון',         value: c.phone }       : null,
                            ].filter(Boolean).map(({ label, value, cls }) => (
                              <div key={label}>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                                <p className={`text-sm font-bold text-slate-700 ${cls || ''}`}>{value}</p>
                              </div>
                            ))}
                          </div>
                          {notesLines.length > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">הערות וטיפול</p>
                              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 max-h-52 overflow-y-auto">
                                {notesLines.map((line, i) => {
                                  const m = line.match(/^\[(.+?)\]\s+(.*)/);
                                  if (m) return (
                                    <div key={i} className="flex gap-3 items-start">
                                      <div className="w-1 shrink-0 bg-purple-300 rounded-full self-stretch" />
                                      <div>
                                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">{m[1]}</p>
                                        <p className="text-xs text-slate-700 leading-relaxed">{m[2]}</p>
                                      </div>
                                    </div>
                                  );
                                  return <p key={i} className="text-xs text-slate-700 leading-relaxed">{line}</p>;
                                })}
                              </div>
                            </div>
                          )}
                          {c.images && c.images.split(',').filter(Boolean).length > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">תמונות</p>
                              <div className="flex flex-wrap gap-3">
                                {c.images.split(',').filter(Boolean).map((url, i) => {
                                  const fileId = url.match(/[?&]id=([^&]+)/)?.[1] || url.match(/\/d\/([^\/]+)/)?.[1];
                                  const thumbSrc = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` : url;
                                  return (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative block w-24 h-24 rounded-xl overflow-hidden border border-slate-200 hover:border-blue-300 transition-colors bg-slate-50 shrink-0">
                                      <img src={thumbSrc} alt={`תמונה ${i+1}`} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; e.target.parentNode.classList.add('flex','items-center','justify-center'); }} />
                                      <div className="absolute bottom-1 right-1 bg-black/40 rounded-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink size={10} className="text-white" /></div>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {((complaintsRole === 'admin' || complaintsRole === 'manager' || complaintsRole === 'editor') && !isClosed) || canClose ? (
                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                              {(complaintsRole === 'admin' || complaintsRole === 'manager' || complaintsRole === 'editor') && !isClosed && (
                                <button onClick={async () => {
                                  if (usersList.length === 0) await loadUsers();
                                  setEditingComplaint(c);
                                  setEditComplaintForm({ status: c.status || 'פתוח', assignedTo: c.assignedTo || '', note: '' });
                                  setSelectedComplaint(null);
                                }} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-black text-sm transition-colors border border-purple-200">
                                  <UserCheck size={14} /> עדכן פנייה
                                </button>
                              )}
                              {canClose && (
                                <button onClick={() => { closeComplaint(c); setSelectedComplaint(null); }} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-black text-sm transition-colors border border-emerald-200">
                                  <CheckCircle2 size={14} /> סגור פנייה
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {complaintsView === 'form' ? (
                  /* ---- NEW COMPLAINT FORM ---- */
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8 max-w-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-black text-slate-800">פנייה חדשה</h3>
                      <button onClick={() => { setComplaintsView('list'); setComplaintImageFiles([]); }} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800">
                        <ChevronRight size={16} /> חזרה לרשימה
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">תאריך פנייה</label>
                          <input type="text" placeholder="DD/MM/YYYY" value={complaintForm.date} onChange={e => setComplaintForm(p => ({ ...p, date: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">נושא</label>
                          <select value={complaintForm.subject} onChange={e => setComplaintForm(p => ({ ...p, subject: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20">
                            {['תשתיות', 'ניקיון', 'תאורה', 'עצים וגינון', 'חניה', 'רעש', 'בעלי חיים', 'אחר'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">כתובת <span className="text-slate-400 font-medium">(חובה אחד מהשניים)</span></label>
                          <input type="text" placeholder="רחוב ומספר בית" value={complaintForm.address} onChange={e => setComplaintForm(p => ({ ...p, address: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">נקודת ציון</label>
                          <input type="text" placeholder='למשל: ליד בית הכנסת "..."' value={complaintForm.landmark} onChange={e => setComplaintForm(p => ({ ...p, landmark: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-500 mb-1.5 block">תיאור הפנייה <span className="text-red-500">*</span></label>
                        <textarea value={complaintForm.description} onChange={e => setComplaintForm(p => ({ ...p, description: e.target.value }))} rows={4} placeholder="תאר את הבעיה בפירוט..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20 resize-none" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">עדיפות</label>
                          <select value={complaintForm.priority} onChange={e => setComplaintForm(p => ({ ...p, priority: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20">
                            <option value="דחוף">דחוף (SLA: 2 ימים)</option>
                            <option value="רגיל">רגיל (SLA: 7 ימים)</option>
                            <option value="נמוך">נמוך (SLA: 14 ימים)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-1.5 block">הקצאה למטפל</label>
                          <select value={complaintForm.assignedTo} onChange={e => setComplaintForm(p => ({ ...p, assignedTo: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20">
                            <option value="">— לא מוקצה —</option>
                            {usersList.filter(u => u.active === 'TRUE').map(u => (
                              <option key={u.id} value={u.username}>{u.fullName || u.username}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-500 mb-1.5 block">תמונות</label>
                        <input ref={complaintImageRef} type="file" accept="image/*" multiple className="hidden" onChange={e => setComplaintImageFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                        <button onClick={() => complaintImageRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-bold text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-colors w-full justify-center">
                          <ImagePlus size={18} /> הוסף תמונות
                        </button>
                        {complaintImageFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {complaintImageFiles.map((f, i) => (
                              <div key={i} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-bold text-purple-700">
                                {f.name}
                                <button onClick={() => setComplaintImageFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-purple-400 hover:text-red-500"><X size={12} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={submitComplaint} disabled={isSubmittingComplaint} className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl font-black text-sm transition-colors flex items-center justify-center gap-2">
                          {isSubmittingComplaint ? <><Loader2 size={16} className="animate-spin" /> שומר...</> : <><Plus size={16} /> שמור פנייה</>}
                        </button>
                        <button onClick={() => { setComplaintsView('list'); setComplaintImageFiles([]); }} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-sm transition-colors">ביטול</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ---- COMPLAINTS LIST ---- */
                  <>
                    {/* Stats row */}
                    {(() => {
                      const now = new Date();
                      const isClosedC = c => (c.closed && String(c.closed).trim() !== '' && String(c.closed).toUpperCase() !== 'FALSE') || c.status === 'סגור';
                      const effSt = c => isClosedC(c) ? 'סגור' : (c.status || 'פתוח');
                      const open = visibleComplaints.filter(c => effSt(c) === 'פתוח').length;
                      const inProgress = visibleComplaints.filter(c => effSt(c) === 'בטיפול').length;
                      const closed = visibleComplaints.filter(c => effSt(c) === 'סגור').length;
                      const overdueSla = visibleComplaints.filter(c => {
                        if (isClosedC(c)) return false;
                        if (!c.slaDate) return false;
                        const sla = parseDateLogic(c.slaDate) || new Date(c.slaDate);
                        return sla && !isNaN(sla.getTime()) && now > sla;
                      }).length;
                      return (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          {[
                            { label: 'פתוח', value: open, color: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
                            { label: 'בטיפול', value: inProgress, color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' },
                            { label: 'סגור', value: closed, color: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
                            { label: 'חריגת SLA', value: overdueSla, color: 'bg-red-50 border-red-200 text-red-700', dot: 'bg-red-500' },
                          ].map(s => (
                            <div key={s.label} className={`rounded-2xl border p-5 flex items-center gap-4 ${s.color}`}>
                              <div className={`w-3 h-3 rounded-full ${s.dot} shrink-0`} />
                              <div>
                                <p className="text-2xl font-black">{s.value}</p>
                                <p className="text-xs font-bold mt-0.5">{s.label}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Toolbar */}
                    {(() => {
                      const isClosedC = c => (c.closed && String(c.closed).trim() !== '' && String(c.closed).toUpperCase() !== 'FALSE') || c.status === 'סגור';
                      const effStC = c => isClosedC(c) ? 'סגור' : (c.status || 'פתוח');
                      const fmtD = (v) => { if (!v) return null; const d = parseDateLogic(v) || new Date(v); return (!d || isNaN(d.getTime())) ? String(v) : d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
                      const assignees = [...new Set(visibleComplaints.map(c => c.assignedTo).filter(Boolean))];
                      const receivers = [...new Set(visibleComplaints.map(c => c.submittedBy).filter(Boolean))];
                      const filteredComplaints = visibleComplaints.filter(c => {
                        const eff = effStC(c);
                        return (complaintFilters.status === 'הכל' || eff === complaintFilters.status)
                          && (complaintFilters.priority === 'הכל' || c.priority === complaintFilters.priority)
                          && (complaintFilters.assignee === 'הכל' || c.assignedTo === complaintFilters.assignee)
                          && (complaintFilters.receiver === 'הכל' || c.submittedBy === complaintFilters.receiver);
                      });
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {(complaintsRole === 'admin' || complaintsRole === 'manager') && (
                              <button onClick={async () => {
                                if (usersList.length === 0) await loadUsers();
                                setComplaintForm({ date: new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }), address: '', landmark: '', subject: 'תשתיות', description: '', priority: 'רגיל', assignedTo: '' });
                                setComplaintsView('form');
                              }} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-sm transition-colors shadow-sm">
                                <Plus size={16} /> פנייה חדשה
                              </button>
                            )}
                            <button onClick={loadComplaints} disabled={complaintsLoading} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                              <RefreshCw size={14} className={complaintsLoading ? 'animate-spin' : ''} /> רענן
                            </button>
                            <select value={complaintFilters.status} onChange={e => setComplaintFilters(p => ({ ...p, status: e.target.value }))} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
                              <option value="הכל">כל הסטטוסים</option>
                              <option value="פתוח">פתוח</option>
                              <option value="בטיפול">בטיפול</option>
                              <option value="סגור">סגור</option>
                            </select>
                            <select value={complaintFilters.priority} onChange={e => setComplaintFilters(p => ({ ...p, priority: e.target.value }))} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
                              <option value="הכל">כל העדיפויות</option>
                              <option value="דחוף">דחוף</option>
                              <option value="רגיל">רגיל</option>
                              <option value="נמוך">נמוך</option>
                            </select>
                            {assignees.length > 0 && (
                              <select value={complaintFilters.assignee} onChange={e => setComplaintFilters(p => ({ ...p, assignee: e.target.value }))} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
                                <option value="הכל">כל המטפלים</option>
                                {assignees.map(a => <option key={a} value={a}>{usersList.find(u => u.username === a)?.fullName || a}</option>)}
                              </select>
                            )}
                            {(complaintsRole === 'admin' || complaintsRole === 'manager') && receivers.length > 0 && (
                              <select value={complaintFilters.receiver} onChange={e => setComplaintFilters(p => ({ ...p, receiver: e.target.value }))} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
                                <option value="הכל">כל מקבלי הפניות</option>
                                {receivers.map(r => <option key={r} value={r}>{usersList.find(u => u.username === r)?.fullName || r}</option>)}
                              </select>
                            )}
                            {(complaintFilters.status !== 'הכל' || complaintFilters.priority !== 'הכל' || complaintFilters.assignee !== 'הכל' || complaintFilters.receiver !== 'הכל') && (
                              <span className="text-xs text-slate-400 font-bold">{filteredComplaints.length} / {visibleComplaints.length}</span>
                            )}
                          </div>

                          {/* Card grid */}
                          {complaintsLoading ? (
                            <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 size={28} className="animate-spin mr-3" /> טוען פניות...</div>
                          ) : filteredComplaints.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                              <MessageSquare size={40} className="mb-3 opacity-30" />
                              <p className="font-bold text-sm">אין פניות להצגה</p>
                              <p className="text-xs mt-1">נסה לשנות את הפילטרים</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {filteredComplaints.map((c, idx) => {
                                const isClosed = isClosedC(c);
                                const effStatus = effStC(c);
                                const sla = c.slaDate ? (parseDateLogic(c.slaDate) || new Date(c.slaDate)) : null;
                                const slaOverdue = sla && !isNaN(sla.getTime()) && !isClosed && new Date() > sla;
                                const priorityBar = c.priority === 'דחוף' ? 'bg-red-500' : c.priority === 'נמוך' ? 'bg-slate-300' : 'bg-amber-400';
                                const priorityLabelCls = c.priority === 'דחוף' ? 'bg-red-100 text-red-700' : c.priority === 'נמוך' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700';
                                const statusCls = isClosed ? 'bg-slate-100 text-slate-500' : effStatus === 'בטיפול' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
                                const assigneeName = c.assignedTo ? (usersList.find(u => u.username === c.assignedTo)?.fullName || c.assignedTo) : 'לא מוקצה';
                                const cardImages = c.images ? c.images.split(',').filter(Boolean) : [];
                                const firstThumb = cardImages.length > 0 ? (() => { const u = cardImages[0]; const fid = u.match(/[?&]id=([^&]+)/)?.[1] || u.match(/\/d\/([^\/]+)/)?.[1]; return fid ? `https://drive.google.com/thumbnail?id=${fid}&sz=w200` : u; })() : null;
                                return (
                                  <div key={c.id || idx} onClick={() => setSelectedComplaint(c)}
                                       className={`flex rounded-xl border overflow-hidden cursor-pointer transition-all duration-150 ${isClosed ? 'bg-slate-50 border-slate-200 opacity-60' : slaOverdue ? 'bg-white border-red-200 shadow-sm hover:shadow' : 'bg-white border-slate-100 shadow-sm hover:shadow'}`}>
                                    <div className={`w-1.5 shrink-0 ${priorityBar}`} />
                                    {firstThumb && (
                                      <div className="w-16 shrink-0 self-stretch overflow-hidden bg-slate-100">
                                        <img src={firstThumb} alt="" className="w-full h-full object-cover" onError={e => { e.target.parentNode.style.display='none'; }} />
                                      </div>
                                    )}
                                    <div className="flex-1 px-4 py-3 min-w-0">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                            <span className="font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">{c.id || '—'}</span>
                                            {c.priority && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${priorityLabelCls}`}>{c.priority}</span>}
                                            {cardImages.length > 1 && <span className="text-[9px] text-slate-400 font-bold">+{cardImages.length - 1} תמונות</span>}
                                          </div>
                                          <p className={`font-black text-sm leading-snug ${isClosed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{c.subject || '—'}</p>
                                          {c.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{c.description}</p>}
                                          {(c.address || c.landmark) && <p className="text-[10px] text-slate-400 mt-1 truncate">📍 {c.address || c.landmark}</p>}
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusCls}`}>{effStatus}</span>
                                          <span className="text-[10px] text-slate-400 font-bold truncate max-w-[100px]">{assigneeName}</span>
                                          {c.slaDate && <span className={`text-[10px] font-bold ${slaOverdue ? 'text-red-500' : 'text-slate-400'}`}>{slaOverdue && '⚠ '}{fmtD(c.slaDate)}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ===== Upload Modal ===== */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[1500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FileSpreadsheet size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-black text-slate-800 text-sm">טעינת נתוני תקציב</h2>
                  {uploadStep === 'unknowns-review' && (
                    <p className="text-[11px] text-slate-400">סעיף {uploadUnknownIdx + 1} מתוך {uploadUnknowns.length} לא מזוהים</p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Step: post-validation — בדיקה אחרי הטעינה */}
            {uploadStep === 'post-validation' && uploadValidation && (
              <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
                {/* סטטוס כללי */}
                <div className={`flex items-center gap-3 p-3 rounded-xl ${uploadValidation.allOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className="text-xl">{uploadValidation.allOk ? '✅' : '⚠️'}</span>
                  <p className="font-black text-sm">{uploadValidation.allOk ? 'הטעינה הצליחה — כל הנתונים תואמים' : 'הטעינה הושלמה — נמצאו אי-התאמות'}</p>
                </div>

                {/* בדיקה 1: סעיפים שלא נטענו */}
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">סעיפים שלא נטענו לפורטל</p>
                  {uploadValidation.notLoaded.length === 0
                    ? <div className="text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-2 rounded-lg">✅ כל הסעיפים נטענו</div>
                    : <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-red-700 font-black text-xs mb-2">❌ {uploadValidation.notLoaded.length} סעיפים לא נמצאו בפורטל ולא נטענו:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {uploadValidation.notLoaded.map(r => (
                            <span key={r.id} className="text-[10px] font-mono font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">{r.id}{r.name ? ` — ${r.name}` : ''}</span>
                          ))}
                        </div>
                      </div>
                  }
                </div>

                {/* בדיקה 2: סעיפים עם ערכים שונים */}
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">סעיפים עם ערכים שלא השתנו כמצופה</p>
                  {uploadValidation.mismatched.length === 0
                    ? <div className="text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-2 rounded-lg">✅ כל הערכים עודכנו כראוי</div>
                    : <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead><tr className="bg-amber-100 text-[10px] font-black text-amber-700 uppercase">
                            <th className="py-1.5 px-3 text-right">סעיף</th>
                            <th className="py-1.5 px-2 text-left">קובץ</th>
                            <th className="py-1.5 px-2 text-left">נשלח לשרת</th>
                            <th className="py-1.5 px-2 text-left">פורטל</th>
                            <th className="py-1.5 px-2 text-center">סיבה</th>
                          </tr></thead>
                          <tbody className="divide-y divide-amber-100">
                            {uploadValidation.mismatched.map(r => (
                              <tr key={r.id} className="bg-white">
                                <td className="py-1.5 px-3 font-mono text-slate-700 font-bold text-[10px]">{r.id}</td>
                                <td className="py-1.5 px-2 font-mono text-slate-500 text-[10px]">
                                  <div>ב: {formatILS(r.fileA)}</div>
                                  <div>ב+ש: {formatILS(r.fileC)}</div>
                                </td>
                                <td className="py-1.5 px-2 font-mono text-[10px]">
                                  {r.wasNotSent
                                    ? <span className="text-red-600 font-black">לא נשלח!</span>
                                    : <><div className={r.execMatch ? 'text-slate-500' : 'text-orange-600 font-bold'}>ב: {formatILS(r.sentA)}</div>
                                       <div className={r.commitMatch ? 'text-slate-500' : 'text-orange-600 font-bold'}>ב+ש: {formatILS(r.sentC)}</div></>
                                  }
                                </td>
                                <td className="py-1.5 px-2 font-mono text-[10px]">
                                  <div className={r.execMatch ? 'text-slate-500' : 'text-red-600 font-bold'}>ב: {formatILS(r.portalA)}</div>
                                  <div className={r.commitMatch ? 'text-slate-500' : 'text-red-600 font-bold'}>ב+ש: {formatILS(r.portalC)}</div>
                                </td>
                                <td className="py-1.5 px-2 text-center text-[10px]">
                                  {r.wasNotSent
                                    ? <span className="text-red-600 font-black" title="הסעיף לא נמצא ב-staticData בזמן ה-upload">ID לא הוכר</span>
                                    : r.sentA === r.portalA
                                      ? <span className="text-blue-600 font-bold" title="הערך נשלח נכון אך הפורטל לא עדכן — ייתכן עיכוב ב-Google Sheet">⏱ עיכוב סנכרון</span>
                                      : <span className="text-orange-600 font-bold">שגיאת שרת</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  }
                </div>

                {/* בדיקות 3–6: השוואת סכומים */}
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">השוואת סכומים — קובץ מול פורטל אחרי טעינה</p>
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                        <th className="py-2 px-3 text-right">פריט</th>
                        <th className="py-2 px-3 text-left">קובץ (עמ׳ 10/12)</th>
                        <th className="py-2 px-3 text-left">פורטל</th>
                        <th className="py-2 px-3 text-center w-28">תוצאה</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {uploadValidation.checks.map((c, i) => (
                          <tr key={i} className={c.ok ? 'bg-white' : 'bg-amber-50'}>
                            <td className="py-2.5 px-3 font-bold text-slate-700 text-[11px]">{c.label}</td>
                            <td className="py-2.5 px-3 text-left font-mono text-slate-600">{formatILS(c.fileVal)}</td>
                            <td className="py-2.5 px-3 text-left font-mono text-slate-600">{formatILS(c.portalVal)}</td>
                            <td className="py-2.5 px-3 text-center">{c.ok ? '✅' : <span className="text-amber-600 font-black text-[10px]">⚠️ {formatILS(Math.abs(c.fileVal - c.portalVal))}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button onClick={() => setShowUploadModal(false)} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-sm transition-colors">
                  סגור
                </button>
              </div>
            )}

            {/* Step: drop */}
            {uploadStep === 'drop' && (
              <div className="p-8">
                <div
                  onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                  onDragLeave={() => setUploadDragOver(false)}
                  onDrop={e => { e.preventDefault(); setUploadDragOver(false); handleUploadFile(e.dataTransfer.files[0]); }}
                  onClick={() => uploadFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${uploadDragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}
                >
                  <Upload size={36} className={`mx-auto mb-4 ${uploadDragOver ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <p className="font-bold text-slate-700 mb-1">גרור קובץ לכאן</p>
                  <p className="text-sm text-slate-400">או לחץ לבחירת קובץ</p>
                  <p className="text-[11px] text-slate-300 mt-3">Excel (.xlsx, .xls) או CSV</p>
                </div>
                <input ref={uploadFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleUploadFile(e.target.files[0])} />
              </div>
            )}

            {/* Step: unknowns-warning */}
            {uploadStep === 'unknowns-warning' && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <AlertTriangle size={32} className="text-amber-500" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">נמצאו סעיפים לא מזוהים</h3>
                <p className="text-slate-500 mb-1">
                  <span className="font-black text-amber-600 text-2xl">{uploadUnknowns.length}</span> סעיפים לא נמצאו במערכת
                </p>
                <p className="text-sm text-slate-400 mb-8">מתוך {uploadRows.length} סעיפים בקובץ</p>
                <button onClick={proceedUnknownReview} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors">
                  המשך לבדיקת הסעיפים
                </button>
              </div>
            )}

            {/* Step: unknowns-review */}
            {uploadStep === 'unknowns-review' && (() => {
              const rowIdx = uploadUnknowns[uploadUnknownIdx];
              const row = uploadRows[rowIdx];
              return (
                <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${(uploadUnknownIdx / uploadUnknowns.length) * 100}%` }} />
                  </div>

                  {/* נתוני הקובץ — קריאה בלבד */}
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">סעיף מהקובץ — לא קיים במערכת</p>
                    <p className="font-black text-slate-800 text-sm leading-snug">{row.fileName || '—'}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 mb-3">מזהה: {row.fileId}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
                        <p className="text-[9px] text-slate-400 font-bold mb-0.5">ביצוע 2026 (מהקובץ)</p>
                        <p className="text-sm font-black text-slate-700 tabular-nums" dir="ltr">{formatILS(row.a2026)}</p>
                      </div>
                      <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
                        <p className="text-[9px] text-slate-400 font-bold mb-0.5">שריון (מהקובץ)</p>
                        <p className="text-sm font-black text-slate-700 tabular-nums" dir="ltr">{formatILS(row.commit)}</p>
                      </div>
                    </div>
                  </div>

                  {/* חיפוש — האם זה סעיף קיים עם מזהה שגוי? */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">האם הסעיף כבר קיים במערכת תחת מזהה אחר? חפש:</p>
                    <div className="relative">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="חפש לפי שם, מזהה, מחלקה..."
                        value={uploadSearch}
                        onChange={e => setUploadSearch(e.target.value)}
                        className="w-full pr-8 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoFocus
                      />
                    </div>
                    {uploadSearchResults.length > 0 && (
                      <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-36 overflow-y-auto shadow-sm">
                        {uploadSearchResults.map(s => (
                          <button
                            key={s.id}
                            onClick={() => confirmUnknown(String(s.id).trim().split('.')[0])}
                            className="w-full text-right px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                              <p className="text-[10px] text-slate-400">{s.id} · {s.dept} · {s.wing}</p>
                            </div>
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                    {uploadSearch.trim() && uploadSearchResults.length === 0 && (
                      <p className="text-xs text-slate-400 mt-2 text-center">לא נמצאו תוצאות — יתווסף כסעיף חדש</p>
                    )}
                  </div>

                  {/* פרטי הסעיף החדש — לעריכה */}
                  <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">פרטי הסעיף החדש לעדכון</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold mb-1">אגף {!uploadCurrentEdit.wing && <span className="text-red-400">*חובה</span>}</p>
                        <select value={uploadCurrentEdit.wing} onChange={e => setUploadCurrentEdit(p => ({ ...p, wing: e.target.value, dept: '' }))}
                          className={`w-full py-1.5 px-2 bg-slate-50 border rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-400 ${!uploadCurrentEdit.wing ? 'border-red-300' : 'border-slate-200'}`}>
                          <option value="">-- בחר אגף --</option>
                          {uploadAllWings.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold mb-1">מחלקה {!uploadCurrentEdit.dept && <span className="text-red-400">*חובה</span>}</p>
                        <select value={uploadCurrentEdit.dept} onChange={e => setUploadCurrentEdit(p => ({ ...p, dept: e.target.value }))}
                          className={`w-full py-1.5 px-2 bg-slate-50 border rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-400 ${!uploadCurrentEdit.dept ? 'border-red-300' : 'border-slate-200'}`}>
                          <option value="">-- בחר מחלקה --</option>
                          {uploadDeptsForWing.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold mb-1">סוג (זוהה אוטומטית לפי מזהה)</p>
                      <select value={uploadCurrentEdit.type} onChange={e => setUploadCurrentEdit(p => ({ ...p, type: e.target.value }))}
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none">
                        <option value="הוצאה">הוצאה</option>
                        <option value="הכנסה">הכנסה</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                      {[['a2024','ביצוע 2024'],['b2025','תקציב 2025'],['b2026','תקציב 2026']].map(([key, label]) => (
                        <div key={key}>
                          <p className="text-[9px] text-slate-400 font-bold mb-1">{label}</p>
                          <input type="number" value={uploadCurrentEdit[key]}
                            onChange={e => setUploadCurrentEdit(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-emerald-400" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* אישור */}
                  <button
                    onClick={() => {
                      if (!uploadCurrentEdit.wing || !uploadCurrentEdit.dept) return alert('יש לבחור אגף ומחלקה');
                      confirmUnknown(null);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    אישור — המשך לסעיף הבא
                  </button>
                </div>
              );
            })()}

            {/* Step: uploading */}
            {uploadStep === 'uploading' && (
              <div className="p-12 text-center">
                <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto mb-4" />
                <p className="font-bold text-slate-700">מעלה נתונים...</p>
              </div>
            )}

            {/* Step: done */}
            {uploadStep === 'done' && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={36} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">הנתונים עודכנו בהצלחה</h3>
                <p className="text-slate-400 text-sm mb-8">הנתונים יטענו מחדש אוטומטית</p>
                <button onClick={() => setShowUploadModal(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-colors">
                  סגור
                </button>
              </div>
            )}

          </div>
        </div>
      )}
      {/* ===== End Upload Modal ===== */}

      {/* Toast Notification */}
      <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[2100] transition-all duration-300 ${saveStatus ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {saveStatus === 'saving' && (
          <div className="flex items-center gap-3 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold">
            <Loader2 size={16} className="animate-spin text-blue-400" /> שומר שינויים...
          </div>
        )}
        {saveStatus === 'saved' && (
          <div className="flex items-center gap-3 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold">
            <CheckCircle2 size={16} /> הנתונים נשמרו בהצלחה
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold">
            <AlertTriangle size={16} /> שגיאה בשמירה — ננסה שוב
          </div>
        )}
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[700] bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.1)]">
        <div className="flex">
          <button onClick={() => { setMainTab('budget'); setViewMode('dashboard'); setIsMenuOpen(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold transition-colors ${mainTab === 'budget' && viewMode !== 'control' ? 'text-emerald-700' : 'text-slate-400'}`}>
            <Wallet size={20} strokeWidth={2} />
            <span>תקציב</span>
          </button>
          <button onClick={() => { setMainTab('budget'); setViewMode('control'); setIsMenuOpen(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-bold transition-colors relative ${mainTab === 'budget' && viewMode === 'control' ? 'text-red-600' : 'text-red-300 hover:text-red-400'}`}>
            <ShieldAlert size={20} strokeWidth={2} />
            <span>בקרת תקציב</span>
            {budgetAlertsCount > 0 && (
              <span className="absolute top-2 right-[calc(50%-18px)] bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{budgetAlertsCount > 99 ? '99+' : budgetAlertsCount}</span>
            )}
          </button>
          <button onClick={() => { setMainTab('workplan'); setViewMode('dashboard'); setIsMenuOpen(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-bold transition-colors relative ${mainTab === 'workplan' && viewMode === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}>
            <Target size={20} strokeWidth={2} />
            <span>תכנית עבודה</span>
            {overdueTasksCount > 0 && (
              <span className="absolute top-2 right-[calc(50%-18px)] bg-orange-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{overdueTasksCount > 99 ? '99+' : overdueTasksCount}</span>
            )}
          </button>
          <button onClick={() => { setMainTab('workplan'); setViewMode('table'); if (workplanQuarter === 0) setShowQuarterPicker(true); setIsMenuOpen(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-bold transition-colors ${mainTab === 'workplan' && viewMode === 'table' ? 'text-blue-600' : 'text-slate-400'}`}>
            <ClipboardList size={20} strokeWidth={2} />
            <span>עדכון משימות</span>
          </button>
          {complaintsRole && (
            <button onClick={async () => { setMainTab('complaints'); await loadComplaints(); setIsMenuOpen(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-bold transition-colors ${mainTab === 'complaints' ? 'text-purple-600' : 'text-slate-400'}`}>
              <MessageSquare size={20} strokeWidth={2} />
              <span>פניות</span>
            </button>
          )}
          {isAharony && (
            <button onClick={async () => { setMainTab('users'); await loadUsers(); setIsMenuOpen(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold transition-colors ${mainTab === 'users' ? 'text-slate-800' : 'text-slate-400'}`}>
              <Users size={20} strokeWidth={2} />
              <span>משתמשים</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

export default App;