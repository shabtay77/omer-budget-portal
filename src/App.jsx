import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { LayoutDashboard, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users, Megaphone, TableProperties, ShieldAlert, Lock, CheckCircle2, Clock, AlertCircle, HelpCircle, Download, Save, Check, Loader2 } from 'lucide-react';

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
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(absVal);
};

const cleanNum = (val) => {
  if (!val || val === "") return 0;
  const n = parseFloat(String(val).replace(/,/g, ''));
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
  const [pendingChanges, setPendingChanges] = useState([]);
  
  const [mainTab, setMainTab] = useState('budget'); 
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [activeWingId, setActiveWingId] = useState(null);
  const [filterDept, setFilterDept] = useState('הכל');
  const [filterStatus, setFilterStatus] = useState('הכל');
  const [search, setSearch] = useState('');

  // טעינת נתונים משולבת: JSON + LIVE CSV
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [budgetRes, workRes, sheetsRes] = await Promise.all([
          fetch('/budget_data.json'),
          fetch('/workplans_data.json'),
          fetch(SHEETS_CSV_URL)
        ]);

        const bData = await budgetRes.json();
        const wData = await workRes.json();
        const csvText = await sheetsRes.text();

        const lines = csvText.split('\n').map(l => l.split(','));
        const headers = lines[0].map(h => h.trim().toLowerCase());
        const idIdx = headers.findIndex(h => h.includes('id'));
        const a26Idx = headers.findIndex(h => h.includes('a2026'));
        const statusIdx = 9; // עמודה J

        const execMap = {};
        const liveStatusMap = {};

        lines.slice(1).forEach(cols => {
          let rawId = cols[idIdx]?.trim();
          if (rawId) {
            let cleanId = rawId.includes('E+') ? String(BigInt(Math.round(Number(rawId)))) : rawId;
            execMap[cleanId] = cleanNum(cols[a26Idx]);
            liveStatusMap[cleanId] = cleanNum(cols[statusIdx]);
          }
        });

        // מיזוג נתונים: סטטוס תמיד נלקח מהשיטס
        const mergedWorkPlans = wData.filter(t => t.id).map(task => ({
          ...task,
          rating: liveStatusMap[String(task.id)] || 0
        }));

        setStaticData(bData);
        setWorkPlans(mergedWorkPlans);
        setExecutionMap(execMap);
      } catch (err) { console.error("Error loading data:", err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // הרשאות וסינון בסיסי
  const filteredWorkData = useMemo(() => {
    let data = workPlans;
    if (currentUser?.role === 'WING') data = data.filter(item => item.wing === currentUser.target);
    if (currentUser?.role === 'DEPT') data = data.filter(item => item.dept === currentUser.target);
    
    if (activeWingId) data = data.filter(item => item.wing === activeWingId);
    if (filterDept !== 'הכל') data = data.filter(t => t.dept === filterDept);
    if (filterStatus !== 'הכל') {
      if (filterStatus === 'missing') data = data.filter(t => !t.rating || t.rating === 0);
      else data = data.filter(t => t.rating === parseInt(filterStatus));
    }
    if (search) data = data.filter(t => (t.task || "").includes(search) || (t.dept || "").includes(search));
    return data;
  }, [workPlans, currentUser, activeWingId, filterDept, filterStatus, search]);

  // חישוב סטטיסטיקה לתמונת מצב - מתוקן!
  const workStats = useMemo(() => {
    const data = filteredWorkData;
    const total = data.length || 1;
    const s1 = data.filter(t => t.rating === 1).length;
    const s2 = data.filter(t => t.rating === 2).length;
    const s3 = data.filter(t => t.rating === 3).length;
    const m = data.filter(t => !t.rating || t.rating === 0).length;

    return {
      p1: Math.round((s1 / total) * 100),
      p2: Math.round((s2 / total) * 100),
      p3: Math.round((s3 / total) * 100),
      pm: Math.round((m / total) * 100),
      counts: { s1, s2, s3, m }
    };
  }, [filteredWorkData]);

  // שמירה מאוחדת
  const handleSave = async () => {
    if (pendingChanges.length === 0) return;
    setIsSaving(true);
    try {
      for (const change of pendingChanges) {
        const url = `${GAS_SCRIPT_URL}?id=${change.id}&rating=${change.rating}`;
        await fetch(url, { method: 'POST', mode: 'no-cors' });
      }
      alert("נשמר בשיטס! הנתונים יתעדכנו בכניסה הבאה.");
      setPendingChanges([]);
    } catch (e) { alert("שגיאה בשמירה"); }
    finally { setIsSaving(false); }
  };

  const updateStatus = (id, val) => {
    const rating = parseInt(val);
    setWorkPlans(prev => prev.map(t => t.id === id ? { ...t, rating } : t));
    setPendingChanges(prev => [...prev.filter(c => c.id !== id), { id, rating }]);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const user = USERS_DB.find(u => u.user.toLowerCase() === uInput.toLowerCase() && u.pass === pInput);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      if (user.role === 'WING') setActiveWingId(user.target);
      if (user.role === 'DEPT') {
          const found = workPlans.find(w => w.dept === user.target);
          setActiveWingId(found?.wing || "שפ\"ה");
      }
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-right" dir="rtl">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200">
          <div className="flex flex-col items-center mb-8"><div className="w-16 h-16 bg-emerald-800 rounded-2xl flex items-center justify-center text-white mb-4"><Lock size={32} /></div><h1 className="text-2xl font-black text-slate-800">פורטל מועצת עומר</h1></div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="שם משתמש" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right" value={uInput} onChange={e => setUInput(e.target.value)} />
            <input type="password" placeholder="סיסמה" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold text-right" value={pInput} onChange={e => setPInput(e.target.value)} />
            <button type="submit" className="w-full bg-emerald-800 text-white p-4 rounded-2xl font-black text-lg">כניסה</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50 font-black text-emerald-800" dir="rtl"><Loader2 className="animate-spin mb-4" size={48} />טוען נתונים חיים מהשיטס...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-right overflow-x-hidden" dir="rtl">
      {pendingChanges.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500] animate-bounce">
          <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-10 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 border-4 border-white">
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />} שמור {pendingChanges.length} שינויים
          </button>
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-[250] shadow-sm p-4 flex justify-between items-center px-8">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => {setMainTab('budget'); setViewMode('dashboard');}} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${mainTab === 'budget' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תקציב</button>
            <button onClick={() => {setMainTab('workplan'); setViewMode('dashboard');}} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${mainTab === 'workplan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תכנית עבודה</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left hidden sm:block"><p className="text-[10px] font-black text-slate-600">שלום, {currentUser.user}</p><button onClick={() => window.location.reload()} className="text-[10px] font-bold text-red-500 underline">התנתק</button></div>
            <div className="w-9 h-9 bg-emerald-800 rounded-xl flex items-center justify-center text-white font-black shadow-md">ע</div>
          </div>
      </header>

      <div className="flex flex-1 lg:flex-row relative">
        <aside className="hidden lg:block lg:w-72 bg-white border-l h-[calc(100vh-64px)] sticky top-16">
          <div className="p-6 space-y-2 border-b">
            <button onClick={() => setViewMode('dashboard')} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${viewMode === 'dashboard' ? 'bg-emerald-800 text-white' : 'text-slate-600'}`}><LayoutDashboard size={20}/> <span className="font-bold">תמונת מצב</span></button>
            <button onClick={() => setViewMode('table')} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${viewMode === 'table' ? 'bg-emerald-800 text-white' : 'text-slate-600'}`}><TableProperties size={20}/> <span className="font-bold">פירוט מלא</span></button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[60%]">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">{currentUser.role === 'ADMIN' ? 'אגפים' : 'האגף שלי'}</p>
            {currentUser.role === 'ADMIN' ? (
              <>
                <button onClick={() => setActiveWingId(null)} className={`w-full text-right p-3 rounded-xl mb-1 text-sm font-bold ${!activeWingId ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>כלל המועצה</button>
                {Object.keys(ICONS).map(name => (
                  <button key={name} onClick={() => setActiveWingId(name)} className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 text-sm ${activeWingId === name ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{React.createElement(ICONS[name], { size: 16 })} <span>{name}</span></button>
                ))}
              </>
            ) : (
              <div className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-800 font-black">
                {React.createElement(ICONS[activeWingId] || Building2, { size: 20 })} <span>{activeWingId}</span>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden text-right">
          <h2 className="text-2xl lg:text-4xl font-black text-slate-800 mb-8">{activeWingId || (currentUser?.role === 'DEPT' ? currentUser.target : 'כלל המועצה')}</h2>

          {mainTab === 'workplan' && viewMode === 'dashboard' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center"><CheckCircle2 className="text-emerald-500 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">בוצע</p><p className="text-3xl font-black text-slate-800">{workStats.p1}%</p></div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center"><Clock className="text-amber-500 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">בתהליך</p><p className="text-3xl font-black text-slate-800">{workStats.p2}%</p></div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center"><AlertCircle className="text-red-500 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">לא בוצע</p><p className="text-3xl font-black text-slate-800">{workStats.p3}%</p></div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center"><HelpCircle className="text-slate-300 mb-2" size={40} /><p className="text-[11px] font-black text-slate-400">טרם עודכן</p><p className="text-3xl font-black text-slate-800">{workStats.pm}%</p></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border h-[400px] flex flex-col items-center justify-center">
                  <h3 className="font-black text-slate-800 mb-4 self-start border-r-8 border-emerald-500 pr-3">סטטוס משימות</h3>
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{name: 'בוצע', value: workStats.counts.s1}, {name: 'בתהליך', value: workStats.counts.s2}, {name: 'לא בוצע', value: workStats.counts.s3}, {name: 'טרם עודכן', value: workStats.counts.m}]} dataKey="value" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5}>{[ '#10b981', '#f59e0b', '#ef4444', '#e2e8f0' ].map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                </div>
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border h-[400px]">
                   <h3 className="font-black text-slate-800 mb-4 border-r-8 border-blue-500 pr-3">משימות לפי מחלקה</h3>
                   <ResponsiveContainer width="100%" height="100%"><BarChart data={Array.from(new Set(filteredWorkData.map(t=>t.dept))).map(d => ({n: d, v: filteredWorkData.filter(t=>t.dept === d).length}))} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="n" type="category" width={100} tick={{fontSize: 10, fontWeight:'black'}}/><Tooltip/><Bar dataKey="v" fill="#3b82f6" radius={[0,10,10,0]} barSize={20}/></BarChart></ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : viewMode === 'table' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-3xl shadow-sm border items-end">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 pr-2">חיפוש</label><input type="text" placeholder="חפש משימה..." value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 pr-2">מחלקה</label><select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right" disabled={currentUser?.role === 'DEPT'}><option value="הכל">כל המחלקות</option>{Array.from(new Set(workPlans.map(t=>t.dept))).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 pr-2">סטטוס</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right"><option value="הכל">כל הסטטוסים</option><option value="1">בוצע</option><option value="2">בתהליך</option><option value="3">לא בוצע</option><option value="missing">טרם עודכן</option></select></div>
              </div>
              <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[900px]">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase">
                    <tr><th className="p-4" style={{width:'5%'}}>#</th><th className="p-4" style={{width:'15%'}}>מחלקה</th><th className="p-4" style={{width:'35%'}}>משימה</th><th className="p-4" style={{width:'12%'}}>לו"ז</th><th className="p-4" style={{width:'15%'}}>יעד הצלחה</th><th className="p-4 text-center" style={{width:'12%'}}>סטטוס</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredWorkData.map(task => (
                      <tr key={task.id} className={`hover:bg-slate-50 ${task.rating === 1 ? 'bg-emerald-50/20' : ''}`}>
                        <td className="p-4 text-slate-300 font-mono text-[10px]">#{task.id}</td>
                        <td className="p-4 text-xs font-black text-emerald-800">{task.dept}</td>
                        <td className="p-4 font-black text-slate-800 text-xs leading-relaxed">{task.task}</td>
                        <td className="p-4 text-[10px] font-black text-slate-500">{formatDate(task.deadline)}</td>
                        <td className="p-4 text-[10px] text-slate-600 leading-tight">{task.success_target}</td>
                        <td className="p-4 text-center">
                          <select value={task.rating || ""} onChange={(e) => updateStatus(task.id, e.target.value)} className={`p-1.5 rounded-xl text-[10px] font-black border-none outline-none cursor-pointer w-full ${task.rating === 1 ? 'bg-emerald-100 text-emerald-700' : task.rating === 2 ? 'bg-amber-100 text-amber-700' : task.rating === 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
                            <option value="">-</option><option value="1">בוצע</option><option value="2">בתהליך</option><option value="3">לא בוצע</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* תצוגת תקציב - השארתי את הטבלה הפשוטה שעבדה לך מצוין */
            <div className="bg-white rounded-3xl shadow-sm border overflow-x-auto p-4">
              <table className="w-full text-right border-collapse min-w-[800px]">
                <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-400 border-b uppercase"><th className="p-4 pr-6">סעיף</th><th>תיאור</th><th className="text-center">מחלקה</th><th className="text-left">תקציב 26</th><th className="text-left">ביצוע 26</th></tr></thead>
                <tbody className="divide-y">{staticData.filter(r => (!activeWingId || r.wing === activeWingId) && (search === '' || (r.name||"").includes(search))).map(row => (
                  <tr key={row.id} className="hover:bg-slate-50"><td className="p-4 pr-6 font-mono text-[10px] text-slate-400">#{row.id}</td><td className="p-4 font-black text-slate-800 text-xs">{row.name}</td><td className="p-4 font-bold text-slate-700 text-[10px] text-center">{row.dept}</td><td className="p-4 text-left font-bold text-blue-800 text-xs">{formatILS(row.b2026)}</td><td className="p-4 text-left font-black text-xs">{formatILS(executionMap[row.id] || 0)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;