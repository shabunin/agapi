package com.agapi.desktop

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import android.content.Context
import android.net.wifi.WifiManager

class MainActivity : TauriActivity() {
  private var multicastLock: WifiManager.MulticastLock? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    try {
      android.webkit.WebView.setWebContentsDebuggingEnabled(true)
      val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      multicastLock = wifiManager.createMulticastLock("agapi_multicast_lock")
      multicastLock?.setReferenceCounted(true)
      multicastLock?.acquire()
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    try {
      if (multicastLock?.isHeld == true) {
        multicastLock?.release()
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }
}
