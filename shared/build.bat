@echo off
echo Building Stake Stealth Claimer Executable...
cd ..
npx pkg backend/launcher.js --targets node18-win-x64 --output "StakeClaimer.exe"
echo Done! Click on StakeClaimer.exe to start.
pause
