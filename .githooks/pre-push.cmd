@echo off
echo Running old test suite...
node --test test\enemies.test.js test\pickups.test.js test\scoring.test.js test\trail.test.js test\upgrades.test.js test\utility.test.js test\waves.test.js
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
echo Running new test suite...
npx vitest run
exit /b %ERRORLEVEL%