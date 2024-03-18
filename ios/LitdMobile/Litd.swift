import Foundation
import Litdmobile
import SwiftProtobuf

public struct LndError: Error {
  let msg: String
}

extension LndError: LocalizedError {
  public var errorDescription: String? {
    return NSLocalizedString(msg, comment: "")
  }
}

enum LndStatusCodes: NSNumber {
  case STATUS_SERVICE_BOUND = 1
  case STATUS_PROCESS_STARTED = 2
  case STATUS_WALLET_UNLOCKED = 4
}

// Used for anyone who wants to use this class
typealias Callback = (Data?, Error?) -> Void
typealias StreamCallback = (Data?, Error?) -> Void

// Used internally in this class to deal with Litdmobile/Go
class LitdmobileCallback: NSObject, LitdmobileCallbackProtocol {
  var method: String
  var callback: Callback

  init(method: String, callback: @escaping Callback) {
    self.method = method
    self.callback = callback
  }

  func onResponse(_ p0: Data?) {
    self.callback(p0, nil)
  }

  func onError(_ p0: Error?) {
    NSLog("Inside onError " + self.method)
    NSLog(p0?.localizedDescription ?? "unknown error")
    self.callback(nil, p0)
  }
}

class LitdmobileReceiveStream: NSObject, LitdmobileRecvStreamProtocol {
  var method: String
  var callback: StreamCallback

  init(method: String, callback: @escaping StreamCallback) {
    self.method = method
    self.callback = callback
  }

  func onResponse(_ p0: Data?) {
    self.callback(p0, nil)
  }

  func onError(_ p0: Error?) {
    NSLog("LitdmobileReceiveStream onError " + self.method)
    NSLog(p0?.localizedDescription ?? "unknown error")
    self.callback(nil, p0)
  }
}

open class Lnd {
  static let shared = Lnd()

  var lndStarted = false
  var activeStreams: [String] = []

  static let syncMethods: [String: (Data?, (any LitdmobileCallbackProtocol)?) -> Void] = [
    // index
    //
    "AddInvoice": { bytes, cb in LitdmobileAddInvoice(bytes, cb) },
    "InvoicesCancelInvoice": { bytes, cb in LitdmobileInvoicesCancelInvoice(bytes, cb) },
    "ConnectPeer": { bytes, cb in LitdmobileConnectPeer(bytes, cb) },
    "DecodePayReq": { bytes, cb in LitdmobileDecodePayReq(bytes, cb) },
    "DescribeGraph": { bytes, cb in LitdmobileDescribeGraph(bytes, cb) },
    "GetInfo": { bytes, cb in LitdmobileGetInfo(bytes, cb) },
    "GetNodeInfo": { bytes, cb in LitdmobileGetNodeInfo(bytes, cb) },
    "LookupInvoice": { bytes, cb in LitdmobileLookupInvoice(bytes, cb) },
    "ListPeers": { bytes, cb in LitdmobileListPeers(bytes, cb) },
    "DisconnectPeer": { bytes, cb in LitdmobileDisconnectPeer (bytes, cb) },
    "SendPaymentSync": { bytes, cb in LitdmobileSendPaymentSync(bytes, cb) },
    "GetRecoveryInfo": { bytes, cb in LitdmobileGetRecoveryInfo(bytes, cb) },
    "WalletKitListUnspent": { bytes, cb in LitdmobileWalletKitListUnspent(bytes, cb) },
    "RouterResetMissionControl": { bytes, cb in LitdmobileRouterResetMissionControl(bytes, cb) },
    "QueryRoutes": { bytes, cb in LitdmobileQueryRoutes(bytes, cb) },
    "ListPayments": { bytes, cb in LitdmobileListPayments(bytes, cb) },
    "ListInvoices": { bytes, cb in LitdmobileListInvoices(bytes, cb) },

    // channel
    //
    "ChannelBalance": { bytes, cb in LitdmobileChannelBalance(bytes, cb) },
    "ListChannels": { bytes, cb in LitdmobileListChannels(bytes, cb) },
    "OpenChannelSync": { bytes, cb in LitdmobileOpenChannelSync(bytes, cb) },
    "PendingChannels": { bytes, cb in LitdmobilePendingChannels(bytes, cb) },
    "ClosedChannels": { bytes, cb in LitdmobileClosedChannels(bytes, cb) },
    "ExportAllChannelBackups": { bytes, cb in LitdmobileExportAllChannelBackups(bytes, cb) },
    "RestoreChannelBackups": { bytes, cb in LitdmobileRestoreChannelBackups(bytes, cb) },
    "VerifyChanBackup": { bytes, cb in LitdmobileVerifyChanBackup(bytes, cb) },
    "GetChanInfo": { bytes, cb in LitdmobileGetChanInfo(bytes, cb) },
    "AbandonChannel": { bytes, cb in LitdmobileAbandonChannel(bytes, cb) },
    "GetNetworkInfo": { bytes, cb in LitdmobileGetNetworkInfo(bytes, cb) },

    // onchain
    //
    "GetTransactions": { bytes, cb in LitdmobileGetTransactions(bytes, cb) },
    "NewAddress": { bytes, cb in LitdmobileNewAddress(bytes, cb) },
    "SendCoins": { bytes, cb in LitdmobileSendCoins(bytes, cb) },
    "WalletBalance": { bytes, cb in LitdmobileWalletBalance(bytes, cb) },

    // wallet
    "GenSeed": { bytes, cb in LitdmobileGenSeed(bytes, cb) },
    "InitWallet": { bytes, cb in LitdmobileInitWallet(bytes, cb) },
    "UnlockWallet": { bytes, cb in LitdmobileUnlockWallet(bytes, cb) },
    "WalletKitDeriveKey": { bytes, cb in LitdmobileWalletKitDeriveKey(bytes, cb) },
//    derivePrivateKey
    "VerifyMessage": { bytes, cb in LitdmobileVerifyMessage(bytes, cb) },
    "SignMessage": { bytes, cb in LitdmobileSignMessage(bytes, cb) },
    "SignerSignMessage": { bytes, cb in LitdmobileSignerSignMessage(bytes, cb) },
    "BumpFee": { bytes, cb in LitdmobileWalletKitBumpFee(bytes, cb) },

    // autopilot
    "AutopilotStatus": { bytes, cb in LitdmobileAutopilotStatus(bytes, cb) },
    "AutopilotModifyStatus": { bytes, cb in LitdmobileAutopilotModifyStatus(bytes, cb) },
    "AutopilotQueryScores": { bytes, cb in LitdmobileAutopilotQueryScores(bytes, cb) },
    "AutopilotSetScores": { bytes, cb in LitdmobileAutopilotSetScores(bytes, cb) },
  ]

  static let streamMethods: [String: (Data?, (any LitdmobileRecvStreamProtocol)?) -> Void] = [
    // index
    //
    "RouterSendPaymentV2": { req, cb in return LitdmobileRouterSendPaymentV2(req, cb) },
    "SubscribeState": { req, cb in return LitdmobileSubscribeState(req, cb) },
    "RouterTrackPaymentV2": { req, cb in return LitdmobileRouterTrackPaymentV2(req, cb) },
    // channel
    //
    "CloseChannel": { req, cb in return LitdmobileCloseChannel(req, cb)},
    "SubscribeChannelEvents": { req, cb in return LitdmobileSubscribeChannelEvents(req, cb)},
    "SubscribeChannelGraph": { req, cb in return LitdmobileSubscribeChannelGraph(req, cb)},
    // onchain
    //
    "SubscribeTransactions": { req, cb in return LitdmobileSubscribeTransactions(req, cb) },
    "SubscribeInvoices": { req, cb in return LitdmobileSubscribeInvoices(req, cb) },
  ]

  static let biStreamMethods: [String: ((any LitdmobileRecvStreamProtocol)?) -> (any LitdmobileSendStreamProtocol)?] = [
    "ChannelAcceptor": {cb in return LitdmobileChannelAcceptor(cb, nil) }
  ]

  var writeStreams: [String: LitdmobileSendStream] = [:]

  func checkStatus() -> Int32 {
    // Service is always bound on iOS
    var flags = LndStatusCodes.STATUS_SERVICE_BOUND.rawValue.int32Value

    if (self.lndStarted) {
      flags += LndStatusCodes.STATUS_PROCESS_STARTED.rawValue.int32Value
    }

    return flags
  }

  func startLnd(_ args: String, isTorEnabled: Bool, isTestnet: Bool, lndStartedCallback: @escaping Callback) -> Void {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let lndPath = applicationSupport.appendingPathComponent("lnd", isDirectory: true)

    var lndArgs = "--lnd.nolisten --lnd.lnddir=\"\(lndPath.path)\" " + args
    if (isTorEnabled) {
      lndArgs += " --tor.active"
    }

    let started: Callback = {(data: Data?, error: Error?) in {
      self.lndStarted = true
      lndStartedCallback(data, error)
    }()}

    LitdmobileStart(
      lndArgs,
      LitdmobileCallback(method: "start", callback: started)
    )
  }

  func stopLnd(_ callback: @escaping Callback) {
    do {
      let stopRequest = Lnrpc_StopRequest()
      let payload = try stopRequest.serializedData()
      LitdmobileStopDaemon(payload, LitdmobileCallback(method: "stopLnd", callback: callback))
    } catch let error {
      callback(nil, error)
    }
  }

  func initWallet(_ seed: [String], password: String, recoveryWindow: Int32, channelsBackupsBase64: String, callback: @escaping Callback) {
    do {
      var initWalletRequest = Lnrpc_InitWalletRequest()
      initWalletRequest.cipherSeedMnemonic = seed
      initWalletRequest.walletPassword = password.data(using: .utf8).unsafelyUnwrapped
      if (recoveryWindow != 0) {
        initWalletRequest.recoveryWindow = recoveryWindow
      }

      if (channelsBackupsBase64 != "") {
        NSLog("--CHANNEL BACKUP RESTORE--")
        var chanBackupSnapshot = Lnrpc_ChanBackupSnapshot()
        var multiChanBackup = Lnrpc_MultiChanBackup()

        multiChanBackup.multiChanBackup = Data(base64Encoded: channelsBackupsBase64, options: [])!
        chanBackupSnapshot.multiChanBackup = multiChanBackup

        initWalletRequest.channelBackups = chanBackupSnapshot
      }
      let payload = try initWalletRequest.serializedData()
      LitdmobileInitWallet(payload, LitdmobileCallback(method: "InitWallet", callback: callback))
    } catch let error {
      callback(nil, error)
    }
  }

  func unlockWallet(_ password: String, callback: @escaping Callback) {
    do {
      var unlockWalletRequest = Lnrpc_UnlockWalletRequest();
      unlockWalletRequest.walletPassword = password.data(using: .utf8).unsafelyUnwrapped
      let payload = try unlockWalletRequest.serializedData()
      LitdmobileUnlockWallet(payload, LitdmobileCallback(method: "UnlockWallet", callback: callback))
    } catch let error {
      callback(nil, error)
    }
  }

  func sendCommand(_ method: String, payload: String, callback: @escaping Callback) {
    let block = Lnd.syncMethods[method]

    if block == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }

    let bytes = Data(base64Encoded: payload, options: [])
    block?(bytes, LitdmobileCallback(method: method, callback: callback))
  }

  func sendStreamCommand(_ method: String, payload: String, streamOnlyOnce: Bool, callback: @escaping StreamCallback) {
    if (streamOnlyOnce) {
      if (self.activeStreams.contains(method)) {
        NSLog("Attempting to stream " + method + " twice, not allowing")
        return
      } else {
        self.activeStreams.append(method)
      }
    }
    let block = Lnd.streamMethods[method]
    if block == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }

    let bytes = Data(base64Encoded: payload, options: [])
    block?(bytes, LitdmobileReceiveStream(method: method, callback: callback))
  }

  func sendBidiStreamCommand(_ method: String, streamOnlyOnce: Bool, callback: @escaping StreamCallback) {
    if (streamOnlyOnce) {
      if (self.activeStreams.contains(method)) {
        NSLog("Attempting to stream " + method + " twice, not allowing")
        return
      } else {
        self.activeStreams.append(method)
      }
    }
    let block = Lnd.biStreamMethods[method]
    if block == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }

    let writeStream = block?(LitdmobileReceiveStream(method: method, callback: callback))
    writeStreams.updateValue(writeStream as! LitdmobileSendStream, forKey: method)
  }

  func writeToStream(_ method: String, payload: String, callback: @escaping StreamCallback) {
    let write = Lnd.shared.writeStreams[method]
    if write == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }
    do {
      let bytes = Data(base64Encoded: payload, options: [])
      try write?.send(bytes) // TODO(hsjoberg): Figure out whether send returns a BOOL?
      callback(nil, nil)
    } catch let error {
      callback(nil, error)
    }
  }

 func gossipSync(_ cacheDir: String, dataDir: String, networkType: String, callback: @escaping Callback) {
   LitdmobileGossipSync(cacheDir, dataDir, networkType, LitdmobileCallback(method: "zeus_gossipSync", callback: callback))
 }
}
