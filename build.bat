@echo off
setlocal

REM =====================================================================
REM == ChunDiet Executable Build Script (v5 - Debug Console Edition)   ==
REM =====================================================================
echo.

REM Define the virtual environment directory name
set VENV_DIR=venv

REM --- Step 1: Set up the Virtual Environment ---
echo [1/4] Setting up Python virtual environment...

if not exist "%VENV_DIR%\" (
    echo Virtual environment not found. Creating it now...
    python -m venv %VENV_DIR%
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to create the virtual environment.
        pause
        exit /b %errorlevel%
    )
)
echo.

REM --- Step 2: Install Dependencies into the venv ---
echo [2/4] Installing/updating packages into the virtual environment...
call .\%VENV_DIR%\Scripts\python.exe -m pip install --upgrade pip
call .\%VENV_DIR%\Scripts\pip.exe install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies into the venv.
    pause
    exit /b %errorlevel%
)
echo.

REM --- Step 3: Run PyInstaller using the venv's Python ---
echo [3/4] Running PyInstaller to create the .exe file...
echo.

call .\%VENV_DIR%\Scripts\pyinstaller.exe --name ChunDiet ^
            --onefile ^
            --console ^
            --icon="nah.png" ^
            --add-data "frontend;frontend" ^
            --add-data "nah.png;." ^
            --collect-data "google-genai" ^
            --collect-data "google.api_core" ^
            --collect-data "pydantic" ^
            --hidden-import "pydantic.v1" ^
            --hidden-import "PIL.Image" ^
            --upx-dir "C:\upx-4.2.4-win64" ^
            run.py

if %errorlevel% neq 0 (
    echo.
    echo ERROR: PyInstaller failed to build the executable.
    pause
    exit /b %errorlevel%
)
echo.

REM --- Step 4: Cleanup ---
echo [4/4] Cleaning up build files...
rmdir /s /q build
del ChunDiet.spec
echo.

echo ========================================
echo       DEBUG BUILD COMPLETE!
echo ========================================
echo Your file ChunDiet.exe is in the 'dist' folder.
echo It will open a console window to show errors.
echo.
pause