package com.agapi.desktop

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import android.content.Context
import android.media.AudioManager
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

    // WebRTC getUserMedia: RustWebChromeClient (wry, generated) already bridges
    // onPermissionRequest → CAMERA/RECORD_AUDIO — that grants the WebView-level
    // request, but without acquiring audio-communication focus the OS still
    // refuses to actually hand the mic over (NotReadableError at getUserMedia()
    // time, even after the permission prompt was accepted).
    try {
      val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
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
