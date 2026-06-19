@echo off
echo Setting environment variables for E: drive cache/temp redirect...
setx NODE_ENV_CACHE "E:\ExpoCache"
setx TMP "E:\ExpoTemp"
setx TEMP "E:\ExpoTemp"
echo.
echo Done! New terminal sessions will have these variables.
echo Note: Close and reopen your terminal for changes to take effect.
echo.
echo Current session variables (set manually):
set NODE_ENV_CACHE=E:\ExpoCache
set TMP=E:\ExpoTemp
set TEMP=E:\ExpoTemp
echo.
echo Verification:
echo NODE_ENV_CACHE=%NODE_ENV_CACHE%
echo TMP=%TMP%
echo TEMP=%TEMP%
