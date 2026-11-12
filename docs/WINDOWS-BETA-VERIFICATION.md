# Windows private beta verification

CI builds MSI/NSIS, runs the P2P backend tests, verifies a disposable Windows Credential Manager entry, extracts the actual MSI and starts its app executable, requiring a surviving process and a real window. No installer is uploaded. Administrative extraction is not an install/uninstall or SmartScreen acceptance test.

The current installer is unsigned: no Authenticode certificate/signing service is configured. Apple Developer ID and Tauri updater keys are not Windows publisher certificates. Do not claim verified publisher, bypass Windows warnings, or purchase a signing service automatically. Authenticode and clean-machine installer/SmartScreen verification remain distribution gates.

GitHub's Windows Server runner does not establish compatibility with Docker Desktop on a Windows client. To close that separate runtime gate, use a Windows workstation with Docker Desktop running Linux containers, Python 3, and no real-value test wallet:

```powershell
powershell -ExecutionPolicy RemoteSigned -File scripts/test-windows-docker.ps1
```

The script uses p2pd.image by immutable digest and a fresh unfunded Signet wallet. It verifies startup, localhost binding, API guards, encrypted keystore, exclusive locking and restart. It removes only the disposable resources it creates. Do not mark this gate passed based on a Linux or macOS-hosted Docker run.
