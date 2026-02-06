puts "Step 1: Loading DLL from [pwd]..."
set dllPath [file join [pwd] orDb_Dll_Tcl64.dll]
if {[catch {load $dllPath DboTclWriteBasic} err]} {
    puts "ERROR: $err"
    exit 1
}
puts "Step 2: DLL loaded OK"
set mSession [DboTclHelper_sCreateSession]
puts "Step 3: Session created"
DboTclHelper_sDeleteSession $mSession
puts "All tests passed!"
