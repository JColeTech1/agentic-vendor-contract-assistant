@echo off
cd /d "%~dp0"
if not exist ".env.local" (
  copy ".env.example" ".env.local" >nul
  echo Created .env.local from the template.
)
echo.
echo  Paste your API keys into the file that's about to open.
echo  (What each value is and where to get it: see SETUP.md)
echo  Then Save and close it, and run "2 - Launch.bat".
echo.
notepad ".env.local"
