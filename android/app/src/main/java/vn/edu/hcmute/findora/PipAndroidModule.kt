package vn.edu.hcmute.findora

import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PipAndroidModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PipAndroid"

    @ReactMethod
    fun enterPip(aspectWidth: Int, aspectHeight: Int, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val num = if (aspectWidth > 0) aspectWidth else 16
                val den = if (aspectHeight > 0) aspectHeight else 9
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(num, den))
                    .build()
                val entered = activity.enterPictureInPictureMode(params)
                promise.resolve(entered)
            } catch (e: Exception) {
                promise.reject("PIP_ERROR", e.message, e)
            }
        } else {
            promise.reject("UNSUPPORTED", "Android version must be >= 8.0 (API 26)")
        }
    }

    @ReactMethod
    fun setAutoPip(enabled: Boolean, promise: Promise) {
        MainActivity.isPipEnabled = enabled
        promise.resolve(true)
    }

    @ReactMethod
    fun isPipSupported(promise: Promise) {
        val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        promise.resolve(supported)
    }
}
