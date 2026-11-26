package com.ntkhub.creatorcommand

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class KeystoreCrypto(context: Context) {
    private val prefs = context.getSharedPreferences("ntk_secure_vault", Context.MODE_PRIVATE)
    private val keyAlias = "ntk_creator_command_vault_v1"

    private fun getOrCreateKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = ks.getKey(keyAlias, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    fun save(key: String, value: String) {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val iv = cipher.iv
            val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
            val combined = ByteArray(iv.size + encrypted.size)
            System.arraycopy(iv, 0, combined, 0, iv.size)
            System.arraycopy(encrypted, 0, combined, iv.size, encrypted.size)
            prefs.edit().putString("enc_$key", Base64.encodeToString(combined, Base64.NO_WRAP)).apply()
        } catch (_: Exception) {
            prefs.edit().putString("raw_$key", value).apply()
        }
    }

    fun load(key: String): String {
        val enc = prefs.getString("enc_$key", null)
        if (enc != null) {
            try {
                val combined = Base64.decode(enc, Base64.DEFAULT)
                if (combined.size > 12) {
                    val iv = combined.copyOfRange(0, 12)
                    val payload = combined.copyOfRange(12, combined.size)
                    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                    cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
                    return String(cipher.doFinal(payload), Charsets.UTF_8)
                }
            } catch (_: Exception) {
                // fall through
            }
        }
        return prefs.getString("raw_$key", "") ?: ""
    }

    fun delete(key: String) {
        prefs.edit().remove("enc_$key").remove("raw_$key").apply()
    }
}
