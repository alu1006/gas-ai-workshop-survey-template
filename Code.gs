var SURVEY_PHASE = 'PRE';
var COURSE_SHEET_NAME = '課程設定';
var RESPONSE_SHEET_NAME = '問卷回覆';
var COURSE_HEADERS = ['課程代碼', '課程名稱', '問卷階段', '開放狀態', '說明'];
var DEFAULT_COURSE = ['AI001', 'AI 學習輔助研習', 'PRE', '開放', 'AI 工具與提示詞實作'];
var RESPONSE_HEADERS = [
  '填寫時間', '課程代碼', '課程名稱', '階段', '登入信箱', '聯絡信箱', '身份', '科別', '年級／姓名',
  '班級', '姓名／學號', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'
];
var POST_RESPONSE_HEADERS = [
  'P1', 'P2', 'P3', 'P4', 'C1', 'C2', 'C3', 'C4', 'K1', 'K2', 'K3', 'K4',
  'R1', 'R2', '未來主題', '其他主題', '收穫內容', '改進建議', '想參加主題'
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
    sections: [
      { code: 'P', title: 'P－教學法與活動設計', questions: [
        '講師的說明清楚、容易理解。', '教學方式能引起我的注意與參與。',
        '活動、示範或討論有助於理解內容。', '課程時間與進度安排合適。'
      ]},
      { code: 'C', title: 'C－課程內容', questions: [
        '本次主題符合我的需求或興趣。', '課程內容充實且難度適當。',
        '課程內容具有實用性。', '我希望繼續了解相關主題。'
      ]},
      { code: 'K', title: 'K－新興科技知識與收穫', questions: [
        '我對本次介紹的新興科技有更深入的認識。', '我能說明這項新興科技的基本概念或用途。',
        '我能辨識新興科技可能帶來的機會與風險。', '我願意把所學應用在學習、教學或生活中。'
      ]}
    ],
    roleQuestions: {
      teacher: ['內容對我的教學或專業成長有幫助。', '我有信心把所學運用在課堂或工作中。'],
      student: ['活動方式能幫助我理解內容。', '課程難度適合我。']
    },
    topicOptions: ['生成式 AI', 'AR/VR', '物聯網', '機器人', '資安'],
    feedbackQuestions: ['今天最有收穫的內容是什麼？', '有哪些地方可以改進？', '還想參加哪些主題？']
  }
};

function surveyConfigForPhase_(phase) {
  var content = SURVEY_CONTENT[phase];
  if (!content) throw new Error('問卷階段設定錯誤。');
  var config = {
    phase: phase, phaseDisplay: content.phaseDisplay, badge: content.badge,
    title: content.title, description: content.description
  };
  if (phase === 'PRE') {
    config.questions = content.questions.slice();
    config.q7 = content.q7;
    config.q8 = content.q8;
  } else {
    config.sections = content.sections.map(function (section) {
      return { code: section.code, title: section.title, questions: section.questions.slice() };
    });
    config.roleQuestions = {
      teacher: content.roleQuestions.teacher.slice(), student: content.roleQuestions.student.slice()
    };
    config.topicOptions = content.topicOptions.slice();
    config.feedbackQuestions = content.feedbackQuestions.slice();
  }
  return config;
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
  if (cleanText_(headers[4]) === '登入信箱' && cleanText_(headers[5]) === '身份') {
    responseSheet.insertColumnAfter(5);
    responseSheet.getRange(1, 6, 1, 1).setValues([['聯絡信箱']]);
  } else if (cleanText_(headers[5]) !== '聯絡信箱') {
    throw new Error('問卷回覆欄位格式不符，請檢查標題列。');
  }
  var current = responseSheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).getValues()[0];
  for (var i = 0; i < RESPONSE_HEADERS.length; i += 1) {
    if (cleanText_(current[i]) !== RESPONSE_HEADERS[i]) throw new Error('問卷回覆欄位格式不符，請檢查標題列。');
  }
  var requiredColumns = RESPONSE_HEADERS.length + POST_RESPONSE_HEADERS.length;
  if (responseSheet.getMaxColumns() < requiredColumns) {
    responseSheet.insertColumnsAfter(responseSheet.getMaxColumns(), requiredColumns - responseSheet.getMaxColumns());
  }
  var extra = responseSheet.getRange(1, RESPONSE_HEADERS.length + 1, 1, POST_RESPONSE_HEADERS.length).getValues()[0];
  var missing = extra.every(function (value) { return !cleanText_(value); });
  if (missing) responseSheet.getRange(1, RESPONSE_HEADERS.length + 1, 1, POST_RESPONSE_HEADERS.length).setValues([POST_RESPONSE_HEADERS]);
  else for (var j = 0; j < POST_RESPONSE_HEADERS.length; j += 1) {
    if (cleanText_(extra[j]) !== POST_RESPONSE_HEADERS[j]) throw new Error('問卷回覆欄位格式不符，請檢查標題列。');
  }
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

function validateSubmission_(data, email, phase) {
  if (!data || !cleanText_(email)) throw new UserFacingError_('無法取得登入信箱，請使用校內帳號重新登入。');
  if (data.role !== 'teacher' && data.role !== 'student') throw new UserFacingError_('請選擇身份。');
  if (!cleanText_(data.info1) || !cleanText_(data.info2)) throw new UserFacingError_('請完整填寫基本資料。');
  if (data.role === 'student' && (!cleanText_(data.info3) || !cleanText_(data.info4))) throw new UserFacingError_('請完整填寫學生資料。');
  if (phase === 'POST') {
    ['P','C','K'].forEach(function (prefix) {
      for (var i = 1; i <= 4; i += 1) validateScore_(data, prefix + i);
    });
    validateScore_(data, 'R1');
    validateScore_(data, 'R2');
    var topics = Array.isArray(data.futureTopics) ? data.futureTopics : [];
    topics.forEach(function (topic) {
      if (SURVEY_CONTENT.POST.topicOptions.indexOf(cleanText_(topic)) === -1) throw new UserFacingError_('未來主題選項不正確。');
    });
  } else {
    for (var i = 1; i <= 6; i += 1) validateScore_(data, 'Q' + i);
    if (!cleanText_(data.Q7)) throw new UserFacingError_('請填寫 Q7。');
  }
  normalizeContactEmail_(data.contactEmail);
}

function validateScore_(data, key) {
  var score = Number(data[key]);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new UserFacingError_(key + ' 請選擇 1 到 5 的分數。');
}

function buildRow_(data, email, course) {
  var isTeacher = data.role === 'teacher';
  var row = [
    new Date(), course.code, course.name, course.phase === 'PRE' ? '前測' : '後測',
    cleanText_(email).toLowerCase(), normalizeContactEmail_(data.contactEmail),
    isTeacher ? '教師' : '學生', cleanText_(data.info1), cleanText_(data.info2),
    isTeacher ? '' : cleanText_(data.info3), isTeacher ? '' : cleanText_(data.info4),
    '', '', '', '', '', '', '', ''
  ];
  if (course.phase === 'PRE') {
    row.splice(11, 8, Number(data.Q1), Number(data.Q2), Number(data.Q3), Number(data.Q4), Number(data.Q5), Number(data.Q6), cleanText_(data.Q7), cleanText_(data.Q8));
    return row.concat(POST_RESPONSE_HEADERS.map(function () { return ''; }));
  }
  ['P','C','K'].forEach(function (prefix) {
    for (var i = 1; i <= 4; i += 1) row.push(Number(data[prefix + i]));
  });
  row.push(Number(data.R1), Number(data.R2));
  row.push((Array.isArray(data.futureTopics) ? data.futureTopics : []).map(cleanText_).filter(Boolean).join('｜'));
  row.push(cleanText_(data.otherTopic), cleanText_(data.feedback1), cleanText_(data.feedback2), cleanText_(data.feedback3));
  return row;
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
    validateSubmission_(data, email, course.phase);
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
