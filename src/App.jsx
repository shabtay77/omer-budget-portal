import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { LayoutDashboard, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users, Megaphone, TableProperties, ShieldAlert, Lock, CheckCircle2, Clock, AlertCircle, HelpCircle, Download, Loader2, Menu, X, AlertTriangle } from 'lucide-react';

const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2Y4QkJxnqapKne4Q5TSAC5ZVBE1oPjKYKRKE1MFqiDfxSBZdWJQgbFnJbKz_H98q6WvS6NtKKjHM2/pub?output=csv";
const GAS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPjDK_Enpt5dqW_soJrxs9y6fU5-cKMqsKzNJNouXvNxGnI8Xrxl9nGL51mG3smACV2A/exec";

const USERS_DB = [
  { user: "aharony", pass: "1234", role: "ADMIN", target: null },
  { user: "tamir", pass: "1234", role: "ADMIN", target: null },
  { user: "erik", pass: "1234", role: "WING", target: "שפ\"ה" },
  { user: "lior", pass: "1234", role: "WING", target: "הנדסה" },
  { user: "smadar", pass: "1234", role: "WING", target: "חינוך" },
  { user: "or", pass: "1234", role: "WING", target: "שירות לתושב ודוברות" },
  { user: "adi", pass: "1234", role: "WING", target: "מרכז קהילתי" },
  { user: "hofit", pass: "1234", role: "WING", target: "הון אנושי" },
  { user: "amir", pass: "1234", role: "DEPT", target: "גינון" }
];

const ICONS = {
  'ראש הרשות': UserRound, 'הנהלה': Building2, 'גזברות': Wallet, 'הנדסה': HardHat,
  'חינוך': GraduationCap, 'שפ"ה': Truck, 'מרכז קהילתי': Users, 'הון אנושי': Users,
  'שירות לתושב ודוברות': Megaphone
};

const formatDate = (val) => {
  if (!val) return "-";
  if (String(val).includes('/')) return val;
  const serial = parseFloat(val);
  if (isNaN(serial)) return val;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const parseDateLogic = (val) => {
    if (!val) return null;
    if (String(val).includes('/')) {
      const parts = String(val).split('/');
      if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const serial = parseFloat(val);
    if (!isNaN(serial)) {
       return new Date(Math.round((serial - 25569) * 86400 * 1000));
    }
    return null;
};

const formatILS = (val) => {
  const absVal = Math.abs(val || 0);
  const formatted = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(absVal);
  return (val || 0) < 0 ? `-${formatted}` : formatted;
};

const cleanStr = (s) => String(s || "").replace(/["'״״]/g, "").trim();

const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val || val === "") return 0;
  let str = String(val).replace(/,/g, '').replace(/\s/g, '');
  if (str.endsWith('-')) str = '-' + str.slice(0, -1);
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
};

// פונקציות עזר למציאת הסטטוס הכולל של משימה
const getUpdatedQuarter = (task) => {
    if ([1, 2, 3].includes(task.q4)) return 4;
    if ([1, 2, 3].includes(task.q3)) return 3;
    if ([1, 2, 3].includes(task.q2)) return 2;
    if ([1, 2, 3].includes(task.q1)) return 1;
    return null;
};

const getOverallRating = (task) => {
    if ([1, 2, 3].includes(task.q4)) return task.q4;
    if ([1, 2, 3].includes(task.q3)) return task.q3;
    if ([1, 2, 3].includes(task.q2)) return task.q2;
    if ([1, 2, 3].includes(task.q1)) return task.q1;
    return null;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uInput, setUInput] = useState("");
  const [pInput, setPInput] = useState("");
  const [staticData, setStaticData] = useState([]);
  const [workPlans, setWorkPlans] = useState([]); 
  const [executionMap, setExecutionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null); 
  const [mainTab, setMainTab] = useState('budget'); 
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [activeWingId, setActiveWingId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // סינוני משימות ורבעון
  const [filterDept, setFilterDept] = useState('הכל');
  const [filterStatus, setFilterStatus] = useState('הכל');
  const [search, setSearch] = useState('');
  const [workplanQuarter, setWorkplanQuarter] = useState(1);
  
  // סינוני תקציב
  const [budgetSearch, setBudgetSearch] = useState('');
  const [budgetType, setBudgetType] = useState('הכל');
  const [budgetDept, setBudgetDept] = useState('הכל');
  const [controlMetric, setControlMetric] = useState('a2026');
  
  const [visibleCols, setVisibleCols] = useState({ 
    a2024: false, 
    b2025: false, 
    a2026: true, 
    commit2026: false 
  });

  const [hasSeenBudgetPopup, setHasSeenBudgetPopup] = useState(false);
  const [hasSeenWorkplanPopup, setHasSeenWorkplanPopup] = useState(false);
  const [activePopup, setActivePopup] = useState(null);
  const [popupData, setPopupData] = useState({ count: 0 });
  const [showOnlyBudgetAnomalies, setShowOnlyBudgetAnomalies] = useState(false);
  const [showOnlyOverdueTasks, setShowOnlyOverdueTasks] = useState(false);

  useEffect(() => {
    setFilterDept('הכל');
    setBudgetDept('הכל');
    setSearch('');
    setBudgetSearch('');
    setShowOnlyBudgetAnomalies(false);
    setShowOnlyOverdueTasks(false);
  }, [activeWingId, viewMode, mainTab]);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [budgetRes, workRes] = await Promise.all([ 
          fetch('/budget_data.json'), 
          fetch('/workplans_data.json') 
        ]);
        const budgetJson = await budgetRes.json();
        const workJsonRaw = await workRes.json();

        let liveStatuses = {};
        try {
            const gasRes = await fetch(GAS_SCRIPT_URL + "?t=" + new Date().getTime());
            liveStatuses = await gasRes.json();
        } catch (e) {
            console.warn("Could not fetch live statuses from GAS", e);
        }
        
        const workJsonMerged = (workJsonRaw || []).map(t => {
            const taskId = String(t.id);
            const live = liveStatuses[taskId] || {};
            
            const getRating = (q) => {
                if (live[`q${q}`] !== undefined && live[`q${q}`] !== null) return parseInt(live[`q${q}`]);
                const saved = localStorage.getItem(`task_rating_${taskId}_q${q}`);
                if (saved) return parseInt(saved);
                if (t[`q${q}`] !== undefined) return parseInt(t[`q${q}`]);
                return null;
            };

            return { 
                ...t, 
                q1: getRating(1), 
                q2: getRating(2), 
                q3: getRating(3), 
                q4: getRating(4) 
            };
        });

        setStaticData(budgetJson || []);
        setWorkPlans(workJsonMerged);

        const sheetsRes = await fetch(SHEETS_CSV_URL + "&t=" + new Date().getTime());
        const csvText = await sheetsRes.text();
        const lines = csvText.split('\n').map(l => l.split(','));
        const headers = lines[0].map(h => h.trim().toLowerCase());
        const map = {};
        const idIdx = headers.findIndex(h => h.includes('id'));
        const a26Idx = headers.findIndex(h => h.includes('a2026'));
        const c26Idx = headers.findIndex(h => h.includes('commit'));

        lines.slice(1).forEach((cols) => {
          let rawId = cols[idIdx]?.trim();
          if (rawId) {
            let cleanId = rawId.includes('E+') ? String(BigInt(Math.round(Number(rawId)))) : rawId;
            map[cleanId] = { a2026: cleanNum(cols[a26Idx]), commit2026: cleanNum(cols[c26Idx]) };
          }
        });
        setExecutionMap(map);
      } catch (e) { 
        console.error("טעינה נכשלה", e); 
      } finally { 
        setLoading(false); 
      }
    };
    loadAllData();
  }, []);

  const fullData = useMemo(() => {
    let base = staticData;
    if (currentUser?.role === 'WING') base = staticData.filter(i => cleanStr(i.wing) === cleanStr(currentUser.target));
    if (currentUser?.role === 'DEPT') base = staticData.filter(i => cleanStr(i.dept) === cleanStr(currentUser.target));
    
    return base.map(item => {
      const idKey = String(item.id).trim();
      const exec = executionMap[idKey] || { a2026: 0, commit2026: 0 };
      const b2026 = cleanNum(item.b2026);
      const metricVal = controlMetric === 'a2026' ? exec.a2026 : exec.commit2026;
      return { 
        ...item, 
        b2026, 
        a2024: cleanNum(item.a2024), 
        b2025: cleanNum(item.b2025), 
        a2026: exec.a2026, 
        commit2026: exec.commit2026, 
        balance: b2026 - metricVal 
      };
    });
  }, [staticData, executionMap, currentUser, controlMetric]);

  const filteredBudgetData = useMemo(() => {
    return fullData.filter(r => {
      if (activeWingId !== null && cleanStr(r.wing) !== cleanStr(activeWingId)) return false;
      if (budgetDept !== 'הכל' && cleanStr(r.dept) !== budgetDept) return false;
      if (budgetType !== 'הכל' && r.type !== budgetType) return false;
      if (budgetSearch) {
        const term = budgetSearch.toLowerCase();
        if (!String(r.id).includes(term) && !r.name.toLowerCase().includes(term)) return false;
      }
      if (showOnlyBudgetAnomalies) {
        const isExpense = r.type === 'הוצאה';
        const isRevenue = r.type === 'הכנסה';
        const isAnomaly = (isExpense && r.balance < 0) || (isRevenue && r.balance > 0);
        if (!isAnomaly) return false;
      }
      return true;
    });
  }, [fullData, activeWingId, budgetDept, budgetType, budgetSearch, showOnlyBudgetAnomalies]);

  const filteredWorkData = useMemo(() => {
    let data = workPlans;
    if (currentUser?.role === 'WING') data = data.filter(item => cleanStr(item.wing) === cleanStr(currentUser.target));
    if (currentUser?.role === 'DEPT') data = data.filter(item => cleanStr(item.dept) === cleanStr(currentUser.target));
    if (activeWingId) data = data.filter(item => cleanStr(item.wing) === cleanStr(activeWingId));
    if (filterDept !== 'הכל') data = data.filter(t => t.dept === filterDept);
    
    // סינון סטטוס מסתכל תמיד על התמונה הכוללת
    if (filterStatus !== 'הכל') {
      if (filterStatus === 'missing') data = data.filter(t => !getOverallRating(t));
      else data = data.filter(t => getOverallRating(t) === parseInt(filterStatus));
    }
    
    if (search) data = data.filter(item => item.task?.includes(search) || String(item.id).includes(search) || item.activity?.includes(search));
    
    if (showOnlyOverdueTasks) {
        data = data.filter(t => {
            const taskDate = parseDateLogic(t.deadline);
            const today = new Date();
            today.setHours(0,0,0,0);
            const overall = getOverallRating(t);
            return taskDate && taskDate < today && (!overall || overall === 3);
        });
    }

    return data;
  }, [workPlans, currentUser, activeWingId, filterDept, filterStatus, search, showOnlyOverdueTasks]);

  const workplanChartData = useMemo(() => {
      const groupKey = activeWingId === null ? 'wing' : 'dept';
      const uniqueNames = Array.from(new Set(filteredWorkData.map(t => t[groupKey]).filter(Boolean)));
      
      return uniqueNames.map(name => ({
          n: name,
          v: filteredWorkData.filter(t => t[groupKey] === name).length
      })).sort((a, b) => b.v - a.v); 
  }, [filteredWorkData, activeWingId]);

  useEffect(() => {
    if (loading) return;

    if (mainTab === 'budget' && viewMode === 'control' && !hasSeenBudgetPopup) {
        const anomaliesCount = fullData.filter(r => {
            if (activeWingId !== null && cleanStr(r.wing) !== cleanStr(activeWingId)) return false;
            const isExpense = r.type === 'הוצאה';
            const isRevenue = r.type === 'הכנסה';
            return (isExpense && r.balance < 0) || (isRevenue && r.balance > 0);
        }).length;

        if (anomaliesCount > 0) {
            setPopupData({ count: anomaliesCount });
            setActivePopup('budget');
            setHasSeenBudgetPopup(true);
        }
    }

    if (mainTab === 'workplan' && viewMode === 'table' && !hasSeenWorkplanPopup) {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        let relevantTasks = workPlans;
        if (currentUser?.role === 'WING') relevantTasks = relevantTasks.filter(item => cleanStr(item.wing) === cleanStr(currentUser.target));
        if (currentUser?.role === 'DEPT') relevantTasks = relevantTasks.filter(item => cleanStr(item.dept) === cleanStr(currentUser.target));
        if (activeWingId) relevantTasks = relevantTasks.filter(item => cleanStr(item.wing) === cleanStr(activeWingId));

        const overdueCount = relevantTasks.filter(t => {
            const taskDate = parseDateLogic(t.deadline);
            const overall = getOverallRating(t);
            return taskDate && taskDate < today && (!overall || overall === 3);
        }).length;

        if (overdueCount > 0) {
            setPopupData({ count: overdueCount });
            setActivePopup('workplan');
            setHasSeenWorkplanPopup(true);
        }
    }
  }, [mainTab, viewMode, loading, fullData, workPlans, activeWingId, currentUser, hasSeenBudgetPopup, hasSeenWorkplanPopup]);

  const workStats = useMemo(() => {
    const data = filteredWorkData || [];
    const total = data.length || 1;
    const counts = { 
        s1: data.filter(t => getOverallRating(t) === 1).length, 
        s2: data.filter(t => getOverallRating(t) === 2).length, 
        s3: data.filter(t => getOverallRating(t) === 3).length, 
        missing: data.filter(t => !getOverallRating(t)).length 
    };
    return { 
      p1: Math.round((counts.s1/total)*100), 
      p2: Math.round((counts.s2/total)*100), 
      p3: Math.round((counts.s3/total)*100), 
      pMissing: Math.round((counts.missing/total)*100), 
      counts 
    };
  }, [filteredWorkData]);

  const handleStatusSave = async (taskId, newRating, quarter) => {
    setSavingId(taskId);
    const parsedRating = newRating === "" ? null : parseInt(newRating);
    localStorage.setItem(`task_rating_${taskId}_q${quarter}`, newRating);
    
    try {
        await fetch(GAS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ id: taskId, rating: newRating === "" ? "" : parsedRating, quarter: quarter })
        });
        setWorkPlans(prev => prev.map(t => t.id === taskId ? { ...t, [`q${quarter}`]: parsedRating } : t));
    } catch (e) {
        console.error("Save Error:", e);
        alert("שגיאה בסנכרון מול גוגל שיטס. נסה שוב.");
    } finally {
        setSavingId(null);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const found = USERS_DB.find(u => u.user.toLowerCase() === uInput.toLowerCase() && u.pass === pInput);
    if(found){
        setCurrentUser(found);
        setIsLoggedIn(true);
        if (found.role === 'WING') setActiveWingId(found.target);
        if (found.role === 'DEPT') {
            const row = staticData.find(i => cleanStr(i.dept) === cleanStr(found.target));
            setActiveWingId(row ? row.wing : null);
        }
    } else {
        alert("שם משתמש או סיסמה שגויים");
    }
  };

  const downloadWorkPlanExcel = () => {
    const headers = ["ID", "אגף", "מחלקה", "פעילות", "משימה", "לוז", "יעד הצלחה", "סטטוס רבעון 1", "סטטוס רבעון 2", "סטטוס רבעון 3", "סטטוס רבעון 4"];
    
    const formatStatus = (val) => val === 1 ? "בוצע" : val === 2 ? "בתהליך" : val === 3 ? "לא בוצע" : "טרם עודכן";
    
    const rows = filteredWorkData.map(t => [
        t.id, 
        t.wing, 
        t.dept, 
        `"${(t.activity || "").replace(/"/g, '""')}"`, 
        `"${(t.task || "").replace(/"/g, '""')}"`, 
        formatDate(t.deadline), 
        `"${(t.success_target || "").replace(/"/g, '""')}"`, 
        formatStatus(t.q1),
        formatStatus(t.q2),
        formatStatus(t.q3),
        formatStatus(t.q4)
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `work_plan_${activeWingId || 'omer'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-right" dir="rtl">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-800 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg"><Lock size={32} /></div>
            <h1 className="text-2xl font-black text-slate-800">פורטל מועצת עומר</h1>
            <p className="text-slate-500 font-bold mt-2">הזדהות לניהול תקציב ותכניות עבודה</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="שם משתמש" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right text-slate-900 focus:ring-2 ring-emerald-500" value={uInput} onChange={e => setUInput(e.target.value)} />
            <input type="password" placeholder="סיסמה" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right text-slate-900 focus:ring-2 ring-emerald-500" value={pInput} onChange={e => setPInput(e.target.value)} />
            <button type="submit" className="w-full bg-emerald-800 text-white p-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-colors">כניסה למערכת</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-black text-emerald-800 animate-pulse text-right" dir="rtl">טוען נתונים מהשרת...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-right overflow-x-hidden" dir="rtl">
      
      {/* פופאפים */}
      {activePopup === 'budget' && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden text-center">
                <div className="bg-red-50 p-6 flex justify-center">
                    <AlertTriangle size={64} className="text-red-500" />
                </div>
                <div className="p-8">
                    <h3 className="text-2xl font-black text-slate-800 mb-2">שימו לב</h3>
                    <p className="text-slate-600 font-bold mb-8">נמצאו <span className="text-red-600 font-black">{popupData.count}</span> סעיפים בחריגה תקציבית בנתונים שלך.</p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => { setShowOnlyBudgetAnomalies(true); setActivePopup(null); }} className="w-full py-4 bg-red-600 text-white font-black rounded-xl shadow-lg hover:bg-red-700 transition-colors">הצג פירוט חריגות</button>
                        <button onClick={() => setActivePopup(null)} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">סגור והמשך לתצוגה המלאה</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activePopup === 'workplan' && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden text-center">
                <div className="bg-amber-50 p-6 flex justify-center">
                    <Clock size={64} className="text-amber-500" />
                </div>
                <div className="p-8">
                    <h3 className="text-2xl font-black text-slate-800 mb-2">עיכוב במשימות</h3>
                    <p className="text-slate-600 font-bold mb-8">יש לך <span className="text-amber-600 font-black">{popupData.count}</span> משימות שעבר המועד שלהן וטרם טופלו.</p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => { setShowOnlyOverdueTasks(true); setActivePopup(null); }} className="w-full py-4 bg-amber-500 text-white font-black rounded-xl shadow-lg hover:bg-amber-600 transition-colors">הצג משימות באיחור</button>
                        <button onClick={() => setActivePopup(null)} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">סגור והמשך לתצוגה המלאה</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-[250] shadow-sm p-4 flex justify-between items-center px-4 lg:px-8">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMenuOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <Menu size={24} />
            </button>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => { setMainTab('budget'); setViewMode('dashboard'); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'budget' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תקציב</button>
              <button onClick={() => { setMainTab('workplan'); setViewMode('dashboard'); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'workplan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תכנית עבודה</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left hidden sm:block">
               <p className="text-[10px] font-black text-slate-600 leading-none">שלום, {currentUser.user}</p>
               <button onClick={() => window.location.reload()} className="text-[10px] font-bold text-red-500 underline uppercase">התנתק</button>
            </div>
            <div className="w-9 h-9 bg-emerald-800 rounded-xl flex items-center justify-center text-white font-black shadow-md">ע</div>
          </div>
      </header>

      <div className="flex flex-1 lg:flex-row relative">
        {/* Sidebar */}
        <aside className={`fixed inset-0 z-[300] bg-white transition-transform duration-300 transform lg:static lg:block lg:w-72 lg:h-[calc(100vh-64px)] lg:border-l ${isMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="flex flex-col h-full bg-white">
             <div className="lg:hidden flex justify-between items-center p-4 border-b">
                <span className="font-black text-slate-800 text-lg">תפריט בחירה</span>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={24} />
                </button>
             </div>
             <div className="p-6 space-y-2 border-b">
                <button onClick={() => { setViewMode('dashboard'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'dashboard' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600 hover:bg-emerald-50'}`}><LayoutDashboard size={20} /> <span className="font-bold">תמונת מצב</span></button>
                <button onClick={() => { setViewMode('table'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'table' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600 hover:bg-emerald-50'}`}><TableProperties size={20} /> <span className="font-bold">{mainTab === 'budget' ? 'פירוט תקציב' : 'פירוט ועדכון'}</span></button>
                {mainTab === 'budget' && <button onClick={() => { setViewMode('control'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'control' ? 'bg-red-700 text-white shadow-lg' : 'text-red-600 font-bold hover:bg-red-50'}`}><ShieldAlert size={20} /> <span className="font-bold">בקרה תקציבית</span></button>}
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase pr-4 mb-2 tracking-widest">{currentUser.role === 'ADMIN' ? 'אגפים' : 'האגף שלי'}</p>
                {currentUser.role === 'ADMIN' ? (
                  <>
                    <button onClick={() => { setActiveWingId(null); setIsMenuOpen(false); }} className={`w-full text-right p-3 rounded-xl mb-1 text-sm font-bold ${activeWingId === null ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>כלל המועצה</button>
                    {Object.keys(ICONS).map(name => (
                      <button key={name} onClick={() => { setActiveWingId(name); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-3 rounded-xl mb-1 text-sm transition-all ${activeWingId === name ? 'bg-slate-900 text-white font-bold' : 'text-slate-500 hover:bg-slate-100'}`}>{React.createElement(ICONS[name], { size: 16 })} <span>{name}</span></button>
                    ))}
                  </>
                ) : (
                  <div className="w-full flex items-center justify-start gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-800 font-black">
                      {React.createElement(ICONS[activeWingId] || Building2, { size: 20 })} <span>{activeWingId}</span>
                  </div>
                )}
             </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden relative">
          <div className="max-w-[1400px] mx-auto">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl lg:text-4xl font-black text-slate-800 tracking-tight">{activeWingId || (currentUser?.role === 'DEPT' ? currentUser.target : 'כלל המועצה')}</h2>
                <p className="text-slate-500 font-bold">{mainTab === 'budget' ? 'ניהול תקציב 2026' : 'מעקב ביצוע תכנית עבודה'}</p>
              </div>
              {mainTab === 'workplan' && (
                <button onClick={downloadWorkPlanExcel} className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg hover:scale-105 transition-all">
                    <Download size={20} /> הורד אקסל
                </button>
              )}
            </header>

            {mainTab === 'budget' ? (
              <div className="space-y-8">
                {/* Budget Stats */}
                {viewMode === 'dashboard' && (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border"><p className="text-[8px] font-bold text-slate-400 uppercase">ביצוע 24</p><p className="text-lg font-black text-slate-700">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.a2024||0),0))}</p></div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border"><p className="text-[8px] font-bold text-slate-400 uppercase">תקציב 25</p><p className="text-lg font-black text-emerald-700">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2025||0),0))}</p></div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-blue-600"><p className="text-[8px] font-bold text-slate-400 uppercase text-blue-600">תקציב 26</p><p className="text-lg font-black text-blue-800">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2026||0),0))}</p></div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-orange-500"><p className="text-[8px] font-bold text-slate-400 uppercase text-orange-600">ביצוע+שריון</p><p className="text-lg font-black text-orange-700">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.commit2026||0),0))}</p></div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-slate-400"><p className="text-[8px] font-bold text-slate-400 uppercase">ביצוע בפועל</p><p className="text-lg font-black text-slate-900">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.a2026||0),0))}</p></div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white p-6 lg:p-10 rounded-[3rem] shadow-sm border min-h-[420px]">
                        <h3 className="font-black text-slate-800 mb-6 border-r-8 border-emerald-500 pr-3">התפלגות הוצאות 26</h3>
                        <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={Array.from(new Set(fullData.map(r => r.wing))).map(w => ({ name: w, value: fullData.filter(r => r.wing === w && r.type === 'הוצאה').reduce((a,c) => a + c.b2026, 0) })).filter(e => e.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5}>{['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip formatter={v => formatILS(v)} /></PieChart></ResponsiveContainer></div>
                      </div>
                      <div className="bg-white p-6 lg:p-10 rounded-[3rem] shadow-sm border min-h-[420px]">
                        <h3 className="font-black text-slate-800 mb-6 border-r-8 border-blue-500 pr-3">מגמת צמיחה רב-שנתית</h3>
                        <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{n:'24', v:fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.a2024||0),0)}, {n:'25', v:fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2025||0),0)}, {n:'26', v:fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2026||0),0)}]}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="n" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={v => formatILS(v)} /><Bar dataKey="v" radius={[10, 10, 0, 0]} barSize={45} fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Budget Detail Table */}
                {viewMode === 'table' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-3xl shadow-sm border mb-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400">חיפוש סעיף / שם</label>
                            <input type="text" placeholder="הזן מספר או שם סעיף..." value={budgetSearch} onChange={e => setBudgetSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400">מחלקה</label>
                            <select value={budgetDept} onChange={e => setBudgetDept(e.target.value)} className="w-full p-2 rounded-xl bg-slate-50 border outline-none font-bold text-sm" disabled={currentUser?.role === 'DEPT'}>
                                <option value="הכל">כל המחלקות</option>
                                {Array.from(new Set(fullData.filter(r => activeWingId === null || cleanStr(r.wing) === cleanStr(activeWingId)).map(r => r.dept))).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400">סוג</label>
                            <select value={budgetType} onChange={e => setBudgetType(e.target.value)} className="w-full p-2 rounded-xl bg-slate-50 border outline-none font-bold text-sm">
                                <option value="הכל">הכנסות והוצאות</option>
                                <option value="הוצאה">הוצאות בלבד</option>
                                <option value="הכנסה">הכנסות בלבד</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 bg-white p-4 rounded-3xl shadow-sm border mb-4">
                      <button onClick={() => setVisibleCols(p => ({...p, a2024: !p.a2024}))} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${visibleCols.a2024 ? 'bg-emerald-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>ביצוע 24</button>
                      <button onClick={() => setVisibleCols(p => ({...p, b2025: !p.b2025}))} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${visibleCols.b2025 ? 'bg-emerald-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>תקציב 25</button>
                      <button onClick={() => setVisibleCols(p => ({...p, a2026: !p.a2026}))} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${visibleCols.a2026 ? 'bg-emerald-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>ביצוע 26</button>
                      <button onClick={() => setVisibleCols(p => ({...p, commit2026: !p.commit2026}))} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${visibleCols.commit2026 ? 'bg-emerald-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>ביצוע+שריון 26</button>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border overflow-x-auto pb-4">
                      <table className="w-full text-right border-collapse whitespace-nowrap min-w-max">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase">
                            <th className="p-4 pr-6">סעיף</th>
                            <th>תיאור</th>
                            <th className="text-center">מחלקה</th>
                            {visibleCols.a2024 && <th className="text-left px-4">ביצוע 24</th>}
                            {visibleCols.b2025 && <th className="text-left px-4">תקציב 25</th>}
                            <th className="text-left px-4">תקציב 26</th>
                            {visibleCols.a2026 && <th className="text-left px-4">ביצוע 26</th>}
                            {visibleCols.commit2026 && <th className="text-left px-4">ביצוע+שריון 26</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredBudgetData.map(row => (
                            <tr key={row.id} className="hover:bg-emerald-50 transition-colors group">
                              <td className="p-4 pr-6 font-mono text-[10px] text-slate-400 group-hover:text-emerald-700 transition-colors">#{row.id}</td>
                              <td className="p-4 font-black text-slate-800 text-xs">{row.name}</td>
                              <td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.dept}</td>
                              {visibleCols.a2024 && <td className="p-4 text-left font-bold text-slate-500 text-xs px-4">{formatILS(row.a2024)}</td>}
                              {visibleCols.b2025 && <td className="p-4 text-left font-bold text-slate-500 text-xs px-4">{formatILS(row.b2025)}</td>}
                              <td className="p-4 text-left font-bold text-blue-800 text-xs px-4">{formatILS(row.b2026)}</td>
                              {visibleCols.a2026 && <td className="p-4 text-left font-black text-slate-900 text-xs px-4">{formatILS(row.a2026)}</td>}
                              {visibleCols.commit2026 && <td className="p-4 text-left font-black text-orange-700 text-xs px-4">{formatILS(row.commit2026)}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Budget Control Table */}
                {viewMode === 'control' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-3xl shadow-sm border mb-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400">חיפוש סעיף / שם</label>
                            <input type="text" placeholder="הזן מספר או שם סעיף..." value={budgetSearch} onChange={e => setBudgetSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm" disabled={showOnlyBudgetAnomalies} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400">מחלקה</label>
                            <select value={budgetDept} onChange={e => setBudgetDept(e.target.value)} className="w-full p-2 rounded-xl bg-slate-50 border outline-none font-bold text-sm" disabled={currentUser?.role === 'DEPT' || showOnlyBudgetAnomalies}>
                                <option value="הכל">כל המחלקות</option>
                                {Array.from(new Set(fullData.filter(r => activeWingId === null || cleanStr(r.wing) === cleanStr(activeWingId)).map(r => r.dept))).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400">סוג</label>
                            <select value={budgetType} onChange={e => setBudgetType(e.target.value)} className="w-full p-2 rounded-xl bg-slate-50 border outline-none font-bold text-sm" disabled={showOnlyBudgetAnomalies}>
                                <option value="הכל">הכנסות והוצאות</option>
                                <option value="הוצאה">הוצאות בלבד</option>
                                <option value="הכנסה">הכנסות בלבד</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-wrap gap-4 bg-white p-2 rounded-2xl shadow-sm border">
                          <button 
                            onClick={() => setControlMetric('a2026')} 
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${controlMetric === 'a2026' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            השווה מול ביצוע 26
                          </button>
                          <button 
                            onClick={() => setControlMetric('commit2026')} 
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${controlMetric === 'commit2026' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            השווה מול ביצוע+שריון 26
                          </button>
                        </div>

                        {showOnlyBudgetAnomalies && (
                            <div className="flex items-center gap-4 bg-red-100 p-2 pl-6 pr-2 rounded-2xl border border-red-200 shadow-sm animate-in fade-in zoom-in">
                                <div className="bg-red-500 text-white w-8 h-8 rounded-xl flex items-center justify-center"><AlertTriangle size={18} /></div>
                                <span className="font-black text-red-800 text-sm">מציג רק סעיפים בחריגה</span>
                                <button onClick={() => setShowOnlyBudgetAnomalies(false)} className="text-xs font-bold text-red-600 hover:text-red-900 underline mr-4">בטל סינון</button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border overflow-x-auto pb-4">
                      <table className="w-full text-right border-collapse whitespace-nowrap min-w-max">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase">
                            <th className="p-4 pr-6">סעיף</th>
                            <th>תיאור</th>
                            {activeWingId === null && <th className="text-center px-4">אגף</th>}
                            <th className="text-center">מחלקה</th>
                            <th className="text-left px-4">תקציב 26</th>
                            <th className="text-left px-4">{controlMetric === 'a2026' ? 'ביצוע 26' : 'ביצוע+שריון 26'}</th>
                            <th className="text-left px-6">יתרה</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredBudgetData.map(row => {
                            const isExpense = row.type === 'הוצאה';
                            const isRevenue = row.type === 'הכנסה';
                            const isAnomaly = (isExpense && row.balance < 0) || (isRevenue && row.balance > 0);
                            
                            return (
                              <tr key={row.id} className={`hover:bg-emerald-50 transition-colors group ${isAnomaly ? 'bg-red-50/40 hover:bg-red-100/60' : ''}`}>
                                <td className="p-4 pr-6 font-mono text-[10px] text-slate-400 group-hover:text-emerald-700 transition-colors">#{row.id}</td>
                                <td className="p-4 font-black text-slate-800 text-xs">
                                  {row.name} {isRevenue && <span className="text-[10px] font-bold text-emerald-600 mr-2 bg-emerald-100 px-2 py-0.5 rounded-md">הכנסה</span>}
                                </td>
                                {activeWingId === null && <td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.wing}</td>}
                                <td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.dept}</td>
                                <td className="p-4 text-left font-bold text-blue-800 text-xs px-4">{formatILS(row.b2026)}</td>
                                <td className="p-4 text-left font-black text-slate-900 text-xs px-4">{formatILS(controlMetric === 'a2026' ? row.a2026 : row.commit2026)}</td>
                                <td className={`p-4 text-left font-black text-xs px-6 ${isAnomaly ? 'text-red-600' : 'text-emerald-600'}`} dir="ltr">{formatILS(row.balance)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredBudgetData.length === 0 && (
                          <div className="p-8 text-center text-slate-400 font-bold">לא נמצאו סעיפים תואמים לסינון.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Workplan Quarter Selector (Only shown in table view for updating) */}
                {viewMode === 'table' && (
                  <div className="bg-white p-4 rounded-3xl shadow-sm border flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                      <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl flex items-center justify-center">
                          <Clock size={24} />
                      </div>
                      <div>
                          <label className="text-sm font-black text-slate-800 block mb-1">עדכון משימות לרבעון:</label>
                          <p className="text-[10px] font-bold text-slate-400">בחר רבעון כדי לעדכן סטטוס חדש</p>
                      </div>
                      <div className="flex flex-wrap gap-2 mr-auto w-full sm:w-auto">
                          {[1, 2, 3, 4].map(q => (
                              <button 
                                  key={q}
                                  onClick={() => setWorkplanQuarter(q)}
                                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-sm transition-all ${workplanQuarter === q ? 'bg-emerald-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                  רבעון {q}
                              </button>
                          ))}
                      </div>
                  </div>
                )}

                {/* Workplan Dashboard */}
                {viewMode === 'dashboard' ? (
                  <>
                    {activeWingId && currentUser?.role !== 'DEPT' && (
                        <div className="bg-white p-4 rounded-3xl shadow-sm border mb-4 flex items-center gap-4">
                            <label className="text-sm font-black text-slate-600">הצג נתונים למחלקה:</label>
                            <select 
                                value={filterDept} 
                                onChange={e => setFilterDept(e.target.value)} 
                                className="p-2 rounded-xl bg-slate-50 border outline-none font-bold text-sm min-w-[200px]"
                            >
                                <option value="הכל">כל המחלקות באגף</option>
                                {Array.from(new Set(workPlans.filter(t => cleanStr(t.wing) === cleanStr(activeWingId)).map(t=>t.dept))).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="bg-slate-800 text-white p-6 rounded-3xl shadow-sm border flex flex-col items-center justify-center">
                        <p className="text-[11px] font-bold text-slate-400 mb-1">סה"כ משימות</p>
                        <p className="text-4xl font-black">{filteredWorkData.length}</p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center justify-center">
                          <CheckCircle2 className="text-emerald-500 mb-2" size={32} />
                          <p className="text-[11px] font-black text-slate-400">בוצע</p>
                          <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-3xl font-black text-slate-800">{workStats.counts.s1}</span>
                              <span className="text-xs font-bold text-slate-400">({workStats.p1}%)</span>
                          </div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center justify-center">
                          <Clock className="text-amber-500 mb-2" size={32} />
                          <p className="text-[11px] font-black text-slate-400">בתהליך</p>
                          <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-3xl font-black text-slate-800">{workStats.counts.s2}</span>
                              <span className="text-xs font-bold text-slate-400">({workStats.p2}%)</span>
                          </div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center justify-center">
                          <AlertCircle className="text-red-500 mb-2" size={32} />
                          <p className="text-[11px] font-black text-slate-400">לא בוצע</p>
                          <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-3xl font-black text-slate-800">{workStats.counts.s3}</span>
                              <span className="text-xs font-bold text-slate-400">({workStats.p3}%)</span>
                          </div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center justify-center">
                          <HelpCircle className="text-slate-300 mb-2" size={32} />
                          <p className="text-[11px] font-black text-slate-400">טרם עודכן</p>
                          <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-3xl font-black text-slate-800">{workStats.counts.missing}</span>
                              <span className="text-xs font-bold text-slate-400">({workStats.pMissing}%)</span>
                          </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[400px]">
                          <h3 className="font-black text-slate-800 mb-6 border-r-8 border-emerald-500 pr-3">סטטוס ביצוע כולל</h3>
                          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'בוצע', value: workStats.counts.s1 }, { name: 'בתהליך', value: workStats.counts.s2 }, { name: 'לא בוצע', value: workStats.counts.s3 }, { name: 'טרם עודכן', value: workStats.counts.missing }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5}>{[ '#10b981', '#f59e0b', '#ef4444', '#e2e8f0' ].map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                      </div>
                      <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[400px]">
                          <h3 className="font-black text-slate-800 mb-6 border-r-8 border-blue-500 pr-3">
                            {activeWingId === null ? 'משימות לפי אגף' : 'משימות לפי מחלקה'}
                          </h3>
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={workplanChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="n" type="category" orientation="right" width={150} tick={{fontSize: 11, fontWeight: 'black', fill: '#1e293b'}} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: '#f1f5f9'}} />
                                    <Bar dataKey="v" radius={[10, 0, 0, 10]} barSize={25} fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>
                          </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-3xl shadow-sm border flex-1">
                            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">חיפוש משימה</label><input type="text" placeholder="חפש משימה, פעילות או מזהה..." value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm" disabled={showOnlyOverdueTasks} /></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">מחלקה</label><select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full p-2 rounded-xl bg-slate-50 border outline-none font-bold text-sm" disabled={currentUser?.role === 'DEPT' || showOnlyOverdueTasks}><option value="הכל">כל המחלקות</option>{Array.from(new Set(filteredWorkData.map(t=>t.dept))).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">סטטוס ביצוע</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 rounded-xl bg-slate-50 border outline-none font-bold text-sm" disabled={showOnlyOverdueTasks}><option value="הכל">כל הסטטוסים</option><option value="1">בוצע</option><option value="2">בתהליך</option><option value="3">לא בוצע</option><option value="missing">טרם עודכן</option></select></div>
                        </div>
                        
                        {showOnlyOverdueTasks && (
                            <div className="flex items-center gap-4 bg-amber-100 p-3 pl-6 pr-3 rounded-2xl border border-amber-200 shadow-sm animate-in fade-in zoom-in h-full">
                                <div className="bg-amber-500 text-white w-10 h-10 rounded-xl flex items-center justify-center"><Clock size={20} /></div>
                                <div className="flex flex-col">
                                    <span className="font-black text-amber-800 text-sm leading-tight">מציג חריגות לו"ז</span>
                                    <button onClick={() => setShowOnlyOverdueTasks(false)} className="text-[10px] text-right font-bold text-amber-600 hover:text-amber-900 underline">בטל סינון</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-x-auto pb-4">
                        <table className="w-full text-right border-collapse min-w-[1000px]">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 border-b">
                                <tr>
                                    <th className="p-4" style={{width: '5%'}}>#</th>
                                    <th className="p-4" style={{width: '12%'}}>מחלקה</th>
                                    <th className="p-4" style={{width: '15%'}}>פעילות</th>
                                    <th className="p-4" style={{width: '35%'}}>משימה</th>
                                    <th className="p-4" style={{width: '10%'}}>לו"ז</th>
                                    <th className="p-4" style={{width: '13%'}}>יעד הצלחה</th>
                                    <th className="p-4 text-center" style={{width: '10%'}}>עדכון (רבעון {workplanQuarter})</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredWorkData.map(task => {
                                    const taskDate = parseDateLogic(task.deadline);
                                    const overallRating = getOverallRating(task);
                                    const updatedQuarter = getUpdatedQuarter(task);
                                    const currentRating = task[`q${workplanQuarter}`];
                                    
                                    const isOverdue = taskDate && taskDate < new Date() && (!overallRating || overallRating === 3);
                                    
                                    return (
                                        <tr key={task.id} className={`hover:bg-emerald-50 transition-colors group ${currentRating === 1 ? 'bg-emerald-50/40' : ''} ${isOverdue && showOnlyOverdueTasks ? 'bg-amber-50/50' : ''}`}>
                                            <td className="p-4 text-slate-300 font-mono text-[10px] group-hover:text-emerald-700 transition-colors">#{task.id}</td>
                                            <td className="p-4 text-xs font-black text-emerald-800">{task.dept}</td>
                                            <td className="p-4 text-[10px] text-slate-600 font-bold leading-tight">{task.activity}</td>
                                            <td className="p-4 font-black text-slate-800 text-xs leading-relaxed max-w-[300px] truncate hover:whitespace-normal hover:break-words">{task.task}</td>
                                            <td className={`p-4 text-[10px] font-black ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>{formatDate(task.deadline)}</td>
                                            <td className="p-4 text-[10px] text-slate-600 leading-tight max-w-[200px] truncate hover:whitespace-normal hover:break-words">{task.success_target}</td>
                                            <td className="p-4 text-center">
                                                {updatedQuarter && updatedQuarter !== workplanQuarter ? (
                                                    <div className="bg-slate-100 text-slate-500 font-bold text-[10px] p-2 rounded-xl text-center shadow-inner border border-slate-200">
                                                        עודכן ברבעון {updatedQuarter}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <select 
                                                            disabled={savingId === task.id} 
                                                            value={currentRating || ""} 
                                                            onChange={(e) => handleStatusSave(task.id, e.target.value, workplanQuarter)} 
                                                            className={`flex-1 p-1.5 rounded-xl text-[10px] font-black border-none outline-none cursor-pointer shadow-sm ${currentRating === 1 ? 'bg-emerald-100 text-emerald-700' : currentRating === 2 ? 'bg-amber-100 text-amber-700' : currentRating === 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'}`}
                                                        >
                                                            <option value="">-</option>
                                                            <option value="1">בוצע</option>
                                                            <option value="2">בתהליך</option>
                                                            <option value="3">לא בוצע</option>
                                                        </select>
                                                        {savingId === task.id && <Loader2 size={14} className="animate-spin text-emerald-600" />}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {filteredWorkData.length === 0 && (
                            <div className="p-8 text-center text-slate-400 font-bold">לא נמצאו משימות תואמות לסינון.</div>
                        )}
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