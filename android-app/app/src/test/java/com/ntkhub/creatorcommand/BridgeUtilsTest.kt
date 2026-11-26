package com.ntkhub.creatorcommand

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeUtilsTest {
    @Test
    fun sanitizeFileNameRemovesUnsafeChars() {
        assertEquals("my-ebook-2026.pdf", BridgeUtils.sanitizeFileName("my/ebook:2026*.pdf"))
        assertEquals("ntk-export.bin", BridgeUtils.sanitizeFileName("   "))
    }

    @Test
    fun normalizeMimeTypeInfersExtensions() {
        assertEquals("application/pdf", BridgeUtils.normalizeMimeType("", "book.pdf"))
        assertEquals(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            BridgeUtils.normalizeMimeType(null, "tracker.xlsx")
        )
        assertEquals("application/zip", BridgeUtils.normalizeMimeType("", "pack.zip"))
    }

    @Test
    fun allowsHttpsAndPrivateLanHttpOnly() {
        assertTrue(BridgeUtils.isAllowedRequestUrl("https://generativelanguage.googleapis.com/v1beta/models"))
        assertTrue(BridgeUtils.isAllowedRequestUrl("http://192.168.1.42:3000/api/dashboard"))
        assertTrue(BridgeUtils.isAllowedRequestUrl("http://10.0.2.2:3000"))
        assertTrue(BridgeUtils.isAllowedRequestUrl("http://localhost:3000"))
        assertFalse(BridgeUtils.isAllowedRequestUrl("http://example.com/api"))
        assertFalse(BridgeUtils.isAllowedRequestUrl("file:///etc/passwd"))
    }
}
