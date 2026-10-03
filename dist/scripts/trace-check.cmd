@echo off
setlocal
echo TRACE - local process snapshot. Not an automatic cheat detector.
echo This script runs tasklist and saves a CSV file to your TEMP folder.
echo Nothing is uploaded. Inspect this script and agree with the device owner first.
choice /C YN /N /M "Create a local report? [Y/N] "
if errorlevel 2 exit /b 0
:chooseName
set "traceReport=%TEMP%\TRACE-processes-%RANDOM%-%RANDOM%.csv"
if exist "%traceReport%" goto chooseName
tasklist /FO CSV > "%traceReport%"
if errorlevel 1 (
  echo Could not complete the process snapshot. The output may be incomplete.
  pause
  exit /b 1
)
echo Report saved to: "%traceReport%"
echo Review it before sharing. A process name is not evidence of cheating.
pause
endlocal
