# 生成 macOS 风格图标源图：在透明画布上居中绘制内容，四周留白并套圆角，
# 以符合 Apple HIG（内容约占画布 80%）。输出供 `tauri icon` 重新生成 .icns。
param(
  [string]$Source = "$PSScriptRoot\..\src-tauri\icons\icon.png",
  [string]$Output = "$PSScriptRoot\..\tmp-macos\macos-source.png",
  [int]$Size = 1024,
  [int]$Content = 824,
  [int]$Radius = 185
)

Add-Type -AssemblyName System.Drawing

$outDir = Split-Path -Parent $Output
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
$bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$margin = [int](($Size - $Content) / 2)
$x = $margin; $y = $margin; $w = $Content; $h = $Content
$d = $Radius * 2

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($x, $y, $d, $d, 180, 90)
$path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
$path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
$path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
$path.CloseFigure()

$g.SetClip($path)
$g.DrawImage($src, $x, $y, $w, $h)
$g.ResetClip()

$bmp.Save((New-Item -ItemType File -Path $Output -Force).FullName, [System.Drawing.Imaging.ImageFormat]::Png)

$path.Dispose(); $g.Dispose(); $bmp.Dispose(); $src.Dispose()
Write-Output "Saved: $Output"
