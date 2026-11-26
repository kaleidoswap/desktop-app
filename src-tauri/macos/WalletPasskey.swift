import AppKit
import AuthenticationServices
import CryptoKit
import Foundation
import Security

private let domain = "keys.kaleidoswap.com"
private let prfInput = Data("Default".utf8)

// Former extension tests used this RP with random 32-byte user handles.
// The marker identifies Desktop-created credentials inside that shared RP.
enum DesktopWalletHandle {
  private static let prefix = Data("KaleidoSwap Desktop v1\0".utf8)

  static func create(randomID: Data) -> Data { prefix + randomID }

  static func matches(_ value: Data?) -> Bool {
    guard let value else { return false }
    return value.count == prefix.count + 32 && value.starts(with: prefix)
  }
}

// The callback consumes its Rust context exactly once. Borrowed byte buffers are
// valid only for the duration of this call (no PRF output travels through a string).
public typealias WalletPasskeyCompletion =
  @convention(c) (
    UnsafeMutableRawPointer?, Int32, UnsafePointer<UInt8>?, Int, UnsafePointer<UInt8>?, Int
  ) -> Void

private enum Status: Int32 {
  case success = 0
  case olderOS, notProvisioned, cancelled, unsupportedPRF, invalidCredential, busy, unavailable
  case legacyCredential
}

@_cdecl("kaleido_passkey_capability")
public func passkeyCapability() -> Int32 {
  guard #available(macOS 15, *) else { return Status.olderOS.rawValue }
  guard let task = SecTaskCreateFromSelf(nil),
    let domains = SecTaskCopyValueForEntitlement(
      task, "com.apple.developer.associated-domains" as CFString, nil) as? [String],
    domains.contains("webcredentials:" + domain),
    let team = SecTaskCopyValueForEntitlement(
      task, "com.apple.developer.team-identifier" as CFString, nil) as? String,
    let bundleID = Bundle.main.bundleIdentifier,
    let appID = SecTaskCopyValueForEntitlement(
      task, "com.apple.application-identifier" as CFString, nil) as? String,
    !team.isEmpty, appID.split(separator: ".", maxSplits: 1).last.map(String.init) == bundleID,
    FileManager.default.fileExists(
      atPath: Bundle.main.bundleURL.appendingPathComponent("Contents/embedded.provisionprofile")
        .path)
  else { return Status.notProvisioned.rawValue }
  // Reject ad-hoc signatures even when a local build copies the entitlement plist.
  var code: SecCode?
  var requirement: SecRequirement?
  let flags = SecCSFlags()
  guard SecCodeCopySelf(flags, &code) == errSecSuccess, let code,
    SecRequirementCreateWithString("anchor apple generic" as CFString, flags, &requirement)
      == errSecSuccess,
    let requirement, SecCodeCheckValidity(code, flags, requirement) == errSecSuccess
  else { return Status.notProvisioned.rawValue }
  return Status.success.rawValue
}

@_cdecl("kaleido_passkey_request")
public func passkeyRequest(
  _ register: Bool, _ id: UnsafePointer<UInt8>?, _ length: Int,
  _ context: UnsafeMutableRawPointer?, _ completion: WalletPasskeyCompletion
) {
  let capability = passkeyCapability()
  guard capability == 0, #available(macOS 15, *) else {
    completion(context, capability, nil, 0, nil, 0)
    return
  }
  let expectedID = id.map { Data(bytes: $0, count: length) }
  DispatchQueue.main.async {
    guard Session.active == nil else {
      completion(context, Status.busy.rawValue, nil, 0, nil, 0)
      return
    }
    guard let window = NSApp?.keyWindow ?? NSApp?.mainWindow else {
      completion(context, Status.unavailable.rawValue, nil, 0, nil, 0)
      return
    }
    let session = Session(
      window: window, register: register, expectedID: expectedID,
      context: context, completion: completion)
    Session.active = session
    session.start()
  }
}

@available(macOS 15, *)
@MainActor
private final class Session: NSObject, ASAuthorizationControllerDelegate,
  ASAuthorizationControllerPresentationContextProviding
{
  static var active: Session?
  private let window: NSWindow
  private let register: Bool
  private let expectedID: Data?
  private let context: UnsafeMutableRawPointer?
  private let completion: WalletPasskeyCompletion
  private var controller: ASAuthorizationController?
  private var timer: DispatchWorkItem?

  init(
    window: NSWindow, register: Bool, expectedID: Data?, context: UnsafeMutableRawPointer?,
    completion: @escaping WalletPasskeyCompletion
  ) {
    self.window = window
    self.register = register
    self.expectedID = expectedID
    self.context = context
    self.completion = completion
  }

  private func randomBytes() -> Data? {
    var bytes = Data(count: 32)
    let status = bytes.withUnsafeMutableBytes {
      SecRandomCopyBytes(kSecRandomDefault, $0.count, $0.baseAddress!)
    }
    return status == errSecSuccess ? bytes : nil
  }

  func start() {
    guard let challenge = randomBytes() else {
      finish(.unavailable)
      return
    }
    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
      relyingPartyIdentifier: domain)
    let request: ASAuthorizationRequest
    if register {
      guard let randomID = randomBytes() else {
        finish(.unavailable)
        return
      }
      // A distinct user handle preserves other Desktop wallets on this RP.
      let userID = DesktopWalletHandle.create(randomID: randomID)
      let name = "KaleidoSwap Desktop · " + String(UUID().uuidString.prefix(8))
      let creation = provider.createCredentialRegistrationRequest(
        challenge: challenge, name: name, userID: userID)
      creation.userVerificationPreference = .required
      creation.prf = .checkForSupport
      request = creation
    } else {
      let assertion = provider.createCredentialAssertionRequest(challenge: challenge)
      assertion.userVerificationPreference = .required
      if let id = expectedID {
        assertion.allowedCredentials = [
          ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: id)
        ]
      }
      // AuthenticationServices applies WebAuthn PRF domain separation.
      assertion.prf = .inputValues(.saltInput1(prfInput))
      request = assertion
    }
    let controller = ASAuthorizationController(authorizationRequests: [request])
    self.controller = controller
    controller.delegate = self
    controller.presentationContextProvider = self
    let timer = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.controller?.cancel()
      self.finish(.cancelled)
    }
    self.timer = timer
    DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: timer)
    controller.performRequests()
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    window
  }

  func authorizationController(
    controller: ASAuthorizationController, didCompleteWithError error: Error
  ) {
    let nsError = error as NSError
    let cancelled =
      nsError.domain == ASAuthorizationError.errorDomain
      && nsError.code == ASAuthorizationError.canceled.rawValue
    finish(cancelled ? .cancelled : .unavailable)
  }

  func authorizationController(
    controller: ASAuthorizationController, didCompleteWithAuthorization result: ASAuthorization
  ) {
    if register,
      let credential = result.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration
    {
      // Persist only the public pending ID. The subsequent explicit assertion determines
      // whether this provider can derive a wallet and is required before any wallet commit.
      finish(.success, id: credential.credentialID)
      return
    }
    guard !register,
      let assertion = result.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion,
      expectedID == nil || expectedID == assertion.credentialID
    else {
      finish(.invalidCredential)
      return
    }
    // Authenticator data begins with SHA256(rpId) and the UP/UV flags.
    guard let data = assertion.rawAuthenticatorData as Data?, data.count >= 37,
      data.prefix(32).elementsEqual(SHA256.hash(data: Data(domain.utf8))),
      data[data.startIndex + 32] & 0x05 == 0x05
    else {
      finish(.invalidCredential)
      return
    }
    guard DesktopWalletHandle.matches(assertion.userID) else {
      finish(.legacyCredential)
      return
    }
    guard let key = assertion.prf?.first, key.bitCount == 256 else {
      finish(.unsupportedPRF)
      return
    }
    finish(.success, id: assertion.credentialID, key: key)
  }

  private func finish(_ status: Status, id: Data = Data(), key: SymmetricKey? = nil) {
    guard Session.active === self else { return }
    Session.active = nil
    timer?.cancel()
    timer = nil
    controller?.delegate = nil
    controller = nil
    id.withUnsafeBytes { idBytes in
      let idPointer = idBytes.bindMemory(to: UInt8.self).baseAddress
      if let key {
        key.withUnsafeBytes { bytes in
          completion(
            context, status.rawValue, idPointer, idBytes.count,
            bytes.bindMemory(to: UInt8.self).baseAddress, bytes.count)
        }
      } else {
        completion(context, status.rawValue, idPointer, idBytes.count, nil, 0)
      }
    }
  }
}
