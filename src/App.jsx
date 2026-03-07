import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  LayoutDashboard,
  UserRound,
  Building2,
  HardHat,
  GraduationCap,
  Wallet,
  Truck,
  Users,
  Megaphone,
  TableProperties,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  Save,
  Menu,
  X,
  Loader2,
  MessageSquare,
  History,
  MinusCircle,
  UserCog
} from 'lucide-react';

const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2Y4QkJxnqapKne4Q5TSAC5ZVBE1oPjKYKRKE1MFqiDfxSBZdWJQgbFnJbKz_H98q6WvS6NtKKjHM2/pub?output=csv";
// הלינק החדש שהבאת הוטמע כאן:
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
  'שירות לתושב ודוברות': Megaphone
};

const STATUS_CONFIG = {
  1: { label: "בוצע", color: "#10b981", bg: "bg-emerald-100", text: "text-emerald-700" },
  2: { label: "עיכוב", color: "#f59e0b", bg: "bg-amber-100", text: "text-amber-700" },
  3: { label: "עצירת המשימה", color: "#ef4444", bg: "bg-red-100", text: "text-red-700" },
  4: { label: "לא הגיע הזמן", color: "#94a3b8", bg: "bg-slate-200", text: "text-slate-600" }
};

const PIE_COLORS = ['#0f766e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b', '#22c55e'];

const formatDate = (val) => {
  if (!val) return "-";
  if (String(val).includes('/')) return val;
  const serial = parseFloat(val);
  if (isNaN(serial)) return val;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
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
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absVal);
  return (val || 0) < 0 ? `-${formatted}` : formatted;
};

const cleanStr = (s) => String(s || "").trim();

const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val || val === "") return 0;
  const str = String(val).replace(/,/g, '').replace(/\s/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
};

const getOverallRating = (task) => {
  if ([1, 2, 3, 4].includes(task.q4)) return task.q4;
  if ([1, 2, 3, 4].includes(task.q3)) return task.q3;
  if ([1, 2, 3, 4].includes(task.q2)) return task.q2;
  if ([1, 2, 3, 4].includes(task.q1)) return task.q1;
  return null;
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
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((v) => v.trim());
};

const StatusDropdown = ({ value, onSelect, isOpen, onToggle }) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`p-2 rounded-xl text-[10px] font-black w-full shadow-sm ${
          value ? `${STATUS_CONFIG[value].bg} ${STATUS_CONFIG[value].text}` : 'bg-slate-100 text-slate-400'
        }`}
      >
        {value ? STATUS_CONFIG[value].label : '- בחר -'}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-full bg-white border rounded-2xl shadow-2xl overflow-hidden">
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <button
              key={v}
              onClick={() => onSelect(parseInt(v, 10))}
              className={`w-full text-right px-3 py-3 text-[11px] font-black ${c.bg} ${c.text} border-b last:border-b-0`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uInput, setUInput] = useState("");
  const [pInput, setPInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [staticData, setStaticData] = useState([]);
  const [workPlans, setWorkPlans] = useState([]);
  const [executionMap, setExecutionMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [pendingChanges, setPendingChanges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [mainTab, setMainTab] = useState('budget');
  const [viewMode, setViewMode] = useState('dashboard');
  const [activeWingId, setActiveWingId] = useState(null);

  const [workplanQuarter, setWorkplanQuarter] = useState(0);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('הכל');
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
    a2024: false,
    b2025: false,
    b2026: true,
    a2026: false,
    commitTotal2026: false
  });
  const [controlCompareBy, setControlCompareBy] = useState('a2026');

  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'WING',
    target1: '',
    target2: '',
    active: 'TRUE'
  });

  const [openStatusMenuId, setOpenStatusMenuId] = useState(null);

  // מאפס את ההתראות כשעוברים מסכים כדי שיוכלו לקפוץ שוב כשצריך
  useEffect(() => {
    if (viewMode !== 'control') {
      setHasSeenBudgetPopup(false);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'table') {
      setHasSeenWorkplanPopup(false);
    }
  }, [viewMode]);

  const wingsOptions = useMemo(() => {
    return Array.from(new Set(staticData.map((r) => cleanStr(r.wing)).filter(Boolean))).sort();
  }, [staticData]);

  const deptsOptions = useMemo(() => {
    return Array.from(new Set(staticData.map((r) => cleanStr(r.dept)).filter(Boolean))).sort();
  }, [staticData]);

  const userTargets = (user) =>
    [user?.target1, user?.target2].map(cleanStr).filter(Boolean);

  const matchesUserTargets = (value, user) => {
    const targets = userTargets(user);
    if (!targets.length) return true;
    return targets.includes(cleanStr(value));
  };

  const getUserScopeLabel = () => {
    if (!currentUser) return 'כלל המועצה';
    if (currentUser.role === 'ADMIN') return activeWingId || 'כלל המועצה';
    const targets = userTargets(currentUser);
    return targets.join(' / ') || activeWingId || 'כלל המועצה';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await fetch(
        `${GAS_SCRIPT_URL}?action=login&username=${encodeURIComponent(uInput)}&password=${encodeURIComponent(pInput)}`
      ).then((r) => ensureOk(r, 'Login'));

      const data = await res.json();

      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        setShowOnlyBudgetAlerts(false);
        setShowOnlyOverdueTasks(false);
        setMainTab(currentUser?.user === 'aharony' ? 'budget' : 'budget');

        if (data.user.role === 'WING') {
          setActiveWingId(cleanStr(data.user.target1) || null);
        } else {
          setActiveWingId(null);
        }
      } else {
        setLoginError('שם משתמש או סיסמה שגויים');
      }
    } catch (err) {
      console.error(err);
      setLoginError('שגיאה בהתחברות לשרת');
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${GAS_SCRIPT_URL}?action=listUsers&t=${Date.now()}`).then((r) =>
        ensureOk(r, 'List users')
      );
      const data = await res.json();
      if (data.success) {
        setUsersList((data.users || []).map((u) => ({
          ...u,
          active: String(u.active || 'TRUE').toUpperCase()
        })));
      } else {
        alert('שגיאה בטעינת משתמשים');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בטעינת משתמשים');
    } finally {
      setUsersLoading(false);
    }
  };

  const addUser = async () => {
    if (!cleanStr(userForm.username) || !cleanStr(userForm.password)) {
      alert('יש למלא שם משתמש וסיסמה');
      return;
    }

    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'addUser',
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          target1: userForm.role === 'ADMIN' ? '' : userForm.target1,
          target2: userForm.role === 'ADMIN' ? '' : userForm.target2,
          active: userForm.active
        })
      }).then((r) => ensureOk(r, 'Add user'));

      const data = await res.json();
      if (data.success) {
        await loadUsers();
        setUserForm({
          username: '',
          password: '',
          role: 'WING',
          target1: '',
          target2: '',
          active: 'TRUE'
        });
        alert('המשתמש נוסף בהצלחה');
      } else {
        alert(`שגיאה בהוספת משתמש: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בהוספת משתמש');
    }
  };

  const updateUserRow = async (user) => {
    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateUser',
          id: user.id,
          username: user.username,
          password: user.password,
          role: user.role,
          target1: user.role === 'ADMIN' ? '' : user.target1,
          target2: user.role === 'ADMIN' ? '' : user.target2,
          active: String(user.active || 'TRUE').toUpperCase()
        })
      }).then((r) => ensureOk(r, 'Update user'));

      const data = await res.json();
      if (data.success) {
        await loadUsers();
        alert('המשתמש עודכן בהצלחה');
      } else {
        alert(`שגיאה בעדכון משתמש: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בעדכון משתמש');
    }
  };

  const deactivateUserRow = async (id) => {
    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deactivateUser',
          id
        })
      }).then((r) => ensureOk(r, 'Deactivate user'));

      const data = await res.json();
      if (data.success) {
        await loadUsers();
        alert('המשתמש הושבת בהצלחה');
      } else {
        alert(`שגיאה בהשבתת משתמש: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בהשבתת משתמש');
    }
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const [bRes, wRes, gasRes] = await Promise.all([
        fetch('/budget_data.json').then((res) => ensureOk(res, 'Budget data')),
        fetch('/workplans_data.json').then((res) => ensureOk(res, 'Workplans data')),
        fetch(`${GAS_SCRIPT_URL}?t=${Date.now()}`).then((res) => ensureOk(res, 'Live GAS data'))
      ]);

      const [bJson, wJson, liveData] = await Promise.all([
        bRes.json(),
        wRes.json(),
        gasRes.json()
      ]);

      setStaticData(bJson || []);
      setWorkPlans(
        (wJson || []).map((t) => {
          const live = liveData?.[String(t.id)] || {};
          return {
            ...t,
            q1: live.q1 ?? t.q1,
            q2: live.q2 ?? t.q2,
            q3: live.q3 ?? t.q3,
            q4: live.q4 ?? t.q4,
            n1: live.n1 || "",
            n2: live.n2 || "",
            n3: live.n3 || "",
            n4: live.n4 || ""
          };
        })
      );

      const csvRes = await fetch(`${SHEETS_CSV_URL}&t=${Date.now()}`).then((res) =>
        ensureOk(res, 'Sheets CSV')
      );
      const csvText = await csvRes.text();

      const rows = csvText.trim().split(/\r?\n/).map(parseCsvLine);
      const headers = (rows[0] || []).map((h) => h.trim().toLowerCase());

      const map = {};
      const idIdx = headers.findIndex((h) => h.includes('id'));
      const a26Idx = headers.findIndex((h) => h.includes('a2026'));
      const c26Idx = headers.findIndex((h) => h.includes('commit'));

      rows.slice(1).forEach((cols) => {
        if (cols[idIdx]) {
          map[String(cols[idIdx]).trim()] = {
            a2026: cleanNum(cols[a26Idx]),
            commit: cleanNum(cols[c26Idx])
          };
        }
      });

      setExecutionMap(map);
    } catch (e) {
      console.error("loadData error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && mainTab === 'workplan' && viewMode === 'table' && !hasSeenWorkplanPopup) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdue = workPlans.filter((t) => {
        if (currentUser?.role === 'WING' && !matchesUserTargets(t.wing, currentUser)) return false;
        if (currentUser?.role === 'DEPT' && !matchesUserTargets(t.dept, currentUser)) return false;
        if (activeWingId && cleanStr(t.wing) !== cleanStr(activeWingId)) return false;

        const taskDate = parseDateLogic(t.deadline);
        const overall = getOverallRating(t);
        return taskDate && taskDate < today && (!overall || overall === 3);
      }).length;

      if (overdue > 0) {
        setPopupCount(overdue);
        setActivePopup('workplan');
        setHasSeenWorkplanPopup(true);
      }
    }
  }, [loading, mainTab, viewMode, activeWingId, workPlans, hasSeenWorkplanPopup, currentUser]);

  const fullBudgetData = useMemo(() => {
    let data = staticData;

    if (currentUser?.role === 'WING') {
      data = data.filter((i) => matchesUserTargets(i.wing, currentUser));
    }

    if (currentUser?.role === 'DEPT') {
      data = data.filter((i) => matchesUserTargets(i.dept, currentUser));
    }

    if (activeWingId) {
      data = data.filter((i) => cleanStr(i.wing) === cleanStr(activeWingId));
    }

    return data.map((item) => {
      const e = executionMap[item.id] || { a2026: 0, commit: 0 };
      const b2026 = cleanNum(item.b2026);
      const a2026 = cleanNum(e.a2026);
      const commit = cleanNum(e.commit);
      const commitTotal2026 = a2026 + commit;

      return {
        ...item,
        a2024: cleanNum(item.a2024),
        b2025: cleanNum(item.b2025),
        b2026,
        a2026,
        commit,
        commitTotal2026
      };
    });
  }, [staticData, executionMap, activeWingId, currentUser]);

  const budgetDeptOptions = useMemo(() => {
    return Array.from(new Set(fullBudgetData.map((r) => cleanStr(r.dept)).filter(Boolean))).sort();
  }, [fullBudgetData]);

  const filteredBudgetData = useMemo(() => {
    let data = [...fullBudgetData];

    if (budgetFilterDept !== 'הכל') {
      data = data.filter((r) => cleanStr(r.dept) === cleanStr(budgetFilterDept));
    }

    if (budgetTypeFilter !== 'הכל') {
      data = data.filter((r) => cleanStr(r.type) === cleanStr(budgetTypeFilter));
    }

    if (cleanStr(budgetSearch)) {
      const q = cleanStr(budgetSearch).toLowerCase();
      data = data.filter((r) => cleanStr(r.name).toLowerCase().includes(q));
    }

    if (showOnlyBudgetAlerts) {
      data = data.filter((r) => {
        const balance = r.b2026 - r.a2026;
        return (r.type === 'הכנסה' && balance > 0) || (r.type === 'הוצאה' && balance < 0);
      });
    }

    return data;
  }, [fullBudgetData, budgetFilterDept, budgetTypeFilter, budgetSearch, showOnlyBudgetAlerts]);

  useEffect(() => {
    if (!loading && mainTab === 'budget' && viewMode === 'control' && !hasSeenBudgetPopup) {
      const redItems = filteredBudgetData.filter((r) => {
        const balance = r.b2026 - r.a2026;
        return (r.type === 'הכנסה' && balance > 0) || (r.type === 'הוצאה' && balance < 0);
      }).length;

      if (redItems > 0) {
        setPopupCount(redItems);
        setActivePopup('budget');
        setHasSeenBudgetPopup(true);
      }
    }
  }, [loading, mainTab, viewMode, filteredBudgetData, hasSeenBudgetPopup]);

  const budgetStats = useMemo(() => {
    const expenses = fullBudgetData.filter((r) => r.type === 'הוצאה');
    const incomes = fullBudgetData.filter((r) => r.type === 'הכנסה');

    const sumRows = (rows, key) => rows.reduce((acc, curr) => acc + cleanNum(curr[key]), 0);

    return {
      expA24: sumRows(expenses, 'a2024'),
      expB25: sumRows(expenses, 'b2025'),
      expB26: sumRows(expenses, 'b2026'),
      expExec26: sumRows(expenses, 'a2026'),
      expCommit26: expenses.reduce((acc, curr) => acc + curr.commitTotal2026, 0),
      incB26: sumRows(incomes, 'b2026'),
      incExec26: sumRows(incomes, 'a2026')
    };
  }, [fullBudgetData]);

  const budgetByDeptChart = useMemo(() => {
    const expensesOnly = fullBudgetData.filter((r) => r.type === 'הוצאה');
    const groups = {};

    expensesOnly.forEach((row) => {
      const groupKey = cleanStr(row.dept) || 'ללא מחלקה';
      groups[groupKey] = (groups[groupKey] || 0) + cleanNum(row.b2026);
    });

    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [fullBudgetData]);

  const budgetByTypePie = useMemo(() => {
    const expenses = fullBudgetData
      .filter((r) => r.type === 'הוצאה')
      .reduce((acc, curr) => acc + curr.b2026, 0);

    const incomes = fullBudgetData
      .filter((r) => r.type === 'הכנסה')
      .reduce((acc, curr) => acc + curr.b2026, 0);

    return [
      { name: 'הוצאה', value: expenses },
      { name: 'הכנסה', value: incomes }
    ].filter((i) => i.value > 0);
  }, [fullBudgetData]);

  const budgetExecutionPie = useMemo(() => {
    const expensesOnly = fullBudgetData.filter((r) => r.type === 'הוצאה');
    const executed = expensesOnly.reduce((acc, curr) => acc + curr.a2026, 0);
    const totalBudget = expensesOnly.reduce((acc, curr) => acc + curr.b2026, 0);
    const remain = Math.max(totalBudget - executed, 0);

    return [
      { name: 'בוצע 2026', value: executed },
      { name: 'יתרה לתקציב', value: remain }
    ].filter((i) => i.value > 0);
  }, [fullBudgetData]);

  const controlData = useMemo(() => {
    return filteredBudgetData.map((row) => {
      const compareValue = controlCompareBy === 'a2026' ? row.a2026 : row.commitTotal2026;
      const balance = row.b2026 - compareValue;
      const isRed =
        (row.type === 'הכנסה' && balance > 0) ||
        (row.type === 'הוצאה' && balance < 0);

      return {
        ...row,
        compareValue,
        balance,
        isRed
      };
    });
  }, [filteredBudgetData, controlCompareBy]);

  const availableDepts = useMemo(() => {
    let pool = workPlans;

    if (currentUser?.role === 'WING') {
      pool = pool.filter((t) => matchesUserTargets(t.wing, currentUser));
    }

    if (currentUser?.role === 'DEPT') {
      pool = pool.filter((t) => matchesUserTargets(t.dept, currentUser));
    }

    if (activeWingId) {
      pool = pool.filter((t) => cleanStr(t.wing) === cleanStr(activeWingId));
    }

    return Array.from(new Set(pool.map((t) => t.dept))).filter(Boolean).sort();
  }, [workPlans, activeWingId, currentUser]);

  const filteredWorkData = useMemo(() => {
    let data = workPlans;

    if (currentUser?.role === 'WING') {
      data = data.filter((t) => matchesUserTargets(t.wing, currentUser));
    }

    if (currentUser?.role === 'DEPT') {
      data = data.filter((t) => matchesUserTargets(t.dept, currentUser));
    }

    if (activeWingId) {
      data = data.filter((t) => cleanStr(t.wing) === cleanStr(activeWingId));
    }

    if (filterDept !== 'הכל') {
      data = data.filter((t) => cleanStr(t.dept) === cleanStr(filterDept));
    }

    if (search) {
      data = data.filter(
        (t) =>
          cleanStr(t.task).includes(search) ||
          cleanStr(t.dept).includes(search) ||
          String(t.id).includes(search)
      );
    }

    if (showOnlyOverdueTasks) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      data = data.filter((t) => {
        const taskDate = parseDateLogic(t.deadline);
        const overall = getOverallRating(t);
        return taskDate && taskDate < today && (!overall || overall === 3);
      });
    }

    return data;
  }, [workPlans, currentUser, activeWingId, filterDept, search, showOnlyOverdueTasks]);

  const workStats = useMemo(() => {
    const total = filteredWorkData.length || 0;
    const s1 = filteredWorkData.filter(
      (t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 1
    ).length;
    const s2 = filteredWorkData.filter(
      (t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 2
    ).length;
    const s3 = filteredWorkData.filter(
      (t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 3
    ).length;
    const s4 = filteredWorkData.filter(
      (t) => (workplanQuarter === 0 ? getOverallRating(t) : t[`q${workplanQuarter}`]) === 4
    ).length;
    const m = total - (s1 + s2 + s3 + s4);

    return {
      total,
      s1,
      s2,
      s3,
      s4,
      m,
      p1: Math.round((s1 / total) * 100) || 0,
      p2: Math.round((s2 / total) * 100) || 0,
      p3: Math.round((s3 / total) * 100) || 0,
      pM: Math.round((m / total) * 100) || 0
    };
  }, [filteredWorkData, workplanQuarter]);

  const updateTaskLocal = (taskId, field, value) => {
    setWorkPlans((prev) => prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)));

    setPendingChanges((prev) => {
      const q = field.startsWith('q') ? parseInt(field.charAt(1), 10) : workplanQuarter;
      const existing = prev.find((c) => c.id === taskId && c.quarter === q);
      const update = { id: taskId, quarter: q, [field.startsWith('q') ? 'rating' : 'note']: value };

      return existing
        ? [...prev.filter((c) => !(c.id === taskId && c.quarter === q)), { ...existing, ...update }]
        : [...prev, update];
    });
  };

  const saveChanges = async () => {
    if (pendingChanges.length === 0) return;
    setIsSaving(true);

    try {
      const res = await fetch(GAS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'batchUpdate',
          changes: pendingChanges
        })
      });

      await ensureOk(res, 'Batch update');
      const data = await res.json();
      
      if (data.success) {
        alert("העדכונים נשמרו בהצלחה!");
        setPendingChanges([]);
        await loadData();
      } else {
        throw new Error(data.error || 'שגיאה בעדכון');
      }
    } catch (e) {
      console.error("saveChanges error:", e);
      alert(`בעיה בסנכרון: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBudgetColumn = (key) => {
    setBudgetVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const visibleBudgetColumnDefs = [
    { key: 'a2024', label: 'ביצוע 2024', value: (r) => r.a2024 },
    { key: 'b2025', label: 'תקציב 2025', value: (r) => r.b2025 },
    { key: 'b2026', label: 'תקציב 2026', value: (r) => r.b2026 },
    { key: 'a2026', label: 'ביצוע 2026', value: (r) => r.a2026 },
    { key: 'commitTotal2026', label: 'שריון+ביצוע 2026', value: (r) => r.commitTotal2026 }
  ].filter((c) => budgetVisibleColumns[c.key]);

  const userTargetOptions = (role) => {
    if (role === 'WING') return wingsOptions;
    if (role === 'DEPT') return deptsOptions;
    return [];
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center p-6 text-right" dir="rtl">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border relative overflow-hidden">
          {loading && (
             <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-emerald-600 mb-2" size={32} />
                <span className="font-bold text-slate-500 text-sm">טוען נתונים מהשרת...</span>
             </div>
          )}
          <h1 className="text-2xl font-black text-slate-800 mb-8 text-center font-sans text-right">
            פורטל מועצת עומר
          </h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="שם משתמש"
              className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right"
              value={uInput}
              onChange={(e) => setUInput(e.target.value)}
            />

            <input
              type="password"
              placeholder="סיסמה"
              className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right"
              value={pInput}
              onChange={(e) => setPInput(e.target.value)}
            />

            {loginError && (
              <div className="text-red-600 text-sm font-bold">{loginError}</div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-800 text-white p-4 rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-900 transition-colors"
            >
              כניסה
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-right overflow-x-hidden" dir="rtl">
      {activePopup === 'workplan' && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 text-center">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden border-t-8 border-red-500">
            <div className="p-8">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} className="text-red-500" />
              </div>

              <h3 className="text-2xl font-black text-slate-800 mb-2">תשומת לב מנהל</h3>
              <p className="text-slate-600 font-bold mb-8">
                נמצאו <span className="text-red-600 underline">{popupCount}</span> משימות שעבר תאריך היעד שלהן ועדיין לא בוצעו.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowOnlyOverdueTasks(true);
                    setActivePopup(null);
                  }}
                  className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition-all"
                >
                  הצג רק משימות בפיגור
                </button>

                <button
                  onClick={() => setActivePopup(null)}
                  className="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200"
                >
                  סגור והמשך כרגיל
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePopup === 'budget' && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 text-center">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden border-t-8 border-red-500">
            <div className="p-8">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} className="text-red-500" />
              </div>

              <h3 className="text-2xl font-black text-slate-800 mb-2">סעיפים בחריגה</h3>
              <p className="text-slate-600 font-bold mb-8">
                נמצאו <span className="text-red-600 underline">{popupCount}</span> סעיפים שנצבעו באדום לפי תצוגת הבקרה הנוכחית.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowOnlyBudgetAlerts(true);
                    setActivePopup(null);
                  }}
                  className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition-all"
                >
                  הצג רק סעיפים בחריגה
                </button>

                <button
                  onClick={() => setActivePopup(null)}
                  className="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200"
                >
                  סגור והמשך כרגיל
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingChanges.length > 0 && mainTab === 'workplan' && (
        <button
          onClick={saveChanges}
          disabled={isSaving}
          className="fixed bottom-6 left-6 z-[1000] bg-blue-600 text-white px-6 py-3 rounded-full font-black shadow-2xl flex items-center gap-3 border-4 border-white"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
          שמור {pendingChanges.length} עדכונים
        </button>
      )}

      <header className="bg-white border-b sticky top-0 z-[500] p-4 flex justify-between items-center px-4 lg:px-8 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setMainTab('budget');
                setViewMode('dashboard');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mainTab === 'budget' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'
              }`}
            >
              תקציב
            </button>

            <button
              onClick={() => {
                setMainTab('workplan');
                setViewMode('dashboard');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mainTab === 'workplan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'
              }`}
            >
              תכניות עבודה
            </button>

            {currentUser?.user === 'aharony' && (
              <button
                onClick={async () => {
                  setMainTab('users');
                  await loadUsers();
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mainTab === 'users' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'
                }`}
              >
                ניהול משתמשים
              </button>
            )}
          </div>
        </div>

        <div className="text-left font-black text-slate-600 text-[10px]">
          מועצת עומר | {currentUser.user}
        </div>
      </header>

      <div className="flex flex-1">
        {isMenuOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-[550] lg:hidden backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        <aside
          className={`fixed lg:static top-0 right-0 h-full w-72 bg-white z-[600] lg:z-auto transition-transform duration-300 transform border-l shadow-2xl lg:shadow-sm overflow-y-auto ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="lg:hidden p-4 border-b flex justify-between items-center bg-slate-50">
            <span className="font-black text-slate-800">תפריט ניווט</span>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-500">
              <X />
            </button>
          </div>

          {mainTab !== 'users' && (
            <>
              <div className="p-6 space-y-2 border-b text-right">
                <button
                  onClick={() => {
                    setViewMode('dashboard');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl ${
                    viewMode === 'dashboard'
                      ? 'bg-emerald-800 text-white shadow-lg'
                      : 'text-slate-600 hover:bg-emerald-50'
                  }`}
                >
                  <LayoutDashboard size={20} /> <span className="font-bold">תמונת מצב</span>
                </button>

                <button
                  onClick={() => {
                    setViewMode('table');
                    if (mainTab === 'workplan' && workplanQuarter === 0) setWorkplanQuarter(1);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl ${
                    viewMode === 'table'
                      ? 'bg-emerald-800 text-white shadow-lg'
                      : 'text-slate-600 hover:bg-emerald-50'
                  }`}
                >
                  <TableProperties size={20} /> <span className="font-bold">{mainTab === 'budget' ? 'פירוט' : 'פירוט ועדכון'}</span>
                </button>

                {mainTab === 'budget' && (
                  <button
                    onClick={() => {
                      setViewMode('control');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl ${
                      viewMode === 'control'
                        ? 'bg-red-700 text-white shadow-lg'
                        : 'text-red-600 font-bold'
                    }`}
                  >
                    <ShieldAlert size={20} /> <span className="font-bold">בקרה</span>
                  </button>
                )}
              </div>

              <div className="p-6 space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">אגפים</p>

                {currentUser.role === 'ADMIN' ? (
                  <>
                    <button
                      onClick={() => {
                        setActiveWingId(null);
                        setFilterDept('הכל');
                        setBudgetFilterDept('הכל');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-right p-3 rounded-xl mb-1 text-sm font-bold ${
                        !activeWingId
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      כלל המועצה
                    </button>

                    {Object.keys(ICONS).map((name) => (
                      <button
                        key={name}
                        onClick={() => {
                          setActiveWingId(name);
                          setFilterDept('הכל');
                          setBudgetFilterDept('הכל');
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-start gap-3 p-3 rounded-xl text-sm ${
                          activeWingId === name
                            ? 'bg-slate-900 text-white font-bold shadow-md'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {React.createElement(ICONS[name], { size: 16 })} <span>{name}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl font-black flex items-center gap-3 border border-emerald-100">
                    {React.createElement(ICONS[activeWingId] || Building2, { size: 20 })} {getUserScopeLabel()}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        <main className="flex-1 p-4 lg:p-8 text-right overflow-x-hidden">
          <h2 className="text-2xl lg:text-4xl font-black text-slate-800 mb-8 tracking-tight">
            {mainTab === 'users' ? 'ניהול משתמשים' : getUserScopeLabel()}
          </h2>

          {mainTab === 'users' ? (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border shadow-sm p-6">
                <h3 className="text-xl font-black text-slate-800 mb-4">הוספת משתמש</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="שם משתמש"
                    value={userForm.username}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="p-3 bg-slate-50 border rounded-xl font-bold text-right"
                  />

                  <input
                    type="text"
                    placeholder="סיסמה"
                    value={userForm.password}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="p-3 bg-slate-50 border rounded-xl font-bold text-right"
                  />

                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm((prev) => ({
                        ...prev,
                        role: e.target.value,
                        target1: '',
                        target2: ''
                      }))
                    }
                    className="p-3 bg-slate-50 border rounded-xl font-bold text-right"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="WING">WING</option>
                    <option value="DEPT">DEPT</option>
                  </select>

                  <select
                    value={userForm.target1}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, target1: e.target.value }))}
                    disabled={userForm.role === 'ADMIN'}
                    className="p-3 bg-slate-50 border rounded-xl font-bold text-right disabled:opacity-50"
                  >
                    <option value="">target1</option>
                    {userTargetOptions(userForm.role).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  <select
                    value={userForm.target2}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, target2: e.target.value }))}
                    disabled={userForm.role === 'ADMIN'}
                    className="p-3 bg-slate-50 border rounded-xl font-bold text-right disabled:opacity-50"
                  >
                    <option value="">target2</option>
                    {userTargetOptions(userForm.role)
                      .filter((opt) => opt !== userForm.target1)
                      .map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                  </select>

                  <select
                    value={userForm.active}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, active: e.target.value }))}
                    className="p-3 bg-slate-50 border rounded-xl font-bold text-right"
                  >
                    <option value="TRUE">פעיל</option>
                    <option value="FALSE">לא פעיל</option>
                  </select>
                </div>

                <div className="mt-4">
                  <button
                    onClick={addUser}
                    className="bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black"
                  >
                    הוסף משתמש
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border shadow-sm overflow-x-auto hidden lg:block">
                {usersLoading ? (
                  <div className="p-10 flex items-center justify-center gap-3 text-slate-500 font-bold">
                    <Loader2 className="animate-spin" />
                    טוען משתמשים...
                  </div>
                ) : (
                  <table className="w-full min-w-[1100px] text-right">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] text-slate-500 font-black">
                        <th className="p-4">id</th>
                        <th className="p-4">username</th>
                        <th className="p-4">password</th>
                        <th className="p-4">role</th>
                        <th className="p-4">target1</th>
                        <th className="p-4">target2</th>
                        <th className="p-4">active</th>
                        <th className="p-4">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {usersList.map((u, idx) => (
                        <tr key={u.id || idx}>
                          <td className="p-3 font-bold">{u.id}</td>
                          <td className="p-3">
                            <input
                              value={u.username}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, username: val } : x));
                              }}
                              className="w-full p-2 bg-slate-50 border rounded-xl text-right"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={u.password}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, password: val } : x));
                              }}
                              className="w-full p-2 bg-slate-50 border rounded-xl text-right"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={u.role}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, role: val, target1: '', target2: '' } : x));
                              }}
                              className="w-full p-2 bg-slate-50 border rounded-xl text-right"
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="WING">WING</option>
                              <option value="DEPT">DEPT</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={u.target1 || ''}
                              disabled={u.role === 'ADMIN'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, target1: val } : x));
                              }}
                              className="w-full p-2 bg-slate-50 border rounded-xl text-right disabled:opacity-50"
                            >
                              <option value="">target1</option>
                              {userTargetOptions(u.role).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={u.target2 || ''}
                              disabled={u.role === 'ADMIN'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, target2: val } : x));
                              }}
                              className="w-full p-2 bg-slate-50 border rounded-xl text-right disabled:opacity-50"
                            >
                              <option value="">target2</option>
                              {userTargetOptions(u.role)
                                .filter((opt) => opt !== u.target1)
                                .map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={String(u.active || 'TRUE').toUpperCase()}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, active: val } : x));
                              }}
                              className="w-full p-2 bg-slate-50 border rounded-xl text-right"
                            >
                              <option value="TRUE">TRUE</option>
                              <option value="FALSE">FALSE</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateUserRow(u)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs"
                              >
                                שמור
                              </button>
                              <button
                                onClick={() => deactivateUserRow(u.id)}
                                className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-xs"
                              >
                                השבת
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="lg:hidden space-y-3">
                {usersList.map((u) => (
                  <div key={u.id} className="bg-white rounded-3xl border shadow-sm p-4 space-y-3">
                    <div className="text-xs font-black text-slate-400">#{u.id}</div>
                    <input
                      value={u.username}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, username: val } : x));
                      }}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-right"
                      placeholder="username"
                    />
                    <input
                      value={u.password}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, password: val } : x));
                      }}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-right"
                      placeholder="password"
                    />
                    <select
                      value={u.role}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, role: val, target1: '', target2: '' } : x));
                      }}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-right"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="WING">WING</option>
                      <option value="DEPT">DEPT</option>
                    </select>
                    <select
                      value={u.target1 || ''}
                      disabled={u.role === 'ADMIN'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, target1: val } : x));
                      }}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-right disabled:opacity-50"
                    >
                      <option value="">target1</option>
                      {userTargetOptions(u.role).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <select
                      value={u.target2 || ''}
                      disabled={u.role === 'ADMIN'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, target2: val } : x));
                      }}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-right disabled:opacity-50"
                    >
                      <option value="">target2</option>
                      {userTargetOptions(u.role).filter((opt) => opt !== u.target1).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <select
                      value={String(u.active || 'TRUE').toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsersList((prev) => prev.map((x) => x.id === u.id ? { ...x, active: val } : x));
                      }}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-right"
                    >
                      <option value="TRUE">TRUE</option>
                      <option value="FALSE">FALSE</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateUserRow(u)}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-black text-sm"
                      >
                        שמור
                      </button>
                      <button
                        onClick={() => deactivateUserRow(u.id)}
                        className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-black text-sm"
                      >
                        השבת
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : mainTab === 'budget' ? (
            <div className="space-y-8">
              {viewMode === 'dashboard' && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-2">
                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">ביצוע 24</p>
                      <p className="text-lg font-black text-slate-700">{formatILS(budgetStats.expA24)}</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">תקציב 25</p>
                      <p className="text-lg font-black text-emerald-700">{formatILS(budgetStats.expB25)}</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border shadow-sm border-b-4 border-blue-600">
                      <p className="text-[8px] font-bold text-slate-400 uppercase text-blue-600">תקציב 26</p>
                      <p className="text-lg font-black text-blue-800">{formatILS(budgetStats.expB26)}</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border shadow-sm border-b-4 border-orange-500">
                      <p className="text-[8px] font-bold text-slate-400 uppercase text-orange-600">ביצוע+שריון</p>
                      <p className="text-lg font-black text-orange-700">{formatILS(budgetStats.expCommit26)}</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border shadow-sm border-b-4 border-slate-400">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">ביצוע בפועל</p>
                      <p className="text-lg font-black text-slate-900">{formatILS(budgetStats.expExec26)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[360px]">
                      <h3 className="font-black text-slate-800 mb-6 border-r-8 border-emerald-500 pr-3">
                        תקציב 2026 לפי מחלקה (הוצאות)
                      </h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={budgetByDeptChart} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 11, fontWeight: 'bold' }} 
                            interval={0} 
                            tickMargin={10} 
                          />
                          <YAxis hide />
                          <Tooltip formatter={(v) => formatILS(v)} cursor={{fill: 'transparent'}}/>
                          <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={42}>
                            {budgetByDeptChart.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                      {budgetByTypePie.length > 0 ? (
                        <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[260px]">
                          <h3 className="font-black text-slate-800 mb-6 border-r-8 border-blue-500 pr-3">
                            חלוקת תקציב לפי הכנסה / הוצאה
                          </h3>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={budgetByTypePie}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                paddingAngle={5}
                              >
                                {budgetByTypePie.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v) => formatILS(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex flex-wrap gap-4 justify-center mt-2">
                            {budgetByTypePie.map((item, i) => (
                              <div key={item.name} className="flex items-center gap-2 text-sm font-black text-slate-700">
                                <span
                                  className="inline-block w-4 h-4 rounded-full shadow-sm"
                                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                {item.name}: {formatILS(item.value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[260px] flex items-center justify-center text-slate-400 font-black">
                          אין נתונים להצגת חלוקת הכנסות והוצאות
                        </div>
                      )}

                      {budgetExecutionPie.length > 0 ? (
                        <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[260px]">
                          <h3 className="font-black text-slate-800 mb-6 border-r-8 border-amber-500 pr-3">
                            ביצוע 2026 מול יתרה (הוצאות)
                          </h3>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={budgetExecutionPie}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                paddingAngle={5}
                              >
                                {budgetExecutionPie.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v) => formatILS(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex flex-wrap gap-4 justify-center mt-2">
                            {budgetExecutionPie.map((item, i) => (
                              <div key={item.name} className="flex items-center gap-2 text-sm font-black text-slate-700">
                                <span
                                  className="inline-block w-4 h-4 rounded-full shadow-sm"
                                  style={{ backgroundColor: PIE_COLORS[(i + 2) % PIE_COLORS.length] }}
                                />
                                {item.name}: {formatILS(item.value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[260px] flex items-center justify-center text-slate-400 font-black">
                          אין נתונים להצגת ביצוע מול יתרה
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {viewMode === 'table' && (
                <div className="space-y-4">
                  {showOnlyBudgetAlerts && (
                    <div className="flex items-center justify-between bg-red-50 p-4 rounded-2xl border border-red-100 animate-pulse">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-red-500" />
                        <span className="font-black text-red-800 text-sm">מציג סעיפים בחריגה בלבד</span>
                      </div>

                      <button
                        onClick={() => setShowOnlyBudgetAlerts(false)}
                        className="px-4 py-2 bg-white text-red-600 font-bold rounded-xl border border-red-200"
                      >
                        בטל סינון
                      </button>
                    </div>
                  )}

                  <div className="bg-white p-4 rounded-3xl shadow-sm border space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 pr-2 uppercase block mb-2">
                        עמודות להצגה
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'a2024', label: 'ביצוע 2024' },
                          { key: 'b2025', label: 'תקציב 2025' },
                          { key: 'b2026', label: 'תקציב 2026' },
                          { key: 'a2026', label: 'ביצוע 2026' },
                          { key: 'commitTotal2026', label: 'שריון+ביצוע 2026' }
                        ].map((col) => (
                          <button
                            key={col.key}
                            onClick={() => toggleBudgetColumn(col.key)}
                            className={`px-4 py-2 rounded-xl text-xs font-black border ${
                              budgetVisibleColumns[col.key]
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            {col.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 pr-2 uppercase block">חיפוש סעיף</label>
                        <input
                          type="text"
                          placeholder="חפש שם סעיף..."
                          value={budgetSearch}
                          onChange={(e) => setBudgetSearch(e.target.value)}
                          className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 pr-2 uppercase block">מחלקה</label>
                        <select
                          value={budgetFilterDept}
                          onChange={(e) => setBudgetFilterDept(e.target.value)}
                          className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right"
                        >
                          <option value="הכל">כל המחלקות</option>
                          {budgetDeptOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 pr-2 uppercase block">סוג</label>
                        <select
                          value={budgetTypeFilter}
                          onChange={(e) => setBudgetTypeFilter(e.target.value)}
                          className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right"
                        >
                          <option value="הכל">הכנסה והוצאה</option>
                          <option value="הכנסה">הכנסה</option>
                          <option value="הוצאה">הוצאה</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 pr-2 uppercase block">סה"כ שורות</label>
                        <div className="w-full p-2 bg-slate-50 border rounded-xl font-black text-sm text-slate-700">
                          {filteredBudgetData.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[1100px]">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black border-b uppercase text-slate-400">
                          <th className="p-4">סעיף</th>
                          <th className="p-4">תיאור</th>
                          <th className="p-4 text-center">מחלקה</th>
                          <th className="p-4 text-center">סוג</th>
                          {visibleBudgetColumnDefs.map((col) => (
                            <th key={col.key} className="p-4 text-left">{col.label}</th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {filteredBudgetData.map((row) => {
                          const isAlert =
                            (row.type === 'הכנסה' && (row.b2026 - row.a2026) > 0) ||
                            (row.type === 'הוצאה' && (row.b2026 - row.a2026) < 0);

                          return (
                            <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${isAlert ? 'bg-red-50/60' : ''}`}>
                              <td className="p-4 font-mono text-[10px] text-slate-400">#{row.id}</td>
                              <td className="p-4 font-black text-xs text-slate-800">{row.name}</td>
                              <td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.dept}</td>
                              <td className="p-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${row.type === 'הכנסה' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {row.type}
                                </span>
                              </td>
                              {visibleBudgetColumnDefs.map((col) => (
                                <td key={col.key} className="p-4 text-left font-bold text-xs">
                                  {formatILS(col.value(row))}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {viewMode === 'control' && (
                <div className="space-y-4">
                  {showOnlyBudgetAlerts && (
                    <div className="flex items-center justify-between bg-red-50 p-4 rounded-2xl border border-red-100 animate-pulse">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-red-500" />
                        <span className="font-black text-red-800 text-sm">מציג סעיפים בחריגה בלבד</span>
                      </div>

                      <button
                        onClick={() => setShowOnlyBudgetAlerts(false)}
                        className="px-4 py-2 bg-white text-red-600 font-bold rounded-xl border border-red-200"
                      >
                        בטל סינון
                      </button>
                    </div>
                  )}

                  <div className="bg-white p-4 rounded-3xl shadow-sm border">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setControlCompareBy('a2026')}
                        className={`px-4 py-2 rounded-xl text-xs font-black border ${
                          controlCompareBy === 'a2026'
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        בקרה מול ביצוע 2026
                      </button>

                      <button
                        onClick={() => setControlCompareBy('commitTotal2026')}
                        className={`px-4 py-2 rounded-xl text-xs font-black border ${
                          controlCompareBy === 'commitTotal2026'
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        בקרה מול ביצוע+שריון 2026
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[1100px]">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black border-b uppercase text-slate-400">
                          <th className="p-4">סעיף</th>
                          <th className="p-4">תיאור</th>
                          <th className="p-4 text-center">מחלקה</th>
                          <th className="p-4 text-center">סוג</th>
                          <th className="p-4 text-left">תקציב 2026</th>
                          <th className="p-4 text-left">{controlCompareBy === 'a2026' ? 'ביצוע 2026' : 'ביצוע+שריון 2026'}</th>
                          <th className="p-4 text-left">יתרה</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {controlData.map((row) => (
                          <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${row.isRed ? 'bg-red-50/70' : ''}`}>
                            <td className="p-4 font-mono text-[10px] text-slate-400">#{row.id}</td>
                            <td className="p-4 font-black text-xs text-slate-800">{row.name}</td>
                            <td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.dept}</td>
                            <td className="p-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${row.type === 'הכנסה' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                {row.type}
                              </span>
                            </td>
                            <td className="p-4 text-left font-bold text-blue-800 text-xs">{formatILS(row.b2026)}</td>
                            <td className="p-4 text-left font-bold text-slate-800 text-xs">{formatILS(row.compareValue)}</td>
                            <td className={`p-4 text-left font-black text-xs ${row.isRed ? 'text-red-600' : 'text-emerald-700'}`}>
                              {formatILS(row.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border">
                {viewMode === 'dashboard' && (
                  <button
                    onClick={() => setWorkplanQuarter(0)}
                    className={`flex-1 min-w-[120px] py-3 rounded-xl font-black text-sm transition-all ${
                      workplanQuarter === 0
                        ? 'bg-slate-800 text-white shadow-md'
                        : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    כלל השנה
                  </button>
                )}

                {[1, 2, 3, 4].map((q) => (
                  <button
                    key={q}
                    onClick={() => setWorkplanQuarter(q)}
                    className={`flex-1 min-w-[100px] py-3 rounded-xl font-black text-sm transition-all ${
                      workplanQuarter === q
                        ? 'bg-emerald-800 text-white shadow-md'
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    רבעון {q}
                  </button>
                ))}
              </div>

              {viewMode === 'dashboard' ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
                    <div className="bg-slate-800 text-white p-6 rounded-3xl border shadow-sm flex flex-col items-center justify-center">
                      <p className="text-[9px] font-black opacity-60 uppercase">סה"כ משימות</p>
                      <p className="text-3xl lg:text-4xl font-black">{workStats.total}</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center border-b-4 border-emerald-500">
                      <CheckCircle2 className="text-emerald-500 mb-1" size={24} />
                      <p className="text-[9px] font-black text-slate-400">בוצע</p>
                      <p className="text-2xl lg:text-3xl font-black text-slate-800">{workStats.p1}%</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center border-b-4 border-amber-500">
                      <Clock className="text-amber-500 mb-1" size={24} />
                      <p className="text-[9px] font-black text-slate-400">עיכוב</p>
                      <p className="text-2xl lg:text-3xl font-black text-slate-800">{workStats.p2}%</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center border-b-4 border-red-500">
                      <MinusCircle className="text-red-500 mb-1" size={24} />
                      <p className="text-[9px] font-black text-slate-400">עצירה</p>
                      <p className="text-2xl lg:text-3xl font-black text-slate-800">{workStats.p3}%</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center border-b-4 border-slate-300">
                      <HelpCircle className="text-slate-300 mb-1" size={24} />
                      <p className="text-[9px] font-black text-slate-400">לא הגיע הזמן</p>
                      <p className="text-2xl lg:text-3xl font-black text-slate-800">{workStats.s4}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-auto lg:h-[400px]">
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border flex flex-col items-center min-h-[350px]">
                      <h3 className="font-black text-slate-800 mb-6 border-r-8 border-emerald-500 pr-3 self-start">
                        {workplanQuarter === 0 ? 'תמונת מצב שנתית (אנכי)' : `סטטוס רבעון ${workplanQuarter}`}
                      </h3>

                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { n: 'בוצע', v: workStats.s1 },
                            { n: 'עיכוב', v: workStats.s2 },
                            { n: 'עצירה', v: workStats.s3 },
                            { n: 'ממתין', v: workStats.s4 }
                          ]}
                          margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis dataKey="n" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                          <YAxis hide />
                          <Tooltip cursor={{fill: 'transparent'}}/>
                          <Bar dataKey="v" radius={[10, 10, 0, 0]} barSize={50}>
                            {[1, 2, 3, 4].map((_, i) => (
                              <Cell key={i} fill={STATUS_CONFIG[i + 1].color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border flex flex-col min-h-[350px]">
                      <h3 className="font-black text-slate-800 mb-6 border-r-8 border-blue-500 pr-3 self-start">
                        {activeWingId ? 'משימות לפי מחלקה' : 'משימות לפי אגף'}
                      </h3>

                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Array.from(
                            new Set(filteredWorkData.map((t) => (activeWingId ? t.dept : t.wing)))
                          ).map((name) => ({
                            n: name,
                            v: filteredWorkData.filter((t) => (activeWingId ? t.dept : t.wing) === name).length
                          }))}
                          layout="vertical"
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis dataKey="n" type="category" width={100} tick={{ fontSize: 10, fontWeight: 'black' }} />
                          <Tooltip cursor={{fill: 'transparent'}}/>
                          <Bar dataKey="v" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {showOnlyOverdueTasks && (
                    <div className="flex items-center justify-between bg-red-50 p-4 rounded-2xl border border-red-100 animate-pulse">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-red-500" />
                        <span className="font-black text-red-800 text-sm">מציג חריגות לו"ז בלבד</span>
                      </div>

                      <button
                        onClick={() => setShowOnlyOverdueTasks(false)}
                        className="px-4 py-2 bg-white text-red-600 font-bold rounded-xl border border-red-200"
                      >
                        בטל סינון
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-3xl shadow-sm border">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 pr-2 uppercase">חיפוש</label>
                      <input
                        type="text"
                        placeholder="חפש משימה או מזהה..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 pr-2 uppercase">מחלקה</label>
                      <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right"
                        disabled={showOnlyOverdueTasks}
                      >
                        <option value="הכל">כל המחלקות באגף</option>
                        {availableDepts.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="hidden lg:block bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-50 p-4 text-[10px] font-black text-slate-400 border-b uppercase">
                      <div className="col-span-1">#</div>
                      <div className="col-span-2">מחלקה</div>
                      <div className="col-span-4">משימה / לו"ז</div>
                      <div className="col-span-2 text-center">סטטוס קודם</div>
                      <div className="col-span-1 text-center">סטטוס ר{workplanQuarter}</div>
                      <div className="col-span-2 pr-4">הערה</div>
                    </div>

                    <div className="divide-y">
                      {filteredWorkData.map((t) => {
                        const prevStatuses = [1, 2, 3, 4].filter((q) => q < workplanQuarter && t[`q${q}`]);
                        const latestPrev =
                          prevStatuses.length > 0 ? t[`q${prevStatuses[prevStatuses.length - 1]}`] : null;
                        const currentStatus = t[`q${workplanQuarter}`];
                        const isOverdue = parseDateLogic(t.deadline) < new Date() && currentStatus !== 1;

                        return (
                          <div
                            key={t.id}
                            className="grid grid-cols-12 p-5 lg:p-0 hover:bg-slate-50 transition-colors gap-0 items-center"
                          >
                            <div className="col-span-1 p-4 text-slate-300 font-mono text-[10px]">#{t.id}</div>
                            <div className="col-span-2 p-4">
                              <span className="text-xs font-black text-emerald-800">{t.dept}</span>
                            </div>
                            <div className="col-span-4 p-4">
                              <div className="font-black text-xs leading-relaxed text-slate-800">{t.task}</div>
                              <div className={`text-[9px] font-bold mt-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                יעד: {formatDate(t.deadline)}
                              </div>
                            </div>
                            <div className="col-span-2 p-4 flex flex-col items-start lg:items-center">
                              {latestPrev ? (
                                <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                                  <History size={12} />
                                  <span className={`text-[9px] font-black ${STATUS_CONFIG[latestPrev].text}`}>
                                    {STATUS_CONFIG[latestPrev].label} (ר{prevStatuses[prevStatuses.length - 1]})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[9px] text-slate-300">-</span>
                              )}
                            </div>
                            <div className="col-span-1 p-4">
                              <StatusDropdown
                                value={currentStatus}
                                isOpen={openStatusMenuId === t.id}
                                onToggle={() => setOpenStatusMenuId(openStatusMenuId === t.id ? null : t.id)}
                                onSelect={(val) => {
                                  updateTaskLocal(t.id, `q${workplanQuarter}`, val);
                                  setOpenStatusMenuId(null);
                                }}
                              />
                            </div>
                            <div className="col-span-2 p-4">
                              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <MessageSquare size={14} className="text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="עדכן הערה..."
                                  value={t[`n${workplanQuarter}`] || ""}
                                  onChange={(e) => updateTaskLocal(t.id, `n${workplanQuarter}`, e.target.value)}
                                  className="w-full bg-transparent outline-none text-[10px] font-bold text-right"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:hidden space-y-4">
                    {filteredWorkData.map((t) => {
                      const prevStatuses = [1, 2, 3, 4].filter((q) => q < workplanQuarter && t[`q${q}`]);
                      const latestPrev =
                        prevStatuses.length > 0 ? t[`q${prevStatuses[prevStatuses.length - 1]}`] : null;
                      const currentStatus = t[`q${workplanQuarter}`];
                      const isOverdue = parseDateLogic(t.deadline) < new Date() && currentStatus !== 1;

                      return (
                        <div key={t.id} className="bg-white rounded-[2rem] shadow-sm border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-slate-300 font-mono text-[10px]">#{t.id}</div>
                            <div className="text-xs font-black text-emerald-800">{t.dept}</div>
                          </div>

                          <div>
                            <div className="font-black text-sm leading-relaxed text-slate-800">{t.task}</div>
                            <div className={`text-[11px] font-bold mt-2 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                              יעד: {formatDate(t.deadline)}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] font-black text-slate-400 mb-1">סטטוס קודם</div>
                            {latestPrev ? (
                              <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                                <History size={12} />
                                <span className={`text-[10px] font-black ${STATUS_CONFIG[latestPrev].text}`}>
                                  {STATUS_CONFIG[latestPrev].label} (ר{prevStatuses[prevStatuses.length - 1]})
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}
                          </div>

                          <div>
                            <div className="text-[10px] font-black text-slate-400 mb-1">עדכון</div>
                            <StatusDropdown
                              value={currentStatus}
                              isOpen={openStatusMenuId === t.id}
                              onToggle={() => setOpenStatusMenuId(openStatusMenuId === t.id ? null : t.id)}
                              onSelect={(val) => {
                                updateTaskLocal(t.id, `q${workplanQuarter}`, val);
                                setOpenStatusMenuId(null);
                              }}
                            />
                          </div>

                          <div>
                            <div className="text-[10px] font-black text-slate-400 mb-1">הערה</div>
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                              <MessageSquare size={14} className="text-slate-400" />
                              <input
                                type="text"
                                placeholder="עדכן הערה..."
                                value={t[`n${workplanQuarter}`] || ""}
                                onChange={(e) => updateTaskLocal(t.id, `n${workplanQuarter}`, e.target.value)}
                                className="w-full bg-transparent outline-none text-[12px] font-bold text-right"
                              />
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
        </main>
      </div>
    </div>
  );
};

export default App;