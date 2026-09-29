const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function readHtml() {
  return fs.readFileSync('Index.html', 'utf8');
}

test('template safely consumes server survey configuration', () => {
  const html = readHtml();
  assert.match(html, /surveyConfigJson/);
  assert.match(html, /JSON\.parse/);
});

test('contains identity branches and accessible survey controls', () => {
  const html = readHtml();
  for (const id of ['surveyForm', 'teacherSection', 'studentSection', 'questionsContainer', 'q7Input', 'q8Input', 'submitBtn', 'successModal']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /aria-live/);
  assert.match(html, /type="radio"/);
});

test('contains mobile layout and google script submission', () => {
  const html = readHtml();
  assert.match(html, /@media\s*\(max-width:\s*600px\)/);
  assert.match(html, /google\.script\.run/);
  assert.match(html, /withSuccessHandler/);
  assert.match(html, /withFailureHandler/);
});

test('loads open courses and provides a course selection view', () => {
  const html = readHtml();
  for (const id of ['courseView', 'courseList', 'courseStatus', 'surveyView', 'backToCoursesBtn', 'selectedCourseName']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const fn of ['loadCourses', 'renderCourses', 'selectCourse', 'returnToCourses']) {
    assert.match(html, new RegExp(`function\\s+${fn}\\s*\\(`));
  }
  assert.match(html, /\.getOpenCourses\s*\(\s*\)/);
  assert.match(html, /courseCode\s*:/);
});

test('routes by number of open courses', () => {
  const html = readHtml();
  assert.match(html, /if\s*\(courses\.length\s*===\s*1\)/);
  assert.match(html, /selectCourse\(courses\[0\],\s*false\)/);
  assert.match(html, /selectCourse\(course,\s*true\)/);
  assert.match(html, /backToCoursesBtn['"]\)\.hidden\s*=\s*!canChooseCourse/);
});

test('provides an optional validated contact email', () => {
  const html = readHtml();
  assert.match(html, /id=["']contactEmail["']/);
  assert.match(html, /type=["']email["']/);
  assert.match(html, /contactEmail\s*:/);
  assert.match(html, /聯絡信箱格式不正確/);
});

test('implements validation, progress, and reset units', () => {
  const html = readHtml();
  for (const fn of ['collectFormData', 'validateForm', 'updateProgress', 'setSubmitting', 'handleSuccess', 'handleFailure', 'resetSurvey']) {
    assert.match(html, new RegExp(`function\\s+${fn}\\s*\\(`));
  }
  assert.match(html, /scrollIntoView/);
  assert.match(html, /classList\.add\(['"]error['"]\)/);
});

test('renders structured POST sections and role-only questions', () => {
  const html = readHtml();
  for (const id of ['postQuestionsContainer', 'roleQuestionsContainer', 'topicsContainer', 'otherTopic', 'feedbackContainer']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /config\.sections/);
  assert.match(html, /roleQuestions/);
  assert.match(html, /section\.code/);
  assert.match(html, /R1/);
  assert.match(html, /R2/);
});

test('collects optional topic checkboxes and feedback fields', () => {
  const html = readHtml();
  assert.match(html, /type\s*=\s*["']checkbox["']/);
  assert.match(html, /name\s*=\s*["']futureTopics["']/);
  assert.match(html, /querySelectorAll\([^)]*futureTopics/);
  assert.match(html, /futureTopics\s*:/);
  assert.match(html, /otherTopic\s*:/);
  assert.match(html, /feedback1\s*:/);
  assert.match(html, /feedback2\s*:/);
  assert.match(html, /feedback3\s*:/);
});
