import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { LayoutDashboard, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users, Megaphone, TableProperties, ShieldAlert, Lock, CheckCircle2, Clock, AlertCircle, HelpCircle, Download } from 'lucide-react';

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

// פתרון למספרי התאריך מאקסל (image_8bf4bd.png)
const formatDate = (val) => {
  if (!val || val === "") return "-";
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
  const [filterDept, setFilterDept] = useState('הכל');
  const [filterStatus, setFilterStatus] = useState('הכל');
  const [search, setSearch] = useState('');
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
      const searchMatch = (r.name || "").includes(search) || String(r.id).includes(search);
      return matchWing && matchDept && searchMatch;
    });
  }, [fullData, activeWingId, filterDept, search]);

  const filteredWorkData = useMemo(() => {
    if (!workPlans.length) return [];
    let data = workPlans.filter(t => t.id && t.task);
    if (currentUser?.role === 'WING') data = data.filter(item => cleanStr(item.wing) === cleanStr(currentUser.target));
    if (currentUser?.role === 'DEPT') data = data.filter(item => cleanStr(item.dept) === cleanStr(currentUser.target));
    if (activeWingId) data = data.filter(item => cleanStr(item.wing) === cleanStr(activeWingId));
    if (filterDept !== 'הכל' && mainTab === 'workplan') data = data.filter(t => t.dept === filterDept);
    if (filterStatus !== 'הכל' && mainTab === 'workplan') {
      if (filterStatus === 'missing') data = data.filter(t => !t.rating);
      else data = data.filter(t => t.rating === parseInt(filterStatus));
    }
    if (search && mainTab === 'workplan') data = data.filter(item => (item.task || "").includes(search) || (item.dept || "").includes(search));
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
        await fetch(`${GAS_SCRIPT_URL}?id=${taskId}&rating=${newRating}`, { method: 'POST', mode: 'no-cors' });
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

  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-right" dir="rtl">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-16 h-16 bg-emerald-800 rounded-2xl flex items-center justify-center text-white mb-4"><Lock size={32} /></div>
            <h1 className="text-2xl font-black text-slate-800">פורטל מועצת עומר</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="שם משתמש" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right text-slate-900" value={uInput} onChange={e => setUInput(e.target.value)} />
            <input type="password" placeholder="סיסמה" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right text-slate-900" value={pInput} onChange={e => setPInput(e.target.value)} />
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
        <aside className="lg:static lg:block lg:w-72 lg:h-[calc(100vh-64px)] lg:border-l bg-white">
          <div className="p-6 space-y-2 border-b">
            <button onClick={() => setViewMode('dashboard')} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${viewMode === 'dashboard' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600'}`}><LayoutDashboard size={20} /> <span className="font-bold">תמונת מצב</span></button>
            <button onClick={() => setViewMode('table')} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${viewMode === 'table' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600'}`}><TableProperties size={20} /> <span className="font-bold">פירוט מלא</span></button>
            {mainTab === 'budget' && <button onClick={() => setViewMode('control')} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${viewMode === 'control' ? 'bg-red-700 text-white shadow-lg' : 'text-red-600 font-bold'}`}><ShieldAlert size={20} /> <span className="font-bold">בקרה</span></button>}
          </div>
          <div className="p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase pr-4 mb-2">האגף שלי</p>
            <div className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-800 font-black">
                {React.createElement(ICONS[activeWingId] || Building2, { size: 20 })} <span>{activeWingId}</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden text-right">
            <h2 className="text-2xl lg:text-4xl font-black text-slate-800 mb-8">{activeWingId || (currentUser?.role === 'DEPT' ? currentUser.target : 'כלל המועצה')}</h2>
            
            {mainTab === 'budget' ? (
                <div className="bg-white rounded-3xl shadow-sm border overflow-x-auto p-4">
                  <table className="w-full text-right border-collapse min-w-[800px]">
                    <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase"><th className="p-4 pr-6">סעיף</th><th>תיאור</th><th className="text-center">מחלקה</th><th className="text-left">תקציב 26</th><th className="text-left">ביצוע 26</th></tr></thead>
                    <tbody className="divide-y">{tableRows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 text-right"><td className="p-4 pr-6 font-mono text-[10px] text-slate-400">#{row.id}</td><td className="p-4 font-black text-slate-800 text-xs">{row.name}</td><td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.dept}</td><td className="p-4 text-left font-bold text-blue-800 text-xs">{formatILS(row.b2026)}</td><td className="p-4 text-left font-black text-xs">{formatILS(row.a2026)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
            ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-3xl shadow-sm border items-end">
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">חיפוש</label><input type="text" placeholder="חפש..." value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">מחלקה</label><select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full p-2 lg:p-3 rounded-xl bg-slate-50 border outline-none font-bold text-sm text-right" disabled={currentUser?.role === 'DEPT'}><option value="הכל">כל המחלקות</option>{Array.from(new Set(filteredWorkData.map(t=>t.dept))).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">סטטוס</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 lg:p-3 rounded-xl bg-slate-50 border outline-none font-bold text-sm text-right"><option value="הכל">כל הסטטוסים</option><option value="1">בוצע</option><option value="2">בתהליך</option><option value="3">לא בוצע</option><option value="missing">טרם עודכן</option></select></div>
                  </div>
                  <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-x-auto">
                      <table className="w-full text-right border-collapse min-w-[1000px]">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase">
                              <tr>
                                  <th className="p-4 text-right" style={{width: '5%'}}>#</th>
                                  <th className="p-4 text-right" style={{width: '12%'}}>מחלקה</th>
                                  <th className="p-4 text-right" style={{width: '15%'}}>פעילות</th>
                                  <th className="p-4 text-right" style={{width: '35%'}}>משימה</th>
                                  <th className="p-4 text-right" style={{width: '10%'}}>לו"ז</th>
                                  <th className="p-4 text-right" style={{width: '13%'}}>יעד הצלחה</th>
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
        </main>
      </div>
    </div>
  );
};

export default App;