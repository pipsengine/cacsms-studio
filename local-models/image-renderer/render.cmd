@echo off
setlocal
set RENDER_DIR=%~dp0
set PYTHON_EXE=%RENDER_DIR%.venv\Scripts\python.exe
if exist "%PYTHON_EXE%" (
  "%PYTHON_EXE%" "%RENDER_DIR%render.py" %*
) else (
  py "%RENDER_DIR%render.py" %*
)
