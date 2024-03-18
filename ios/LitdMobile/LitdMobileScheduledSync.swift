import Foundation

@objc(LitdMobileScheduledSync)
class LitdMobileScheduledSync: NSObject, RCTBridgeModule {
  @objc
  static func moduleName() -> String! {
    "LitdMobileScheduledSync"
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(setupScheduledSyncWork:rejecter:)
  func setupScheduledSyncWork(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock ) -> Void {
    resolve(true)
  }

  @objc(removeScheduledSyncWork:rejecter:)
  func removeScheduledSyncWork(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) -> Void {
    resolve(true)
  }

  @objc(checkScheduledSyncWorkStatus:rejecter:)
  func checkScheduledSyncWorkStatus(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) -> Void {
  }
}
