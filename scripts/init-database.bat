@echo off
REM Allegro Component Library - Database Initialization Script (Windows)

setlocal

REM Database configuration
if "%DB_HOST%"=="" set DB_HOST=infra.main.local
if "%DB_PORT%"=="" set DB_PORT=5435
if "%DB_USER%"=="" set DB_USER=sami
if "%DB_PASSWORD%"=="" set DB_PASSWORD=123456
if "%DB_NAME%"=="" set DB_NAME=cip

echo ==================================
echo Allegro Component Library
echo Database Initialization Script
echo ==================================
echo.

REM Check if psql is installed
where psql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: psql is not installed
    echo Please install PostgreSQL client tools
    pause
    exit /b 1
)

echo Database Configuration:
echo   Host: %DB_HOST%
echo   Port: %DB_PORT%
echo   User: %DB_USER%
echo   Database: %DB_NAME%
echo.

REM Test connection
echo Testing database connection...
set PGPASSWORD=%DB_PASSWORD%
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT version();" >nul 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo Error: Cannot connect to database
    echo Please verify:
    echo   1. Database server is running
    echo   2. Connection details are correct
    echo   3. Network/firewall allows connection
    pause
    exit /b 1
)

echo [OK] Database connection successful
echo.

REM Check existing tables
echo Checking existing schema...
for /f %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"') do set TABLE_COUNT=%%i

if %TABLE_COUNT% GTR 0 (
    echo Warning: Database already contains %TABLE_COUNT% tables
    set /p CONFIRM="Do you want to drop all tables and reinitialize? (yes/no): "
    
    if /i "%CONFIRM%"=="yes" (
        echo Dropping existing tables...
        psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO %DB_USER%; GRANT ALL ON SCHEMA public TO public;"
        echo [OK] Existing tables dropped
    ) else (
        echo Initialization cancelled
        pause
        exit /b 0
    )
)

REM Initialize schema
echo.
echo Initializing database schema...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f database\schema.sql

if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to initialize schema
    pause
    exit /b 1
)

echo [OK] Schema initialized successfully
echo.

REM Verify tables
echo Verifying installation...
echo Tables created:
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT '  [OK] ' || tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

REM Ask about sample data
echo.
set /p LOAD_SAMPLE="Do you want to load sample data? (yes/no): "

if /i "%LOAD_SAMPLE%"=="yes" (
    echo Loading sample data...
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f database\sample-data.sql
    
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Sample data loaded successfully
        echo.
        echo Record counts:
        psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT '  Components: ' || COUNT(*) FROM components UNION ALL SELECT '  Categories: ' || COUNT(*) FROM component_categories UNION ALL SELECT '  Manufacturers: ' || COUNT(*) FROM manufacturers UNION ALL SELECT '  Inventory Items: ' || COUNT(*) FROM inventory;"
    ) else (
        echo Warning: Failed to load sample data
    )
)

echo.
echo ==================================
echo Database initialization complete!
echo ==================================
echo.
echo Next steps:
echo   1. Start the backend server: cd server ^&^& npm run dev
echo   2. Start the frontend: cd client ^&^& npm run dev
echo   3. Open http://localhost:5173 in your browser
echo.
pause
