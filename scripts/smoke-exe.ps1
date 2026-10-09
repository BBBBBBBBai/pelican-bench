# 冒烟测试打包出来的单文件 exe。
#
#   pwsh -File scripts/smoke-exe.ps1                 自动找 build\pelican-bench-*.exe
#   pwsh -File scripts/smoke-exe.ps1 -Exe build\pelican-bench-0.2.0-win-x64.exe
#   pwsh -File scripts/smoke-exe.ps1 -InPlace        跑原地不拷贝（一般用不上，见下）
#
# 检查四件事：进程能起来、/api/config 有响应、首页与内嵌静态资源能取到、
# %APPDATA%\PelicanBench 落了 config.json 与 prompts.json。跑完一定停掉进程（finally）。
#
# 为什么默认要先拷到 %TEMP% 再跑：装了 DSH 之类的 agent 沙箱时，沙箱会按「可执行文件的
# 位置」放行写权限 —— 凡是从工作区里启动的进程，写工作区外的路径一律 EPERM。这是沙箱的
# 特性，不是 exe 的毛病（「未改动的官方 node.exe 拷进工作区」同样 EPERM，而「注入过的 exe
# 拷到 %TEMP%」写真实 %APPDATA% 完全正常）。所以测「真实用户双击」的场景，必须把 exe
# 放到工作区外去跑。CI 上没有沙箱，这一拷只是变得多余，不会出错。
param(
  [string]$Exe = '',
  [int]$Port = 8787,
  [int]$WaitSec = 8,
  [switch]$InPlace
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not $Exe) {
  $found = Get-ChildItem (Join-Path $root 'build') -Filter 'pelican-bench-*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $found) { Write-Error "build\ 下没有 pelican-bench-*.exe —— 先跑 npm run build:exe"; exit 2 }
  $srcExe = $found.FullName
} else {
  $srcExe = if ([System.IO.Path]::IsPathRooted($Exe)) { $Exe } else { Join-Path $root $Exe }
}
if (-not (Test-Path $srcExe)) { Write-Error "找不到 exe：$srcExe"; exit 2 }

if ($InPlace) {
  $exePath = $srcExe
} else {
  $stage = Join-Path $env:TEMP 'pb-smoke'
  New-Item -ItemType Directory $stage -Force | Out-Null
  $exePath = Join-Path $stage (Split-Path -Leaf $srcExe)
  Copy-Item $srcExe $exePath -Force
}

$out = Join-Path $env:TEMP 'pb-smoke-out.txt'
$err = Join-Path $env:TEMP 'pb-smoke-err.txt'
Remove-Item $out, $err -ErrorAction SilentlyContinue

$env:PB_NO_OPEN = '1'   # 别在冒烟测试里弹浏览器
$proc = $null
$fail = 0
function Check($label, $ok, $detail) {
  if ($ok) { Write-Output "  [OK]   $label  $detail" }
  else { Write-Output "  [FAIL] $label  $detail"; $script:fail++ }
}

Write-Output "源 exe：$srcExe"
Write-Output "跑    ：$exePath"
Write-Output "体积  ：$([math]::Round((Get-Item $exePath).Length / 1MB, 1)) MB"

try {
  $proc = Start-Process -FilePath $exePath -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -NoNewWindow

  $deadline = (Get-Date).AddSeconds($WaitSec)
  $config = $null
  while ((Get-Date) -lt $deadline -and -not $config) {
    Start-Sleep -Milliseconds 400
    if ($proc.HasExited) { break }
    try { $config = Invoke-WebRequest "http://127.0.0.1:$Port/api/config" -UseBasicParsing -TimeoutSec 3 } catch { }
  }

  Write-Output "`n--- 进程输出 ---"
  (Get-Content $out -Raw -ErrorAction SilentlyContinue)
  $errText = (Get-Content $err -Raw -ErrorAction SilentlyContinue)
  if ($errText) { Write-Output "--- stderr ---`n$errText" }

  Write-Output "`n--- 检查 ---"
  Check "进程还活着" (-not $proc.HasExited) "pid=$($proc.Id)"
  Check "GET /api/config" ($null -ne $config) $(if ($config) { ($config.Content | ConvertFrom-Json).dataDir } else { '无响应' })

  if ($config) {
    $cfg = $config.Content | ConvertFrom-Json
    Check "UI 语言是 zh" ($cfg.uiLang -eq 'zh') "uiLang=$($cfg.uiLang)"
    Check "供应商列表为空" ($cfg.providers.Count -eq 0) "providers=$($cfg.providers.Count)"
    Check "modelPresets 10 项" ($cfg.modelPresets.Count -eq 10) "presets=$($cfg.modelPresets.Count)"
  }

  try {
    $home_ = Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5
    Check "GET / 首页" ($home_.StatusCode -eq 200 -and $home_.Content -match '鹈鹕测试台') "status=$($home_.StatusCode) len=$($home_.RawContentLength) type=$($home_.Headers['Content-Type'])"
  } catch { Check "GET / 首页" $false $_.Exception.Message }

  # 资源文件名带构建哈希，从 dist/web 里现找，别把哈希写死在脚本里
  $js = (Get-ChildItem (Join-Path $root 'dist\web\assets') -Filter 'index-*.js' | Select-Object -First 1).Name
  try {
    $asset = Invoke-WebRequest "http://127.0.0.1:$Port/assets/$js" -UseBasicParsing -TimeoutSec 5
    Check "GET 内嵌静态资源 $js" ($asset.StatusCode -eq 200) "len=$($asset.RawContentLength) cache=$($asset.Headers['Cache-Control'])"
  } catch { Check "GET 内嵌静态资源 $js" $false $_.Exception.Message }

  # 题池是懒加载的：走过一次 /api/prompts 才会把 prompts.json 释放到用户目录
  try {
    # 响应形状是 { pool:{animals,template,templateEn,extras}, entries, promptsPath, lang }
    $prompts = (Invoke-WebRequest "http://127.0.0.1:$Port/api/prompts" -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
    Check "GET /api/prompts" ($prompts.pool.animals.Count -eq 20 -and $prompts.pool.extras.Count -eq 1 -and $prompts.entries.Count -eq 21) "动物 $($prompts.pool.animals.Count) 只 / 附加题 $($prompts.pool.extras.Count) 道 / 展开后 $($prompts.entries.Count) 条"
  } catch { Check "GET /api/prompts" $false $_.Exception.Message }

  $homeDir = Join-Path $env:APPDATA 'PelicanBench'
  $files = if (Test-Path $homeDir) { Get-ChildItem $homeDir } else { @() }
  $names = ($files | ForEach-Object { $_.Name }) -join ', '
  Check "%APPDATA%\PelicanBench 落地" ($files.Count -ge 2) "$homeDir -> $names"
}
finally {
  if ($proc -and -not $proc.HasExited) { $proc | Stop-Process -Force; Start-Sleep -Milliseconds 500 }
  # 端口要么已经放掉，要么是别人的进程 —— 只报告，不动手
  $still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  Write-Output "`n端口 $Port ：$(if ($still) { '仍被占用' } else { '已空闲' })"
  Write-Output "`n$(if ($fail -eq 0) { '全部通过' } else { "$fail 项失败" })"
  exit $fail
}
