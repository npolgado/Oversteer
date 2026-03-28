@echo off
echo Running old test suite...
setlocal enabledelayedexpansion
set FILES=
for %%f in (test\*.test.js) do set FILES=!FILES! %%f
node --test %FILES%
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
echo Running new test suite...
npx vitest run
exit /b %ERRORLEVEL%