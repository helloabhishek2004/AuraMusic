package com.anonymous.AuraMusic.poc

enum class ClientStrategy(val clientName: String, val clientVersion: String, val clientId: Int) {
    ANDROID_VR("ANDROID_VR", "1.65.10", 28),
    TVHTML5("TVHTML5", "7.20230405.08.01", 7),
    WEB_REMIX("WEB_REMIX", "1.20231214.00.00", 67),
    ANDROID("ANDROID", "18.34.37", 1),
    ANDROID_MUSIC("ANDROID_MUSIC", "6.02.53", 21);
    
    fun getContextJson(): String {
        return ""
    }
}
