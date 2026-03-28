@echo off
echo Running old test suite...
node --test test/*.test.js
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
echo Running new test suite...
npx vitest run
exit /b %ERRORLEVEL%