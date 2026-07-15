// ==================== קבועים ====================

const USERS_SHEET_NAME = 'users';
const COMPLAINTS_SHEET_NAME = 'פניות ציבור';
const COMPLAINTS_IMAGES_FOLDER_ID = '1TR1T_jIQ-c5GtgH7CRlbKmHuritDRa1F';
var BITZUA_2026_ID = "1fiBXKtF4sZs8JJnhtfL4Y_tbQpSjX8SrpnN4Ak3m75U";

// ==================== פונקציות עזר בסיסיות ====================

function getComplaintsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMPLAINTS_SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + COMPLAINTS_SHEET_NAME);
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getWorkplanSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function getUsersSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + USERS_SHEET_NAME);
  return sheet;
}

function normalizeBool(val) {
  return String(val || '').trim().toUpperCase() === 'TRUE';
}

function cleanNum(val) {
  if (typeof val === 'number') return val;
  if (!val || val === '') return 0;
  var str = String(val).trim();
  var isNegative = str.includes('-') || (str.includes('(') && str.includes(')'));
  str = str.replace(/[^\d.]/g, '');
  var n = parseFloat(str);
  if (isNaN(n)) return 0;
  return isNegative ? -Math.abs(n) : Math.abs(n);
}

function getSheetDataAsObjects(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// ==================== פונקציות עזר למיילים שבועיים ====================

function normalizeStr(s) {
  if (!s) return "";
  return String(s).replace(/[״"]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sameStr(a, b) {
  return normalizeStr(a) === normalizeStr(b);
}

function parseDateGas(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime()) || val.getFullYear() < 2020) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }
  var s = String(val).trim();
  var m = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (/^\d+$/.test(s)) {
    var serial = Number(s);
    if (serial > 1000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  return null;
}

function loadExecutionData() {
  var bitzuaSS = SpreadsheetApp.openById(BITZUA_2026_ID);
  var execSheet = bitzuaSS.getSheetByName("גיליון1");
  if (!execSheet) { Logger.log("גיליון1 לא נמצא!"); return []; }
  var raw = execSheet.getDataRange().getValues();
  var headers = raw[0].map(function(h) { return String(h).trim(); });
  Logger.log("עמודות גיליון1: " + JSON.stringify(headers));
  var data = [];
  for (var i = 1; i < raw.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = raw[i][j];
    data.push(obj);
  }
  Logger.log("שורות ביצוע: " + data.length);
  if (data.length > 0) {
    var first = data[0];
    Logger.log("תקציב 2026 ראשון: [" + first["תקציב 2026"] + "] | a2026 ראשון: [" + first["a2026"] + "] | סוג: [" + first["סוג"] + "]");
  }
  return data;
}

function loadOverdueTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var wpSheet = ss.getSheetByName("תכנית עבודה");
  if (!wpSheet) { Logger.log("גיליון תכנית עבודה לא נמצא"); return []; }
  var raw = wpSheet.getDataRange().getValues();
  Logger.log("כותרות תכנית עבודה: " + JSON.stringify(raw[0]));
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var overdue = [];
  for (var i = 1; i < raw.length; i++) {
    var row = raw[i];
    if (row[8] == 1 || row[10] == 1 || row[12] == 1 || row[14] == 1) continue;
    var dl = parseDateGas(row[6]);
    if (!dl || dl >= today) continue;
    overdue.push({
      task:     String(row[5] || "").trim(),
      activity: String(row[4] || "").trim(),
      wing:     String(row[1] || "").trim(),
      dept:     String(row[2] || "").trim(),
      deadline: dl
    });
  }
  Logger.log("משימות באיחור (סה\"כ): " + overdue.length);
  return overdue;
}

function filterForUser(user, budgetExceptions, overdueWorkplan) {
  var role    = String(user.role    || "").trim().toUpperCase();
  var target1 = String(user.target1 || "").trim();
  var target2 = String(user.target2 || "").trim();
  Logger.log("role: " + role + " | target1: [" + target1 + "] | target2: [" + target2 + "]");

  function matchesTarget(val) {
    if (role === "ADMIN") return true;
    if (!target1 && !target2) return true;
    return sameStr(val, target1) || sameStr(val, target2);
  }

  var userExceptions = budgetExceptions.filter(function(item) {
    if (role === "ADMIN") return true;
    return matchesTarget(String(item["אגף"] || ""));
  });

  var userOverdue = overdueWorkplan.filter(function(task) {
    if (role === "ADMIN") return true;
    if (role === "WING") return matchesTarget(task.wing);
    if (role === "DEPT") return matchesTarget(task.dept);
    return true;
  });

  Logger.log("חריגות אחרי פילטר: " + userExceptions.length + " | משימות אחרי פילטר: " + userOverdue.length);
  return { exceptions: userExceptions, overdue: userOverdue };
}

// ==================== משתמשים ====================

function getUsersData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users')
           || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var col = function(name) { return headers.indexOf(name.toLowerCase()); };
  var fullnameCol = ['fullname', 'full name', 'שם מלא'].map(function(h) { return col(h); }).find(function(i) { return i >= 0; });
  if (fullnameCol === undefined) fullnameCol = -1;
  return data.slice(1).filter(function(row) { return row[col('username')] || row[0]; }).map(function(row, i) {
    return {
      id:             col('id')             >= 0 ? row[col('id')]                          : i + 2,
      username:       col('username')       >= 0 ? String(row[col('username')]       || '') : '',
      password:       col('password')       >= 0 ? String(row[col('password')]       || '') : '',
      email:          col('email')          >= 0 ? String(row[col('email')]          || '') : '',
      role:           col('role')           >= 0 ? String(row[col('role')]           || '') : '',
      permissions:    col('permissions')    >= 0 ? String(row[col('permissions')]    || '') : 'EDIT',
      addUser:        col('adduser')        >= 0 ? String(row[col('adduser')]        || '') : '',
      target1:        col('target1')        >= 0 ? String(row[col('target1')]        || '') : '',
      target2:        col('target2')        >= 0 ? String(row[col('target2')]        || '') : '',
      active:         col('active')         >= 0 ? String(row[col('active')])               : 'TRUE',
      q1:             col('q1')             >= 0 ? !!row[col('q1')]                         : false,
      q2:             col('q2')             >= 0 ? !!row[col('q2')]                         : false,
      q3:             col('q3')             >= 0 ? !!row[col('q3')]                         : false,
      q4:             col('q4')             >= 0 ? !!row[col('q4')]                         : false,
      fullName:       fullnameCol           >= 0 ? String(row[fullnameCol]           || '') : '',
      complaintsRole: col('complaintsrole') >= 0 ? String(row[col('complaintsrole')] || '') : '',
      budgetManager:  col('budgetmanager')  >= 0 ? normalizeBool(row[col('budgetmanager')])  : false,
      itManager:      col('itmanager')      >= 0 ? normalizeBool(row[col('itmanager')])      : false,
      vehicleManager: col('vehiclemanager') >= 0 ? normalizeBool(row[col('vehiclemanager')]) : false,
      userEditScope:  col('usereditscope')  >= 0 ? String(row[col('usereditscope')]  || '') : ''
    };
  });
}

function listUsers() {
  return { success: true, users: getUsersData() };
}

function loginUser(username, password) {
  var users = getUsersData();
  var user = users.find(function(u) {
    return u.active &&
      String(u.username || '').trim().toLowerCase() === String(username || '').trim().toLowerCase() &&
      String(u.password || '').trim() === String(password || '').trim();
  });
  if (!user) return { success: false };
  return { success: true, user: {
    id:             user.id,
    user:           user.username,
    role:           user.role,
    permissions:    user.permissions || 'EDIT',
    addUser:        user.addUser || '',
    target1:        user.target1,
    target2:        user.target2,
    complaintsRole: user.complaintsRole || '',
    fullName:       user.fullName || '',
    q1:             !!user.q1,
    q2:             !!user.q2,
    q3:             !!user.q3,
    q4:             !!user.q4,
    budgetManager:  !!user.budgetManager,
    itManager:      !!user.itManager,
    vehicleManager: !!user.vehicleManager,
    userEditScope:  user.userEditScope || ''
  }};
}

function addUser(data) {
  var sheet = getUsersSheet();
  var values = sheet.getDataRange().getValues();
  var headers = (values.length > 0 ? values[0] : ['id','username','password','email','role','target1','target2','active'])
    .map(function(h) { return String(h).trim().toLowerCase(); });
  var users = getUsersData();
  var nextId = users.length === 0 ? 1 : Math.max.apply(null, users.map(function(u) { return Number(u.id) || 0; })) + 1;
  var newRow = new Array(headers.length).fill('');
  var map = {
    id:            nextId,
    username:      String(data.username || '').trim(),
    password:      String(data.password || '').trim(),
    email:         String(data.email || '').trim(),
    role:          String(data.role || '').trim(),
    permissions:   String(data.permissions || '').trim() || 'EDIT',
    adduser:       String(data.addUser || '').trim(),
    target1:       String(data.target1 || '').trim(),
    target2:       String(data.target2 || '').trim(),
    active:        String(data.active).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE',
    q1:            data.q1 ? 'TRUE' : 'FALSE',
    q2:            data.q2 ? 'TRUE' : 'FALSE',
    q3:            data.q3 ? 'TRUE' : 'FALSE',
    q4:            data.q4 ? 'TRUE' : 'FALSE',
    budgetmanager:  data.budgetManager  ? 'TRUE' : 'FALSE',
    itmanager:      data.itManager      ? 'TRUE' : 'FALSE',
    vehiclemanager: data.vehicleManager ? 'TRUE' : 'FALSE',
    usereditscope:  String(data.userEditScope || '')
  };
  headers.forEach(function(h, i) { if (map[h] !== undefined) newRow[i] = map[h]; });
  sheet.appendRow(newRow);
  return { success: true, id: nextId };
}

function updateUser(data) {
  var sheet = getUsersSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { success: false, error: 'No data in sheet' };
  var headers = values[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  if (idCol === -1) return { success: false, error: 'Missing id column' };
  var rowIndex = values.findIndex(function(row, idx) { return idx > 0 && String(row[idCol]).trim() === String(data.id).trim(); });
  if (rowIndex === -1) return { success: false, error: 'User not found' };
  var updateMap = {
    username:       data.username,
    password:       String(data.password || ''),
    role:           data.role,
    permissions:    String(data.permissions || '').trim() || 'EDIT',
    adduser:        String(data.addUser || '').trim(),
    target1:        data.target1,
    target2:        data.target2,
    email:          data.email,
    active:         String(data.active).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE',
    q1:             data.q1 ? 'TRUE' : 'FALSE',
    q2:             data.q2 ? 'TRUE' : 'FALSE',
    q3:             data.q3 ? 'TRUE' : 'FALSE',
    q4:             data.q4 ? 'TRUE' : 'FALSE',
    complaintsrole: String(data.complaintsRole || ''),
    fullname:       String(data.fullName || ''),
    budgetmanager:  data.budgetManager  ? 'TRUE' : 'FALSE',
    itmanager:      data.itManager      ? 'TRUE' : 'FALSE',
    vehiclemanager: data.vehicleManager ? 'TRUE' : 'FALSE',
    usereditscope:  String(data.userEditScope || '')
  };
  Object.keys(updateMap).forEach(function(key) {
    var colIdx = headers.indexOf(key);
    if (colIdx !== -1) sheet.getRange(rowIndex + 1, colIdx + 1).setValue(updateMap[key] != null ? updateMap[key] : '');
  });
  return { success: true };
}

function deactivateUser(data) {
  var sheet = getUsersSheet();
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  var activeCol = headers.indexOf('active');
  if (idCol === -1 || activeCol === -1) return { success: false, error: 'Missing columns' };
  var rowIndex = values.findIndex(function(row, idx) { return idx > 0 && String(row[idCol]).trim() === String(data.id).trim(); });
  if (rowIndex === -1) return { success: false, error: 'User not found' };
  sheet.getRange(rowIndex + 1, activeCol + 1).setValue('FALSE');
  return { success: true };
}

// ==================== תכנית עבודה ====================

function getWorkplanLiveData() {
  var sheet = getWorkplanSheet();
  var data = sheet.getDataRange().getValues();
  var results = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]).trim();
    if (id) {
      results[id] = {
        q1: data[i][8],  n1: data[i][9],
        q2: data[i][10], n2: data[i][11],
        q3: data[i][12], n3: data[i][13],
        q4: data[i][14], n4: data[i][15]
      };
    }
  }
  return results;
}

function updateSingleTask(sheet, data, payload) {
  var taskId = String(payload.id).trim();
  var quarter = Number(payload.quarter);
  if ([1,2,3,4].indexOf(quarter) === -1) return false;
  var statusCol = 7 + (2 * quarter);
  var noteCol = statusCol + 1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === taskId) {
      if (payload.rating !== undefined) sheet.getRange(i + 1, statusCol).setValue(payload.rating);
      if (payload.note   !== undefined) sheet.getRange(i + 1, noteCol).setValue(payload.note);
      return true;
    }
  }
  return false;
}

// ==================== ביצוע תקציב ====================

function uploadExecution(data) {
  var sheet = SpreadsheetApp.openById(BITZUA_2026_ID).getSheetByName("גיליון1");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var findCol = function(names, fallback) {
    for (var i = 0; i < names.length; i++) {
      var n = names[i].toLowerCase();
      var idx = headers.findIndex(function(h) { return h === n || h.includes(n); });
      if (idx !== -1) return idx;
    }
    return fallback !== undefined ? fallback : -1;
  };
  var colId     = findCol(['מזהה','id','קוד','מספר'], 0);
  var colA2026  = findCol(['ביצוע 2026','a2026'], -1);
  var colCommit = findCol(['שריון','התחייבות','commit'], -1);
  var colType   = findCol(['סוג'], 3);
  var colWing   = findCol(['אגף'], 4);
  var colDept   = findCol(['מחלקה'], 5);
  var colName   = findCol(['שם סעיף','שם'], 6);
  var colA2024  = findCol(['ביצוע 2024','a2024'], 7);
  var colB2025  = findCol(['תקציב 2025','b2025'], 8);
  var colB2026  = findCol(['תקציב 2026','b2026'], 9);
  var idMap = {};
  for (var i = 1; i < rows.length; i++) {
    var cellId = String(rows[i][colId] || '').trim().split('.')[0];
    if (cellId) idMap[cellId] = i;
  }
  var updated = 0, added = 0;
  (data.rows || []).forEach(function(item) {
    var itemId = String(item.id || '').trim().split('.')[0];
    var existingRowIdx = idMap[itemId];
    if (existingRowIdx !== undefined) {
      var sheetRow = existingRowIdx + 1;
      if (colA2026  !== -1) sheet.getRange(sheetRow, colA2026  + 1).setValue(item.a2026  != null ? item.a2026  : 0);
      if (colCommit !== -1) sheet.getRange(sheetRow, colCommit + 1).setValue(item.commit != null ? item.commit : 0);
      updated++;
    } else {
      var newRow = new Array(Math.max(headers.length, 10)).fill('');
      newRow[colId]    = itemId;
      newRow[colType]  = item.type  || '';
      newRow[colWing]  = item.wing  || '';
      newRow[colDept]  = item.dept  || '';
      newRow[colName]  = item.name  || '';
      newRow[colA2024] = item.a2024 != null ? item.a2024 : 0;
      newRow[colB2025] = item.b2025 != null ? item.b2025 : 0;
      newRow[colB2026] = item.b2026 != null ? item.b2026 : 0;
      if (colA2026  !== -1) newRow[colA2026]  = item.a2026  != null ? item.a2026  : 0;
      if (colCommit !== -1) newRow[colCommit] = item.commit != null ? item.commit : 0;
      sheet.appendRow(newRow);
      added++;
    }
  });
  return { success: true, updated: updated, added: added };
}

// ==================== פניות ציבור ====================

function generateComplaintId() {
  var sheet = getComplaintsSheet();
  var values = sheet.getDataRange().getValues();
  var year = new Date().getFullYear();
  var maxNum = 0;
  for (var i = 1; i < values.length; i++) {
    var id = String(values[i][14] || '');
    if (id.startsWith(String(year) + '-')) {
      var num = parseInt(id.split('-')[1]) || 0;
      if (num > maxNum) maxNum = num;
    }
  }
  return year + '-' + String(maxNum + 1).padStart(3, '0');
}

function getComplaintSLA(priority) {
  var now = new Date();
  var days = priority === 'דחוף' ? 2 : priority === 'רגיל' ? 7 : 14;
  now.setDate(now.getDate() + days);
  return now.toLocaleDateString('he-IL');
}

function listComplaints() {
  var sheet = getComplaintsSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { success: true, complaints: [] };
  var LEGACY_SUBJECTS = ['תשתיות','ניקיון','תאורה','עצים וגינון','חניה','רעש','בעלי חיים','אחר'];
  var complaints = values.slice(1).map(function(row, idx) {
    var m = String(row[12] || '').trim();
    var l = String(row[11] || '').trim();
    var isClosedVal = function(v) { return ['סגור','בוצע','V','v'].indexOf(v) !== -1 || v.toUpperCase() === 'TRUE'; };
    var closed = isClosedVal(m) || isClosedVal(l);
    var status = closed ? 'סגור' : (l === 'בטיפול' || m === 'בטיפול' ? 'בטיפול' : 'פתוח');
    var col8  = String(row[8]  || '').trim();
    var col13 = String(row[13] || '').trim();
    var col18 = String(row[18] || '').trim();
    var isLegacy = LEGACY_SUBJECTS.indexOf(col8) !== -1;
    return {
      rowIndex:        idx + 2,
      submittedBy:     String(row[0]  || ''),
      date:            String(row[1]  || ''),
      residentName:    String(row[2]  || ''),
      address:         String(row[3]  || ''),
      landmark:        String(row[4]  || ''),
      contactMethod:   String(row[5]  || ''),
      phone:           String(row[6]  || ''),
      mobile2:         String(row[7]  || ''),
      description:     isLegacy ? col13 : col8,
      assignedTo:      String(row[9]  || ''),
      responsibility2: String(row[10] || ''),
      statusDetail:    '',
      status:          status,
      notes:           col13,
      id:              String(row[14] || ''),
      priority:        String(row[15] || ''),
      slaDate:         String(row[16] || ''),
      images:          String(row[17] || ''),
      subject:         col18 || (isLegacy ? col8 : '')
    };
  }).filter(function(c) {
    return c.id || c.date || c.address || c.subject || c.residentName || c.description || c.submittedBy || c.assignedTo || c.phone || c.slaDate;
  });
  return { success: true, complaints: complaints };
}

function addComplaint(data) {
  var sheet = getComplaintsSheet();
  var id = generateComplaintId();
  var priority = data.priority || 'רגיל';
  var newRow = [
    data.submittedBy     || data.receivedBy     || '',
    data.date            || new Date().toLocaleDateString('he-IL'),
    data.residentName    || '',
    data.address         || '',
    data.landmark        || '',
    data.contactMethod   || '',
    data.phone           || data.mobile1        || '',
    data.mobile2         || '',
    data.description     || '',
    data.assignedTo      || data.responsibility1 || '',
    data.responsibility2 || '',
    data.statusDetail    || '',
    'פתוח',
    '',
    id,
    priority,
    data.slaDate || data.dueDate || getComplaintSLA(priority),
    data.images  || data.imageUrl || '',
    data.subject || ''
  ];
  sheet.appendRow(newRow);
  sendComplaintEmail(Object.assign({}, data, { responsibility1: data.assignedTo || data.responsibility1 }), id, getUsersData(), 'new');
  return { success: true, id: id };
}

function updateComplaint(data) {
  var sheet = getComplaintsSheet();
  var values = sheet.getDataRange().getValues();
  var rowIndex = values.findIndex(function(row, idx) { return idx > 0 && String(row[14]).trim() === String(data.id).trim(); });
  if (rowIndex === -1) return { success: false, error: 'Complaint not found' };
  var prevRow = values[rowIndex];
  var sheetRow = rowIndex + 1;
  var notes = String(prevRow[13] || '');
  if (data.note && String(data.note).trim()) {
    var timestamp = new Date().toLocaleString('he-IL');
    var newNote = '[' + timestamp + '] ' + String(data.note).trim();
    notes = notes ? notes + '\n' + newNote : newNote;
  } else if (data.notes !== undefined) {
    notes = data.notes;
  }
  var assignedTo = data.assignedTo !== undefined ? data.assignedTo : data.responsibility1;
  var cols = {
    0:  data.submittedBy    !== undefined ? data.submittedBy  : data.receivedBy,
    1:  data.date,
    2:  data.residentName,
    3:  data.address,
    4:  data.landmark,
    5:  data.contactMethod,
    6:  data.phone          !== undefined ? data.phone        : data.mobile1,
    7:  data.mobile2,
    8:  data.subject,
    9:  assignedTo,
    10: data.responsibility2,
    11: data.statusDetail,
    12: data.status,
    13: notes,
    15: data.priority,
    16: data.slaDate        !== undefined ? data.slaDate      : data.dueDate,
    17: data.images         !== undefined ? data.images       : (data.imageUrl !== undefined ? data.imageUrl : String(prevRow[17] || ''))
  };
  Object.entries(cols).forEach(function(entry) {
    if (entry[1] !== undefined) sheet.getRange(sheetRow, parseInt(entry[0]) + 1).setValue(entry[1]);
  });
  var users = getUsersData();
  var prevAssigned = String(prevRow[9] || '');
  if (assignedTo && assignedTo !== prevAssigned) {
    sendComplaintEmail(Object.assign({}, data, { responsibility1: assignedTo }), data.id, users, 'assigned', assignedTo);
  }
  return { success: true };
}

function sendComplaintEmail(data, id, users, type, specificUser) {
  try {
    var assignees = specificUser ? [specificUser] : [data.assignedTo].filter(Boolean);
    assignees.forEach(function(username) {
      var user = users.find(function(u) { return u.username === username && u.email && normalizeBool(u.active); });
      if (!user) return;
      var priorityColor = data.priority === 'דחוף' ? '#dc2626' : data.priority === 'רגיל' ? '#d97706' : '#64748b';
      var rows = [['מזהה',id],['נושא',data.subject],['כתובת',data.address||data.landmark],
                  ['עדיפות','<span style="color:'+priorityColor+';font-weight:bold;">'+(data.priority||'רגיל')+'</span>'],
                  ['מועד SLA',data.slaDate||getComplaintSLA(data.priority||'רגיל')]];
      var tableRows = rows.map(function(r, i) {
        return '<tr style="background:' + (i%2?'#f8fafc':'#fff') + '"><td style="padding:8px;font-weight:bold;border:1px solid #e2e8f0;">' + r[0] + '</td><td style="padding:8px;border:1px solid #e2e8f0;">' + (r[1]||'') + '</td></tr>';
      }).join('');
      var htmlBody = '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">' +
        '<div style="background:#065f46;padding:20px;text-align:center;color:white;"><h2 style="margin:0;">פניית ציבור ' + id + ' — ' + (type === 'new' ? 'שויכה אליך' : 'עדכון אחריות') + '</h2></div>' +
        '<div style="padding:24px;background:#fff;color:#334155;"><p>שלום ' + (user.fullName||user.username) + ',<br>שויכה אליך פניית ציבור הדורשת טיפול:</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">' + tableRows + '</table>' +
        '<div style="text-align:center;margin-top:24px;"><a href="https://omerbudget.netlify.app/" style="background:#065f46;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">כניסה לפורטל לטיפול</a></div></div>' +
        '<div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#64748b;">הודעה נשלחה אוטומטית ממערכת פניות הציבור של מועצת עומר.</div></div>';
      MailApp.sendEmail({ to: user.email, subject: 'פניית ציבור ' + id + ' — ' + (type === 'new' ? 'פניה חדשה שויכה אליך' : 'עדכון אחריות'), htmlBody: htmlBody, name: 'מועצת עומר — פניות ציבור', replyTo: 'omerbudget@gmail.com' });
    });
  } catch(e) { Logger.log('Email error: ' + e.message); }
}

function uploadComplaintImage(data) {
  try {
    var folder = DriveApp.getFolderById(COMPLAINTS_IMAGES_FOLDER_ID);
    var blob = Utilities.newBlob(Utilities.base64Decode(data.base64), data.mimeType, data.fileName || data.filename || 'image.jpg');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: 'https://drive.google.com/uc?id=' + file.getId() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ==================== תב"ר ====================

function listTabar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('תב"ר');
  if (!sheet) return { success: false, error: 'גיליון תב"ר לא נמצא' };
  var values = sheet.getDataRange().getValues();
  var cNum = function(v) { var n = parseFloat(String(v).replace(/[,₪\s]/g,'')); return isNaN(n) ? 0 : n; };
  var items = values.slice(1).map(function(row) {
    return {
      id:      String(row[0]  || '').trim(),
      name:    String(row[1]  || '').trim(),
      budget:  cNum(row[3]  || 0),
      income:  cNum(row[10] || 0),
      balance: cNum(row[11] || 0),
      wing1:   String(row[15] || '').trim(),
      dept1:   String(row[16] || '').trim(),
      wing2:   String(row[17] || '').trim(),
      dept2:   String(row[18] || '').trim(),
      wing3:   String(row[19] || '').trim(),
      dept3:   String(row[20] || '').trim()
    };
  }).filter(function(item) { return item.id || item.name; });
  return { success: true, items: items };
}

// ==================== מיילים שבועיים ====================

function sendWeeklyAlertsTestToMe() {
  var MY_EMAIL = "aharony@omer.muni.il";
  var executionData    = loadExecutionData();
  var budgetExceptions = getBudgetExceptions(executionData);
  var overdueWorkplan  = loadOverdueTasks();
  var myUser = getUsersData().find(function(u) {
    return String(u.username || "").toLowerCase() === "aharony";
  });
  if (!myUser) { Logger.log("המשתמש aharony לא נמצא בגיליון users"); return; }
  Logger.log("משתמש: " + JSON.stringify(myUser));
  var filtered = filterForUser(myUser, budgetExceptions, overdueWorkplan);
  MailApp.sendEmail({
    to:       MY_EMAIL,
    subject:  "התראות שבועיות — פורטל תקציב עומר",
    htmlBody: buildWeeklyAlertHtml(filtered.exceptions, filtered.overdue, myUser),
    name:     "מועצת עומר - פורטל מנהלים"
  });
  Logger.log("נשלח אל: " + MY_EMAIL);
}

function sendWeeklyAlerts() {
  var executionData    = loadExecutionData();
  var budgetExceptions = getBudgetExceptions(executionData);
  var overdueWorkplan  = loadOverdueTasks();
  var users            = getUsersData();
  var sentCount = 0, skippedCount = 0;
  users.forEach(function(user) {
    var email = String(user.email || "").trim();
    if (!email || email.split("@").length !== 2) { skippedCount++; return; }
    if (String(user.active).toUpperCase() === "FALSE") { skippedCount++; return; }
    var filtered = filterForUser(user, budgetExceptions, overdueWorkplan);
    if (filtered.exceptions.length === 0 && filtered.overdue.length === 0) { skippedCount++; return; }
    try {
      MailApp.sendEmail({
        to:       email,
        subject:  "התראות שבועיות — פורטל תקציב עומר",
        htmlBody: buildWeeklyAlertHtml(filtered.exceptions, filtered.overdue, user),
        name:     "מועצת עומר - פורטל מנהלים"
      });
      sentCount++;
    } catch (err) { skippedCount++; }
  });
  Logger.log("סיום — נשלחו: " + sentCount + " | דולגו: " + skippedCount);
}

function debugWeeklyAlerts() {
  var users = getUsersData();
  Logger.log("משתמשים: " + users.length);
  users.forEach(function(u) {
    var email = String(u.email || "").trim();
    if (email.split("@").length !== 2) Logger.log("INVALID EMAIL: [" + email + "]");
  });
}

// ==================== הכרזת תב"ר ====================

function sendTabarAnnouncementTest() {
  MailApp.sendEmail({
    to: 'aharony@omer.muni.il',
    subject: 'פורטל עומר — לשונית תב"ר חדשה',
    htmlBody: buildTabarEmailHtml('אהרוני'),
    name: 'מועצת עומר — פורטל מנהלים',
    replyTo: 'omerbudget@gmail.com'
  });
}

function sendTabarAnnouncementAll() {
  var users = getUsersData().filter(function(u) {
    return String(u.active).toUpperCase() !== 'FALSE' && String(u.email || '').trim();
  });
  var sent = 0, failed = 0;
  users.forEach(function(u) {
    try {
      MailApp.sendEmail({
        to: u.email,
        subject: 'פורטל עומר — לשונית תב"ר חדשה',
        htmlBody: buildTabarEmailHtml(u.fullName || u.username),
        name: 'מועצת עומר — פורטל מנהלים',
        replyTo: 'omerbudget@gmail.com'
      });
      sent++;
    } catch(e) { failed++; }
  });
  Logger.log('נשלח: ' + sent + ' | נכשל: ' + failed);
}

function buildTabarEmailHtml(name) {
  return '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">' +
    '<div style="background-color:#ffffff;padding:25px 20px;text-align:center;border-bottom:4px solid #065f46;">' +
    '<h1 style="color:#065f46;margin:0;font-size:24px;font-weight:900;">מערכת ניהול ובקרה</h1></div>' +
    '<div style="padding:30px;background-color:#ffffff;color:#334155;">' +
    '<h2 style="color:#0f766e;margin-top:0;">שלום ' + name + ',</h2>' +
    '<p style="font-size:16px;line-height:1.7;margin-bottom:20px;">ברצוננו לעדכן כי נוספה ללשונית הפורטל <strong>לשונית חדשה: תב"ר — תקציב בלתי רגיל</strong>.</p>' +
    '<div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:20px;margin-bottom:24px;">' +
    '<h3 style="color:#c2410c;margin-top:0;font-size:18px;">מה תמצאו בלשונית תב"ר?</h3>' +
    '<ul style="font-size:15px;line-height:2.2;margin:0;padding-right:20px;color:#334155;">' +
    '<li><strong>תמונת מצב גרפית</strong> — סה"כ תקציב, אחוז ביצוע ויתרות</li>' +
    '<li><strong>גרף 10 התב"רים הגדולים ביותר</strong> לפי תקציב וביצוע</li>' +
    '<li><strong>מד התקדמות</strong> לכל תב"ר עם סימון חריגות</li>' +
    '<li><strong>פירוט מלא</strong> — מספר, שם, יתרה, הכנסות לגבייה ושיוך אגף/מחלקה</li>' +
    '</ul></div>' +
    '<div style="text-align:center;"><a href="https://omerbudget.netlify.app/" style="display:inline-block;background-color:#065f46;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:bold;font-size:16px;">כניסה לפורטל</a></div></div>' +
    '<div style="background-color:#f8fafc;padding:18px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">הודעה זו נשלחה אוטומטית ממערכת הפורטל של מועצת עומר.</div></div>';
}

// ==================== doGet / doPost ====================

// ==================== בניית תקציב 2027 ====================

var BUDGET_2027_SHEET_NAME = 'תקציב 2027';
var PIRUT_2027_SHEET_NAME  = 'פירוט 2027';

function getBudget2027Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(BUDGET_2027_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(BUDGET_2027_SHEET_NAME);
  if (sheet.getLastRow() === 0)
    sheet.appendRow(['מזהה','תחזית_ביצוע_2026','תקציב_מבוקש_2027','עדכון_אחרון','מעדכן','תחזית_גזבר','מבוקש_גזבר','עדכון_גזבר','מעדכן_גזבר']);
  return sheet;
}

function getPirut2027Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PIRUT_2027_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(PIRUT_2027_SHEET_NAME);
  if (sheet.getLastRow() === 0)
    sheet.appendRow(['מזהה','עמודה','שורה','פירוט','כמות','עלות','סהכ','מעדכן','עדכון_אחרון']);
  return sheet;
}

function listBudget2027() {
  var items = [], details = [], execDate = '';
  try {
    execDate = Utilities.formatDate(
      DriveApp.getFileById(BITZUA_2026_ID).getLastUpdated(),
      Session.getScriptTimeZone(), 'dd/MM/yyyy'
    );
  } catch(e) {}
  try {
    var b27 = getBudget2027Sheet().getDataRange().getValues();
    for (var i = 1; i < b27.length; i++) {
      if (!b27[i][0]) continue;
      items.push({
        id:              String(b27[i][0]).trim(),
        forecast2026:    parseFloat(b27[i][1]) || 0,
        requested2027:   parseFloat(b27[i][2]) || 0,
        gazburForecast:  parseFloat(b27[i][5]) || 0,
        gazburRequested: parseFloat(b27[i][6]) || 0
      });
    }
  } catch(e) { Logger.log('listBudget2027 items: ' + e.message); }
  try {
    var p27 = getPirut2027Sheet().getDataRange().getValues();
    for (var j = 1; j < p27.length; j++) {
      if (!p27[j][0]) continue;
      details.push({
        id:     String(p27[j][0]).trim(),
        column: String(p27[j][1]).trim(),
        row:    Number(p27[j][2]) || 0,
        pirut:  String(p27[j][3] || '').trim(),
        kamut:  parseFloat(p27[j][4]) || 0,
        alut:   parseFloat(p27[j][5]) || 0,
        total:  parseFloat(p27[j][6]) || 0
      });
    }
  } catch(e) { Logger.log('listBudget2027 details: ' + e.message); }
  return { success: true, items: items, details: details, execDate: execDate };
}

function savePirut2027(data) {
  var rowId     = String(data.id     || '').trim();
  var column    = String(data.column || '').trim();
  var rows      = data.rows || [];
  var total     = parseFloat(data.total) || 0;
  var updatedBy = String(data.updatedBy || '').trim();
  var now       = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');

  // עדכון גיליון פירוט
  var p27  = getPirut2027Sheet();
  var p27d = p27.getDataRange().getValues();
  for (var i = p27d.length - 1; i >= 1; i--)
    if (String(p27d[i][0]).trim() === rowId && String(p27d[i][1]).trim() === column)
      p27.deleteRow(i + 1);
  rows.forEach(function(r, idx) {
    p27.appendRow([rowId, column, idx + 1, String(r.pirut || ''),
      parseFloat(r.kamut) || 0, parseFloat(r.alut) || 0, parseFloat(r.total) || 0,
      updatedBy, now]);
  });

  // עדכון גיליון סיכום
  var b27  = getBudget2027Sheet();
  var b27d = b27.getDataRange().getValues();
  var found = false;
  for (var j = 1; j < b27d.length; j++) {
    if (String(b27d[j][0]).trim() === rowId) {
      if      (column === 'תחזית')      { b27.getRange(j+1,2).setValue(total); b27.getRange(j+1,4).setValue(now); b27.getRange(j+1,5).setValue(updatedBy); }
      else if (column === 'מבוקש')      { b27.getRange(j+1,3).setValue(total); b27.getRange(j+1,4).setValue(now); b27.getRange(j+1,5).setValue(updatedBy); }
      else if (column === 'תחזית_גזבר') { b27.getRange(j+1,6).setValue(total); b27.getRange(j+1,8).setValue(now); b27.getRange(j+1,9).setValue(updatedBy); }
      else if (column === 'מבוקש_גזבר') { b27.getRange(j+1,7).setValue(total); b27.getRange(j+1,8).setValue(now); b27.getRange(j+1,9).setValue(updatedBy); }
      found = true; break;
    }
  }
  if (!found)
    b27.appendRow([
      rowId,
      column === 'תחזית'      ? total : 0,
      column === 'מבוקש'      ? total : 0,
      (column === 'תחזית' || column === 'מבוקש') ? now       : '',
      (column === 'תחזית' || column === 'מבוקש') ? updatedBy : '',
      column === 'תחזית_גזבר' ? total : 0,
      column === 'מבוקש_גזבר' ? total : 0,
      (column === 'תחזית_גזבר' || column === 'מבוקש_גזבר') ? now       : '',
      (column === 'תחזית_גזבר' || column === 'מבוקש_גזבר') ? updatedBy : ''
    ]);

  return { success: true };
}

// ==================== בקשות שינוי שם סעיף ====================

function getNameChange2027Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('בקשות שינוי שם 2027');
  if (!sheet) sheet = ss.insertSheet('בקשות שינוי שם 2027');
  if (sheet.getLastRow() === 0)
    sheet.appendRow(['מזהה','שם_נוכחי','שם_מבוקש','מגיש','תאריך']);
  return sheet;
}

function listNameChangeRequests() {
  var sheet = getNameChange2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    items.push({
      id:            String(rows[i][0]).trim(),
      currentName:   String(rows[i][1] || '').trim(),
      requestedName: String(rows[i][2] || '').trim(),
      submittedBy:   String(rows[i][3] || '').trim(),
      date:          String(rows[i][4] || '').trim()
    });
  }
  return { success: true, items: items };
}

function saveNameChangeRequest(data) {
  var sheet = getNameChange2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.id).trim()) {
      sheet.getRange(i+1, 3).setValue(data.requestedName || '');
      sheet.getRange(i+1, 4).setValue(data.submittedBy  || '');
      sheet.getRange(i+1, 5).setValue(now);
      return { success: true };
    }
  }
  sheet.appendRow([String(data.id), data.currentName||'', data.requestedName||'', data.submittedBy||'', now]);
  return { success: true };
}

// ==================== סעיפים חדשים 2027 ====================

function getNewItems2027Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('סעיפים חדשים 2027');
  if (!sheet) {
    sheet = ss.insertSheet('סעיפים חדשים 2027');
    sheet.appendRow(['tempId','wing','dept','name','type','requested2027','justification','submittedBy','date','status','realId','approvedBy','approvalDate']);
    sheet.getRange(1, 1, 1, 13).setFontWeight('bold');
  }
  return sheet;
}

function generateDraftId() {
  var sheet = getNewItems2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][0]);
    if (id.indexOf('DRAFT-') === 0) {
      var num = parseInt(id.replace('DRAFT-', ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  var next = max + 1;
  return 'DRAFT-' + (next < 10 ? '00' + next : next < 100 ? '0' + next : String(next));
}

function listNewItemRequests() {
  var sheet = getNewItems2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    items.push({
      tempId: String(r[0]),
      wing: String(r[1] || ''),
      dept: String(r[2] || ''),
      name: String(r[3] || ''),
      type: String(r[4] || 'הוצאה'),
      requested2027: parseFloat(r[5]) || 0,
      justification: String(r[6] || ''),
      submittedBy: String(r[7] || ''),
      date: String(r[8] || ''),
      status: String(r[9] || 'ממתין'),
      realId: String(r[10] || ''),
      approvedBy: String(r[11] || ''),
      approvalDate: String(r[12] || '')
    });
  }
  return { success: true, items: items };
}

function saveNewItemRequest(data) {
  var sheet = getNewItems2027Sheet();
  var tempId = generateDraftId();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  sheet.appendRow([
    tempId,
    data.wing || '',
    data.dept || '',
    data.name || '',
    data.type || 'הוצאה',
    parseFloat(data.requested2027) || 0,
    data.justification || '',
    data.submittedBy || '',
    now,
    'ממתין',
    '', '', ''
  ]);
  return {
    success: true,
    item: {
      tempId: tempId,
      wing: data.wing || '',
      dept: data.dept || '',
      name: data.name || '',
      type: data.type || 'הוצאה',
      requested2027: parseFloat(data.requested2027) || 0,
      justification: data.justification || '',
      submittedBy: data.submittedBy || '',
      date: now,
      status: 'ממתין',
      realId: '',
      approvedBy: '',
      approvalDate: ''
    }
  };
}

function approveNewItem(data) {
  var sheet = getNewItems2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.tempId)) {
      sheet.getRange(i + 1, 10).setValue('אושר');
      sheet.getRange(i + 1, 11).setValue(data.realId || '');
      sheet.getRange(i + 1, 12).setValue(data.approvedBy || '');
      sheet.getRange(i + 1, 13).setValue(now);
      return { success: true };
    }
  }
  return { success: false, error: 'לא נמצא רשומה עם מזהה זמני: ' + data.tempId };
}

// ==================== מדפסות 2027 ====================

function getPrinters2027Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('מדפסות 2027');
  if (!sheet) {
    sheet = ss.insertSheet('מדפסות 2027');
    sheet.appendRow(['מזהה','אגף','מחלקה','שם','מבנה','סוג_מדפסת','אושר','הערה','מגיש','תאריך',
      'שם_מתוקן','מבנה_מתוקן','סוג_מתוקן','תוקן_ע"י','תאריך_תיקון']);
    sheet.getRange(1, 1, 1, 15).setFontWeight('bold');
  } else {
    // הוסף עמודות תיקון אם חסרות
    var lastCol = sheet.getLastColumn();
    if (lastCol < 15) {
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var corrHeaders = ['שם_מתוקן','מבנה_מתוקן','סוג_מתוקן','תוקן_ע"י','תאריך_תיקון'];
      for (var ci = 0; ci < corrHeaders.length; ci++) {
        if (lastCol + ci < 10 || headers.indexOf(corrHeaders[ci]) === -1) {
          sheet.getRange(1, 11 + ci).setValue(corrHeaders[ci]);
          sheet.getRange(1, 11 + ci).setFontWeight('bold');
        }
      }
    }
  }
  return sheet;
}

function listPrinters2027() {
  var sheet = getPrinters2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[0] === '' && r[0] !== 0) continue;
    var status = String(r[6] || '');
    var isConfirmed = status === 'אושר' || status.toUpperCase() === 'TRUE';
    var isRejected  = status === 'לא נכון';
    items.push({
      id:               String(r[0]),
      confirmed:        isConfirmed,
      rejected:         isRejected,
      note:             String(r[7] || ''),
      submittedBy:      String(r[8] || ''),
      date:             String(r[9] || ''),
      correctedName:    String(r.length > 10 ? r[10] || '' : ''),
      correctedBuilding:String(r.length > 11 ? r[11] || '' : ''),
      correctedType:    String(r.length > 12 ? r[12] || '' : ''),
      correctedBy:      String(r.length > 13 ? r[13] || '' : ''),
      correctedDate:    String(r.length > 14 ? r[14] || '' : '')
    });
  }
  return { success: true, items: items };
}

function savePrinterConfirmation(data) {
  var sheet = getPrinters2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var idStr = String(data.id);
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === idStr) {
      sheet.getRange(i + 1, 2).setValue(data.wing     || rows[i][1] || '');
      sheet.getRange(i + 1, 3).setValue(data.dept     || rows[i][2] || '');
      sheet.getRange(i + 1, 4).setValue(data.name     || rows[i][3] || '');
      sheet.getRange(i + 1, 5).setValue(data.building || rows[i][4] || '');
      sheet.getRange(i + 1, 6).setValue(data.type     || rows[i][5] || '');
      sheet.getRange(i + 1, 7).setValue(data.confirmed ? 'אושר' : (data.rejected ? 'לא נכון' : ''));
      sheet.getRange(i + 1, 8).setValue(data.note || '');
      sheet.getRange(i + 1, 9).setValue(data.submittedBy || '');
      sheet.getRange(i + 1, 10).setValue(now);
      return { success: true };
    }
  }
  sheet.appendRow([
    idStr,
    data.wing || '', data.dept || '', data.name || '', data.building || '', data.type || '',
    data.confirmed ? 'אושר' : (data.rejected ? 'לא נכון' : ''), data.note || '', data.submittedBy || '', now
  ]);
  return { success: true };
}

function saveItCorrection(data) {
  var sheet = getPrinters2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var idStr = String(data.id);
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === idStr) {
      sheet.getRange(i + 1, 11).setValue(data.correctedName     || '');
      sheet.getRange(i + 1, 12).setValue(data.correctedBuilding || '');
      sheet.getRange(i + 1, 13).setValue(data.correctedType     || '');
      sheet.getRange(i + 1, 14).setValue(data.correctedBy       || '');
      sheet.getRange(i + 1, 15).setValue(now);
      return { success: true };
    }
  }
  return { success: false, error: 'מזהה לא נמצא: ' + idStr };
}

// ==================== רכבים 2027 ====================

function getVehicles2027Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('רכבים 2027');
  if (!sheet) {
    sheet = ss.insertSheet('רכבים 2027');
    sheet.appendRow(['מס_רישוי','אגף','מחלקה','הנהג','סוג_רכב','קטגוריה','שנת_יצור','טסט','אושר','הערה','מגיש','תאריך',
      'הנהג_מתוקן','סוג_מתוקן','תוקן_ע"י','תאריך_תיקון']);
    sheet.getRange(1, 1, 1, 16).setFontWeight('bold');
  } else {
    var lastCol = sheet.getLastColumn();
    if (lastCol < 16) {
      var corrHeaders = ['הנהג_מתוקן','סוג_מתוקן','תוקן_ע"י','תאריך_תיקון'];
      for (var ci = 0; ci < corrHeaders.length; ci++) {
        if (lastCol + ci < 12) continue;
        sheet.getRange(1, 13 + ci).setValue(corrHeaders[ci]);
        sheet.getRange(1, 13 + ci).setFontWeight('bold');
      }
    }
  }
  return sheet;
}

function listVehicles2027() {
  var sheet = getVehicles2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[0] === '' && r[0] !== 0) continue;
    var status = String(r[8] || '');
    var isConfirmed = status === 'אושר' || status.toUpperCase() === 'TRUE';
    var isRejected  = status === 'לא נכון';
    items.push({
      id:               String(r[0]),
      confirmed:        isConfirmed,
      rejected:         isRejected,
      note:             String(r[9]  || ''),
      submittedBy:      String(r[10] || ''),
      date:             String(r[11] || ''),
      correctedDriver:  String(r.length > 12 ? r[12] || '' : ''),
      correctedType:    String(r.length > 13 ? r[13] || '' : ''),
      correctedBy:      String(r.length > 14 ? r[14] || '' : ''),
      correctedDate:    String(r.length > 15 ? r[15] || '' : '')
    });
  }
  return { success: true, items: items };
}

function saveVehicleConfirmation(data) {
  var sheet = getVehicles2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var idStr = String(data.id);
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === idStr) {
      sheet.getRange(i + 1, 2).setValue(data.wing        || rows[i][1] || '');
      sheet.getRange(i + 1, 3).setValue(data.dept        || rows[i][2] || '');
      sheet.getRange(i + 1, 4).setValue(data.driver      || rows[i][3] || '');
      sheet.getRange(i + 1, 5).setValue(data.vehicleType || rows[i][4] || '');
      sheet.getRange(i + 1, 6).setValue(data.category    || rows[i][5] || '');
      sheet.getRange(i + 1, 7).setValue(data.year        || rows[i][6] || '');
      sheet.getRange(i + 1, 8).setValue(data.test        || rows[i][7] || '');
      sheet.getRange(i + 1, 9).setValue(data.confirmed ? 'אושר' : (data.rejected ? 'לא נכון' : ''));
      sheet.getRange(i + 1, 10).setValue(data.note || '');
      sheet.getRange(i + 1, 11).setValue(data.submittedBy || '');
      sheet.getRange(i + 1, 12).setValue(now);
      return { success: true };
    }
  }
  sheet.appendRow([
    idStr,
    data.wing || '', data.dept || '', data.driver || '', data.vehicleType || '', data.category || '', data.year || '', data.test || '',
    data.confirmed ? 'אושר' : (data.rejected ? 'לא נכון' : ''), data.note || '', data.submittedBy || '', now
  ]);
  return { success: true };
}

function saveVehicleManagerCorrection(data) {
  var sheet = getVehicles2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var idStr = String(data.id);
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === idStr) {
      sheet.getRange(i + 1, 13).setValue(data.correctedDriver || '');
      sheet.getRange(i + 1, 14).setValue(data.correctedType   || '');
      sheet.getRange(i + 1, 15).setValue(data.correctedBy     || '');
      sheet.getRange(i + 1, 16).setValue(now);
      return { success: true };
    }
  }
  return { success: false, error: 'מזהה לא נמצא: ' + idStr };
}

// ==================== תכנית עבודה 2027 ====================

function getWorkplan2027Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('תכנית עבודה 2027');
  if (!sheet) {
    sheet = ss.insertSheet('תכנית עבודה 2027');
    sheet.appendRow(['id','wing','dept','goalLink','successTarget','activity','task','deadline','estimatedValue','budgetItemId','budgetItemName','budgetItemType','submittedBy','date','sourcePrevYear','prevYearId']);
    sheet.getRange(1, 1, 1, 16).setFontWeight('bold');
  }
  return sheet;
}

function generateWp2027Id() {
  var sheet = getWorkplan2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][0]);
    if (id.indexOf('WP27-') === 0) {
      var num = parseInt(id.replace('WP27-', ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  var next = max + 1;
  return 'WP27-' + (next < 10 ? '00' + next : next < 100 ? '0' + next : String(next));
}

function listWorkplan2027() {
  var sheet = getWorkplan2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var tasks = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    tasks.push({
      id:             String(r[0]),
      wing:           String(r[1] || ''),
      dept:           String(r[2] || ''),
      goalLink:       String(r[3] || ''),
      successTarget:  String(r[4] || ''),
      activity:       String(r[5] || ''),
      task:           String(r[6] || ''),
      deadline:       String(r[7] || ''),
      estimatedValue: parseFloat(r[8]) || 0,
      budgetItemId:   String(r[9] || ''),
      budgetItemName: String(r[10] || ''),
      budgetItemType: String(r[11] || ''),
      submittedBy:    String(r[12] || ''),
      date:           String(r[13] || ''),
      sourcePrevYear: String(r[14] || '').toUpperCase() === 'TRUE',
      prevYearId:     String(r[15] || '')
    });
  }
  return { success: true, tasks: tasks };
}

function saveWorkplan2027Task(data) {
  var sheet = getWorkplan2027Sheet();
  var rows = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var deadline = data.deadline ? String(data.deadline) : '';
  if (data.id && data.id !== '' && data.id !== 'new') {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        sheet.getRange(i + 1, 2).setValue(data.wing || '');
        sheet.getRange(i + 1, 3).setValue(data.dept || '');
        sheet.getRange(i + 1, 4).setValue(data.goalLink || '');
        sheet.getRange(i + 1, 5).setValue(data.successTarget || '');
        sheet.getRange(i + 1, 6).setValue(data.activity || '');
        sheet.getRange(i + 1, 7).setValue(data.task || '');
        sheet.getRange(i + 1, 8).setValue(deadline);
        sheet.getRange(i + 1, 9).setValue(parseFloat(data.estimatedValue) || 0);
        sheet.getRange(i + 1, 10).setValue(data.budgetItemId || '');
        sheet.getRange(i + 1, 11).setValue(data.budgetItemName || '');
        sheet.getRange(i + 1, 12).setValue(data.budgetItemType || '');
        sheet.getRange(i + 1, 13).setValue(data.submittedBy || '');
        return { success: true };
      }
    }
  }
  var id = generateWp2027Id();
  sheet.appendRow([id, data.wing||'', data.dept||'', data.goalLink||'', data.successTarget||'',
    data.activity||'', data.task||'', deadline,
    parseFloat(data.estimatedValue)||0, data.budgetItemId||'', data.budgetItemName||'', data.budgetItemType||'',
    data.submittedBy||'', now, data.sourcePrevYear ? 'TRUE' : 'FALSE', data.prevYearId||'']);
  return { success: true, id: id };
}

function deleteWorkplan2027Task(data) {
  var sheet = getWorkplan2027Sheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'לא נמצא: ' + data.id };
}

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : '';
    if (action === 'debug')          return jsonResponse({ count: getUsersData().length, users: getUsersData().map(function(u) { return {user:u.username,pass:String(u.password),passType:typeof u.password,active:u.active}; }) });
    if (action === 'login')          return jsonResponse(loginUser(e.parameter.username, e.parameter.password));
    if (action === 'listUsers')      return jsonResponse(listUsers());
    if (action === 'listComplaints') return jsonResponse(listComplaints());
    if (action === 'listTabar')      return jsonResponse(listTabar());
    if (action === 'listBudget2027')         return jsonResponse(listBudget2027());
    if (action === 'listNameChangeRequests') return jsonResponse(listNameChangeRequests());
    if (action === 'listNewItemRequests')    return jsonResponse(listNewItemRequests());
    if (action === 'listPrinters2027')       return jsonResponse(listPrinters2027());
    if (action === 'listVehicles2027')       return jsonResponse(listVehicles2027());
    if (action === 'listWorkplan2027')       return jsonResponse(listWorkplan2027());
    return jsonResponse(getWorkplanLiveData());
  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    if (action === 'uploadExecution')      return jsonResponse(uploadExecution(payload));
    if (action === 'addUser')              return jsonResponse(addUser(payload));
    if (action === 'updateUser')           return jsonResponse(updateUser(payload));
    if (action === 'deactivateUser')       return jsonResponse(deactivateUser(payload));
    if (action === 'uploadComplaintImage') return jsonResponse(uploadComplaintImage(payload));
    if (action === 'addComplaint')         return jsonResponse(addComplaint(payload));
    if (action === 'updateComplaint')      return jsonResponse(updateComplaint(payload));
    if (action === 'savePirut2027')           return jsonResponse(savePirut2027(payload));
    if (action === 'saveNameChangeRequest')   return jsonResponse(saveNameChangeRequest(payload));
    if (action === 'saveNewItemRequest')      return jsonResponse(saveNewItemRequest(payload));
    if (action === 'approveNewItem')          return jsonResponse(approveNewItem(payload));
    if (action === 'savePrinterConfirmation')      return jsonResponse(savePrinterConfirmation(payload));
    if (action === 'saveItCorrection')             return jsonResponse(saveItCorrection(payload));
    if (action === 'saveVehicleConfirmation')      return jsonResponse(saveVehicleConfirmation(payload));
    if (action === 'saveVehicleManagerCorrection') return jsonResponse(saveVehicleManagerCorrection(payload));
    if (action === 'saveWorkplan2027Task')   return jsonResponse(saveWorkplan2027Task(payload));
    if (action === 'deleteWorkplan2027Task') return jsonResponse(deleteWorkplan2027Task(payload));
    if (action === 'batchUpdate') {
      var sheet = getWorkplanSheet();
      var data = sheet.getDataRange().getValues();
      payload.changes.forEach(function(change) { updateSingleTask(sheet, data, change); });
      return jsonResponse({ success: true });
    }
    var sheet2 = getWorkplanSheet();
    var data2 = sheet2.getDataRange().getValues();
    var success = updateSingleTask(sheet2, data2, payload);
    return jsonResponse({ success: success, error: success ? undefined : 'ID Not Found' });
  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ==================== כלים ====================

function setupWeeklyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendWeeklyAlerts') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('sendWeeklyAlerts').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).create();
}

function testMyEmail() {
  MailApp.sendEmail({ to: 'aharony@omer.muni.il', subject: 'טסט: התראת פורטל מועצת עומר', htmlBody: '<div dir="rtl">בדיקה</div>', name: 'מועצת עומר', replyTo: 'omerbudget@gmail.com' });
}

function debugLogin() {
  var users = getUsersData();
  Logger.log('סה"כ משתמשים: ' + users.length);
  users.forEach(function(u) {
    Logger.log('user=' + u.username + ' | pass=' + u.password + ' | active=' + u.active);
  });
}

function loadStaticBudgetJson() {
  try {
    var url = "https://omerbudget.netlify.app/budget_data.json";
    var response = UrlFetchApp.fetch(url);
    var items = JSON.parse(response.getContentText());
    var map = {};
    items.forEach(function(item) {
      var id = String(item.id || "").trim().split(".")[0];
      if (id) map[id] = item;
    });
    Logger.log("budget_data.json: " + Object.keys(map).length + " פריטים");
    return map;
  } catch(e) {
    Logger.log("שגיאה בטעינת budget_data.json: " + e.message);
    return {};
  }
}

function getBudgetExceptions(executionData) {
  var staticMap = loadStaticBudgetJson();
  if (Object.keys(staticMap).length === 0) {
    Logger.log("לא ניתן לחשב חריגות — יש לאשר הרשאות UrlFetchApp (ריצה ראשונה מהעורך)");
    return [];
  }
  var exceptions = [];
  executionData.forEach(function(item) {
    var itemId = String(item["id"] || "").trim().split(".")[0];
    var staticItem = staticMap[itemId];
    if (!staticItem) return;
    var b2026       = cleanNum(staticItem.b2026 || 0);
    var a2026       = Math.abs(cleanNum(item["a2026"]             || 0));
    var commit      = Math.abs(cleanNum(item["total_commit_2026"] || 0));
    var totalCommit = a2026 + commit;
    var type        = String(staticItem.type || "הוצאה").trim();
    if (b2026 === 0) return;
    var balance = b2026 - totalCommit;
    if ((sameStr(type, "הוצאה") && balance < 0) || (sameStr(type, "הכנסה") && balance > 0)) {
      exceptions.push(Object.assign({}, item, {
        _b2026: b2026,
        _total: totalCommit,
        _type:  type,
        _wing:  String(staticItem.wing || item["אגף"]   || "").trim(),
        _dept:  String(staticItem.dept || item["מחלקה"] || "").trim(),
        _name:  String(staticItem.name || item["שם"]    || "").trim()
      }));
    }
  });
  Logger.log("חריגות תקציב: " + exceptions.length);
  return exceptions;
}

function buildWeeklyAlertHtml(exceptions, overdue, user) {
  var name = String(user.fullName || user.username || "");
  var tz   = Session.getScriptTimeZone();
  var html = '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;padding:20px;color:#1f2937">';
  html += '<h2 style="color:#1e3a8a;text-align:center;margin-bottom:16px">התראות שבועיות — פורטל תקציב עומר</h2>';
  if (name) html += '<p>שלום ' + name + ',</p>';
  if (exceptions.length === 0 && overdue.length === 0) {
    html += '<p style="color:#16a34a;text-align:center">אין התראות לשבוע זה</p>';
  }
  if (exceptions.length > 0) {
    html += '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px">';
    html += '<h3 style="color:#dc2626;margin:0 0 12px 0">חריגות תקציב (' + exceptions.length + ')</h3>';
    var eMap = {};
    exceptions.forEach(function(item) {
      var w = item._wing || "כללי"; var d = item._dept || "כללי";
      if (!eMap[w]) eMap[w] = {}; if (!eMap[w][d]) eMap[w][d] = [];
      eMap[w][d].push(item);
    });
    Object.keys(eMap).forEach(function(wing) {
      html += '<div style="font-weight:bold;color:#7f1d1d;margin:10px 0 4px 0">אגף: ' + wing + '</div>';
      Object.keys(eMap[wing]).forEach(function(dept) {
        html += '<div style="margin-right:12px;margin-bottom:8px"><div style="font-weight:bold;color:#991b1b;margin-bottom:4px">מחלקה: ' + dept + '</div><ul style="margin:0;padding-right:20px">';
        eMap[wing][dept].forEach(function(item) {
          html += '<li style="margin-bottom:4px">' + item._name + ' — תקציב: ₪' + Math.round(item._b2026).toLocaleString() + ' | ביצוע+שריון: <span style="color:#dc2626;font-weight:bold">₪' + Math.round(item._total).toLocaleString() + '</span></li>';
        });
        html += '</ul></div>';
      });
    });
    html += '</div>';
  }
  if (overdue.length > 0) {
    html += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:20px">';
    html += '<h3 style="color:#b45309;margin:0 0 12px 0">משימות שעבר תאריך היעד שלהן (' + overdue.length + ')</h3>';
    var wMap = {};
    overdue.forEach(function(task) {
      var w = task.wing || "כללי"; var d = task.dept || "כללי";
      if (!wMap[w]) wMap[w] = {}; if (!wMap[w][d]) wMap[w][d] = [];
      wMap[w][d].push(task);
    });
    Object.keys(wMap).forEach(function(wing) {
      html += '<div style="font-weight:bold;color:#78350f;margin:10px 0 4px 0">אגף: ' + wing + '</div>';
      Object.keys(wMap[wing]).forEach(function(dept) {
        html += '<div style="margin-right:12px;margin-bottom:8px"><div style="font-weight:bold;color:#92400e;margin-bottom:4px">מחלקה: ' + dept + '</div><ul style="margin:0;padding-right:20px">';
        wMap[wing][dept].forEach(function(task) {
          html += '<li style="margin-bottom:6px">' + task.activity + '<br><span style="font-size:13px;color:#4b5563">' + task.task + '</span> <span style="color:#dc2626">(יעד: ' + Utilities.formatDate(task.deadline, tz, "dd/MM/yyyy") + ')</span></li>';
        });
        html += '</ul></div>';
      });
    });
    html += '</div>';
  }
  html += '<hr style="margin-top:20px"><p style="color:#9ca3af;font-size:12px;text-align:center">נשלח אוטומטית מפורטל תקציב עומר</p></div>';
  return html;
}
