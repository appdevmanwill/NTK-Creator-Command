package com.ntkhub.creatorcommand

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var rootContainer: FrameLayout
    private lateinit var vaultCrypto: KeystoreCrypto
    private val networkExecutor = Executors.newCachedThreadPool()
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var lastBackPressMs: Long = 0L

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        fileUploadCallback?.onReceiveValue(uris)
        fileUploadCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        vaultCrypto = KeystoreCrypto(this)

        rootContainer = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#09090B"))
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootContainer.addView(webView)
        setContentView(rootContainer)

        ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { view, insets ->
            val sysBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val bottom = maxOf(sysBars.bottom, ime.bottom)
            view.setPadding(sysBars.left, sysBars.top, sysBars.right, bottom)
            insets
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        webView.addJavascriptInterface(NTKAndroidBridge(), "NTKAndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                if (url.startsWith("https://appassets.androidplatform.net/")) {
                    return false
                }
                openUrlExternally(url)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback
                return try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                    true
                } catch (_: Exception) {
                    fileUploadCallback = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(function(){return window.__ntkOnHardwareBack ? window.__ntkOnHardwareBack() : false;})()"
                ) { raw ->
                    val handled = raw == "true"
                    if (handled) return@evaluateJavascript
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        val now = System.currentTimeMillis()
                        if (now - lastBackPressMs < 2000) {
                            finish()
                        } else {
                            lastBackPressMs = now
                            Toast.makeText(
                                this@MainActivity,
                                "Press back again to exit NTK Creator Command",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }
            }
        })

        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private fun openUrlExternally(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(this, "No app available to open link", Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateSystemBars(theme: String) {
        val isLight = theme.equals("light", ignoreCase = true)
        val bgColor = if (isLight) Color.parseColor("#F6F3EC") else Color.parseColor("#09090B")
        rootContainer.setBackgroundColor(bgColor)
        window.statusBarColor = bgColor
        window.navigationBarColor = bgColor
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = isLight
        controller.isAppearanceLightNavigationBars = isLight
    }

    override fun onDestroy() {
        networkExecutor.shutdownNow()
        super.onDestroy()
    }

    inner class NTKAndroidBridge {

        @JavascriptInterface
        fun httpRequest(
            callbackId: String,
            url: String,
            method: String,
            headersJson: String,
            body: String
        ) {
            networkExecutor.execute {
                val resultJson = JSONObject()
                try {
                    if (!BridgeUtils.isAllowedRequestUrl(url)) {
                        resultJson.put("ok", false)
                        resultJson.put("status", 400)
                        resultJson.put("body", "")
                        resultJson.put("error", "URL must use HTTPS (HTTP allowed only for local Wi-Fi IPs)")
                    } else {
                        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                            requestMethod = method.uppercase()
                            connectTimeout = 15000
                            readTimeout = 25000
                            doInput = true
                            val headers = try {
                                JSONObject(headersJson)
                            } catch (_: Exception) {
                                JSONObject()
                            }
                            val keys = headers.keys()
                            while (keys.hasNext()) {
                                val k = keys.next()
                                setRequestProperty(k, headers.optString(k, ""))
                            }
                            if (method.uppercase() !in listOf("GET", "HEAD") && body.isNotEmpty()) {
                                doOutput = true
                                outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                            }
                        }

                        val status = conn.responseCode
                        val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                        val respText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                        conn.disconnect()

                        resultJson.put("ok", status in 200..299)
                        resultJson.put("status", status)
                        resultJson.put("body", respText)
                    }
                } catch (e: Exception) {
                    resultJson.put("ok", false)
                    resultJson.put("status", 503)
                    resultJson.put("body", "")
                    resultJson.put("error", e.message ?: "Network request failed")
                }

                val payloadLiteral = JSONObject.quote(resultJson.toString())
                val idLiteral = JSONObject.quote(callbackId)
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.__ntkBridgeResolve && window.__ntkBridgeResolve($idLiteral, $payloadLiteral);",
                        null
                    )
                }
            }
        }

        @JavascriptInterface
        fun saveFile(fileName: String, mimeType: String, base64Data: String): String {
            val cleanName = BridgeUtils.sanitizeFileName(fileName)
            val cleanMime = BridgeUtils.normalizeMimeType(mimeType, cleanName)
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)

            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, cleanName)
                        put(MediaStore.Downloads.MIME_TYPE, cleanMime)
                        put(
                            MediaStore.Downloads.RELATIVE_PATH,
                            "${Environment.DIRECTORY_DOWNLOADS}/NTK Creator Command"
                        )
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val resolver = contentResolver
                    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("Could not create MediaStore Downloads entry")
                    resolver.openOutputStream(uri)?.use { it.write(bytes) }
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                    "Saved to Downloads/NTK Creator Command/$cleanName"
                } else {
                    val hasLegacyPerm = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        android.Manifest.permission.WRITE_EXTERNAL_STORAGE
                    ) == PackageManager.PERMISSION_GRANTED
                    val targetDir = if (hasLegacyPerm) {
                        @Suppress("DEPRECATION")
                        File(
                            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                            "NTK Creator Command"
                        )
                    } else {
                        File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "NTK Creator Command")
                    }
                    targetDir.mkdirs()
                    val outFile = File(targetDir, cleanName)
                    FileOutputStream(outFile).use { it.write(bytes) }
                    "Saved: ${outFile.absolutePath}"
                }
            } catch (e: Exception) {
                "Save error: ${e.message ?: "unknown"}"
            }
        }

        @JavascriptInterface
        fun shareFile(fileName: String, mimeType: String, base64Data: String): String {
            val cleanName = BridgeUtils.sanitizeFileName(fileName)
            val cleanMime = BridgeUtils.normalizeMimeType(mimeType, cleanName)
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)

            return try {
                val exportDir = File(cacheDir, "exports").apply { mkdirs() }
                val file = File(exportDir, cleanName)
                FileOutputStream(file).use { it.write(bytes) }

                val uri = FileProvider.getUriForFile(
                    this@MainActivity,
                    "${packageName}.fileprovider",
                    file
                )
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = cleanMime
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runOnUiThread {
                    startActivity(Intent.createChooser(shareIntent, "Share $cleanName"))
                }
                "Opening share sheet for $cleanName"
            } catch (e: Exception) {
                "Share error: ${e.message ?: "unknown"}"
            }
        }

        @JavascriptInterface
        fun openExternalUrl(url: String) {
            runOnUiThread { openUrlExternally(url) }
        }

        @JavascriptInterface
        fun setSystemBars(resolvedTheme: String) {
            runOnUiThread { updateSystemBars(resolvedTheme) }
        }

        @JavascriptInterface
        fun secureSave(key: String, value: String) {
            vaultCrypto.save(key, value)
        }

        @JavascriptInterface
        fun secureLoad(key: String): String {
            return vaultCrypto.load(key)
        }

        @JavascriptInterface
        fun secureDelete(key: String) {
            vaultCrypto.delete(key)
        }

        @JavascriptInterface
        fun getDeviceInfo(): String {
            return JSONObject().apply {
                put("apiLevel", Build.VERSION.SDK_INT)
                put("androidRelease", Build.VERSION.RELEASE ?: "unknown")
                put("appVersion", "1.0.0")
                put("minSdk", 26)
                put("targetSdk", 36)
            }.toString()
        }
    }
}
