@echo off
REM Uso: categorizar.bat <arquivo.csv>
REM    O argumento pode ser um caminho completo OU apenas o nome do
REM    arquivo dentro de exemplo_input\.
REM    Resultado vai para output\<nome_do_arquivo>.

setlocal
if "%~1"=="" (
    echo Uso: %~nx0 ^<arquivo.csv^>
    exit /b 2
)

python "%~dp0categorizar_extrato.py" %*
endlocal
