package org.lightningdevkit.ldknode

import android.os.FileObserver
import java.io.*

class LogFileObserver(
    private val filePath: String,
    private val onNewLine: (String) -> Unit
) {
    private var fileObserver: FileObserver? = null
    private var reader: BufferedReader? = null

    fun startObserving() {
        // Open file, create if needed
        val file = File(filePath)
        file.parentFile?.mkdirs()
        if (!file.exists()) file.createNewFile()

        val stream = FileInputStream(file)
        reader = BufferedReader(InputStreamReader(stream))

        // Read to EOF without emitting (skip historical)
        readToEnd(emit = false)

        // Watch for MODIFY events
        fileObserver = object : FileObserver(filePath) {
            override fun onEvent(event: Int, path: String?) {
                if (event != MODIFY) return
                readToEnd(emit = true)
            }
        }
        fileObserver?.startWatching()
    }

    fun stopObserving() {
        fileObserver?.stopWatching()
        fileObserver = null
        reader?.close()
        reader = null
    }

    private fun readToEnd(emit: Boolean) {
        try {
            var line = reader?.readLine()
            while (line != null) {
                if (emit) onNewLine(line)
                line = reader?.readLine()
            }
        } catch (_: IOException) {}
    }

    companion object {
        fun tailFile(filePath: String, numLines: Int): String {
            val file = File(filePath)
            if (!file.exists()) return ""
            val lines = file.readLines()
            return lines.takeLast(numLines).joinToString("\n")
        }
    }
}
