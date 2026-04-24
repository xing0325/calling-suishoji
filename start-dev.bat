@echo off
cd /d "%~dp0"
set NODE_ENV=development
node_modules\.bin\tsx server\_core\index.ts
