import Foundation

// Run outside an application bundle. These checks never need an account or a system prompt.
@main
enum WalletPasskeyChecks {
  static func main() {
    let legacy = Data(repeating: 0x37, count: 32)
    let desktop = DesktopWalletHandle.create(randomID: legacy)
    precondition(desktop.count <= 64)
    precondition(DesktopWalletHandle.matches(desktop))
    precondition(!DesktopWalletHandle.matches(legacy))
    precondition(!DesktopWalletHandle.matches(nil))
    precondition(!DesktopWalletHandle.matches(desktop.dropLast()))
    var otherVersion = desktop
    otherVersion[otherVersion.startIndex] ^= 1
    precondition(!DesktopWalletHandle.matches(otherVersion))
    precondition([1, 2].contains(passkeyCapability()))
  }
}
