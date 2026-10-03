@echo off
REM ============================================================
REM  一键创建 GitHub 仓库并推送
REM  用法：双击运行，或在 cmd 中执行  setup-github.bat
REM ============================================================
echo ==========================================
echo   Fitness_APP - 创建 GitHub 仓库并推送
echo ==========================================
echo.

REM ---------- 步骤 1：创建仓库（会弹出浏览器授权）----------
echo [1/3] 正在打开 GitHub 创建页面...
echo.
echo  请在浏览器中按以下要点操作：
echo    - Repository name : fitness-app
echo    - Public / Private : 按需选择（建议 Private）
echo    - 勾选 Add a README file       : 不要勾
echo    - 勾选 Add .gitignore          : 不要勾
echo    - License                       : None
echo.
echo  创建后点 "Create repository"，然后回到此窗口。
echo.
start https://github.com/new?name=fitness-app^&description=WeChat-mini-program-fitness-app-MVP
echo 浏览器已打开。按任意键继续（建好后回车）...
pause >nul
echo.

REM ---------- 步骤 2：推送 ----------
echo [2/3] 正在推送到 origin/master ...
git push -u origin master
if errorlevel 1 (
    echo.
    echo [失败] 推送出错。常见原因：
    echo    - 仓库名不是 fitness-app
    echo    - 仓库创建时勾选了 README 导致冲突
    echo.
    echo  解决办法：先建空仓库，或执行以下命令覆盖：
    echo    git push -u origin master --force
    echo.
    pause
    exit /b 1
)
echo.

REM ---------- 步骤 3：验证 ----------
echo [3/3] 验证远程内容...
git ls-remote --heads origin
echo.
echo ==========================================
echo   完成！仓库地址：
echo   https://github.com/TheNorth7747/fitness-app
echo ==========================================
pause
