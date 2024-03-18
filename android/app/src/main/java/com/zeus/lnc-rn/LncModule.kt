package app.zeusln.zeus;

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.OkHttpClient
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Proxy;
import java.security.cert.X509Certificate

import app.zeusln.zeus.AndroidCallback

import litdmobile.Litdmobile;

class LncModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "LncModule"
  }

  @ReactMethod
  fun registerLocalPrivCreateCallback(namespace: String, onLocalPrivCreate: Callback) {
     val lpccb = AndroidCallback()
     lpccb.setCallback(onLocalPrivCreate)

     Litdmobile.registerLocalPrivCreateCallback(namespace, lpccb)
  }

  @ReactMethod
  fun registerRemoteKeyReceiveCallback(namespace: String, onRemoteKeyReceive: Callback) {
     val rkrcb = AndroidCallback()
     rkrcb.setCallback(onRemoteKeyReceive)

     Litdmobile.registerRemoteKeyReceiveCallback(namespace, rkrcb)
  }

  @ReactMethod
  fun registerAuthDataCallback(namespace: String, onAuthData: Callback) {
     val oacb = AndroidCallback()
     oacb.setCallback(onAuthData)

     Litdmobile.registerAuthDataCallback(namespace, oacb)
  }

  @ReactMethod
  fun initLNC(namespace: String) {
     Litdmobile.initLNC(namespace, "info")
  }

  @ReactMethod
  fun isConnected(namespace: String, promise: Promise) {
     try {
        var response = Litdmobile.isConnected(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun status(namespace: String, promise: Promise) {
     try {
        var response = Litdmobile.status(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun expiry(namespace: String, promise: Promise) {
     try {
        var response = Litdmobile.getExpiry(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun isReadOnly(namespace: String, promise: Promise) {
     try {
        var response = Litdmobile.isReadOnly(namespace)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun hasPerms(namespace: String, permission: String, promise: Promise) {
     try {
        var response = Litdmobile.hasPermissions(namespace, permission)
        promise.resolve(response);
     } catch(e: Throwable) {
        promise.reject("request Error", e);
     }
  }

  @ReactMethod
  fun connectServer(namespace: String, mailboxServerAddr: String, isDevServer: Boolean = false, connectPhrase: String, localStatic: String, remoteStatic: String, promise: Promise) {
     Log.d("connectMailbox", "called with connectPhrase: " + connectPhrase
     + " and mailboxServerAddr: " + mailboxServerAddr);

     try {
         Litdmobile.connectServer(namespace, mailboxServerAddr, isDevServer, connectPhrase, localStatic ?: "", remoteStatic ?: "")
         promise.resolve(null)
     } catch (e: Exception) {
         val exceptionAsString = e.toString()
         promise.resolve(exceptionAsString)
     }
  }

  @ReactMethod
  fun disconnect(namespace: String) {
     Litdmobile.disconnect(namespace)
  }

  @ReactMethod
  fun invokeRPC(namespace: String, route: String, requestData: String, rnCallback: Callback) {
     Log.d("request", "called with route: " + route
     + " and requestData: " + requestData);

     val gocb = AndroidCallback()
     gocb.setCallback(rnCallback)
     Litdmobile.invokeRPC(namespace, route, requestData, gocb)
  }

  private fun sendEvent(event: String, data: String) {
      val params = Arguments.createMap().apply {
        putString("result", data)
      }
      getReactApplicationContext()
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, params)
  }

  @ReactMethod
  fun initListener(namespace: String, eventName: String, request: String) {
     val gocb = AndroidStreamingCallback()
     gocb.setEventName(eventName)
     gocb.setCallback(::sendEvent)
     Litdmobile.invokeRPC(namespace, eventName, request, gocb)
  }
}
