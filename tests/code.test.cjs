const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCode(overrides = {}) {
  const sandbox = {
    console,
    Date,
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ...overrides,
  };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
  vm.runInContext(source, sandbox, { filename: 'Code.gs' });
  return sandbox;
}

test('survey phase is a trusted PRE or POST server setting', () => {
  const app = loadCode();
  assert.match(app.SURVEY_PHASE, /^(PRE|POST)$/);
});

test('getSurveyConfig returns PRE copy and questions', () => {
  const app = loadCode();
  const config = app.getSurveyConfig_();
  assert.equal(config.phase, 'PRE');
  assert.equal(config.phaseDisplay, '研習前測');
  assert.equal(config.title, '課前期待調查');
  assert.equal(config.questions.length, 6);
  assert.match(config.questions[0], /我期待/);
  assert.match(config.q7, /最期待學到什麼/);
});

test('POST config exposes P C K role topics and optional feedback', () => {
  const app = loadCode();
  const config = app.surveyConfigForPhase_('POST');
  assert.deepEqual(Array.from(config.sections, section => section.code), ['P', 'C', 'K']);
  assert.deepEqual(Array.from(config.sections, section => section.questions.length), [4, 4, 4]);
  assert.equal(config.roleQuestions.teacher.length, 2);
  assert.equal(config.roleQuestions.student.length, 2);
  assert.deepEqual(Array.from(config.topicOptions), ['生成式 AI', 'AR/VR', '物聯網', '機器人', '資安']);
  assert.equal(config.feedbackQuestions.length, 3);
  assert.equal(config.questions, undefined);
});

test('doGet binds serialized config to Index template', () => {
  const evaluated = {
    setTitle() { return this; },
    setSandboxMode() { return this; },
    addMetaTag() { return this; },
    setXFrameOptionsMode() { return this; },
  };
  const template = { evaluate: () => evaluated };
  const app = loadCode({
    HtmlService: {
      createTemplateFromFile(name) {
        assert.equal(name, 'Index');
        return template;
      },
      SandboxMode: { IFRAME: 'IFRAME' },
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    },
  });
  assert.equal(app.doGet(), evaluated);
  assert.match(template.surveyConfigJson, /課前期待調查/);
});

test('validateSubmission rejects invalid scores and missing Q7', () => {
  const app = loadCode();
  assert.throws(
    () => app.validateSubmission_({
      role: 'teacher', info1: '英文', info2: '王老師',
      Q1: 6, Q2: 5, Q3: 5, Q4: 5, Q5: 5, Q6: 5, Q7: '',
    }, 'a@clvsc.tyc.edu.tw'),
    /請完整填寫|1 到 5/
  );
});

function makeSheet(name = '') {
  const sheet = {
    name,
    rows: [],
    frozenRows: 0,
    validation: null,
    validations: [],
    insertedColumns: [],
    maxColumns: 26,
    getLastRow() { return this.rows.length; },
    getMaxRows() { return Math.max(this.rows.length, 100); },
    getMaxColumns() { return this.maxColumns; },
    setFrozenRows(count) { this.frozenRows = count; },
    appendRow(row) { this.rows.push([...row]); },
    insertColumnAfter(column) {
      this.insertedColumns.push(column);
      this.rows.forEach(row => row.splice(column, 0, ''));
    },
    insertColumnsAfter(column, count) {
      this.insertedColumns.push({ after: column, count });
      this.maxColumns += count;
    },
    getRange(row, column, rowCount, columnCount) {
      return {
        setValues: (values) => {
          values.forEach((valueRow, rowOffset) => {
            const targetIndex = row - 1 + rowOffset;
            if (!sheet.rows[targetIndex]) sheet.rows[targetIndex] = [];
            valueRow.forEach((value, columnOffset) => {
              sheet.rows[targetIndex][column - 1 + columnOffset] = value;
            });
          });
        },
        getValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: columnCount }, (_, columnOffset) =>
            sheet.rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ''
          )
        ),
        setDataValidation: (rule) => {
          sheet.validation = rule;
          sheet.validations.push({ row, column, rowCount, columnCount, rule });
        },
      };
    },
  };
  return sheet;
}

function makeSpreadsheetApp(workbook, validation = {}) {
  return {
    getActiveSpreadsheet: () => workbook,
    newDataValidation() {
      const rule = { values: [], allowInvalid: true, helpText: '' };
      return {
        requireValueInList(values) { rule.values = [...values]; return this; },
        setAllowInvalid(value) { rule.allowInvalid = value; return this; },
        setHelpText(value) { rule.helpText = value; return this; },
        build() { Object.assign(validation, rule); return rule; },
      };
    },
  };
}

function makeWorkbook(seed = {}) {
  const workbook = {
    sheets: {},
    getSheetByName(name) { return this.sheets[name] || null; },
    insertSheet(name) {
      const sheet = makeSheet(name);
      this.sheets[name] = sheet;
      return sheet;
    },
  };
  for (const [name, rows] of Object.entries(seed)) {
    const sheet = workbook.insertSheet(name);
    sheet.rows = rows.map(row => [...row]);
  }
  return workbook;
}

function validTeacher(overrides = {}) {
  return {
    courseCode: 'AI001', contactEmail: '', role: 'teacher', info1: '英文', info2: '王老師', info3: '', info4: '',
    Q1: 5, Q2: 5, Q3: 4, Q4: 4, Q5: 5, Q6: 4,
    Q7: '學會設計提示詞', Q8: '希望有更多範例', ...overrides,
  };
}

function validPost(role = 'teacher', overrides = {}) {
  return {
    courseCode: 'AI002', contactEmail: '', role,
    info1: role === 'teacher' ? '英文' : '資處科',
    info2: role === 'teacher' ? '王老師' : '一年級',
    info3: role === 'teacher' ? '' : '1 班',
    info4: role === 'teacher' ? '' : 's115001',
    P1: 5, P2: 4, P3: 5, P4: 4,
    C1: 5, C2: 4, C3: 5, C4: 4,
    K1: 5, K2: 4, K3: 5, K4: 4,
    R1: 5, R2: 4,
    futureTopics: ['生成式 AI', '資安'], otherTopic: '',
    feedback1: '', feedback2: '', feedback3: '',
    ...overrides,
  };
}

test('POST accepts required scales and optional topics and feedback', () => {
  const app = loadCode();
  assert.doesNotThrow(() => app.validateSubmission_(validPost('teacher'), 'teacher@clvsc.tyc.edu.tw', 'POST'));
  assert.doesNotThrow(() => app.validateSubmission_(validPost('student', {
    futureTopics: [], otherTopic: '', feedback1: '', feedback2: '', feedback3: '',
  }), 'student@clvsc.tyc.edu.tw', 'POST'));
});

test('POST rejects invalid scales and unknown topic values', () => {
  const app = loadCode();
  assert.throws(
    () => app.validateSubmission_(validPost('teacher', { P1: 6 }), 'teacher@clvsc.tyc.edu.tw', 'POST'),
    /P1.*1 到 5/
  );
  assert.throws(
    () => app.validateSubmission_(validPost('student', { futureTopics: ['量子電腦'] }), 'student@clvsc.tyc.edu.tw', 'POST'),
    /未來主題/
  );
});

test('POST appends explicit columns once and preserves legacy Q columns', () => {
  const currentHeader = [
    '填寫時間', '課程代碼', '課程名稱', '階段', '登入信箱', '聯絡信箱', '身份', '科別', '年級／姓名',
    '班級', '姓名／學號', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'
  ];
  const workbook = makeWorkbook({ '問卷回覆': [currentHeader] });
  const app = loadCode({ SpreadsheetApp: makeSpreadsheetApp(workbook) });
  app.ensureSurveySheets_();
  app.ensureSurveySheets_();
  const headers = workbook.getSheetByName('問卷回覆').rows[0];
  assert.deepEqual(headers.slice(11, 19), ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']);
  assert.deepEqual(headers.slice(19), [
    'P1','P2','P3','P4','C1','C2','C3','C4','K1','K2','K3','K4',
    'R1','R2','未來主題','其他主題','收穫內容','改進建議','想參加主題'
  ]);
  assert.equal(headers.length, 38);
});

test('POST row leaves PRE answer columns blank and writes redesigned answers', () => {
  const app = loadCode();
  const row = app.buildRow_(validPost('teacher', {
    futureTopics: ['生成式 AI', '資安'], otherTopic: 'AI 法規',
    feedback1: '提示詞', feedback2: '增加實作', feedback3: '機器人',
  }), 'teacher@clvsc.tyc.edu.tw', { code: 'AI002', name: '新興科技', phase: 'POST' });
  assert.deepEqual(Array.from(row.slice(11, 19)), ['', '', '', '', '', '', '', '']);
  assert.deepEqual(Array.from(row.slice(19, 33)), [5,4,5,4,5,4,5,4,5,4,5,4,5,4]);
  assert.equal(row[33], '生成式 AI｜資安');
  assert.deepEqual(Array.from(row.slice(34)), ['AI 法規', '提示詞', '增加實作', '機器人']);
});

test('getOpenCourses creates named sheets and a default course', () => {
  const workbook = makeWorkbook();
  const app = loadCode({ SpreadsheetApp: makeSpreadsheetApp(workbook) });
  const courses = app.getOpenCourses();
  assert.ok(workbook.getSheetByName('課程設定'));
  assert.ok(workbook.getSheetByName('問卷回覆'));
  assert.equal(courses.length, 1);
  assert.equal(courses[0].code, 'AI001');
  assert.equal(courses[0].phase, 'PRE');
});

test('getOpenCourses returns only unique valid open courses', () => {
  const workbook = makeWorkbook({
    '課程設定': [
      ['課程代碼', '課程名稱', '問卷階段', '開放狀態', '說明'],
      ['AI001', 'AI 入門', 'PRE', '開放', '入門'],
      ['AI001', '重複課程', 'POST', '開放', '略過'],
      ['AI002', '關閉課程', 'PRE', '關閉', ''],
      ['AI003', '錯誤階段', 'MID', '開放', ''],
      ['AI004', 'AI 進階', 'post', '開放', '進階'],
    ],
  });
  const app = loadCode({ console: { error() {} }, SpreadsheetApp: makeSpreadsheetApp(workbook) });
  const courses = app.getOpenCourses();
  assert.equal(JSON.stringify(courses.map(course => course.code)), JSON.stringify(['AI001', 'AI004']));
  assert.equal(courses[0].phaseDisplay, '研習前測');
  assert.equal(courses[1].phaseDisplay, '研習後測');
});

test('submitSurvey creates headers and appends trusted course data', () => {
  const workbook = makeWorkbook();
  const app = loadCode({
    Session: { getActiveUser: () => ({ getEmail: () => 'user@clvsc.tyc.edu.tw' }) },
    SpreadsheetApp: makeSpreadsheetApp(workbook),
  });

  const response = app.submitSurvey(validTeacher({ contactEmail: ' Contact@Example.COM ', courseName: '竄改', phase: 'POST' }));
  const sheet = workbook.getSheetByName('問卷回覆');
  assert.equal(response.status, 'success');
  assert.equal(response.action, 'created');
  assert.equal(sheet.rows[0][0], '填寫時間');
  assert.equal(sheet.rows[1][1], 'AI001');
  assert.equal(sheet.rows[1][2], 'AI 學習輔助研習');
  assert.equal(sheet.rows[1][3], '前測');
  assert.equal(sheet.rows[1][4], 'user@clvsc.tyc.edu.tw');
  assert.equal(sheet.rows[1][5], 'contact@example.com');
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.frozenRows, 1);
});

test('submitSurvey updates the same email and phase instead of appending', () => {
  const workbook = makeWorkbook();
  const app = loadCode({
    Session: { getActiveUser: () => ({ getEmail: () => 'USER@clvsc.tyc.edu.tw' }) },
    SpreadsheetApp: makeSpreadsheetApp(workbook),
  });

  app.submitSurvey(validTeacher());
  const response = app.submitSurvey(validTeacher({ Q1: 4 }));
  const sheet = workbook.getSheetByName('問卷回覆');
  assert.equal(response.status, 'success');
  assert.equal(response.action, 'updated');
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[1][11], 4);
});

test('contact email is optional but rejects malformed values', () => {
  const app = loadCode();
  assert.doesNotThrow(() => app.validateSubmission_(validTeacher({ contactEmail: '' }), 'user@clvsc.tyc.edu.tw'));
  assert.throws(
    () => app.validateSubmission_(validTeacher({ contactEmail: 'not-an-email' }), 'user@clvsc.tyc.edu.tw'),
    /聯絡信箱格式不正確/
  );
});

test('legacy response sheet inserts the contact email column only once', () => {
  const legacyHeader = [
    '填寫時間', '課程代碼', '課程名稱', '階段', '登入信箱', '身份', '科別', '年級／姓名',
    '班級', '姓名／學號', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'
  ];
  const legacyRow = [
    new Date(0), 'AI001', 'AI 入門', '前測', 'old@example.com', '教師', '英文', '王老師',
    '', '', 5, 5, 5, 5, 5, 5, '內容', '心得'
  ];
  const workbook = makeWorkbook({ '問卷回覆': [legacyHeader, legacyRow] });
  const app = loadCode({ SpreadsheetApp: makeSpreadsheetApp(workbook) });

  app.ensureSurveySheets_();
  app.ensureSurveySheets_();
  const sheet = workbook.getSheetByName('問卷回覆');
  assert.equal(sheet.rows[0][5], '聯絡信箱');
  assert.equal(sheet.rows[0].length, 38);
  assert.equal(sheet.rows[1][5], '');
  assert.equal(sheet.rows[1][6], '教師');
  assert.deepEqual(sheet.insertedColumns, [5, { after: 26, count: 12 }]);
});

test('submitSurvey rejects an unknown or closed course', () => {
  const workbook = makeWorkbook({
    '課程設定': [
      ['課程代碼', '課程名稱', '問卷階段', '開放狀態', '說明'],
      ['AI001', 'AI 入門', 'PRE', '關閉', ''],
    ],
  });
  const app = loadCode({
    console: { error() {} },
    Session: { getActiveUser: () => ({ getEmail: () => 'user@clvsc.tyc.edu.tw' }) },
    SpreadsheetApp: makeSpreadsheetApp(workbook),
  });
  const response = app.submitSurvey(validTeacher());
  assert.equal(response.status, 'error');
  assert.match(response.message, /未開放/);
  assert.equal(workbook.getSheetByName('問卷回覆').rows.length, 1);
});

test('course settings fill blank named codes and apply a strict phase dropdown', () => {
  const workbook = makeWorkbook({
    '課程設定': [
      ['課程代碼', '課程名稱', '問卷階段', '開放狀態', '說明'],
      ['AI001', '既有課程', 'PRE', '關閉', ''],
      ['AI003', '另一課程', 'POST', '關閉', ''],
      ['', '自動編號課程', 'PRE', '開放', ''],
      ['CUSTOM', '手動代碼課程', 'POST', '關閉', ''],
      ['', '', '', '', ''],
    ],
  });
  const lock = {
    waited: false, released: false,
    waitLock(ms) { this.waited = ms === 10000; },
    releaseLock() { this.released = true; },
  };
  const validation = {};
  const app = loadCode({
    LockService: { getDocumentLock: () => lock },
    SpreadsheetApp: makeSpreadsheetApp(workbook, validation),
  });

  app.getOpenCourses();
  const sheet = workbook.getSheetByName('課程設定');
  assert.equal(sheet.rows[3][0], 'AI004');
  assert.equal(sheet.rows[4][0], 'CUSTOM');
  assert.equal(sheet.rows[5][0], '');
  assert.equal(sheet.validations.length, 2);
  assert.deepEqual(sheet.validations[0].rule.values, ['PRE', 'POST']);
  assert.equal(sheet.validations[0].rule.allowInvalid, false);
  assert.deepEqual(sheet.validations[1].rule.values, ['開放', '關閉']);
  assert.equal(sheet.validations[1].column, 4);
  assert.equal(sheet.validations[1].rule.allowInvalid, false);
  assert.equal(lock.waited, true);
  assert.equal(lock.released, true);
});

test('submitSurvey hides internal error details from respondents', () => {
  const app = loadCode({
    console: { error() {} },
    Session: { getActiveUser: () => ({ getEmail: () => 'user@clvsc.tyc.edu.tw' }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('internal sheet identifier'); } },
  });
  const response = app.submitSurvey(validTeacher());
  assert.equal(response.status, 'error');
  assert.equal(response.message, '資料送出失敗，請稍後再試。');
  assert.doesNotMatch(response.message, /internal sheet identifier/);
});

module.exports = { loadCode };
