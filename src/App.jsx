import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { LayoutDashboard, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users, Megaphone, TableProperties, ShieldAlert, Menu, Lock, CheckCircle2, Clock, AlertCircle, HelpCircle, Download, Save } from 'lucide-react';

const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2Y4QkJxnqapKne4Q5TSAC5ZVBE1oPjKYKRKE1MFqiDfxSBZdWJQgbFnJbKz_H98q6WvS6NtKKjHM2/pub?output=csv";
const GAS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxApLFVWP1w72mz9PEAIvZ030j3vsVPkz2WfLf5KlzGu5TDN0e3H6IVwR-fhRrI_Wf5aw/exec";

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

// המרת מספרי תאריך אקסל לתאריך ישראלי קריא
const formatDate = (val) => {
  if (!val) return "-";
  if (String(val).includes('/')) return val;
  const serial = parseFloat(val);
  if (isNaN(serial)) return val;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uInput, setUInput] = useState("");
  const [pInput, setPInput] = useState("");
  const [staticData, setStaticData] = useState([]);
  const [workPlans, setWorkPlans] = useState([]); 
  const [executionMap, setExecutionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mainTab, setMainTab] = useState('budget'); 
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [activeWingId, setActiveWingId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [filterDept, setFilterDept] = useState('הכל');
  const [filterStatus, setFilterStatus] = useState('הכל');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('הכל');
  const [visibleYears, setVisibleYears] = useState({ a2024: false, b2025: false, a2026: true, commit2026: true });
  const [controlMetric, setControlMetric] = useState('a2026');

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [budgetRes, workRes] = await Promise.all([ fetch('/budget_data.json'), fetch('/workplans_data.json') ]);
        const budgetJson = await budgetRes.json();
        const workJson = await workRes.json();
        setStaticData(budgetJson || []);
        setWorkPlans(workJson || []);

        const sheetsRes = await fetch(SHEETS_CSV_URL);
        const csvText = await sheetsRes.text();
        const lines = csvText.split('\n').map(l => l.split(','));
        const headers = lines[0].map(h => h.trim().toLowerCase());
        const idIdx = headers.findIndex(h => h.includes('id'));
        const a26Idx = headers.findIndex(h => h.includes('a2026'));
        const c26Idx = headers.findIndex(h => h.includes('commit'));

        const map = {};
        lines.slice(1).forEach((cols) => {
          let rawId = cols[idIdx]?.trim();
          if (rawId) {
            let cleanId = rawId.includes('E+') ? String(BigInt(Math.round(Number(rawId)))) : rawId;
            map[cleanId] = { a2026: cleanNum(cols[a26Idx]), commit2026: cleanNum(cols[c26Idx]) };
          }
        });
        setExecutionMap(map);
      } catch (e) { console.error("Sync Error:", e); }
      finally { setLoading(false); }
    };
    loadAllData();
  }, []);

  const filteredBaseData = useMemo(() => {
    if (!currentUser || !staticData.length) return [];
    if (currentUser.role === 'ADMIN') return staticData;
    if (currentUser.role === 'WING') return staticData.filter(item => cleanStr(item.wing) === cleanStr(currentUser.target));
    if (currentUser.role === 'DEPT') return staticData.filter(item => cleanStr(item.dept) === cleanStr(currentUser.target));
    return [];
  }, [staticData, currentUser]);

  const fullData = useMemo(() => {
    return filteredBaseData.map(item => {
      const idKey = String(item.id).trim();
      const exec = executionMap[idKey] || { a2026: 0, commit2026: 0 };
      const b2026 = cleanNum(item.b2026);
      const metricVal = controlMetric === 'a2026' ? exec.a2026 : exec.commit2026;
      return { ...item, b2026, a2024: cleanNum(item.a2024), b2025: cleanNum(item.b2025), a2026: exec.a2026, commit2026: exec.commit2026, balance: b2026 - metricVal };
    });
  }, [filteredBaseData, executionMap, controlMetric]);

  const tableRows = useMemo(() => {
    return fullData.filter(r => {
      const matchWing = !activeWingId || cleanStr(r.wing) === cleanStr(activeWingId);
      const matchDept = filterDept === 'הכל' || r.dept === filterDept;
      const typeMatch = filterType === 'הכל' || r.type === filterType;
      const searchMatch = r.name.includes(search) || String(r.id).includes(search);
      return matchWing && matchDept && typeMatch && searchMatch;
    });
  }, [fullData, activeWingId, filterDept, filterType, search]);

  const filteredWorkData = useMemo(() => {
    if (!workPlans.length) return [];
    let data = workPlans;
    if (currentUser?.role === 'WING') data = workPlans.filter(item => cleanStr(item.wing) === cleanStr(currentUser.target));
    if (currentUser?.role === 'DEPT') data = workPlans.filter(item => cleanStr(item.dept) === cleanStr(currentUser.target));
    if (activeWingId) data = data.filter(item => cleanStr(item.wing) === cleanStr(activeWingId));
    if (filterDept !== 'הכל' && mainTab === 'workplan') data = data.filter(t => t.dept === filterDept);
    if (filterStatus !== 'הכל' && mainTab === 'workplan') {
      if (filterStatus === 'missing') data = data.filter(t => !t.rating);
      else data = data.filter(t => t.rating === parseInt(filterStatus));
    }
    if (search && mainTab === 'workplan') data = data.filter(item => item.task?.includes(search) || item.dept?.includes(search));
    return data;
  }, [workPlans, currentUser, activeWingId, filterDept, filterStatus, search, mainTab]);

  const workStats = useMemo(() => {
    const data = filteredWorkData || [];
    const total = data.length || 1;
    const counts = { s1: data.filter(t => t.rating === 1).length, s2: data.filter(t => t.rating === 2).length, s3: data.filter(t => t.rating === 3).length, missing: data.filter(t => !t.rating).length };
    return { p1: Math.round((counts.s1/total)*100), p2: Math.round((counts.s2/total)*100), p3: Math.round((counts.s3/total)*100), pMissing: Math.round((counts.missing/total)*100), counts };
  }, [filteredWorkData]);

  const handleStatusSave = async (taskId, newRating) => {
    setIsSaving(true);
    try {
        await fetch(GAS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, rating: parseInt(newRating) }) });
        setWorkPlans(prev => prev.map(t => t.id === taskId ? { ...t, rating: parseInt(newRating) } : t));
    } catch (e) { alert("שגיאה בעדכון"); }
    finally { setIsSaving(false); }
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
            setActiveWingId(row ? row.wing : "שפ\"ה");
        }
    }
  };

  const downloadWorkPlanExcel = () => {
    const headers = ["ID", "אגף", "מחלקה", "פעילות", "משימה", "לוז", "יעד הצלחה", "תפוקות", "הערות", "סטטוס"];
    const rows = filteredWorkData.map(t => [t.id, t.wing, t.dept, t.activity || "", `"${t.task}"`, formatDate(t.deadline), t.success_target || "", `"${t.outputs || ''}"`, `"${t.notes || ''}"`, t.rating || ""]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `work_plan_omer.csv`);
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
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="שם משתמש" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right" value={uInput} onChange={e => setUInput(e.target.value)} />
            <input type="password" placeholder="סיסמה" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right" value={pInput} onChange={e => setPInput(e.target.value)} />
            <button type="submit" className="w-full bg-emerald-800 text-white p-4 rounded-2xl font-black text-lg">כניסה</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-black text-emerald-800 animate-pulse text-right" dir="rtl">טוען נתונים...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-right overflow-x-hidden" dir="rtl">
      <header className="bg-white border-b sticky top-0 z-[250] shadow-sm p-4 flex justify-between items-center px-8">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => { setMainTab('budget'); setViewMode('dashboard'); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'budget' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תקציב</button>
            <button onClick={() => { setMainTab('workplan'); setViewMode('dashboard'); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'workplan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תכנית עבודה</button>
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
        <aside className={`fixed inset-0 z-[150] bg-white transition-transform duration-300 transform lg:static lg:block lg:w-72 lg:h-[calc(100vh-64px)] lg:border-l ${isMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="flex flex-col h-full bg-white pt-24 lg:pt-0">
             <div className="p-6 space-y-2 border-b">
                <button onClick={() => { setViewMode('dashboard'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'dashboard' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600 hover:bg-emerald-50'}`}><LayoutDashboard size={20} /> <span className="font-bold">תמונת מצב</span></button>
                <button onClick={() => { setViewMode('table'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'table' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600 hover:bg-emerald-50'}`}><TableProperties size={20} /> <span className="font-bold">{mainTab === 'budget' ? 'פירוט תקציב' : 'פירוט משימות'}</span></button>
                {mainTab === 'budget' && <button onClick={() => { setViewMode('control'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'control' ? 'bg-red-700 text-white shadow-lg' : 'text-red-600 font-bold hover:bg-red-50'}`}><ShieldAlert size={20} /> <span className="font-bold">בקרה</span></button>}
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase pr-4 mb-2 tracking-widest text-right">{currentUser.role === 'ADMIN' ? 'אגפים' : 'האגף שלי'}</p>
                {currentUser.role === 'ADMIN' ? (
                  <>
                    <button onClick={() => setActiveWingId(null)} className={`w-full text-right p-3 rounded-xl mb-1 text-sm font-bold ${activeWingId === null ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>כלל המועצה</button>
                    {Object.keys(ICONS).map(name => (
                      <button key={name} onClick={() => setActiveWingId(name)} className={`w-full flex items-center justify-start gap-3 p-3 rounded-xl mb-1 text-sm transition-all ${activeWingId === name ? 'bg-slate-900 text-white font-bold' : 'text-slate-500 hover:bg-slate-100'}`}>{React.createElement(ICONS[name], { size: 16 })} <span className="text-right">{name}</span></button>
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

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden text-right">
          <div className="max-w-[1400px] mx-auto text-right">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl lg:text-4xl font-black text-slate-800 tracking-tight">{activeWingId || (currentUser?.role === 'DEPT' ? currentUser.target : 'כלל המועצה')}</h2>
              {mainTab === 'workplan' && <button onClick={downloadWorkPlanExcel} className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg hover:scale-105 transition-all"><Download size={20} /> הורד אקסל</button>}
            </header>

            {mainTab === 'budget' ? (
              <div className="space-y-8">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
                   <div className="bg-white p-4 rounded-2xl shadow-sm border text-right"><p className="text-[8px] font-bold text-slate-400 uppercase">ביצוע 24</p><p className="text-lg font-black text-slate-700">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.a2024||0),0))}</p></div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border text-right"><p className="text-[8px] font-bold text-slate-400 uppercase">תקציב 25</p><p className="text-lg font-black text-emerald-700">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2025||0),0))}</p></div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-blue-600 text-right"><p className="text-[8px] font-bold text-slate-400 uppercase text-blue-600">תקציב 2026</p><p className="text-lg font-black text-blue-800">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2026||0),0))}</p></div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-orange-500 text-right"><p className="text-[8px] font-bold text-slate-400 uppercase text-orange-600">ביצוע+שריון</p><p className="text-lg font-black text-orange-700">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.commit2026||0),0))}</p></div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-slate-400 text-right"><p className="text-[8px] font-bold text-slate-400 uppercase">ביצוע בפועל</p><p className="text-lg font-black text-slate-900">{formatILS(fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.a2026||0),0))}</p></div>
                </div>
                {viewMode === 'dashboard' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 lg:p-10 rounded-[3rem] shadow-sm border min-h-[420px]">
                      <h3 className="font-black text-slate-800 mb-6 border-r-8 border-emerald-500 pr-3">התפלגות הוצאות 26</h3>
                      <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={Array.from(new Set(fullData.map(r => r.wing))).map(w => ({ name: w, value: fullData.filter(r => r.wing === w && r.type === 'הוצאה').reduce((a,c) => a + c.b2026, 0) })).filter(e => e.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5}>{['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip formatter={v => formatILS(v)} /></PieChart></ResponsiveContainer></div>
                    </div>
                    <div className="bg-white p-6 lg:p-10 rounded-[3rem] shadow-sm border min-h-[420px]">
                      <h3 className="font-black text-slate-800 mb-6 border-r-8 border-blue-500 pr-3">מגמת צמיחה הוצאות</h3>
                      <div className="h-[300px] text-right"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{n:'24', v:fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.a2024||0),0)}, {n:'25', v:fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2025||0),0)}, {n:'26', v:fullData.filter(r=>r.type==='הוצאה').reduce((a,c)=>a+(c.b2026||0),0)}]}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="n" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={v => formatILS(v)} /><Bar dataKey="v" radius={[10, 10, 0, 0]} barSize={45} fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl shadow-sm border overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[800px]">
                      <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase"><th className="p-4 pr-6">סעיף</th><th>תיאור</th><th className="text-center">מחלקה</th><th className="text-left">תקציב 26</th><th className="text-left">ביצוע 26</th></tr></thead>
                      <tbody className="divide-y">{tableRows.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50 text-right"><td className="p-4 pr-6 font-mono text-[10px] text-slate-400">#{row.id}</td><td className="p-4 font-black text-slate-800 text-xs">{row.name}</td><td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.dept}</td><td className="p-4 text-left font-bold text-blue-800 text-xs">{formatILS(row.b2026)}</td><td className="p-4 text-left font-black text-xs">{formatILS(row.a2026)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {viewMode === 'dashboard' ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center"><CheckCircle2 className="text-emerald-500 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">בוצע</p><p className="text-3xl font-black text-slate-800">{workStats.p1}%</p></div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center"><Clock className="text-amber-500 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">בתהליך</p><p className="text-3xl font-black text-slate-800">{workStats.p2}%</p></div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center"><AlertCircle className="text-red-500 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">לא בוצע</p><p className="text-3xl font-black text-slate-800">{workStats.p3}%</p></div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border flex flex-col items-center"><HelpCircle className="text-slate-300 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">טרם עודכן</p><p className="text-3xl font-black text-slate-800">{workStats.pMissing}%</p></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[400px]">
                          <h3 className="font-black text-slate-800 mb-6 border-r-8 border-emerald-500 pr-3">סטטוס ביצוע כולל</h3>
                          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'בוצע', value: workStats.counts.s1 }, { name: 'בתהליך', value: workStats.counts.s2 }, { name: 'לא בוצע', value: workStats.counts.s3 }, { name: 'טרם עודכן', value: workStats.counts.missing }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5}>{[ '#10b981', '#f59e0b', '#ef4444', '#e2e8f0' ].map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                      </div>
                      <div className="bg-white p-8 rounded-[3rem] shadow-sm border min-h-[400px]">
                          <h3 className="font-black text-slate-800 mb-6 border-r-8 border-blue-500 pr-3">משימות לפי מחלקה</h3>
                          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={Array.from(new Set(filteredWorkData.map(t => t.dept))).map(d => ({ n: d, v: filteredWorkData.filter(t => t.dept === d).length }))} layout="vertical" margin={{ left: 30, right: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} /><XAxis type="number" hide /><YAxis dataKey="n" type="category" width={120} tick={{fontSize: 10, fontWeight: 'black', fill: '#1e293b'}} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="v" radius={[0, 10, 10, 0]} barSize={25} fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-3xl shadow-sm border items-end">
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">חיפוש</label><input type="text" placeholder="חפש..." value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 text-right">מחלקה</label><select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full p-2 lg:p-3 rounded-xl bg-slate-50 border outline-none font-bold text-sm text-right" disabled={currentUser?.role === 'DEPT'}><option value="הכל">כל המחלקות</option>{Array.from(new Set(filteredWorkData.map(t=>t.dept))).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 text-right">סטטוס</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 lg:p-3 rounded-xl bg-slate-50 border outline-none font-bold text-sm text-right"><option value="הכל">כל הסטטוסים</option><option value="1">בוצע</option><option value="2">בתהליך</option><option value="3">לא בוצע</option><option value="missing">טרם עודכן</option></select></div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-x-auto">
                        <table className="w-full text-right border-collapse min-w-[1000px]">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase text-right">
                                <tr>
                                    <th className="p-4" style={{width: '5%'}}>#</th>
                                    <th className="p-4" style={{width: '12%'}}>מחלקה</th>
                                    <th className="p-4" style={{width: '15%'}}>פעילות</th>
                                    <th className="p-4" style={{width: '35%'}}>משימה</th>
                                    <th className="p-4" style={{width: '10%'}}>לו"ז</th>
                                    <th className="p-4" style={{width: '13%'}}>יעד הצלחה</th>
                                    <th className="p-4 text-center" style={{width: '10%'}}>סטטוס</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredWorkData.map(task => (
                                    <tr key={task.id} className={`hover:bg-slate-50 transition-all ${task.rating === 1 ? 'bg-emerald-50/20' : ''}`}>
                                        <td className="p-4 text-slate-300 font-mono text-[10px]">#{task.id}</td>
                                        <td className="p-4 text-xs font-black text-emerald-800">{task.dept}</td>
                                        <td className="p-4 text-[10px] text-slate-600 font-bold leading-tight">{task.activity}</td>
                                        <td className="p-4 font-black text-slate-800 text-xs leading-relaxed whitespace-normal">{task.task}</td>
                                        <td className="p-4 text-[10px] font-black text-slate-500">{formatDate(task.deadline)}</td>
                                        <td className="p-4 text-[10px] text-slate-600 leading-tight whitespace-normal">{task.success_target}</td>
                                        <td className="p-4 text-center">
                                            <select disabled={isSaving} value={task.rating || ""} onChange={(e) => handleStatusSave(task.id, e.target.value)} className={`p-1.5 rounded-xl text-[10px] font-black border-none outline-none cursor-pointer shadow-sm w-full ${task.rating === 1 ? 'bg-emerald-100 text-emerald-700' : task.rating === 2 ? 'bg-amber-100 text-amber-700' : task.rating === 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
                                                <option value="">-</option><option value="1">בוצע</option><option value="2">בתהליך</option><option value="3">לא בוצע</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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