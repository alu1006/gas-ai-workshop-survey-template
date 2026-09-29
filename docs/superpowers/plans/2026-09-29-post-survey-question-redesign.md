# POST Survey Question Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the POST questionnaire with the approved P, C, K, role-specific, topic-selection, and optional feedback questions while preserving PRE behavior and historical rows.

**Architecture:** Keep question definitions in the server-owned `SURVEY_CONTENT.POST` configuration and send structured sections to `Index.html`. Extend the response schema by appending named POST columns, validate every POST field on the server, and keep the existing login-email, course-code, and phase upsert key. Migrate headers idempotently without reordering existing data.

**Tech Stack:** Google Apps Script JavaScript, HTML/CSS/vanilla JavaScript, Node.js built-in test runner

---

### Task 1: Specify the new POST configuration and schema in tests

**Files:**
- Modify: `tests/code.test.cjs`
- Modify: `tests/index.test.cjs`

- [ ] **Step 1: Add failing server-configuration tests**

Add assertions that `getSurveyConfig('POST')` exposes three common sections with four required scale questions each, two role questions per role, five allowed topic choices, and three optional feedback prompts. Assert PRE still exposes its six existing questions plus Q7 and Q8.

```js
test('POST config exposes P C K role topics and optional feedback', () => {
  const config = app.getSurveyConfig('POST');
  assert.deepEqual(config.sections.map(section => section.code), ['P', 'C', 'K']);
  assert.deepEqual(config.sections.map(section => section.questions.length), [4, 4, 4]);
  assert.equal(config.roleQuestions.teacher.length, 2);
  assert.equal(config.roleQuestions.student.length, 2);
  assert.deepEqual(config.topicOptions, ['生成式 AI', 'AR/VR', '物聯網', '機器人', '資安']);
  assert.equal(config.feedbackQuestions.length, 3);
});
```

- [ ] **Step 2: Add failing submission and migration tests**

Add teacher and student POST payload fixtures. Assert invalid ratings, unknown topic values, and forged opposite-role answers fail. Assert blank topics and blank feedback are accepted. Assert the header migration appends the exact new columns once and preserves Q1–Q8.

```js
const POST_HEADERS = [
  'P1','P2','P3','P4','C1','C2','C3','C4','K1','K2','K3','K4',
  'R1','R2','未來主題','其他主題','收穫內容','改進建議','想參加主題'
];
```

- [ ] **Step 3: Add failing UI-contract tests**

Assert `Index.html` renders structured section headings, uses checkboxes for topics, has a separate other-topic input, creates role-only questions after identity selection, and includes all POST fields in the submitted payload.

- [ ] **Step 4: Run focused tests and confirm failure**

Run:

```powershell
node --test tests\code.test.cjs tests\index.test.cjs
```

Expected: FAIL because structured POST configuration, POST columns, topic controls, and role-question payloads do not exist yet.

- [ ] **Step 5: Commit the failing tests**

```powershell
git add tests/code.test.cjs tests/index.test.cjs
git commit -m "test: specify redesigned POST questionnaire"
```

### Task 2: Implement POST configuration, validation, schema migration, and row mapping

**Files:**
- Modify: `Code.gs`
- Test: `tests/code.test.cjs`

- [ ] **Step 1: Replace the POST configuration with structured content**

Define `sections`, `roleQuestions`, `topicOptions`, and `feedbackQuestions` under `SURVEY_CONTENT.POST`. Keep `SURVEY_CONTENT.PRE` and its existing fields unchanged. Return cloned structured arrays from `getSurveyConfig` so the browser never receives mutable server objects.

```js
POST: {
  phaseDisplay: '研習後測', badge: '研習後測 · POST', title: '課後成果回饋',
  subtitle: '請依本次研習經驗作答。',
  sections: [
    { code: 'P', title: '教學法與活動設計', questions: [
      '講師的說明清楚、容易理解。',
      '教學方式能引起我的注意與參與。',
      '活動、示範或討論有助於理解內容。',
      '課程時間與進度安排合適。'
    ] },
    { code: 'C', title: '課程內容', questions: [
      '本次主題符合我的需求或興趣。',
      '課程內容充實且難度適當。',
      '課程內容具有實用性。',
      '我希望繼續了解相關主題。'
    ] },
    { code: 'K', title: '新興科技知識與收穫', questions: [
      '我對本次介紹的新興科技有更深入的認識。',
      '我能說明這項新興科技的基本概念或用途。',
      '我能辨識新興科技可能帶來的機會與風險。',
      '我願意把所學應用在學習、教學或生活中。'
    ] }
  ],
  roleQuestions: {
    teacher: ['內容對我的教學或專業成長有幫助。', '我有信心把所學運用在課堂或工作中。'],
    student: ['活動方式能幫助我理解內容。', '課程難度適合我。']
  },
  topicOptions: ['生成式 AI', 'AR/VR', '物聯網', '機器人', '資安'],
  feedbackQuestions: ['今天最有收穫的內容是什麼？', '有哪些地方可以改進？', '還想參加哪些主題？']
}
```

- [ ] **Step 2: Add idempotent appended POST headers**

Keep the existing `RESPONSE_HEADERS` order and append `POST_RESPONSE_HEADERS`. Update the header initializer to add only missing columns at the right edge. Never insert cells inside historical rows or rewrite existing values.

- [ ] **Step 3: Add strict POST validation**

For POST, require numeric integers 1–5 for P1–P4, C1–C4, K1–K4, R1, and R2. Accept zero or more distinct values from the allowed topic list. Trim `otherTopic`, `feedback1`, `feedback2`, and `feedback3`. Reject payload fields for the opposite role and reject unknown topic values.

- [ ] **Step 4: Build phase-aware rows and updates**

For PRE, preserve the current Q1–Q8 mapping. For POST, leave Q1–Q8 blank and populate the appended POST fields. Join selected topics with `｜`. Ensure upsert updates the complete current schema without changing the existing composite key.

- [ ] **Step 5: Run server tests**

Run:

```powershell
node --test tests\code.test.cjs
```

Expected: all server tests pass.

- [ ] **Step 6: Commit backend implementation**

```powershell
git add Code.gs tests/code.test.cjs
git commit -m "feat: implement redesigned POST survey backend"
```

### Task 3: Render structured POST sections and role branching in the browser

**Files:**
- Modify: `Index.html`
- Test: `tests/index.test.cjs`

- [ ] **Step 1: Add reusable POST rendering containers**

Keep the existing PRE question renderer. Add empty containers for common POST sections, role questions, topic checkboxes, other-topic input, and optional feedback fields. Use the existing question-card and five-point scale styling.

- [ ] **Step 2: Render P, C, and K sections from server configuration**

Create section headings from `config.sections`, then render each required rating with stable field names such as `P1`, `C3`, and `K4`. Keep the visible endpoints「非常不同意」and「非常同意」.

- [ ] **Step 3: Render only the selected role's questions**

When identity changes, render `config.roleQuestions[role]` as `R1` and `R2`. Clear previous role ratings whenever the identity changes so hidden answers cannot be submitted.

- [ ] **Step 4: Add optional topic and feedback controls**

Render five checkboxes named `futureTopics`, a separate `otherTopic` text field, and three optional textareas. Collect selected checkbox values as an array.

- [ ] **Step 5: Make validation and progress phase-aware**

PRE continues requiring its six ratings and Q7. POST requires the twelve common ratings and two visible role ratings, while topic and feedback fields remain optional. Focus the first invalid visible card and update the progress count from the active phase's required-field total.

- [ ] **Step 6: Run UI and full tests**

Run:

```powershell
node --test tests\index.test.cjs
node --test tests\code.test.cjs tests\index.test.cjs
```

Expected: all tests pass.

- [ ] **Step 7: Commit frontend implementation**

```powershell
git add Index.html tests/index.test.cjs
git commit -m "feat: render redesigned POST survey form"
```

### Task 4: Document the new questionnaire and verify release readiness

**Files:**
- Modify: `README.md`
- Verify: `Code.gs`
- Verify: `Index.html`
- Verify: `tests/code.test.cjs`
- Verify: `tests/index.test.cjs`

- [ ] **Step 1: Update README**

Document that PRE retains its current questions, POST contains P/C/K plus role-specific questions, future topics are optional multiple choice, and historical Q1–Q8 columns remain preserved. Describe the appended POST columns and the need to deploy a new Apps Script version after copying the complete files.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
node --test tests\code.test.cjs tests\index.test.cjs
```

Expected: zero failures.

- [ ] **Step 3: Check content and repository hygiene**

Run:

```powershell
git diff --check
rg -n "講師的說明清楚|本次主題符合|新興科技有更深入|內容對我的教學|活動方式能幫助|生成式 AI|今天最有收穫" Code.gs Index.html README.md
rg -n -i "api[_-]?key|client[_-]?secret|private[_-]?key|AKfyc|script\.google\.com/.*/exec" Code.gs Index.html README.md
```

Expected: every approved question is present; the sensitive-pattern scan returns no matches.

- [ ] **Step 4: Commit documentation**

```powershell
git add README.md
git commit -m "docs: describe redesigned POST questionnaire"
```

- [ ] **Step 5: Review the branch before integration**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -5
```

Expected: clean feature branch with the test, backend, frontend, and documentation commits.
