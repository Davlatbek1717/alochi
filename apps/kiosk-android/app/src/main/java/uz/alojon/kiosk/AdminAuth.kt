package uz.alojon.kiosk

import android.content.Context
import java.security.MessageDigest
import java.util.UUID

object AdminAuth {

    private const val PREFS = "kiosk_admin"
    private const val KEY_HASH = "pw_hash"
    private const val KEY_SALT = "pw_salt"

    fun isPasswordSet(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(KEY_HASH, null) != null
    }

    fun setPassword(context: Context, password: String) {
        val salt = UUID.randomUUID().toString()
        val hash = sha256("$salt:$password")
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_HASH, hash)
            .putString(KEY_SALT, salt)
            .apply()
    }

    fun checkPassword(context: Context, input: String): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val storedHash = prefs.getString(KEY_HASH, null) ?: return false
        val salt = prefs.getString(KEY_SALT, "") ?: ""
        return sha256("$salt:$input") == storedHash
    }

    private fun sha256(data: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(data.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
