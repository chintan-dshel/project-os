@echo off
setlocal EnableDelayedExpansion
title Project OS — Setup and Launch

:: ═══════════════════════════════════════════════════════════════
::  PROJECT OS — Windows Launcher
::  Double-click this file to set up and start the whole app.
::  It will tell you exactly what it is doing at every step.
::  Safe to run multiple times — skips anything already done.
::
::  Place this file in the same folder as project-os and project-os-ui
::  i.e. your folder should look like:
::    my-project\
::      setup.bat          <- this file
::      project-os\
::      project-os-ui\
:: ═══════════════════════════════════════════════════════════════

cls
echo.
echo  =====================================================
echo   PROJECT OS ^| Windows Setup and Launcher
echo   AI Project Management System
echo  =====================================================
echo.
echo  This script will:
echo    1. Check if Node.js is installed (installs if not)
echo    2. Check if PostgreSQL is installed (installs if not)
echo    3. Ask for your Anthropic API key
echo    4. Create the database
echo    5. Install app dependencies
echo    6. Start the backend and frontend
echo    7. Open the app in your browser
echo.
echo  It will ASK before installing anything.
echo.
pause

:: ─────────────────────────────────────────────────────────────
:: Figure out where this script lives
:: ─────────────────────────────────────────────────────────────
:: Get script directory with trailing backslash stripped
:: pushd/cd trick is the most reliable way on Windows
pushd "%~dp0"
set "ROOT=%CD%"
popd

set "BACKEND=%ROOT%\project-os"
set "FRONTEND=%ROOT%\project-os-ui"
set "ENV_FILE=%BACKEND%\.env"

:: Verify folder structure
if not exist "%BACKEND%\package.json" (
    echo.
    echo  ERROR: Cannot find project-os folder next to this script.
    echo.
    echo  Your folder should look like this:
    echo    [some folder]\
    echo      setup.bat           ^<-- this file
    echo      project-os\
    echo      project-os-ui\
    echo.
    echo  Make sure setup.bat is in the SAME folder as project-os and project-os-ui.
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND%\package.json" (
    echo.
    echo  ERROR: Cannot find project-os-ui folder next to this script.
    echo.
    pause
    exit /b 1
)

echo.
echo  [OK] Found project-os folder
echo  [OK] Found project-os-ui folder
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 1 — Check Node.js
:: ═══════════════════════════════════════════════════════════════
echo  ─────────────────────────────────────────────
echo   Step 1 of 6 — Checking Node.js
echo  ─────────────────────────────────────────────
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  Node.js is NOT installed.
    echo.
    echo  Node.js is what runs the backend server.
    echo  It is free and safe to install.
    echo.
    set /p INSTALL_NODE="  Type YES to open the Node.js download page, then re-run this script after installing: "
    if /i "!INSTALL_NODE!"=="YES" (
        echo.
        echo  Opening Node.js download page...
        echo  Download the "Windows Installer" ^(.msi^) — choose the LTS version.
        echo  Run the installer, click Next through everything, then re-run setup.bat.
        echo.
        start https://nodejs.org/en/download
        echo  Press any key once you have started the Node.js installer...
        pause
        echo  After Node.js finishes installing, close this window and double-click setup.bat again.
        pause
        exit /b 0
    ) else (
        echo  Cancelled. Node.js is required. Exiting.
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
    echo  [OK] Node.js is installed ^(!NODE_VER!^)
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: npm not found. Please reinstall Node.js from nodejs.org
    pause
    exit /b 1
)
echo  [OK] npm is available
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 2 — Check PostgreSQL
:: ═══════════════════════════════════════════════════════════════
echo  ─────────────────────────────────────────────
echo   Step 2 of 6 — Checking PostgreSQL
echo  ─────────────────────────────────────────────
echo.

:: Try common PostgreSQL install locations on Windows
set "PSQL_EXE="
set "PG_PATHS=C:\Program Files\PostgreSQL\18\bin;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\PostgreSQL\16\bin;C:\Program Files\PostgreSQL\15\bin;C:\Program Files\PostgreSQL\14\bin;C:\Program Files (x86)\PostgreSQL\18\bin;C:\Program Files (x86)\PostgreSQL\17\bin;C:\Program Files (x86)\PostgreSQL\16\bin"

for %%p in ("%PG_PATHS:;=" "%") do (
    if exist "%%~p\psql.exe" (
        set "PSQL_EXE=%%~p\psql.exe"
        set "PG_BIN=%%~p"
    )
)

:: Also try PATH
where psql >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%p in ('where psql 2^>nul') do set "PSQL_EXE=%%p"
    for %%p in ("!PSQL_EXE!") do set "PG_BIN=%%~dpp"
)

if "!PSQL_EXE!"=="" (
    echo  PostgreSQL is NOT installed.
    echo.
    echo  PostgreSQL is the database that stores all your project data.
    echo  It is free and safe to install.
    echo.
    echo  We will open the download page. Follow these steps:
    echo    1. Click the Windows installer link
    echo    2. Run the installer
    echo    3. When asked for a password — WRITE IT DOWN, you will need it
    echo    4. Leave the port as 5432
    echo    5. Finish the install
    echo    6. Re-run setup.bat
    echo.
    set /p INSTALL_PG="  Type YES to open the PostgreSQL download page: "
    if /i "!INSTALL_PG!"=="YES" (
        start https://www.postgresql.org/download/windows/
        echo.
        echo  IMPORTANT: When the installer asks for a password, write it down.
        echo  After PostgreSQL finishes installing, close this window and re-run setup.bat.
        echo.
        pause
        exit /b 0
    ) else (
        echo  Cancelled. PostgreSQL is required. Exiting.
        pause
        exit /b 1
    )
) else (
    echo  [OK] PostgreSQL found at: !PG_BIN!
    :: Add pg bin to PATH for this session
    set "PATH=!PG_BIN!;!PATH!"
)
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 3 — Anthropic API Key
:: ═══════════════════════════════════════════════════════════════
echo  ─────────────────────────────────────────────
echo   Step 3 of 6 — Anthropic API Key
echo  ─────────────────────────────────────────────
echo.

:: Check if .env already has a real key
set "HAS_KEY=0"
if exist "%ENV_FILE%" (
    findstr /i "ANTHROPIC_API_KEY=sk-ant-" "%ENV_FILE%" >nul 2>nul
    if !errorlevel! equ 0 set "HAS_KEY=1"
)

if "!HAS_KEY!"=="1" (
    echo  [OK] Anthropic API key already saved
) else (
    echo  The app uses Claude AI to power the project agents.
    echo  You need a free Anthropic API key.
    echo.
    echo  To get one:
    echo    1. Go to: https://console.anthropic.com
    echo    2. Sign up or log in
    echo    3. Click "API Keys" in the left menu
    echo    4. Click "Create Key"
    echo    5. Copy the key ^(starts with sk-ant-...^)
    echo.
    set /p OPEN_ANTHROPIC="  Type YES to open the Anthropic console in your browser: "
    if /i "!OPEN_ANTHROPIC!"=="YES" start https://console.anthropic.com/settings/keys
    echo.
    echo  Paste your API key below and press Enter.
    echo  ^(The key starts with sk-ant- and is about 100 characters long^)
    echo.
    :ASK_KEY
    set /p ANTHROPIC_KEY="  API Key: "
    if "!ANTHROPIC_KEY!"=="" (
        echo  No key entered. Please paste your key.
        goto ASK_KEY
    )
    :: Basic validation
    echo !ANTHROPIC_KEY! | findstr /i "sk-ant-" >nul 2>nul
    if !errorlevel! neq 0 (
        echo.
        echo  That doesn't look like an Anthropic key ^(should start with sk-ant-^).
        echo  Please try again.
        echo.
        goto ASK_KEY
    )
    echo  [OK] API key looks valid
)

:: ═══════════════════════════════════════════════════════════════
:: STEP 4 — Create .env file
:: ═══════════════════════════════════════════════════════════════
echo.
echo  ─────────────────────────────────────────────
echo   Step 4 of 6 — Setting up configuration
echo  ─────────────────────────────────────────────
echo.

if not exist "%ENV_FILE%" (
    :: Ask for PostgreSQL password
    echo  What password did you set when installing PostgreSQL?
    echo  ^(If you used the default installer, you typed a password during setup^)
    echo  ^(If you're not sure, try leaving blank and pressing Enter^)
    echo.
    set /p PG_PASS="  PostgreSQL password: "

    if "!PG_PASS!"=="" (
        set "DB_URL=postgres://postgres@localhost:5432/project_os"
    ) else (
        set "DB_URL=postgres://postgres:!PG_PASS!@localhost:5432/project_os"
    )

    (
        echo DATABASE_URL=!DB_URL!
        echo PORT=3000
        echo NODE_ENV=development
        echo ANTHROPIC_API_KEY=!ANTHROPIC_KEY!
    ) > "%ENV_FILE%"

    echo  [OK] Created configuration file ^(.env^)
) else (
    :: .env exists — update key if we just collected one
    if "!HAS_KEY!"=="0" (
        :: Replace the key line
        set "TMPFILE=%TEMP%\env_tmp.txt"
        (for /f "tokens=*" %%l in (%ENV_FILE%) do (
            echo %%l | findstr /i "ANTHROPIC_API_KEY" >nul 2>nul
            if !errorlevel! equ 0 (
                echo ANTHROPIC_API_KEY=!ANTHROPIC_KEY!
            ) else (
                echo %%l
            )
        )) > "!TMPFILE!"
        move /y "!TMPFILE!" "%ENV_FILE%" >nul
        echo  [OK] Updated API key in configuration file
    ) else (
        echo  [OK] Configuration file already exists
    )
)

:: Read DB URL from .env for later use
for /f "tokens=1,* delims==" %%a in ('findstr "DATABASE_URL" "%ENV_FILE%"') do set "DB_URL=%%b"
echo  [OK] Database URL: !DB_URL!
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 5 — Database setup
:: ═══════════════════════════════════════════════════════════════
echo  ─────────────────────────────────────────────
echo   Step 5 of 6 — Setting up database
echo  ─────────────────────────────────────────────
echo.

:: Extract password from DB URL for psql
set "PG_PASSWORD="
echo !DB_URL! | findstr ":[^@]*@" >nul 2>nul

:: Set PGPASSWORD so psql doesn't prompt
for /f "tokens=3 delims=:/@" %%p in ("!DB_URL!") do set "PGPASSWORD=%%p"

:: Check if database already exists
"!PSQL_EXE!" -U postgres -h localhost -p 5432 -lqt 2>nul | findstr /i "project_os" >nul 2>nul
if %errorlevel% equ 0 (
    echo  [OK] Database 'project_os' already exists
) else (
    echo  Creating database 'project_os'...
    "!PSQL_EXE!" -U postgres -h localhost -p 5432 -c "CREATE DATABASE project_os;" 2>nul
    if !errorlevel! neq 0 (
        echo.
        echo  ERROR: Could not create database.
        echo.
        echo  This usually means:
        echo    a^) PostgreSQL is not running — look for the elephant icon in your taskbar
        echo    b^) Wrong password — re-run setup.bat and try a different password
        echo.
        echo  To start PostgreSQL manually:
        echo    Press Windows key, search "Services", find "postgresql-x64-16", right-click Start
        echo.
        pause
        exit /b 1
    )
    echo  [OK] Database created
)

:: Check if tables already exist
"!PSQL_EXE!" -U postgres -h localhost -p 5432 -d project_os -c "\dt" 2>nul | findstr "projects" >nul 2>nul
if %errorlevel% equ 0 (
    echo  [OK] Database tables already set up
) else (
    echo  Creating database tables...

    :: Find schema.sql — look next to this script and in parent folders
    set "SCHEMA_FILE="
    if exist "%ROOT%\schema.sql"                   set "SCHEMA_FILE=%ROOT%\schema.sql"
    if exist "%ROOT%\project-os\schema.sql"        set "SCHEMA_FILE=%ROOT%\project-os\schema.sql"
    if exist "%BACKEND%\schema.sql"                set "SCHEMA_FILE=%BACKEND%\schema.sql"

    set "MIGRATION_FILE="
    if exist "%BACKEND%\migrations\001_task_upsert_constraint.sql" (
        set "MIGRATION_FILE=%BACKEND%\migrations\001_task_upsert_constraint.sql"
    )
    if exist "%ROOT%\migrations\001_task_upsert_constraint.sql" (
        set "MIGRATION_FILE=%ROOT%\migrations\001_task_upsert_constraint.sql"
    )

    if "!SCHEMA_FILE!"=="" (
        echo.
        echo  ERROR: Cannot find schema.sql
        echo.
        echo  Please place schema.sql in the same folder as setup.bat, then re-run.
        echo  You should have received schema.sql along with the project files.
        echo.
        pause
        exit /b 1
    )

    "!PSQL_EXE!" -U postgres -h localhost -p 5432 -d project_os -f "!SCHEMA_FILE!" >nul 2>&1
    if !errorlevel! neq 0 (
        echo  ERROR: Failed to run schema.sql. Check the file is not corrupted.
        pause
        exit /b 1
    )
    echo  [OK] Main schema applied

    if not "!MIGRATION_FILE!"=="" (
        "!PSQL_EXE!" -U postgres -h localhost -p 5432 -d project_os -f "!MIGRATION_FILE!" >nul 2>&1
        echo  [OK] Migration 001 applied
    )

    :: Migration 002 — performance indexes (safe to run multiple times)
    set "MIGRATION_002="
    if exist "%BACKEND%\migrations\002_performance_indexes.sql" (
        set "MIGRATION_002=%BACKEND%\migrations\002_performance_indexes.sql"
    )
    if not "!MIGRATION_002!"=="" (
        "!PSQL_EXE!" -U postgres -h localhost -p 5432 -d project_os -f "!MIGRATION_002!" >nul 2>&1
        echo  [OK] Migration 002 applied ^(performance indexes^)
    )
)
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 6 — Install Node dependencies
:: ═══════════════════════════════════════════════════════════════
echo  ─────────────────────────────────────────────
echo   Step 6 of 6 — Installing app dependencies
echo  ─────────────────────────────────────────────
echo.

:: Backend dependencies
if not exist "%BACKEND%\node_modules\express\package.json" (
    echo  Installing backend packages ^(express, pg, dotenv^)...
    echo  This takes about 30 seconds the first time.
    cd /d "%BACKEND%"
    call npm install --silent 2>nul
    if !errorlevel! neq 0 (
        echo  npm install failed. Trying again with more output...
        call npm install
        if !errorlevel! neq 0 (
            echo  ERROR: Could not install backend packages.
            echo  Check that Node.js is properly installed.
            pause
            exit /b 1
        )
    )
    echo  [OK] Backend packages installed
) else (
    echo  [OK] Backend packages already installed
)

:: Frontend dependencies
if not exist "%FRONTEND%\node_modules\vite\package.json" (
    echo  Installing frontend packages ^(React, Vite^)...
    echo  This takes about 60 seconds the first time.
    cd /d "%FRONTEND%"
    call npm install --silent 2>nul
    if !errorlevel! neq 0 (
        call npm install
        if !errorlevel! neq 0 (
            echo  ERROR: Could not install frontend packages.
            pause
            exit /b 1
        )
    )
    echo  [OK] Frontend packages installed
) else (
    echo  [OK] Frontend packages already installed
)

echo.

:: ═══════════════════════════════════════════════════════════════
:: LAUNCH
:: ═══════════════════════════════════════════════════════════════
echo  =====================================================
echo   All set up! Starting Project OS...
echo  =====================================================
echo.
echo  Two windows will open:
echo    - Backend server  ^(port 3000^)
echo    - Frontend app    ^(port 5173^)
echo.
echo  Your browser will open automatically in a few seconds.
echo  To stop the app, close those two windows.
echo.
echo  The app will be at: http://localhost:5173
echo.
timeout /t 2 /nobreak >nul

:: Write helper bat files with fully-resolved literal paths
:: Using >>file syntax line by line avoids all quoting issues

set "SB=%TEMP%\pos_backend.bat"
set "SF=%TEMP%\pos_frontend.bat"

:: Backend launcher
echo @echo off                                  > "%SB%"
echo title Project OS - Backend                >> "%SB%"
echo cd /d "%BACKEND%"                         >> "%SB%"
echo echo.                                     >> "%SB%"
echo echo Starting backend on port 3000...     >> "%SB%"
echo npm run dev                               >> "%SB%"
echo pause                                     >> "%SB%"

:: Frontend launcher
echo @echo off                                  > "%SF%"
echo title Project OS - Frontend               >> "%SF%"
echo cd /d "%FRONTEND%"                        >> "%SF%"
echo echo.                                     >> "%SF%"
echo echo Starting frontend on port 5173...    >> "%SF%"
echo npm run dev                               >> "%SF%"
echo pause                                     >> "%SF%"

:: Confirm what paths we are using
echo  Backend  folder: %BACKEND%
echo  Frontend folder: %FRONTEND%
echo.

:: Verify folders exist before launching
if not exist "%BACKEND%\src\index.js" (
    echo  ERROR: Backend folder not found or missing src\index.js
    echo  Expected: %BACKEND%\src\index.js
    pause
    exit /b 1
)
if not exist "%FRONTEND%\package.json" (
    echo  ERROR: Frontend folder not found or missing package.json
    echo  Expected: %FRONTEND%\package.json
    pause
    exit /b 1
)

echo  [OK] Both folders verified
echo.

:: Start backend
start "Project OS - Backend" cmd /k "%SB%"

:: Wait for backend to start
echo  Waiting for backend to start...
timeout /t 4 /nobreak >nul

:: Start frontend
start "Project OS - Frontend" cmd /k "%SF%"

:: Wait for frontend to start
echo  Waiting for frontend to start...
timeout /t 5 /nobreak >nul

:: Open browser
echo  Opening browser...
start http://localhost:5173

echo.
echo  ─────────────────────────────────────────────────────
echo   Project OS is running!
echo.
echo   App:      http://localhost:5173
echo   Backend:  http://localhost:3000/health
echo.
echo   To stop: close the two black terminal windows
echo   To restart: double-click setup.bat again
echo  ─────────────────────────────────────────────────────
echo.
pause
