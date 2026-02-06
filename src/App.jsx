import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { LayoutDashboard, Search, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users, Megaphone, TableProperties, ShieldAlert, Menu, X, Lock } from 'lucide-react';

const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2Y4QkJxnqapKne4Q5TSAC5ZVBE1oPjKYKRKE1MFqiDfxSBZdWJQgbFnJbKz_H98q6WvS6NtKKjHM2/pub?output=csv";

const USERS_DB = [
  { user: "aharony", pass: "1234", role: "ADMIN", target: null },
  { user: "tamir", pass: "1234", role: "ADMIN", target: null },
  { user: "erik", pass: "1234", role: "WING", target: "שפ\"ה" },
  { user: "lior", pass: "1234", role: "WING", target: "הנדסה" },
  { user: "smadar", pass: "1234", role: "WING", target: "חינוך" },
  { user: "or", pass: "1234", role: "WING", target: "שירות לתושב ודוברות" },
  { user: "adi", pass: "1234", role: "WING", target: "מרכז קהילתי" },
  { user: "hofit", pass: "1234", role: "WING", target: "הון אנושי" },
  { user: "tavroa", pass: "1234", role: "DEPT", target: "תברואה", wingContext: "שפ\"ה" },
  { user: "ginon", pass: "1234", role: "DEPT", target: "גינון", wingContext: "שפ\"ה" }
];

const ICONS = {
  'ראש הרשות': UserRound, 'הנהלה': Building2, 'גזברות': Wallet, 'הנדסה': HardHat,
  'חינוך': GraduationCap, 'שפ"ה': Truck, 'מרכז קהילתי': Users, 'הון אנושי': Users,
  'שירות לתושב ודוברות': Megaphone
};

const formatILS = (val) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val);
const cleanStr = (s) => String(s || "").replace(/["'״״]/g, "").trim();
const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const p = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(p) ? 0 : p;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uInput, setUInput] = useState("");
  const [pInput, setPInput] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const [staticData, setStaticData] = useState([]);
  const [executionMap, setExecutionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('budget'); 
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [activeWingId, setActiveWingId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null); 
  const [filterType, setFilterType] = useState('הכל');
  const [filterDept, setFilterDept] = useState('הכל');
  const [controlMetric, setControlMetric] = useState('a2026'); 
  const [visibleYears, setVisibleYears] = useState({ a2024: false, b2025: false, a2026: true, commit2026: true });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const staticRes = await fetch('/budget_data.json');
        const staticJson = await staticRes.json();
        setStaticData(staticJson);

        const sheetsRes = await fetch(SHEETS_CSV_URL);
        const csvText = await sheetsRes.text();
        const lines = csvText.split('\n').map(l => l.split(','));
        const headers = lines[0].map(h => h.trim().toLowerCase());
        const idIdx = headers.findIndex(h => h.includes('id'));
        const a26Idx = headers.findIndex(h => h.includes('a2026'));
        const c26Idx = headers.findIndex(h => h.includes('commit'));

        const map = {};
        lines.slice(1).forEach(cols => {
          const id = cols[idIdx]?.trim();
          if (id) map[id] = { a2026: cleanNum(cols[a26Idx]), commit2026: cleanNum(cols[c26Idx]) };
        });
        setExecutionMap(map);
      } catch (e) { console.error("Error:", e); }
      finally { setLoading(false); }
    };
    loadAllData();
  }, []);

  const filteredBaseData = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'ADMIN') return staticData;
    if (currentUser.role === 'WING') return staticData.filter(item => cleanStr(item.wing) === cleanStr(currentUser.target));
    if (currentUser.role === 'DEPT') return staticData.filter(item => cleanStr(item.dept) === cleanStr(currentUser.target));
    return [];
  }, [staticData, currentUser]);

  const fullData = useMemo(() => {
    return filteredBaseData.map(item => {
      const exec = executionMap[String(item.id).trim()] || { a2026: 0, commit2026: 0 };
      const b2026 = cleanNum(item.b2026);
      const metricVal = controlMetric === 'a2026' ? exec.a2026 : exec.commit2026;
      
      // לוגיקת יתרה וחריגה מעודכנת לפי סוג (הוצאה/הכנסה)
      const balance = b2026 - metricVal;
      let isOver = false;
      if (item.type === 'הוצאה') {
        isOver = balance < 0; // בהוצאה מינוס זה חריגה
      } else {
        isOver = balance > 0; // בהכנסה פלוס זה חריגה (הכנסנו פחות מהצפוי)
      }

      return {
        ...item,
        b2026, a2024: cleanNum(item.a2024), b2025: cleanNum(item.b2025),
        a2026: exec.a2026, commit2026: exec.commit2026,
        balance,
        isOverBudget: isOver && b2026 !== 0
      };
    });
  }, [filteredBaseData, executionMap, controlMetric]);

  const currentStats = useMemo(() => {
    const filtered = fullData.filter(r => r.type === 'הוצאה' && (!activeWingId || cleanStr(r.wing) === cleanStr(activeWingId)));
    return {
      a2024: filtered.reduce((a, c) => a + c.a2024, 0),
      b2025: filtered.reduce((a, c) => a + c.b2025, 0),
      b2026: filtered.reduce((a, c) => a + c.b2026, 0),
      a2026: filtered.reduce((a, c) => a + c.a2026, 0),
      commit2026: filtered.reduce((a, c) => a + c.commit2026, 0),
    };
  }, [fullData, activeWingId]);

  const chartData = useMemo(() => {
    const source = activeWingId ? fullData.filter(r => cleanStr(r.wing) === cleanStr(activeWingId) && r.type === 'הוצאה') : fullData.filter(r => r.type === 'הוצאה');
    const groups = {};
    source.forEach(r => {
      const key = (activeWingId || currentUser?.role === 'WING') ? r.dept : r.wing;
      if (!groups[key]) groups[key] = { name: key, value: 0 };
      groups[key].value += r.b2026;
    });
    return Object.values(groups).sort((a, b) => b.value - a.value);
  }, [fullData, activeWingId, currentUser]);

  const wingDepts = useMemo(() => {
    if (!activeWingId) return [];
    const depts = new Set(fullData.filter(r => cleanStr(r.wing) === cleanStr(activeWingId)).map(r => r.dept));
    return Array.from(depts);
  }, [fullData, activeWingId]);

  const tableRows = useMemo(() => {
    return fullData.filter(r => {
      const matchWing = !activeWingId || cleanStr(r.wing) === cleanStr(activeWingId);
      const matchDept = filterDept === 'הכל' || r.dept === filterDept;
      const matchType = filterType === 'הכל' || r.type === filterType;
      const matchSearch = r.name.includes(search) || String(r.id).includes(search);
      return matchWing && matchDept && matchType && matchSearch;
    });
  }, [fullData, activeWingId, filterDept, filterType, search]);

  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-right" dir="rtl">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-800 rounded-2xl flex items-center justify-center text-white mb-4"><Lock size={32} /></div>
            <h1 className="text-2xl font-black text-slate-800">פורטל מועצת עומר</h1>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const found = USERS_DB.find(u => u.user.toLowerCase() === uInput.toLowerCase() && u.pass === pInput); if(found){ setCurrentUser(found); setIsLoggedIn(true); if(found.role==='WING') setActiveWingId(found.target); } else setLoginErr('שגיאה בפרטים'); }} className="space-y-4 text-right">
            <input type="text" placeholder="שם משתמש" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-right" value={uInput} onChange={e => setUInput(e.target.value)} />
            <input type="password" placeholder="סיסמה" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-right" value={pInput} onChange={e => setPInput(e.target.value)} />
            <button type="submit" className="w-full bg-emerald-800 text-white p-4 rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-700 transition-all">כניסה</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-right overflow-x-hidden" dir="rtl">
      <header className="bg-white border-b sticky top-0 z-[250] shadow-sm text-right">
        <div className="max-w-[1600px] mx-auto p-3 flex justify-between items-center px-4 lg:px-8 text-right">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600 lg:hidden focus:outline-none"><Menu size={28} /></button>
          <div className="flex bg-slate-100 p-1 rounded-xl text-right">
            <button onClick={() => setMainTab('budget')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'budget' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תקציב</button>
            <button onClick={() => setMainTab('workplan')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'workplan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}>תכנית עבודה</button>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="text-left hidden sm:block text-right">
               <p className="text-[10px] font-black text-slate-400 leading-none">שלום, {currentUser.user}</p>
               <button onClick={() => window.location.reload()} className="text-[10px] font-bold text-red-500 underline uppercase">התנתק</button>
            </div>
            <div className="w-9 h-9 bg-emerald-800 rounded-xl flex items-center justify-center text-white font-black">ע</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 lg:flex-row relative text-right">
        <aside className={`fixed inset-0 z-[150] bg-white transition-transform duration-300 transform lg:static lg:block lg:w-72 lg:h-[calc(100vh-64px)] lg:border-l ${isMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="flex flex-col h-full bg-white pt-24 lg:pt-0 text-right">
             <div className="p-6 space-y-2 border-b text-right text-right">
                <button onClick={() => { setViewMode('dashboard'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'dashboard' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-500 hover:bg-emerald-50'}`}><LayoutDashboard size={20} /> <span className="font-bold">תמונת מצב</span></button>
                <button onClick={() => { setViewMode('table'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'table' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-500 hover:bg-emerald-50'}`}><TableProperties size={20} /> <span className="font-bold">פירוט תקציב</span></button>
                <button onClick={() => { setViewMode('control'); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-4 rounded-2xl transition-all ${viewMode === 'control' ? 'bg-red-700 text-white shadow-lg' : 'text-red-600 font-bold hover:bg-red-50'}`}><ShieldAlert size={20} /> <span className="font-bold">בקרה</span></button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-1 text-right">
                {currentUser.role === 'ADMIN' && (
                  <>
                    <p className="text-[10px] font-black text-slate-300 uppercase pr-4 mb-2 tracking-widest text-right">אגפים</p>
                    <button onClick={() => { setActiveWingId(null); setIsMenuOpen(false); }} className={`w-full text-right p-3 rounded-xl mb-1 text-sm font-bold ${activeWingId === null ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>כלל המועצה</button>
                    {Object.keys(ICONS).map(name => (
                      <button key={name} onClick={() => { setActiveWingId(name); setIsMenuOpen(false); }} className={`w-full flex items-center justify-start gap-3 p-3 rounded-xl mb-1 text-sm transition-all ${activeWingId === name ? 'bg-slate-900 text-white font-bold' : 'text-slate-500 hover:bg-slate-100'}`}>{React.createElement(ICONS[name], { size: 16 })} <span>{name}</span></button>
                    ))}
                  </>
                )}
             </div>
             <button onClick={() => setIsMenuOpen(false)} className="lg:hidden p-6 bg-slate-50 border-t font-black text-slate-400 text-sm flex items-center justify-center gap-2 italic uppercase text-right text-right">סגור תפריט</button>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-10 overflow-x-hidden text-right">
          {mainTab === 'budget' ? (
            <div className="max-w-[1400px] mx-auto text-right animate-in fade-in duration-500 text-right">
              <header className="mb-8 text-right text-right">
                <h2 className="text-2xl lg:text-4xl font-black text-slate-800 tracking-tight text-right text-right">{viewMode === 'dashboard' ? 'תמונת מצב' : viewMode === 'table' ? 'פירוט' : 'בקרה'} - {activeWingId || currentUser.target || 'כלל המועצה'}</h2>
              </header>

              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8 text-right text-right text-right">
                {viewMode !== 'control' && (
                  <>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-right text-right"><p className="text-[8px] font-bold text-slate-400 uppercase text-right">ביצוע 24</p><p className="text-lg font-black text-slate-500 tabular-nums text-right">{formatILS(currentStats.a2024)}</p></div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-right text-right"><p className="text-[8px] font-bold text-slate-400 uppercase text-right">תקציב 25</p><p className="text-lg font-black text-emerald-600 tabular-nums text-right text-right">{formatILS(currentStats.b2025)}</p></div>
                  </>
                )}
                <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-blue-600 text-right text-right text-right"><p className="text-[8px] font-bold text-slate-400 uppercase text-right text-right">תקציב 2026</p><p className="text-lg font-black text-blue-700 tabular-nums text-right text-right text-right">{formatILS(currentStats.b2026)}</p></div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-orange-500 text-right text-right text-right"><p className="text-[8px] font-bold text-slate-400 uppercase text-right text-right text-right">ביצוע+שריון</p><p className="text-lg font-black text-orange-600 tabular-nums text-right text-right text-right text-right text-right">{formatILS(currentStats.commit2026)}</p></div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-slate-400 text-right text-right text-right"><p className="text-[8px] font-bold text-slate-400 uppercase text-right text-right text-right text-right">ביצוע</p><p className="text-lg font-black text-slate-800 tabular-nums text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">{formatILS(currentStats.a2026)}</p></div>
                <div className="bg-emerald-900 p-4 rounded-2xl flex flex-col items-center justify-center text-white font-black text-[10px] italic text-center text-center text-center text-center text-center text-center text-center text-center text-center text-center">LIVE SYNC</div>
              </div>

              {viewMode === 'dashboard' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-right text-right text-right">
                  <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 min-h-[420px] text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">
                    <h3 className="font-black text-slate-800 mb-6 border-r-8 border-emerald-500 pr-3 text-right">התפלגות הוצאות 26</h3>
                    <div className="h-[300px] text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right"><ResponsiveContainer width="100%" height="100%" minHeight={250}><PieChart><Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5}>{chartData.map((e, i) => <Cell key={i} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />)}</Pie><Tooltip formatter={v => formatILS(v)} /></PieChart></ResponsiveContainer></div>
                  </div>
                  <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 min-h-[420px] text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">
                    <h3 className="font-black text-slate-800 mb-6 border-r-8 border-blue-500 pr-3 text-right text-right">מגמת צמיחה</h3>
                    <div className="h-[300px] text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right"><ResponsiveContainer width="100%" height="100%" minHeight={250}><BarChart data={[{n:'24', v:currentStats.a2024}, {n:'25', v:currentStats.b2025}, {n:'26', v:currentStats.b2026}]}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="n" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={v => formatILS(v)} /><Bar dataKey="v" radius={[10, 10, 0, 0]} barSize={45} fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-right text-right text-right">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-3xl shadow-sm border items-end text-right text-right text-right text-right text-right">
                    <div className="space-y-1 text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right"><label className="text-[10px] font-black text-slate-400 uppercase text-right">חיפוש</label><input type="text" placeholder="חפש..." value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 lg:p-3 rounded-xl bg-slate-50 border outline-none font-bold text-sm text-right text-right" /></div>
                    <div className="space-y-1 text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right"><label className="text-[10px] font-black text-slate-400 uppercase">סוג</label><select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full p-2 lg:p-3 rounded-xl bg-slate-50 border outline-none font-bold text-sm text-right"><option value="הכל">הכל</option><option value="הוצאה">הוצאה</option><option value="הכנסה">הכנסה</option></select></div>
                    <div className="space-y-1 text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right"><label className="text-[10px] font-black text-slate-400 uppercase">מחלקה</label><select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="w-full p-2 lg:p-3 rounded-xl bg-slate-50 border outline-none font-bold text-sm text-right" disabled={!activeWingId}><option value="הכל">כל המחלקות</option>{wingDepts.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                    <div className="lg:col-span-2 space-y-1 text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">
                      <label className="text-[10px] font-black text-slate-400 uppercase">
                        {viewMode === 'table' ? 'בורר שנים' : 'מדד בקרה'}
                      </label>
                      <div className="flex gap-1 bg-slate-50 p-1 rounded-xl text-right text-right text-right text-right text-right text-right text-right text-right text-right">
                        {viewMode === 'table' ? (
                          Object.keys(visibleYears).filter(y => y !== 'a2026' && y !== 'commit2026').concat(['a2026', 'commit2026']).map(y => (
                            <button key={y} onClick={() => setVisibleYears(p => ({...p, [y]: !p[y]}))} className={`flex-1 py-1.5 rounded-lg font-bold text-[8px] lg:text-[10px] transition-all ${visibleYears[y] ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-300'}`}>
                              {y === 'a2026' ? 'ביצוע' : y === 'commit2026' ? 'ביצוע+שריון' : y === 'a2024' ? '24' : '25'}
                            </button>
                          ))
                        ) : (
                          <>
                            <button onClick={() => setControlMetric('a2026')} className={`flex-1 py-2 rounded-lg font-bold text-[10px] transition-all ${controlMetric === 'a2026' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-300'}`}>ביצוע</button>
                            <button onClick={() => setControlMetric('commit2026')} className={`flex-1 py-2 rounded-lg font-bold text-[10px] transition-all ${controlMetric === 'commit2026' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-300'}`}>ביצוע+שריון</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-x-auto text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">
                    <table className="w-full text-right border-collapse min-w-[800px] text-right text-right text-right text-right text-right text-right text-right text-right">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 border-b text-right uppercase">
                          <th className="p-4 pr-6 text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">סעיף</th><th className="p-4 text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">תיאור</th><th className="p-4 text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right text-right">מחלקה</th><th className="p-4 text-left">תקציב 2026</th>
                          {viewMode === 'control' ? <><th className={`p-4 text-left font-black ${controlMetric === 'a2026' ? 'text-blue-700' : 'text-orange-600'}`}>{controlMetric === 'a2026' ? 'ביצוע' : 'ביצוע+שריון'}</th><th className="p-4 text-left font-black text-emerald-700 bg-emerald-50/50">יתרה</th></> : (
                            <>
                              {visibleYears.a2024 && <th className="p-4 text-left text-slate-500">ביצוע 24</th>}
                              {visibleYears.b2025 && <th className="p-4 text-left text-emerald-600">תקציב 25</th>}
                              {visibleYears.a2026 && <th className="p-4 text-left text-blue-700">ביצוע</th>}
                              {visibleYears.commit2026 && <th className="p-4 text-left text-orange-600">ביצוע+שריון</th>}
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y text-right">
                        {tableRows.map(row => (
                          <tr key={row.id} onClick={() => setSelectedRowId(row.id === selectedRowId ? null : row.id)} className={`cursor-pointer transition-all text-right ${selectedRowId === row.id ? 'bg-yellow-100 ring-2 ring-yellow-400 ring-inset scale-[1.005]' : 'hover:bg-slate-50'}`}>
                            <td className="p-4 pr-6 font-mono text-[10px] text-slate-400 text-right text-right text-right text-right">#{row.id}</td><td className="p-4 font-black text-slate-800 text-xs text-right text-right text-right text-right">{row.name}</td><td className="p-4 font-bold text-slate-700 text-[10px] text-right text-right text-right text-right text-right">{row.dept}</td><td className="p-4 text-left font-bold text-blue-800 text-xs tabular-nums text-left">{formatILS(row.b2026)}</td>
                            {viewMode === 'control' ? <><td className={`p-4 text-left font-black text-xs tabular-nums ${controlMetric === 'a2026' ? 'text-blue-700' : (row.isOverBudget ? 'text-red-600' : 'text-orange-600')}`}>{formatILS(controlMetric === 'a2026' ? row.a2026 : row.commit2026)}</td><td className={`p-4 text-left font-black text-xs tabular-nums ${row.isOverBudget ? 'bg-red-50 text-red-700' : 'text-emerald-700'}`}>{formatILS(row.balance)}</td></> : (
                              <>
                                {visibleYears.a2024 && <td className="p-4 text-left text-xs tabular-nums text-slate-400">{formatILS(row.a2024)}</td>}
                                {visibleYears.b2025 && <td className="p-4 text-left text-xs tabular-nums text-emerald-600/70">{formatILS(row.b2025)}</td>}
                                {visibleYears.a2026 && <td className="p-4 text-left text-xs tabular-nums text-blue-700/80">{formatILS(row.a2026)}</td>}
                                {visibleYears.commit2026 && <td className="p-4 text-left text-xs font-bold text-orange-600 tabular-nums">{formatILS(row.commit2026)}</td>}
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 italic text-right text-right text-right">תכניות עבודה בבנייה...</div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;