import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { LayoutDashboard, UserRound, Building2, HardHat, GraduationCap, Wallet, Truck, Users, Megaphone, TableProperties, ShieldAlert, Lock, CheckCircle2, Clock, AlertCircle, HelpCircle, Download, Save, Menu, X, Loader2 } from 'lucide-react';

// --- החלף כאן את הקישור שלך ---
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

const formatDate = (v) => {
  if (!v) return "-";
  if (String(v).includes('/')) return v;
  const s = parseFloat(v);
  if (isNaN(s)) return v;
  return new Date(Math.round((s - 25569) * 86400 * 1000)).toLocaleDateString('he-IL');
};

const formatILS = (v) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 }).format(v || 0);

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uInput, setUInput] = useState("");
  const [pInput, setPInput] = useState("");
  const [staticData, setStaticData] = useState([]);
  const [workPlans, setWorkPlans] = useState([]); 
  const [executionMap, setExecutionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mainTab, setMainTab] = useState('budget'); 
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [activeWingId, setActiveWingId] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('הכל');

  const cleanNum = (v) => parseFloat(String(v || "0").replace(/,/g, '')) || 0;

  const loadData = async () => {
    setLoading(true);
    try {
      const [bRes, wRes, sRes] = await Promise.all([
        fetch('/budget_data.json'),
        fetch('/workplans_data.json'),
        fetch(`${SHEETS_CSV_URL}&t=${Date.now()}`)
      ]);
      const bJson = await bRes.json();
      const wJson = await wRes.json();
      const csv = await sRes.text();

      const rows = csv.split('\n').map(r => r.split(','));
      const idIdx = 0; // עמודה A
      const statusIdx = 10; // עמודה 11 (K) - אינדקס 10
      const a26Idx = rows[0].map(h => h.trim().toLowerCase()).findIndex(h => h.includes('a2026'));

      const execMap = {};
      const liveStatus = {};
      rows.slice(1).forEach(cols => {
        const id = cols[idIdx]?.trim();
        if (id) {
          execMap[id] = cleanNum(cols[a26Idx]);
          liveStatus[id] = parseInt(cols[statusIdx]) || 0;
        }
      });

      setStaticData(bJson);
      setExecutionMap(execMap);
      
      // מיזוג נתונים: "דירוג רבעון 2" תמיד נלקח מהשיטס
      setWorkPlans(wJson.filter(t => t.id).map(t => ({
        ...t,
        "דירוג רבעון 2": liveStatus[String(t.id)] !== undefined ? liveStatus[String(t.id)] : t["דירוג רבעון 2"] || 0
      })));
    } catch (e) { console.error("Error:", e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const budgetStats = useMemo(() => {
    const data = staticData.filter(r => (!activeWingId || r.wing === activeWingId) && r.type === 'הוצאה');
    return data.reduce((acc, curr) => {
      acc.total += cleanNum(curr.b2026);
      acc.exec += executionMap[curr.id] || 0;
      return acc;
    }, { total: 0, exec: 0 });
  }, [staticData, activeWingId, executionMap]);

  const filteredWorkData = useMemo(() => {
    let data = workPlans;
    if (currentUser?.role === 'WING') data = data.filter(t => t.wing === currentUser.target);
    if (currentUser?.role === 'DEPT') data = data.filter(t => t.dept === currentUser.target);
    if (activeWingId) data = data.filter(t => t.wing === activeWingId);
    if (filterDept !== 'הכל') data = data.filter(t => t.dept === filterDept);
    if (search) data = data.filter(t => t.task?.includes(search) || t.dept?.includes(search));
    return data;
  }, [workPlans, currentUser, activeWingId, filterDept, search]);

  const workStats = useMemo(() => {
    const total = filteredWorkData.length || 1;
    const s1 = filteredWorkData.filter(t => t["דירוג רבעון 2"] === 1).length;
    const s2 = filteredWorkData.filter(t => t["דירוג רבעון 2"] === 2).length;
    const s3 = filteredWorkData.filter(t => t["דירוג רבעון 2"] === 3).length;
    const m = total - (s1 + s2 + s3);
    return { p1: Math.round((s1/total)*100), p2: Math.round((s2/total)*100), p3: Math.round((s3/total)*100), pm: Math.round((m/total)*100), s1, s2, s3, m };
  }, [filteredWorkData]);

  const handleSave = async () => {
    if (!pendingChanges.length) return;
    setIsSaving(true);
    try {
      for (const c of pendingChanges) {
        // שליחת הערך לשיטס בעמודה 11
        await fetch(`${GAS_SCRIPT_URL}?id=${c.id}&val=${c.val}`, { method: 'POST', mode: 'no-cors' });
      }
      alert("השינויים נשמרו בהצלחה!");
      setPendingChanges([]);
      loadData(); // רענון מהשיטס
    } catch (e) { alert("תקלה בשמירה"); }
    finally { setIsSaving(false); }
  };

  const login = (e) => {
    e.preventDefault();
    const user = USERS_DB.find(u => u.user.toLowerCase() === uInput.toLowerCase() && u.pass === pInput);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      if (user.role === 'WING') setActiveWingId(user.target);
      if (user.role === 'DEPT') {
          const task = workPlans.find(t => t.dept === user.target);
          setActiveWingId(task?.wing || "שפ\"ה");
      }
    }
  };

  if (!isLoggedIn) return (
    <div className="h-screen bg-slate-100 flex items-center justify-center p-6 text-right font-sans" dir="rtl">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200">
        <h1 className="text-2xl font-black text-slate-800 mb-8 text-center">פורטל מועצת עומר</h1>
        <form onSubmit={login} className="space-y-4 text-right">
          <input type="text" placeholder="שם משתמש" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold" value={uInput} onChange={e => setUInput(e.target.value)} />
          <input type="password" placeholder="סיסמה" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold" value={pInput} onChange={e => setPInput(e.target.value)} />
          <button type="submit" className="w-full bg-emerald-800 text-white p-4 rounded-2xl font-black text-lg text-center">כניסה</button>
        </form>
      </div>
    </div>
  );

  if (loading && !workPlans.length) return <div className="h-screen flex items-center justify-center bg-white font-black text-emerald-800" dir="rtl"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-right overflow-x-hidden" dir="rtl">
      {pendingChanges.length > 0 && (
        <button onClick={handleSave} disabled={isSaving} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white px-8 py-4 rounded-full font-black shadow-2xl flex items-center gap-2 border-4 border-white">
          {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20}/>} שמור {pendingChanges.length} שינויים
        </button>
      )}

      <header className="bg-white border-b sticky top-0 z-[500] p-4 flex justify-between items-center px-6 shadow-sm">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => {setMainTab('budget'); setViewMode('dashboard');}} className={`px-4 py-2 rounded-lg text-xs font-bold ${mainTab === 'budget' ? 'bg-white shadow-sm text-emerald-800' : 'text-slate-400'}`}>תקציב</button>
          <button onClick={() => {setMainTab('workplan'); setViewMode('dashboard');}} className={`px-4 py-2 rounded-lg text-xs font-bold ${mainTab === 'workplan' ? 'bg-white shadow-sm text-emerald-800' : 'text-slate-400'}`}>תכנית עבודה</button>
        </div>
        <button onClick={() => setIsMenuOpen(true)} className="lg:hidden p-2 text-slate-600"><Menu size={28}/></button>
        <div className="hidden lg:flex items-center gap-3">
          <div className="text-left text-[10px] font-black">שלום, {currentUser.user}</div>
          <div className="w-10 h-10 bg-emerald-800 text-white rounded-xl flex items-center justify-center font-black">ע</div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={`${isMenuOpen ? 'fixed inset-0 z-[600] flex' : 'hidden'} lg:static lg:block lg:w-72 bg-white border-l`}>
          <div className="bg-white w-72 h-full flex flex-col p-6 shadow-xl lg:shadow-none">
            <button onClick={()=>setIsMenuOpen(false)} className="lg:hidden self-end mb-4"><X/></button>
            <div className="space-y-2 mb-8">
              <button onClick={()=>{setViewMode('dashboard'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${viewMode === 'dashboard' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600 hover:bg-emerald-50'}`}><LayoutDashboard size={20}/> <span className="font-bold">תמונת מצב</span></button>
              <button onClick={()=>{setViewMode('table'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-4 rounded-2xl ${viewMode === 'table' ? 'bg-emerald-800 text-white shadow-lg' : 'text-slate-600 hover:bg-emerald-50'}`}><TableProperties size={20}/> <span className="font-bold">פירוט מלא</span></button>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest text-right">אגפים</p>
            <div className="overflow-y-auto flex-1 space-y-1">
              {currentUser.role === 'ADMIN' ? (
                <>
                  <button onClick={()=>{setActiveWingId(null); setFilterDept('הכל'); setIsMenuOpen(false);}} className={`w-full text-right p-3 rounded-xl font-bold ${!activeWingId ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>כלל המועצה</button>
                  {Object.keys(ICONS).map(name => (
                    <button key={name} onClick={()=>{setActiveWingId(name); setFilterDept('הכל'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl ${activeWingId === name ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{React.createElement(ICONS[name], {size:16})} <span>{name}</span></button>
                  ))}
                </>
              ) : (
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl font-black flex items-center gap-3">
                  {React.createElement(ICONS[activeWingId] || Building2, {size:20})} {activeWingId}
                </div>
              )}
            </div>
          </div>
          {isMenuOpen && <div className="flex-1 bg-black/40 lg:hidden" onClick={()=>setIsMenuOpen(false)}></div>}
        </aside>

        <main className="flex-1 p-4 lg:p-8 text-right overflow-x-hidden">
          <h2 className="text-2xl lg:text-4xl font-black text-slate-800 mb-8">{activeWingId || 'כלל המועצה'}</h2>

          {mainTab === 'budget' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-3xl border shadow-sm text-right"><p className="text-[10px] font-bold text-slate-400 uppercase">תקציב 2026</p><p className="text-2xl font-black text-emerald-800">{formatILS(budgetStats.total)}</p></div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm text-right"><p className="text-[10px] font-bold text-slate-400 uppercase">ביצוע בפועל</p><p className="text-2xl font-black text-blue-800">{formatILS(budgetStats.exec)}</p></div>
              </div>
              {viewMode === 'dashboard' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[400px]">
                  <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center">
                    <h3 className="font-black mb-4 border-r-4 border-emerald-500 pr-2 self-start">התפלגות אגפים</h3>
                    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={Object.keys(ICONS).map(w => ({name:w, value: staticData.filter(r=>r.wing===w && r.type==='הוצאה').reduce((a,c)=>a+cleanNum(c.b2026),0)})).filter(v=>v.value>0)} dataKey="value" innerRadius={60} outerRadius={100} paddingAngle={5}>{[ '#3b82f6', '#10b981', '#f59e0b', '#ef4444' ].map((c,i)=><Cell key={i} fill={c}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center">
                    <h3 className="font-black mb-4 border-r-4 border-blue-500 pr-2 self-start">תקציב מול ביצוע</h3>
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={[{name:'תקציב', v:budgetStats.total}, {name:'ביצוע', v:budgetStats.exec}]}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis hide/><Tooltip formatter={(v)=>formatILS(v)}/><Bar dataKey="v" fill="#3b82f6" radius={[10,10,0,0]} barSize={50}/></BarChart></ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border shadow-sm overflow-x-auto p-4">
                  <table className="w-full text-right border-collapse">
                    <thead><tr className="bg-slate-50 text-[10px] font-black border-b uppercase"><th className="p-4 text-right">סעיף</th><th className="text-right">תיאור</th><th className="text-left">תקציב</th><th className="text-left">ביצוע</th></tr></thead>
                    <tbody className="divide-y text-right">{staticData.filter(r => (!activeWingId || r.wing === activeWingId) && (!search || r.name.includes(search))).map(row => (
                      <tr key={row.id} className="hover:bg-slate-50"><td className="p-4 font-mono text-[10px] text-slate-400">#{row.id}</td><td className="p-4 font-black text-xs">{row.name}</td><td className="p-4 text-left font-bold text-emerald-800">{formatILS(cleanNum(row.b2026))}</td><td className="p-4 text-left font-black text-blue-800">{formatILS(executionMap[row.id] || 0)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {viewMode === 'dashboard' ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center"><CheckCircle2 className="text-emerald-500 mb-2" size={32}/><p className="text-[11px] font-black">בוצע</p><p className="text-3xl font-black">{workStats.p1}%</p></div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center"><Clock className="text-amber-500 mb-2" size={32}/><p className="text-[11px] font-black">בתהליך</p><p className="text-3xl font-black">{workStats.p2}%</p></div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center"><AlertCircle className="text-red-500 mb-2" size={32}/><p className="text-[11px] font-black">לא בוצע</p><p className="text-3xl font-black">{workStats.p3}%</p></div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center"><HelpCircle className="text-slate-300 mb-2" size={32}/><p className="text-[11px] font-black">טרם עודכן</p><p className="text-3xl font-black">{workStats.pm}%</p></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[400px]">
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center">
                      <h3 className="font-black mb-4 border-r-4 border-emerald-500 pr-2 self-start">סטטוס ביצוע</h3>
                      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{name:'בוצע', v:workStats.s1}, {name:'תהליך', v:workStats.s2}, {name:'טרם/לא', v:workStats.s3+workStats.m}]} dataKey="v" innerRadius={60} outerRadius={95} paddingAngle={5}>{[ '#10b981', '#f59e0b', '#ef4444' ].map((c,i)=><Cell key={i} fill={c}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col overflow-hidden">
                       <h3 className="font-black mb-4 border-r-4 border-blue-500 pr-2 self-start">משימות לפי מחלקה</h3>
                       <ResponsiveContainer width="100%" height="100%"><BarChart data={Array.from(new Set(filteredWorkData.map(t=>t.dept))).map(d => ({n: d, v: filteredWorkData.filter(t=>t.dept === d).length}))} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="n" type="category" width={80} tick={{fontSize: 9, fontWeight:'black'}}/><Tooltip/><Bar dataKey="v" fill="#3b82f6" radius={[0,10,10,0]} barSize={15}/></BarChart></ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-3xl border shadow-sm items-end text-right">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">חפש משימה</label><input type="text" placeholder="חפש..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right" /></div>
                    <div className="space-y-1 text-right"><label className="text-[10px] font-black text-slate-400">סינון מחלקה</label>
                      <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none font-bold text-sm text-right" disabled={currentUser?.role === 'DEPT'}>
                        <option value="הכל">כל המחלקות</option>
                        {Array.from(new Set(workPlans.filter(t => !activeWingId || t.wing === activeWingId).map(t=>t.dept))).filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl border shadow-sm overflow-x-auto text-right">
                    <table className="w-full text-right min-w-[800px] border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black border-b uppercase">
                        <tr><th className="p-4" style={{width:'5%'}}>#</th><th className="p-4" style={{width:'15%'}}>מחלקה</th><th className="p-4" style={{width:'50%'}}>משימה</th><th className="p-4 text-center" style={{width:'15%'}}>סטטוס</th></tr>
                      </thead>
                      <tbody className="divide-y text-right">
                        {filteredWorkData.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="p-4 font-mono text-[10px] text-slate-300">#{t.id}</td>
                            <td className="p-4 text-xs font-black text-emerald-800">{t.dept}</td>
                            <td className="p-4 text-xs font-black leading-relaxed">{t.task}</td>
                            <td className="p-4 text-center">
                              <select value={t["דירוג רבעון 2"] || ""} onChange={(e)=>{
                                const val = parseInt(e.target.value);
                                setWorkPlans(prev => prev.map(item => item.id === t.id ? {...item, "דירוג רבעון 2": val} : item));
                                setPendingChanges(prev => [...prev.filter(c => c.id !== t.id), {id: t.id, val}]);
                              }} className={`p-1.5 rounded-xl text-[10px] font-black w-full outline-none border-none shadow-sm ${t["דירוג רבעון 2"] === 1 ? 'bg-emerald-100 text-emerald-700' : t["דירוג רבעון 2"] === 2 ? 'bg-amber-100 text-amber-700' : t["דירוג רבעון 2"] === 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
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
        </main>
      </div>
    </div>
  );
};

export default App;