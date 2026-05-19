# Keep the WebView JS interface surface (none exposed today, but keep
# the activity + receivers intact for the launcher/admin contracts).
-keep class uz.alojon.kiosk.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
