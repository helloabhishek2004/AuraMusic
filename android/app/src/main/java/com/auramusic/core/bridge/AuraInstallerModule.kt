package com.auramusic.core.bridge

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File

/**
 * Native bridge module providing production-grade Android package installation
 * and permission management for self-hosted updates.
 */
class AuraInstallerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AuraInstallerModule"

    /**
     * Checks whether the app has permission to install unknown APKs.
     * Android < Oreo (API 26) always returns true.
     * Android >= Oreo queries PackageManager.canRequestPackageInstalls().
     */
    @ReactMethod
    fun canRequestPackageInstalls(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val canInstall = reactContext.packageManager.canRequestPackageInstalls()
                promise.resolve(canInstall)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Launches the system settings screen for "Install unknown apps"
     * targeted directly at AuraMusic.
     */
    @ReactMethod
    fun openInstallPermissionSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            // Fallback to application details settings
            try {
                val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(fallbackIntent)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("ERR_SETTINGS_FAILED", "Failed to open settings: ${e2.message}")
            }
        }
    }

    /**
     * Launches Android's native system package installer for the specified APK file.
     * Verifies canRequestPackageInstalls() first and resolves a structured result.
     */
    @ReactMethod
    fun installApk(fileUriOrPath: String, promise: Promise) {
        try {
            // 1. Verify unknown app install permission on Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val canInstall = reactContext.packageManager.canRequestPackageInstalls()
                if (!canInstall) {
                    val map = Arguments.createMap().apply {
                        putBoolean("success", false)
                        putBoolean("permissionRequired", true)
                        putString("error", "INSTALL_PERMISSION_REQUIRED")
                    }
                    promise.resolve(map)
                    return
                }
            }

            // 2. Resolve file path from URI or raw path
            val cleanPath = when {
                fileUriOrPath.startsWith("file://") -> fileUriOrPath.substring(7)
                else -> fileUriOrPath
            }

            val file = File(cleanPath)
            if (!file.exists() || !file.canRead()) {
                val map = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putBoolean("permissionRequired", false)
                    putString("error", "Update package file not found or not readable: $cleanPath")
                }
                promise.resolve(map)
                return
            }

            // 3. Resolve Content URI via FileProvider
            val contentUri: Uri = try {
                FileProvider.getUriForFile(
                    reactContext,
                    "${reactContext.packageName}.FileSystemFileProvider",
                    file
                )
            } catch (fpEx: Exception) {
                Uri.fromFile(file)
            }

            // 4. Construct intent for Android Package Installer
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            reactContext.startActivity(intent)

            val map = Arguments.createMap().apply {
                putBoolean("success", true)
                putBoolean("permissionRequired", false)
            }
            promise.resolve(map)
        } catch (e: ActivityNotFoundException) {
            val map = Arguments.createMap().apply {
                putBoolean("success", false)
                putBoolean("permissionRequired", false)
                putString("error", "No application found to handle package installation.")
            }
            promise.resolve(map)
        } catch (e: Exception) {
            val map = Arguments.createMap().apply {
                putBoolean("success", false)
                putBoolean("permissionRequired", false)
                putString("error", e.message ?: "Failed to launch package installer.")
            }
            promise.resolve(map)
        }
    }
}
