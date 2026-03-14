import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  LayoutDashboard, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users,
  Megaphone, TableProperties, ShieldAlert, CheckCircle2, Clock, AlertTriangle,
  HelpCircle, Save, Menu, X, Loader2, MessageSquare, History, MinusCircle,
  Download, ChevronDown, Filter, Search, TrendingUp, TrendingDown,
  Target, ArrowUp, ArrowDown, ArrowUpDown, RefreshCw
} from 'lucide-react';

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2Y4QkJxnqapKne4Q5TSAC5ZVBE1oPjKYKRKE1MFqiDfxSBZdWJQgbFnJbKz_H98q6WvS6NtKKjHM2/pub?output=csv";
const GAS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzPjDK_Enpt5dqW_soJrxs9y6fU5-cKMqsKzNJNouXvNxGnI8Xrxl9nGL51mG3smACV2A/exec";

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
  if (String(val).includes('/')) {
    const parts = String(val).split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  const serial = parseFloat(val);
  if (!isNaN(serial)) return new Date(Math.round((serial - 25569) * 86400 * 1000));
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
  const status = quarter === 0 ? getOverallRating(t) : t[`q${quarter}`];
  return status !== 1;
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

const StatCard = ({ title, value, subtext, icon: Icon, isHighlight }) => (
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

  const [pendingChanges, setPendingChanges] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  const [mainTab, setMainTab] = useState('budget');
  const [viewMode, setViewMode] = useState('dashboard');
  const [activeWingId, setActiveWingId] = useState(null);

  const [workplanQuarter, setWorkplanQuarter] = useState(0);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('הכל');
  const [sortOrder, setSortOrder] = useState('default');
  const [activePopup, setActivePopup] = useState(null);
  const [popupCount, setPopupCount] = useState(0);
  const [showOnlyOverdueTasks, setShowOnlyOverdueTasks] = useState(false);
  const [showOnlyBudgetAlerts, setShowOnlyBudgetAlerts] = useState(false);
  const [hasSeenWorkplanPopup, setHasSeenWorkplanPopup] = useState(false);
  const [hasSeenBudgetPopup, setHasSeenBudgetPopup] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [budgetSearch, setBudgetSearch] = useState('');
  const [budgetFilterDept, setBudgetFilterDept] = useState('הכל');
  const [budgetTypeFilter, setBudgetTypeFilter] = useState('הכל');
  const [budgetVisibleColumns, setBudgetVisibleColumns] = useState({
    a2024: false, b2025: false, b2026: true, a2026: false, commitTotal2026: false
  });
  const [controlCompareBy, setControlCompareBy] = useState('a2026');

  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'WING', target1: '', target2: '', active: 'TRUE' });
  const [openStatusMenuId, setOpenStatusMenuId] = useState(null);

  const isAharony = currentUser?.user === 'aharony';

  const userTargets = (user) => [user?.target1, user?.target2].map(normalizeKey).filter(Boolean);
  const matchesUserTargets = (value, user) => {
    const targets = userTargets(user);
    if (!targets.length) return true;
    return targets.includes(normalizeKey(value));
  };

  useEffect(() => {
    setShowOnlyBudgetAlerts(false);
    setShowOnlyOverdueTasks(false);
    setSearch('');
    setBudgetSearch('');
    setFilterDept('הכל');
    setBudgetFilterDept('הכל');
    setBudgetTypeFilter('הכל');
    setSortOrder('default');
  }, [mainTab, viewMode]);

  useEffect(() => {
    if (mainTab === 'workplan' && viewMode === 'table' && workplanQuarter === 0) {
      setWorkplanQuarter(1);
    }
  }, [mainTab, viewMode, workplanQuarter]);

  // מנגנון שמירה אוטומטית (Auto-Save)
  useEffect(() => {
    if (pendingChanges.length === 0) return;
    const timer = setTimeout(async () => {
      const changesToSave = [...pendingChanges];
      setPendingChanges([]); 
      setSaveStatus('saving');
      try {
        const res = await fetch(GAS_SCRIPT_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'batchUpdate', changes: changesToSave })
        });
        await ensureOk(res, 'Batch update');
        const data = await res.json();
        if (data.success) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus(''), 2500);
        } else {
          throw new Error(data.error || 'שגיאה בעדכון');
        }
      } catch (e) {
        console.error("Auto-save error:", e);
        setSaveStatus('error');
        setPendingChanges((prev) => [...prev, ...changesToSave]);
        setTimeout(() => setSaveStatus(''), 4000);
      }
    }, 1000); 
    return () => clearTimeout(timer);
  }, [pendingChanges]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bRes, wRes, gasRes] = await Promise.all([
        fetch('/budget_data.json').then((res) => ensureOk(res, 'Budget data')),
        fetch('/workplans_data.json').then((res) => ensureOk(res, 'Workplans data')),
        fetch(`${GAS_SCRIPT_URL}?t=${Date.now()}`).then((res) => ensureOk(res, 'Live GAS data'))
      ]);

      const [bJson, wJson, liveData] = await Promise.all([bRes.json(), wRes.json(), gasRes.json()]);

      setStaticData((bJson || []).map(b => ({
        ...b, wing: cleanStr(b.wing), dept: cleanStr(b.dept), name: cleanStr(b.name), type: cleanStr(b.type)
      })));

      setWorkPlans(
        (wJson || []).map((t) => {
          const live = liveData?.[String(t.id)] || {};
          return {
            ...t, wing: cleanStr(t.wing), dept: cleanStr(t.dept), activity: cleanStr(t.activity), task: cleanStr(t.task),
            q1: live.q1 ?? t.q1, q2: live.q2 ?? t.q2, q3: live.q3 ?? t.q3, q4: live.q4 ?? t.q4,
            n1: live.n1 || "", n2: live.n2 || "", n3: live.n3 || "", n4: live.n4 || ""
          };
        })
      );

      const csvRes = await fetch(`${SHEETS_CSV_URL}&t=${Date.now()}`).then((res) => ensureOk(res, 'Sheets CSV'));
      const csvText = await csvRes.text();
      const rows = csvText.trim().split(/\r?\n/).map(parseCsvLine);
      const headers = (rows[0] || []).map((h) => h.trim().toLowerCase());
      const map = {};
      const idIdx = headers.findIndex((h) => h.includes('id'));
      const a26Idx = headers.findIndex((h) => h.includes('a2026'));
      const c26Idx = headers.findIndex((h) => h.includes('commit'));

      rows.slice(1).forEach((cols) => {
        if (cols[idIdx]) {
          map[String(cols[idIdx]).trim()] = { a2026: cleanNum(cols[a26Idx]), commit: cleanNum(cols[c26Idx]) };
        }
      });
      setExecutionMap(map);
    } catch (e) {
      console.error("loadData error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${GAS_SCRIPT_URL}?action=login&username=${encodeURIComponent(uInput)}&password=${encodeURIComponent(pInput)}`).then((r) => ensureOk(r, 'Login'));
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        setShowOnlyBudgetAlerts(false);
        setShowOnlyOverdueTasks(false);
        setMainTab('budget');
        setViewMode('dashboard');
        setHasSeenBudgetPopup(false);
        setHasSeenWorkplanPopup(false);
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

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${GAS_SCRIPT_URL}?action=listUsers&t=${Date.now()}`).then((r) => ensureOk(r, 'List users'));
      const data = await res.json();
      if (data.success) {
        setUsersList((data.users || []).map((u) => ({ ...u, active: String(u.active || 'TRUE').toUpperCase() })));
      } else alert('שגיאה בטעינת משתמשים');
    } catch (err) {
      console.error(err); alert('שגיאה בטעינת משתמשים');
    } finally {
      setUsersLoading(false);
    }
  };

  const addUser = async () => {
    if (!cleanStr(userForm.username) || !cleanStr(userForm.password)) return alert('יש למלא שם משתמש וסיסמה');
    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addUser', ...userForm, target1: userForm.role === 'ADMIN' ? '' : userForm.target1, target2: userForm.role === 'ADMIN' ? '' : userForm.target2 })
      }).then((r) => ensureOk(r, 'Add user'));
      const data = await res.json();
      if (data.success) {
        await loadUsers();
        setUserForm({ username: '', password: '', role: 'WING', target1: '', target2: '', active: 'TRUE' });
        alert('המשתמש נוסף בהצלחה');
      } else alert(`שגיאה: ${data.error || 'שגיאה כללית'}`);
    } catch (err) { alert(`שגיאה: ${err.message || ''}`); }
  };

  const updateUserRow = async (user) => {
    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateUser', ...user, target1: user.role === 'ADMIN' ? '' : user.target1, target2: user.role === 'ADMIN' ? '' : user.target2, active: String(user.active || 'TRUE').toUpperCase() })
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
    if (!loading && mainTab === 'workplan' && viewMode === 'table' && !hasSeenWorkplanPopup) {
      const overdue = workPlans.filter((t) => {
        if (currentUser?.role === 'WING' && !matchesUserTargets(t.wing, currentUser)) return false;
        if (currentUser?.role === 'DEPT' && !matchesUserTargets(t.dept, currentUser)) return false;
        if (activeWingId && !sameKey(t.wing, activeWingId)) return false;
        return isTaskOverdue(t, workplanQuarter);
      }).length;
      if (overdue > 0) { setPopupCount(overdue); setActivePopup('workplan'); setHasSeenWorkplanPopup(true); }
    }
  }, [loading, mainTab, viewMode, activeWingId, workPlans, hasSeenWorkplanPopup, currentUser, workplanQuarter]);

  const fullBudgetData = useMemo(() => {
    let data = staticData;
    if (currentUser?.role === 'WING') data = data.filter((i) => matchesUserTargets(i.wing, currentUser));
    if (currentUser?.role === 'DEPT') data = data.filter((i) => matchesUserTargets(i.dept, currentUser));
    if (activeWingId) data = data.filter((i) => sameKey(i.wing, activeWingId));
    return data.map((item) => {
      const e = executionMap[item.id] || { a2026: 0, commit: 0 };
      const b2026 = cleanNum(item.b2026);
      const a2026 = cleanNum(e.a2026);
      const commit = cleanNum(e.commit);
      return { ...item, a2024: cleanNum(item.a2024), b2025: cleanNum(item.b2025), b2026, a2026, commit, commitTotal2026: commit };
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

  const availableDepts = useMemo(() => {
    let pool = workPlans;
    if (currentUser?.role === 'WING') pool = pool.filter((t) => matchesUserTargets(t.wing, currentUser));
    if (currentUser?.role === 'DEPT') pool = pool.filter((t) => matchesUserTargets(t.dept, currentUser));
    if (activeWingId) pool = pool.filter((t) => sameKey(t.wing, activeWingId));
    return Array.from(new Set(pool.map((t) => t.dept))).filter(Boolean).sort();
  }, [workPlans, activeWingId, currentUser]);

  const filteredWorkData = useMemo(() => {
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

  const sortedWorkData = useMemo(() => {
    if (sortOrder === 'default') return filteredWorkData;
    return [...filteredWorkData].sort((a, b) => {
      const dateA = parseDateLogic(a.deadline) || new Date(2100, 0, 1);
      const dateB = parseDateLogic(b.deadline) || new Date(2100, 0, 1);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA; 
    });
  }, [filteredWorkData, sortOrder]);

  const workStats = useMemo(() => {
    const total = filteredWorkData.length || 0;
    const s1 = filteredWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 1).length;
    const s2 = filteredWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 2).length;
    const s3 = filteredWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 3).length;
    const s4 = filteredWorkData.filter((t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 4).length;
    const overdueCount = filteredWorkData.filter((t) => isTaskOverdue(t, workplanQuarter)).length;
    const m = total - (s1 + s2 + s3 + s4);
    return {
      total, s1, s2, s3, s4, m, overdue: overdueCount,
      p1: Math.round((s1 / total) * 100) || 0, p2: Math.round((s2 / total) * 100) || 0, p3: Math.round((s3 / total) * 100) || 0, pM: Math.round((m / total) * 100) || 0
    };
  }, [filteredWorkData, workplanQuarter]);

  const orphanedDataAlert = useMemo(() => {
    if (currentUser?.user !== 'aharony') return null;
    const orphanedBudgets = staticData.filter(b => !cleanStr(b.wing) || !cleanStr(b.dept));
    const orphanedWorks = workPlans.filter(w => !cleanStr(w.wing) || !cleanStr(w.dept));
    if (orphanedBudgets.length === 0 && orphanedWorks.length === 0) return null;
    return { budgets: orphanedBudgets.length, works: orphanedWorks.length };
  }, [staticData, workPlans, currentUser]);

  const updateTaskLocal = (taskId, field, value) => {
    setWorkPlans((prev) => prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)));
    setPendingChanges((prev) => {
      const q = field.startsWith('q') ? parseInt(field.charAt(1), 10) : workplanQuarter;
      const existing = prev.find((c) => c.id === taskId && c.quarter === q);
      const update = { id: taskId, quarter: q, [field.startsWith('q') ? 'rating' : 'note']: value };
      return existing ? [...prev.filter((c) => !(c.id === taskId && c.quarter === q)), { ...existing, ...update }] : [...prev, update];
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

  const scopeTitle = useMemo(() => {
    if (!currentUser) return 'כלל המועצה';
    if (currentUser.role === 'ADMIN') return activeWingId || 'כלל המועצה';
    const targets = [currentUser.target1, currentUser.target2].map(cleanStr).filter(Boolean);
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-900 text-white flex items-center justify-center mb-5 shadow-xl shadow-emerald-900/20">
              <Building2 size={32} strokeWidth={2} />
            </div>
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
    <div className="min-h-screen bg-slate-50/50 text-slate-800 flex flex-col font-sans text-right overflow-x-hidden" dir="rtl">
      
      {/* Global Spinner */}
      {loading && (
        <div className="fixed inset-0 z-[2000] bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100 animate-in zoom-in-95 duration-200">
            <Loader2 className="animate-spin text-emerald-600 mb-3" size={32} />
            <span className="font-bold text-slate-600 text-sm">מרענן נתונים...</span>
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
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><Menu size={22} /></button>
          <div className="hidden sm:flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button onClick={() => { setMainTab('budget'); setViewMode('dashboard'); }} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${mainTab === 'budget' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>תקציב</button>
            <button onClick={() => { setMainTab('workplan'); setViewMode('dashboard'); }} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${mainTab === 'workplan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>תכניות עבודה</button>
            {isAharony && <button onClick={async () => { setMainTab('users'); await loadUsers(); }} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${mainTab === 'users' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>משתמשים</button>}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          
          {/* אינדיקטור שמירה אוטומטית */}
          {saveStatus === 'saving' && <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg"><Loader2 size={12} className="animate-spin"/> <span className="hidden sm:inline">שומר...</span></div>}
          {saveStatus === 'saved' && <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg animate-in fade-in duration-300"><CheckCircle2 size={12}/> <span className="hidden sm:inline">נשמר</span></div>}
          {saveStatus === 'error' && <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg animate-in slide-in-from-top-1"><AlertTriangle size={12}/> <span className="hidden sm:inline">שגיאה</span></div>}

          <button onClick={loadData} disabled={loading} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> <span className="hidden sm:inline">רענן נתונים</span>
          </button>
          <button onClick={exportCurrentView} className="hidden sm:flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-bold text-xs shadow-sm hover:bg-slate-50 hover:text-emerald-700 transition-colors">
            <Download size={14} /> ייצוא
          </button>
          <div className="flex flex-col items-end mr-2">
            <span className="text-xs font-black text-slate-800">{currentUser.user}</span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wide">מועצת עומר</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-800 flex items-center justify-center font-black border border-emerald-200 shadow-sm shrink-0">
            {currentUser.user.charAt(0).toUpperCase()}
          </div>
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
             {['budget', 'workplan', ...(isAharony ? ['users'] : [])].map(tab => (
                <button key={tab} onClick={() => { setMainTab(tab); if(tab!=='users') setViewMode('dashboard'); else loadUsers(); setIsMenuOpen(false); }} className={`w-full text-right px-4 py-3 rounded-xl text-sm font-bold transition-all ${mainTab === tab ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {tab === 'budget' ? 'תקציב' : tab === 'workplan' ? 'תכניות עבודה' : 'ניהול משתמשים'}
                </button>
             ))}
          </div>
          
          {mainTab !== 'users' && (
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="p-4 space-y-1.5 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">תצוגות</p>
                <button onClick={() => { setViewMode('dashboard'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${viewMode === 'dashboard' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <LayoutDashboard size={18} className={viewMode === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'} /> תמונת מצב
                </button>
                <button onClick={() => { setViewMode('table'); if (mainTab === 'workplan' && workplanQuarter === 0) setWorkplanQuarter(1); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <TableProperties size={18} className={viewMode === 'table' ? 'text-blue-400' : 'text-slate-400'} /> {mainTab === 'budget' ? 'פירוט תקציב' : 'עדכון משימות'}
                </button>
                {mainTab === 'budget' && (
                  <button onClick={() => { setViewMode('control'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${viewMode === 'control' ? 'bg-red-50 text-red-700 border border-red-100' : 'text-slate-600 hover:bg-slate-50 hover:text-red-600'}`}>
                    <ShieldAlert size={18} className={viewMode === 'control' ? 'text-red-600' : 'text-slate-400'} /> בקרת חריגות
                  </button>
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
                  <div className="bg-emerald-50 text-emerald-800 px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 border border-emerald-100">
                    <Building2 size={16} className="text-emerald-600" /> <span className="truncate">{currentUser.target1}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8 scroll-smooth relative">
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
                {mainTab === 'users' ? 'ניהול גישה והרשאות' : (
                  <>{mainTab === 'budget' && <Wallet className="text-emerald-500 hidden sm:block" size={28} />}{mainTab === 'workplan' && <Target className="text-blue-500 hidden sm:block" size={28} />}{scopeTitle}</>
                )}
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1.5 flex items-center gap-2">
                {mainTab === 'budget' && viewMode === 'dashboard' && 'תקציר ביצועים פיננסיים והתפלגות לפי מחלקות.'}
                {mainTab === 'budget' && viewMode === 'table' && 'פירוט סעיפים מלא וניתוח שורות תקציב.'}
                {mainTab === 'budget' && viewMode === 'control' && 'זיהוי חריגות וניהול סיכונים תקציביים.'}
                {mainTab === 'workplan' && viewMode === 'dashboard' && 'מעקב התקדמות ויעדים אסטרטגיים.'}
                {mainTab === 'workplan' && viewMode === 'table' && 'עדכון סטטוסים והערות למשימות שוטפות.'}
              </p>
            </div>

            {/* --------- USERS TAB --------- */}
            {mainTab === 'users' && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-5">הוספת משתמש חדש</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" placeholder="שם משתמש" value={userForm.username} onChange={(e) => setUserForm(p => ({ ...p, username: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    <input type="text" placeholder="סיסמה" value={userForm.password} onChange={(e) => setUserForm(p => ({ ...p, password: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    <select value={userForm.role} onChange={(e) => setUserForm(p => ({ ...p, role: e.target.value, target1: '', target2: '' }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                      <option value="ADMIN">מנהל (ADMIN)</option><option value="WING">ראש אגף (WING)</option><option value="DEPT">מנהל מחלקה (DEPT)</option>
                    </select>
                    <select value={userForm.active} onChange={(e) => setUserForm(p => ({ ...p, active: e.target.value }))} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                      <option value="TRUE">סטטוס: פעיל</option><option value="FALSE">סטטוס: מושהה</option>
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
                    {usersList.map((u) => (
                      <div key={u.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-4 lg:items-center">
                        <div className="bg-slate-50 text-slate-400 font-mono text-[10px] p-2 rounded-lg shrink-0">#{u.id}</div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                          <div><span className="text-[9px] font-bold text-slate-400 block mb-1">שם משתמש</span><input value={u.username} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, username: e.target.value } : x))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-emerald-500" /></div>
                          <div><span className="text-[9px] font-bold text-slate-400 block mb-1">סיסמה</span><input value={u.password} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, password: e.target.value } : x))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-1 focus:ring-emerald-500" /></div>
                          <div><span className="text-[9px] font-bold text-slate-400 block mb-1">הרשאה</span><select value={u.role} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, role: e.target.value, target1: '', target2: '' } : x))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none"><option value="ADMIN">ADMIN</option><option value="WING">WING</option><option value="DEPT">DEPT</option></select></div>
                          <div><span className="text-[9px] font-bold text-slate-400 block mb-1">סטטוס</span><select value={String(u.active).toUpperCase()} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, active: e.target.value } : x))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none"><option value="TRUE">פעיל</option><option value="FALSE">לא פעיל</option></select></div>
                        </div>
                        {u.role !== 'ADMIN' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 lg:max-w-xs border-t lg:border-t-0 lg:border-r border-slate-100 pt-3 lg:pt-0 lg:pr-4">
                             <select value={u.target1 || ''} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, target1: e.target.value } : x))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"><option value="">יעד 1</option>{userTargetOptions(u.role).map(o => <option key={o} value={o}>{o}</option>)}</select>
                             <select value={u.target2 || ''} onChange={(e) => setUsersList(p => p.map(x => x.id === u.id ? { ...x, target2: e.target.value } : x))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"><option value="">יעד 2</option>{userTargetOptions(u.role).filter(o => o !== u.target1).map(o => <option key={o} value={o}>{o}</option>)}</select>
                          </div>
                        )}
                        <div className="flex w-full lg:w-auto gap-2 mt-2 lg:mt-0">
                          <button onClick={() => updateUserRow(u)} className="flex-1 lg:flex-none bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-xs border border-blue-200 transition-colors hover:bg-blue-100">שמור</button>
                          <button onClick={() => deactivateUserRow(u.id)} className="flex-1 lg:flex-none bg-white text-red-600 px-4 py-2 rounded-lg font-bold text-xs border border-red-200 transition-colors hover:bg-red-50">מחק</button>
                        </div>
                      </div>
                    ))}
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
                      <StatCard title="ביצוע + שריון 2026" value={formatILS(budgetStats.expCommit26)} icon={TrendingUp} />
                      <StatCard title="ביצוע בפועל 2026" value={formatILS(budgetStats.expExec26)} icon={TrendingDown} />
                      <StatCard title="הכנסות (תקציב 2026)" value={formatILS(budgetStats.incB26)} />
                      <StatCard title="הכנסות (ביצוע בפועל)" value={formatILS(budgetStats.incExec26)} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] p-6 min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-end mb-8"><h3 className="font-black text-slate-800 text-lg">פילוח תקציב הוצאות למחלקות (2026)</h3></div>
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                          <BarChart data={budgetByDeptChart} margin={{ top: 0, right: 0, left: 0, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} interval={0} tickMargin={14} />
                            <YAxis hide />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 'bold' }} formatter={(v) => formatILS(v)} />
                            <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={36}>{budgetByDeptChart.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}</Bar>
                          </BarChart>
                        </ResponsiveContainer>
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
                            <h3 className="font-bold text-slate-400 text-xs tracking-widest uppercase absolute top-5 right-6">ביצוע מול יתרה (הוצאות)</h3>
                            {budgetExecutionPie.length > 0 ? (
                               <div className="w-full h-full flex items-center justify-center mt-6">
                                  <ResponsiveContainer width="100%" height={160}>
                                    <PieChart><Pie data={budgetExecutionPie} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70} stroke="none" paddingAngle={5}><Cell fill="#cbd5e1" /><Cell fill="#0d9488" /></Pie><Tooltip formatter={(v) => formatILS(v)} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 'bold' }} /></PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute bottom-5 flex gap-4">{budgetExecutionPie.map((item, i) => (<div key={item.name} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: i === 0 ? '#cbd5e1' : '#0d9488'}}></div> {i===0?'יתרה':'בוצע'}</div>))}</div>
                               </div>
                            ) : (<span className="text-slate-300 font-bold text-sm">אין נתונים</span>)}
                         </div>
                      </div>
                    </div>
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
                       <div className="hidden xl:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
                         {[ { k: 'a2024', l: 'ביצוע 24' }, { k: 'b2025', l: 'תקציב 25' }, { k: 'b2026', l: 'תקציב 26' }, { k: 'a2026', l: 'ביצוע 26' }, { k: 'commitTotal2026', l: 'שריון+ביצוע' } ].map((col) => (<button key={col.k} onClick={() => toggleBudgetColumn(col.k)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${budgetVisibleColumns[col.k] ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{col.l}</button>))}
                       </div>
                    </div>
                    <div className="hidden lg:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="py-4 px-5 w-24">מזהה</th><th className="py-4 px-5">שם סעיף תקציבי</th><th className="py-4 px-5 w-32">מחלקה</th><th className="py-4 px-5 w-24 text-center">סוג</th>{visibleBudgetColumnDefs.map((col) => <th key={col.key} className="py-4 px-5 w-32 text-left">{col.label}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredBudgetData.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="py-3 px-5 text-[10px] font-mono text-slate-400 group-hover:text-slate-600 transition-colors">{row.id}</td><td className="py-3 px-5 text-sm font-black text-slate-800">{row.name}</td><td className="py-3 px-5 text-xs font-bold text-slate-500">{row.dept}</td>
                              <td className="py-3 px-5 text-center"><span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold ${sameKey(row.type, 'הכנסה') ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>{row.type}</span></td>
                              {visibleBudgetColumnDefs.map((col) => (<td key={col.key} className="py-3 px-5 text-sm font-bold text-slate-700 text-left tabular-nums">{formatILS(col.value(row))}</td>))}
                            </tr>
                          ))}
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
                       {showOnlyBudgetAlerts && <button onClick={() => setShowOnlyBudgetAlerts(false)} className="w-full lg:w-auto px-4 py-2 bg-red-50 text-red-600 font-bold text-xs rounded-xl flex items-center justify-center gap-2"><X size={14}/> בטל סינון חריגות</button>}
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
                   {[1, 2, 3, 4].map(q => ( <button key={q} onClick={() => setWorkplanQuarter(q)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${workplanQuarter === q ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>רבעון {q}</button> ))}
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
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4 mb-6">
                      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg shadow-slate-900/10 flex flex-col justify-center text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">סה"כ</p>
                        <p className="text-3xl font-black">{workStats.total}</p>
                      </div>
                      <div className="bg-red-50 text-red-700 p-5 rounded-2xl border border-red-100 flex flex-col justify-center text-center shadow-sm cursor-pointer hover:bg-red-100 transition-colors" onClick={() => { setViewMode('table'); setShowOnlyOverdueTasks(true); }}>
                        <div className="flex justify-center items-center gap-1.5 mb-1">
                          <AlertTriangle size={14} className="text-red-500" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">בחריגה</p>
                        </div>
                        <p className="text-3xl font-black">{workStats.overdue}</p>
                      </div>
                      <StatCard title="בוצע" value={`${workStats.p1}%`} subtext={`${workStats.s1} משימות`} icon={CheckCircle2} />
                      <StatCard title="בעיכוב" value={`${workStats.p2}%`} subtext={`${workStats.s2} משימות`} icon={Clock} />
                      <StatCard title="בהקפאה" value={`${workStats.p3}%`} subtext={`${workStats.s3} משימות`} icon={MinusCircle} />
                      <StatCard title="ממתין" value={workStats.s4} subtext={`מתוך ${workStats.total}`} icon={HelpCircle} />
                    </div>

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
                          <ResponsiveContainer width="100%" height={260}>
                             <BarChart layout="vertical" data={Array.from(new Set(filteredWorkData.map((t) => (activeWingId ? t.dept : t.wing)))).map((name) => ({ n: name, v: filteredWorkData.filter((t) => (activeWingId ? t.dept : t.wing) === name).length }))} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="n" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#475569' }} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius:'10px', border:'none', boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}} />
                                <Bar dataKey="v" fill="#3b82f6" radius={[4, 4, 4, 4]} barSize={14} />
                             </BarChart>
                          </ResponsiveContainer>
                       </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white p-2 pl-4 pr-2 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between sticky top-20 z-40">
                       <div className="flex w-full md:w-auto items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all flex-1 md:max-w-md">
                          <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                          <input type="text" placeholder="חיפוש משימה, פעילות או מזהה..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full" />
                       </div>
                       <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                          <div className="flex-1 md:flex-none items-center bg-slate-50 rounded-xl border border-slate-200 shrink-0 relative min-w-[150px]">
                             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Filter size={14} /></div>
                             <select disabled={showOnlyOverdueTasks} value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-full bg-transparent py-2.5 pl-4 pr-9 text-sm font-bold text-slate-700 outline-none appearance-none disabled:opacity-50">
                               <option value="הכל">כל המחלקות באגף</option>
                               {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
                             </select>
                          </div>
                          <button onClick={() => setShowOnlyOverdueTasks(!showOnlyOverdueTasks)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${showOnlyOverdueTasks ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                             <AlertTriangle size={14}/> {showOnlyOverdueTasks ? 'הסר סינון חריגות' : 'הצג חריגות בלבד'}
                          </button>
                       </div>
                    </div>

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
                             {sortedWorkData.map(t => {
                                const prevStatuses = [1, 2, 3, 4].filter((q) => q < workplanQuarter && t[`q${q}`]);
                                const latestPrev = prevStatuses.length > 0 ? t[`q${prevStatuses[prevStatuses.length - 1]}`] : null;
                                const currentStatus = t[`q${workplanQuarter}`];
                                const isOverdue = isTaskOverdue(t, workplanQuarter);
                                
                                return (
                                   <tr key={t.id} className="hover:bg-slate-50/40 transition-colors group">
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
                                      <td className="py-4 px-5"><StatusDropdown value={currentStatus} open={openStatusMenuId === t.id} setOpen={(open) => setOpenStatusMenuId(open ? t.id : null)} onChange={(val) => { updateTaskLocal(t.id, `q${workplanQuarter}`, val); setOpenStatusMenuId(null); }} /></td>
                                      <td className="py-4 px-5">
                                         <div className="relative group-hover:shadow-inner bg-slate-50 rounded-xl transition-all"><MessageSquare size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="הקלד הערה למנהל..." value={t[`n${workplanQuarter}`] || ""} onChange={(e) => updateTaskLocal(t.id, `n${workplanQuarter}`, e.target.value)} className="w-full bg-transparent border border-transparent focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl py-2 pl-3 pr-9 text-xs font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400" /></div>
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

                          return (
                             <div key={t.id} className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_15px_-5px_rgba(0,0,0,0.05)] p-5 relative overflow-visible">
                                <div className="flex justify-between items-start mb-3">
                                   <div className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-mono text-slate-500">#{t.id}</div>
                                   <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{t.dept}</div>
                                </div>
                                {t.activity && <div className="text-[10px] font-bold text-blue-600 mb-1">{t.activity}</div>}
                                <h4 className="font-black text-slate-800 text-sm leading-snug mb-3 pr-1">{t.task}</h4>
                                <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md mb-4 ${isOverdue ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-50'}`}><Clock size={12} /> יעד לביצוע: {formatDate(t.deadline)}</div>
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-4 border border-slate-100/50">
                                   <div className="grid grid-cols-2 gap-4 items-center">
                                      <div>
                                         <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">סטטוס קודם</p>
                                         {latestPrev ? (<div className="inline-flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${STATUS_CONFIG[latestPrev].bg.replace('bg-', 'bg-').replace('50', '400')}`}></div><span className="text-[11px] font-bold text-slate-600">{STATUS_CONFIG[latestPrev].label}</span></div>) : <span className="text-[11px] text-slate-400 font-medium">אין מידע</span>}
                                      </div>
                                      <div>
                                         <p className="text-[9px] font-black uppercase text-blue-500 mb-1.5">עדכון עכשיו (ר{workplanQuarter})</p>
                                         <StatusDropdown value={currentStatus} open={openStatusMenuId === t.id} setOpen={(open) => setOpenStatusMenuId(open ? t.id : null)} onChange={(val) => { updateTaskLocal(t.id, `q${workplanQuarter}`, val); setOpenStatusMenuId(null); }} />
                                      </div>
                                   </div>
                                   <div className="relative pt-2 border-t border-slate-200/60">
                                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">הערות לחמ"ל</p>
                                      <textarea rows={1} placeholder="הקלד כאן..." value={t[`n${workplanQuarter}`] || ""} onChange={(e) => updateTaskLocal(t.id, `n${workplanQuarter}`, e.target.value)} className="w-full bg-white border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-xl py-2 px-3 text-xs font-medium text-slate-700 outline-none transition-all resize-none overflow-hidden" />
                                   </div>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;