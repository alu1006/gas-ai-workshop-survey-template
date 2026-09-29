# Anonymous Survey Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow survey submission without a login email while retaining overwrite behavior when an email is available.

**Architecture:** Keep the response schema unchanged. Make email optional in validation and row construction; only call the existing-row lookup when the normalized login email is non-empty, so anonymous submissions always append.

**Tech Stack:** Google Apps Script, JavaScript, Node.js built-in test runner

---

### Task 1: Specify anonymous submission behavior

**Files:**
- Modify: `tests/code.test.cjs`

- [ ] Add a test that calls `validateSubmission_` with an empty email for valid PRE and POST payloads and expects no exception.
- [ ] Add a submit test with `Session.getActiveUser().getEmail()` returning `''`; submit twice and assert two response rows were appended with blank login-email cells.
- [ ] Run `node --test --test-name-pattern="anonymous|empty login" tests/code.test.cjs` and verify the validation test fails with `無法取得登入信箱`.

### Task 2: Implement optional login email

**Files:**
- Modify: `Code.gs`
- Modify: `README.md`

- [ ] Change the first validation guard to reject only missing payload data:

```javascript
if (!data) throw new UserFacingError_('未收到問卷資料，請重新填寫。');
```

- [ ] Normalize the possibly empty login email in `buildRow_` and keep the response cell blank when unavailable.
- [ ] In `submitSurvey`, call `findExistingRow_` only when the normalized login email is non-empty; otherwise use row number `0` and append.
- [ ] Document that login email may be blank and anonymous submissions cannot overwrite prior responses.
- [ ] Run `node --test tests/code.test.cjs tests/index.test.cjs` and verify all tests pass.
- [ ] Commit with `git commit -am "feat: allow anonymous survey submissions"`.

### Task 3: Integrate and deploy

**Files:**
- No source changes expected.

- [ ] Merge `codex/anonymous-survey` into local `main` and rerun the full 27+ test suite.
- [ ] Push `main` to GitHub.
- [ ] Copy the verified `Code.gs` into the existing Apps Script project and save.
- [ ] Update the existing Web App deployment with a new version, preserving its URL and access setting.
- [ ] Open the `/exec` URL and verify the page loads without requiring Google sign-in.
