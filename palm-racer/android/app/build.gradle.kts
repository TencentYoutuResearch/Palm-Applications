import java.util.Properties

plugins {
    id("com.android.application")
}

// Load signing config from keystore.properties (not checked into git)
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        load(keystorePropertiesFile.inputStream())
    }
}

// release 版本使用 https://{palm.host}/palm-racer 作为后端地址
val serverConfigFile = rootProject.file("../server/conf/palm-racer.yaml")
val palmHost: String by lazy {
    if (serverConfigFile.exists()) {
        val lines = serverConfigFile.readLines()
        var inPalmSection = false
        var host = ""
        for (line in lines) {
            val trimmed = line.trimStart()
            // 检测顶级 section
            if (!line.startsWith(" ") && !line.startsWith("\t") && line.contains(":")) {
                inPalmSection = trimmed.startsWith("palm:")
            }
            if (inPalmSection && trimmed.startsWith("host:")) {
                host = trimmed.substringAfter("host:").trim().trim('"').split("#")[0].trim().trim('"')
            }
        }
        if (host.isNotEmpty()) "https://$host/palm-racer" else "http://10.0.2.2:9090/palm-racer"
    } else {
        "http://10.0.2.2:9090/palm-racer"
    }
}

android {
    namespace = "com.edgesenseai.palmracer"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.edgesenseai.palmracer"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("release") {
            storeFile = file(keystoreProperties.getProperty("storeFile", "release.keystore"))
            storePassword = keystoreProperties.getProperty("storePassword", "")
            keyAlias = keystoreProperties.getProperty("keyAlias", "")
            keyPassword = keystoreProperties.getProperty("keyPassword", "")
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            buildConfigField("String", "NETWORK_ENV", "\"public\"")
            // Override via local.properties or gradle.properties
            buildConfigField("String", "DEFAULT_API_BASE_URL", "\"http://10.0.2.2:9090/palm-racer\"")
        }
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "NETWORK_ENV", "\"public\"")
            buildConfigField("String", "DEFAULT_API_BASE_URL", "\"${palmHost}\"")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Prevent AAPT from compressing MediaPipe binary assets
    // Without this, .data/.binarypb/.wasm files get corrupted when read via AssetManager
    androidResources {
        noCompress += listOf("data", "binarypb", "wasm", "tflite", "glb")
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("com.google.code.gson:gson:2.10.1")

    // MediaPipe Tasks Vision — native hand landmark detection
    implementation("com.google.mediapipe:tasks-vision:0.10.14")

    // CameraX — camera access for hand tracking
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
}
