@echo off
rem ===========================================================================
rem  动物骑单车测试台 - 临时启动用（关掉这个窗口服务就停，不留后台进程）
rem
rem    启动.bat          单进程模式：后端顺便托管前端，只有一个地址 127.0.0.1:8787
rem    启动.bat dev      开发模式：前端 127.0.0.1:5174，改代码自动刷新
rem
rem  它自己会判断：缺依赖就 npm install，没构建过前端就先 build 一次，
rem  等服务真的起来了再开浏览器，端口已经占着就不重复启动。
rem  不想自动开浏览器：先在命令行执行 set NOBROWSER=1，再运行本文件。
rem ===========================================================================
setlocal
chcp 936 >nul 2>nul
title 动物骑单车测试台
cd /d "%~dp0"

set "MODE=prod"
if /i "%~1"=="dev" set "MODE=dev"
if /i "%~1"=="--dev" set "MODE=dev"

echo.
echo   动物骑单车测试台
echo   ----------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node
where npm >nul 2>nul
if errorlevel 1 goto no_node

if exist "node_modules" goto have_deps
echo [*] 还没装依赖，先跑一次 npm install，装完会自动继续。
call npm install
if errorlevel 1 goto fail

:have_deps
if /i "%MODE%"=="dev" goto dev
if exist "dist\web\index.html" goto after_build
echo [*] 还没有前端产出，先构建一次（npm run build）。
call npm run build
if errorlevel 1 goto fail

:after_build
set "PORT=8787"
set "URL=http://127.0.0.1:8787"
call :port_busy
if "%BUSY%"=="1" goto already
echo [*] 页面和接口都在 %URL%
echo     刚改过前端代码的话，改用「启动.bat dev」起开发模式。
goto open_then_run

:dev
set "PORT=5174"
set "URL=http://127.0.0.1:5174"
call :port_busy
if "%BUSY%"=="1" goto already
echo [*] 开发模式：页面在 %URL% ，接口自动代理到 127.0.0.1:8787

:open_then_run
if defined NOBROWSER goto run
rem 另开一个最小化窗口，等接口真的通了再开浏览器，免得开出一个连不上的页面
where curl >nul 2>nul
if errorlevel 1 goto open_simple
start "" /min cmd /c "curl -s -o nul --retry 30 --retry-delay 1 --retry-connrefused --max-time 2 %URL%/api/config && start %URL%"
goto run

:open_simple
start "" /min cmd /c "timeout /t 6 /nobreak >nul && start %URL%"
goto run

:run
echo.
echo [*] 正在启动，看到下面打印出地址就是好了。（Ctrl+C 或直接关掉本窗口即停止）
echo.
if /i "%MODE%"=="dev" goto run_dev
call npm start
goto stopped

:run_dev
call npm run dev
goto stopped

rem ---------------------------------------------------------------- 收尾与出错
:already
echo [!] %URL% 已经有东西在监听，看上去服务早就跑着了。
echo     这次不重复启动，只帮你把浏览器打开；要重开请先关掉原来那个窗口。
start "" "%URL%"
echo.
pause
exit /b 0

:stopped
echo.
echo [*] 服务已停止。
pause
exit /b 0

:no_node
echo [x] 没找到 node 或 npm。请先安装 Node.js 20 以上版本，装完重开一个窗口再运行本文件。
pause
exit /b 1

:fail
echo.
echo [x] 上面那一步失败了，服务没有启动。
pause
exit /b 1

rem ---------------------------------------------------------------- 工具
:port_busy
set "BUSY=0"
netstat -an | findstr /c:":%PORT% " | findstr /i "LISTENING" >nul 2>nul
if not errorlevel 1 set "BUSY=1"
exit /b 0