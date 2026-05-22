package uz.alojon.kiosk

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Tiny HTTP client for the device-facing backend API under /device-api.
 * Uses HttpURLConnection + org.json to avoid extra dependencies. All calls
 * are blocking and MUST run off the main thread (the monitor service does).
 */
object DeviceApi {
    private const val TAG = "DeviceApi"
    private const val TIMEOUT = 15000

    data class HeartbeatResult(
        val blocked: Boolean,
        val blockReason: String?,
        val commands: List<Command>,
    )

    data class Command(val id: String, val type: String, val payload: JSONObject?)

    /** POST /device-api/heartbeat — returns block state + pending commands, or null on failure. */
    fun heartbeat(ctx: Context, body: JSONObject): HeartbeatResult? {
        val resp = post(ctx, "/device-api/heartbeat", body) ?: return null
        val data = resp.optJSONObject("data") ?: resp
        val cmds = mutableListOf<Command>()
        val arr = data.optJSONArray("commands") ?: JSONArray()
        for (i in 0 until arr.length()) {
            val c = arr.optJSONObject(i) ?: continue
            cmds.add(
                Command(
                    id = c.optString("id"),
                    type = c.optString("type"),
                    payload = c.optJSONObject("payload"),
                ),
            )
        }
        return HeartbeatResult(
            blocked = data.optBoolean("blocked", false),
            blockReason = if (data.isNull("blockReason")) null else data.optString("blockReason"),
            commands = cmds,
        )
    }

    /** POST /device-api/events — fire-and-forget tamper/security events. */
    fun sendEvents(ctx: Context, events: JSONArray) {
        val body = JSONObject().put("events", events)
        post(ctx, "/device-api/events", body)
    }

    /** POST /device-api/commands/:id/ack */
    fun ackCommand(ctx: Context, cmdId: String, status: String, result: JSONObject? = null) {
        val body = JSONObject().put("status", status)
        if (result != null) body.put("resultPayload", result)
        post(ctx, "/device-api/commands/$cmdId/ack", body)
    }

    private fun post(ctx: Context, path: String, body: JSONObject): JSONObject? {
        val token = DeviceConfig.token(ctx) ?: return null
        val url = DeviceConfig.baseUrl(ctx).trimEnd('/') + path
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = TIMEOUT
                readTimeout = TIMEOUT
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Device $token")
            }
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) {
                Log.w(TAG, "POST $path -> $code $text")
                return null
            }
            if (text.isBlank()) JSONObject() else JSONObject(text)
        } catch (e: Exception) {
            Log.w(TAG, "POST $path failed: ${e.message}")
            null
        } finally {
            conn?.disconnect()
        }
    }
}
