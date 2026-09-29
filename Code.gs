var SURVEY_PHASE = 'PRE';
var COURSE_SHEET_NAME = '課程設定';
var RESPONSE_SHEET_NAME = '問卷回覆';
var COURSE_HEADERS = ['課程代碼', '課程名稱', '問卷階段', '開放狀態', '說明'];
var DEFAULT_COURSE = ['AI001', 'AI 學習輔助研習', 'PRE', '開放', 'AI 工具與提示詞實作'];
var RESPONSE_HEADERS = [
  '填寫時間', '課程代碼', '課程名稱', '階段', '登入信箱', '聯絡信箱', '身份', '科別', '年級／姓名',
  '班級', '姓名／學號', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'
];

var SURVEY_CONTENT = {
  PRE: {
    phaseDisplay: '研習前測', badge: '研習前測 · PRE', title: '課前期待調查',
    description: '了解你對本次研習的期待與需求，約 3 分鐘完成。',
    questions: [
      '我期待透過本次研習，更了解 AI 學習輔助工具的功能與應用方式。',
      '我期待學會實際操作 AI 工具，並能完成基本任務。',
      '我期待學會如何向 AI 清楚提問，以取得更符合需求的回答。',
      '我期待能把 AI 應用在未來的教學或學習活動中。',
      '我期待 AI 能協助我提升備課、工作或學習的效率。',
      '我期待了解使用 AI 時應注意的正確性、倫理與資訊安全。'
    ],
    q7: '本次研習中，你最期待學到什麼？',
    q8: '目前你最希望運用 AI 解決什麼問題？'
  },
  POST: {
    phaseDisplay: '研習後測', badge: '研習後測 · POST', title: '課後成果回饋',
    description: '請依本次研習的實際體驗填答，約 3 分鐘完成。',
    questions: [
      '透過本次研習，我更了解 AI 學習輔助工具的功能與應用方式。',
      '透過本次研習，我已學會操作 AI 工具並完成基本任務。',
      '透過本次研習，我更能向 AI 清楚提問並取得符合需求的回答。',
      '研習後，我有信心把 AI 應用在未來的教學或學習活動中。',
      '研習後，我認為 AI 能協助我提升備課、工作或學習的效率。',
      '透過本次研習，我更了解使用 AI 時應注意的正確性、倫理與資訊安全。'
    ],
    q7: '本次研習中，對你最有幫助的內容是什麼？',
    q8: '請分享研習心得、建議，或仍想進一步了解的內容。'
  }
};

function surveyConfigForPhase_(phase) {
  var content = SURVEY_CONTENT[phase];
  if (!content) throw new Error('問卷階段設定錯誤。');
  return {
    phase: phase, phaseDisplay: content.phaseDisplay, badge: content.badge,
    title: content.title, description: content.description,
    questions: content.questions.slice(), q7: content.q7, q8: content.q8
  };
}

function getSurveyConfig_() { return surveyConfigForPhase_(SURVEY_PHASE); }

function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
  template.surveyConfigJson = JSON.stringify(getSurveyConfig_()).replace(/</g, '\\u003c');
  return template.evaluate()
    .setTitle('中壢高商 AI 學習輔助研習')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function cleanText_(value) { return String(value == null ? '' : value).trim(); }
function UserFacingError_(message) { var error = new Error(message); error.name = 'UserFacingError'; return error; }

function ensureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function nextCourseNumber_(rows) {
  return rows.reduce(function (max, row) {
    var match = cleanText_(row[0]).match(/^AI(\d{3})$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
}

function formatCourseCode_(number) {
  return 'AI' + String(number).padStart(3, '0');
}

function maintainCourseSettings_(courseSheet) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    var lastRow = courseSheet.getLastRow();
    var rows = lastRow < 2 ? [] : courseSheet.getRange(2, 1, lastRow - 1, COURSE_HEADERS.length).getValues();
    var usedCodes = {};
    rows.forEach(function (row) {
      var code = cleanText_(row[0]);
      if (code) usedCodes[code] = true;
    });
    var nextNumber = nextCourseNumber_(rows);
    rows.forEach(function (row, index) {
      if (cleanText_(row[0]) || !cleanText_(row[1])) return;
      var code = formatCourseCode_(nextNumber);
      while (usedCodes[code]) {
        nextNumber += 1;
        code = formatCourseCode_(nextNumber);
      }
      courseSheet.getRange(index + 2, 1, 1, 1).setValues([[code]]);
      row[0] = code;
      usedCodes[code] = true;
      nextNumber += 1;
    });

    var phaseRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['PRE', 'POST'], true)
      .setAllowInvalid(false)
      .setHelpText('請選擇 PRE 或 POST。')
      .build();
    courseSheet.getRange(2, 3, Math.max(courseSheet.getMaxRows() - 1, 1), 1)
      .setDataValidation(phaseRule);

    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['開放', '關閉'], true)
      .setAllowInvalid(false)
      .setHelpText('請選擇開放或關閉。')
      .build();
    courseSheet.getRange(2, 4, Math.max(courseSheet.getMaxRows() - 1, 1), 1)
      .setDataValidation(statusRule);
  } finally {
    lock.releaseLock();
  }
}

function maintainResponseSheet_(responseSheet) {
  if (responseSheet.getLastRow() === 0) return;
  var headers = responseSheet.getRange(1, 1, 1, 6).getValues()[0];
  if (cleanText_(headers[5]) === '聯絡信箱') return;
  if (cleanText_(headers[4]) === '登入信箱' && cleanText_(headers[5]) === '身份') {
    responseSheet.insertColumnAfter(5);
    responseSheet.getRange(1, 6, 1, 1).setValues([['聯絡信箱']]);
    return;
  }
  throw new Error('問卷回覆欄位格式不符，請檢查標題列。');
}

function ensureSurveySheets_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var courseSheet = ensureSheet_(spreadsheet, COURSE_SHEET_NAME, COURSE_HEADERS);
  if (courseSheet.getLastRow() === 1) courseSheet.appendRow(DEFAULT_COURSE.slice());
  maintainCourseSettings_(courseSheet);
  var responseSheet = ensureSheet_(spreadsheet, RESPONSE_SHEET_NAME, RESPONSE_HEADERS);
  maintainResponseSheet_(responseSheet);
  return { courseSheet: courseSheet, responseSheet: responseSheet };
}

function normalizeCourse_(row) {
  var code = cleanText_(row[0]);
  var name = cleanText_(row[1]);
  var phase = cleanText_(row[2]).toUpperCase();
  var status = cleanText_(row[3]);
  if (!code || !name || !SURVEY_CONTENT[phase] || (status !== '開放' && status !== '關閉')) return null;
  var course = surveyConfigForPhase_(phase);
  course.code = code;
  course.name = name;
  course.status = status;
  course.courseDescription = cleanText_(row[4]);
  return course;
}

function readCourses_() {
  var sheet = ensureSurveySheets_().courseSheet;
  var lastRow = sheet.getLastRow();
  return lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, COURSE_HEADERS.length).getValues();
}

function getOpenCourses() {
  var rows = readCourses_();
  var seen = {};
  var courses = [];
  rows.forEach(function (row) {
    var course = normalizeCourse_(row);
    if (!course || seen[course.code]) return;
    seen[course.code] = true;
    if (course.status === '開放') courses.push(course);
  });
  return courses;
}

function findOpenCourse_(courseCode) {
  var wanted = cleanText_(courseCode);
  var rows = readCourses_();
  for (var i = 0; i < rows.length; i += 1) {
    var course = normalizeCourse_(rows[i]);
    if (course && course.code === wanted) {
      if (course.status !== '開放') break;
      return course;
    }
  }
  throw new UserFacingError_('此課程目前未開放填答。');
}

function normalizeContactEmail_(value) {
  var email = cleanText_(value).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserFacingError_('聯絡信箱格式不正確。');
  }
  return email;
}

function validateSubmission_(data, email) {
  if (!data || !cleanText_(email)) throw new UserFacingError_('無法取得登入信箱，請使用校內帳號重新登入。');
  if (data.role !== 'teacher' && data.role !== 'student') throw new UserFacingError_('請選擇身份。');
  if (!cleanText_(data.info1) || !cleanText_(data.info2)) throw new UserFacingError_('請完整填寫基本資料。');
  if (data.role === 'student' && (!cleanText_(data.info3) || !cleanText_(data.info4))) throw new UserFacingError_('請完整填寫學生資料。');
  for (var i = 1; i <= 6; i += 1) {
    var score = Number(data['Q' + i]);
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new UserFacingError_('Q' + i + ' 請選擇 1 到 5 的分數。');
  }
  if (!cleanText_(data.Q7)) throw new UserFacingError_('請填寫 Q7。');
  normalizeContactEmail_(data.contactEmail);
}

function buildRow_(data, email, course) {
  var isTeacher = data.role === 'teacher';
  return [
    new Date(), course.code, course.name, course.phase === 'PRE' ? '前測' : '後測',
    cleanText_(email).toLowerCase(), normalizeContactEmail_(data.contactEmail),
    isTeacher ? '教師' : '學生', cleanText_(data.info1), cleanText_(data.info2),
    isTeacher ? '' : cleanText_(data.info3), isTeacher ? '' : cleanText_(data.info4),
    Number(data.Q1), Number(data.Q2), Number(data.Q3), Number(data.Q4), Number(data.Q5), Number(data.Q6),
    cleanText_(data.Q7), cleanText_(data.Q8)
  ];
}

function findExistingRow_(sheet, email, courseCode, phaseDisplay) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, 2, lastRow - 1, 4).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (cleanText_(values[i][0]) === courseCode && cleanText_(values[i][2]) === phaseDisplay &&
        cleanText_(values[i][3]).toLowerCase() === email.toLowerCase()) return i + 2;
  }
  return 0;
}

function submitSurvey(data) {
  try {
    var sheets = ensureSurveySheets_();
    var course = findOpenCourse_(data && data.courseCode);
    var email = Session.getActiveUser().getEmail();
    validateSubmission_(data, email);
    var row = buildRow_(data, email, course);
    var existingRow = findExistingRow_(sheets.responseSheet, cleanText_(email), course.code, row[3]);
    if (existingRow) {
      sheets.responseSheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
      return { status: 'success', action: 'updated' };
    }
    sheets.responseSheet.appendRow(row);
    return { status: 'success', action: 'created' };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: error && error.name === 'UserFacingError' ? error.message : '資料送出失敗，請稍後再試。' };
  }
}
