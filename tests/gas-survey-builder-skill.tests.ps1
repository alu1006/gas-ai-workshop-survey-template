$ErrorActionPreference = 'Stop'

$skillRoot = 'C:\Users\user\.codex\skills\gas-survey-builder'
$failures = [System.Collections.Generic.List[string]]::new()

function Require-Path([string]$relativePath) {
  $fullPath = Join-Path $skillRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath)) {
    $failures.Add("Missing: $relativePath")
  }
}

function Require-Text([string]$relativePath, [string]$pattern, [string]$label) {
  $fullPath = Join-Path $skillRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath)) {
    $failures.Add("Missing: $relativePath")
    return
  }
  $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $fullPath
  if ($content -notmatch $pattern) {
    $failures.Add("$relativePath lacks $label")
  }
}

@(
  'SKILL.md',
  'agents\openai.yaml',
  'references\creating-new-survey.md',
  'references\modifying-existing-survey.md',
  'references\deploying-and-verifying.md',
  'assets\survey-template\Code.gs',
  'assets\survey-template\Index.html',
  'assets\survey-template\appsscript.json',
  'assets\survey-template\tests\code.test.cjs',
  'assets\survey-template\tests\index.test.cjs'
) | ForEach-Object { Require-Path $_ }

Require-Text 'SKILL.md' '^---\s*\r?\nname:\s*gas-survey-builder' 'valid frontmatter name'
Require-Text 'SKILL.md' 'description:\s*Use when' 'trigger-oriented description'
Require-Text 'SKILL.md' 'creating-new-survey\.md' 'new-survey route'
Require-Text 'SKILL.md' 'modifying-existing-survey\.md' 'existing-survey route'
Require-Text 'SKILL.md' 'deploying-and-verifying\.md' 'deployment route'
Require-Text 'references\creating-new-survey.md' '課程設定' 'course settings sheet contract'
Require-Text 'references\creating-new-survey.md' '登入信箱.*聯絡信箱' 'separate login and contact email fields'
Require-Text 'references\modifying-existing-survey.md' '唯一鍵' 'upsert identity invariant'
Require-Text 'references\deploying-and-verifying.md' '存取網頁應用程式的使用者' 'web-app execution identity requirement'
Require-Text 'references\deploying-and-verifying.md' '不.*帳號密碼|不得.*帳號密碼' 'credential safety boundary'
Require-Text 'assets\survey-template\Code.gs' 'Session\.getActiveUser\(\)\.getEmail\(\)' 'authenticated email capture'
Require-Text 'assets\survey-template\Index.html' 'contactEmail' 'optional contact email field'

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Host 'PASS: gas-survey-builder skill contract is complete.'
