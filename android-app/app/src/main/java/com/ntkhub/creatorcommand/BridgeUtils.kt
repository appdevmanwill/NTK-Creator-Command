package com.ntkhub.creatorcommand

import java.net.URI

object BridgeUtils {
    fun sanitizeFileName(raw: String, fallback: String = "ntk-export.bin"): String {
        val cleaned = raw.trim()
            .replace(Regex("[\\\\/:*?\"<>|]+"), "-")
            .replace(Regex("\\s+"), "-")
            .replace(Regex("-+"), "-")
            .replace(Regex("-+\\."), ".")
            .trim('-')
        return if (cleaned.isEmpty()) fallback else cleaned.take(120)
    }

    fun normalizeMimeType(mime: String?, fileName: String): String {
        val trimmed = mime?.trim()?.lowercase().orEmpty()
        if (trimmed.isNotEmpty() && trimmed.contains("/")) return trimmed
        val lower = fileName.lowercase()
        return when {
            lower.endsWith(".pdf") -> "application/pdf"
            lower.endsWith(".xlsx") -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            lower.endsWith(".zip") -> "application/zip"
            lower.endsWith(".json") -> "application/json"
            lower.endsWith(".txt") -> "text/plain"
            else -> "application/octet-stream"
        }
    }

    fun isPrivateLanHost(host: String): Boolean {
        val h = host.trim().lowercase()
        if (h == "localhost" || h == "127.0.0.1" || h == "10.0.2.2" || h.endsWith(".local")) {
            return true
        }
        val parts = h.split('.')
        if (parts.size == 4) {
            val a = parts[0].toIntOrNull() ?: return false
            val b = parts[1].toIntOrNull() ?: return false
            val c = parts[2].toIntOrNull() ?: return false
            val d = parts[3].toIntOrNull() ?: return false
            if (a !in 0..255 || b !in 0..255 || c !in 0..255 || d !in 0..255) return false
            if (a == 10) return true
            if (a == 172 && b in 16..31) return true
            if (a == 192 && b == 168) return true
            if (a == 127) return true
        }
        return false
    }

    fun isAllowedRequestUrl(rawUrl: String): Boolean {
        val uri = try {
            URI(rawUrl.trim())
        } catch (_: Exception) {
            return false
        }
        val scheme = uri.scheme?.lowercase() ?: return false
        val host = uri.host ?: return false
        return when (scheme) {
            "https" -> true
            "http" -> isPrivateLanHost(host)
            else -> false
        }
    }
}
