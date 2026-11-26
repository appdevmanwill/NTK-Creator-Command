# ProGuard rules for NTK Creator Command
-keepattributes JavascriptInterface
-keepclassmembers class com.ntkhub.creatorcommand.MainActivity$NTKAndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
