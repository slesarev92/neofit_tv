package com.signage.player

import android.content.Context

/**
 * Pre-baked list of known deployments. Source of truth is
 * `res/values/clubs.xml` — see comment there for rationale.
 *
 * The UI uses [list] to populate a Spinner and [findByUrl] to map a saved URL
 * back to the right Spinner index when restoring state.
 */
object Clubs {
    data class Club(val name: String, val url: String)

    fun list(context: Context): List<Club> {
        val raw = context.resources.getStringArray(R.array.clubs)
        return raw.mapNotNull { entry ->
            val parts = entry.split('|', limit = 2)
            if (parts.size != 2) return@mapNotNull null
            val name = parts[0].trim()
            val url = parts[1].trim().trimEnd('/')
            if (name.isEmpty() || url.isEmpty()) return@mapNotNull null
            Club(name, url)
        }
    }

    /**
     * Returns the club whose URL matches [savedUrl] (after trimming trailing
     * slash on both sides). Returns null if [savedUrl] is blank or matches no
     * known club — in that case the UI should fall back to "Other (manual)".
     */
    fun findByUrl(context: Context, savedUrl: String?): Club? {
        if (savedUrl.isNullOrBlank()) return null
        val target = savedUrl.trim().trimEnd('/')
        return list(context).firstOrNull { it.url == target }
    }
}
