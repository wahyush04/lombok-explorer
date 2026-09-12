# Panduan Implementasi Android: Live Trip Tracking & Start Trip
**Lombok Explorer Mobile App**

Dokumentasi ini ditujukan bagi tim engineer Android untuk mengintegrasikan fitur **"Start Trip"**, pelacakan GPS di latar depan (Foreground Service), deteksi kedatangan otomatis (Auto-Arrival Detection), serta rendering rute Mapbox.

---

## 1. Arsitektur & Prinsip Utama

1. **`START TRIP ≠ LOCK ITINERARY`**
   - Memulai sesi perjalanan (**TripSession**) **tidak mengunci** itinerary.
   - User tetap diizinkan menambah, menghapus, atau mengubah urutan aktivitas saat sesi berstatus `ACTIVE`.
   - Backend secara otomatis merekonsiliasi daftar aktivitas dan memperbarui snapshot rute/polyline saat ada perubahan.

2. **Dual-Check Arrival Detection (Client-Triggered, Server-Validated)**
   - Android memonitor jarak GPS real-time ke aktivitas saat ini (`currentActivity`).
   - Setiap aktivitas menyertakan `arrivalRadiusMeters` (default: 100 meter).
   - Saat user memasuki radius tersebut, Android mengirim sinyal ke endpoint sinkronisasi lokasi dengan flag `arrivalDetected: true`.
   - Backend memvalidasi koordinat, menandai aktivitas sebagai `COMPLETED`, memperbarui `isCompleted: true` pada item itinerary, dan memajukan sesi ke aktivitas berikutnya (`IN_PROGRESS`).

3. **Polyline Format**
   - Snapshot rute dari Mapbox disimpan dan dikembalikan dalam format **Encoded Polyline6** (`precision = 6`).
   - Pada Android, decode menggunakan `PolylineUtils.decode(polyline, 6)`.

4. **Lifecycle State**
   - **TripSessionStatus**: `ACTIVE` ➔ `COMPLETED` / `CANCELLED` (atau `PAUSED`)
   - **TripActivityStatus**: `NOT_STARTED` ➔ `IN_PROGRESS` ➔ `COMPLETED` (atau `SKIPPED`)

---

## 2. Diagram Alur (Sequence Flow)

```
[Android Client]                                              [Backend API]
       |                                                             |
       |  1. POST /api/v1/itineraries/{id}/start-trip                 |
       |------------------------------------------------------------>|
       |  <-- 201 Created (session, currentActivity, polyline6)       |
       |<------------------------------------------------------------|
       |                                                             |
       |  2. Start Foreground Service & Setup Mapbox                 |
       |     - Decode polyline6 & render rute                        |
       |     - Highlight currentActivity                             |
       |                                                             |
       |  3. Local GPS Tracking (Interval: 10-15s / 25m)             |
       |     POST /api/v1/trip-sessions/{id}/location                |
       |     { latitude, longitude, accuracy }                       |
       |------------------------------------------------------------>|
       |  <-- 200 OK (updated state)                                 |
       |<------------------------------------------------------------|
       |                                                             |
       |  4. Jarak user ke currentActivity <= arrivalRadius (100m)   |
       |     POST /api/v1/trip-sessions/{id}/location                |
       |     { latitude, longitude, arrivalDetected: true,           |
       |       activityId: "uuid-activity" }                         |
       |------------------------------------------------------------>|
       |  <-- 200 OK (currentActivity advances to next activity!)    |
       |<------------------------------------------------------------|
       |                                                             |
       |  5. Update Map Marker & UI:                                 |
       |     - Tampilkan dialog/toast: "Tiba di [Nama Lokasi]!"      |
       |     - Marker lokasi lama -> Completed                       |
       |     - Marker lokasi baru -> In Progress (fokus kamera)      |
       |                                                             |
       |  6. (Opsi) User selesai semua aktivitas / tekan Selesai:    |
       |     POST /api/v1/trip-sessions/{id}/finish                  |
       |------------------------------------------------------------>|
       |  <-- 200 OK (session.status = COMPLETED)                    |
       |<------------------------------------------------------------|
```

---

## 3. Daftar REST API Endpoints

Semua endpoint memerlukan header otentikasi JWT:
```http
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

### Response Envelope Standard:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "...",
  "data": { ... }
}
```

---

### A. Memulai Trip: `POST /api/v1/itineraries/{id}/start-trip`
- **Alternatif**: `POST /api/v1/trip-sessions/start` (dengan `itineraryId` di request body).
- **Idempoten**: Jika sesi untuk itinerary ini sudah aktif, backend langsung mengembalikan sesi yang sedang berjalan.
- **Request Body** (opsional):
  ```json
  {
    "initialLatitude": -8.3405,
    "initialLongitude": 116.0725
  }
  ```
- **Response** (`201 Created` / `200 OK`):
  Mengembalikan objek lengkap data navigasi (lihat DTO Response di bagian 4).

---

### B. Pemulihan Sesi Aktif (App Launch / Crash Recovery): `GET /api/v1/trip-sessions/active`
Panggil endpoint ini saat aplikasi terbuka (misalnya di Splash Screen atau ViewModel HomeScreen) untuk mengecek apakah user memiliki sesi navigasi yang belum selesai.

- **Jika ADA sesi aktif** (`200 OK`):
  ```json
  {
    "success": true,
    "code": "SUCCESS",
    "message": "Active trip session retrieved successfully",
    "data": {
      "hasActiveTrip": true,
      "session": { "id": "uuid-session", "status": "ACTIVE", ... },
      "itinerary": { "id": "uuid-itinerary", "title": "Trip Lombok 3H2M", ... },
      "activities": [ ... ],
      "currentActivity": { ... },
      "nextActivities": [ ... ],
      "route": {
        "totalDistanceKm": 45.2,
        "totalDurationMinutes": 75,
        "polyline": "encoded_polyline6_string...",
        "legs": [ ... ]
      },
      "progressPercentage": 25
    }
  }
  ```

- **Jika TIDAK ADA sesi aktif** (`200 OK`):
  ```json
  {
    "success": true,
    "code": "SUCCESS",
    "message": "No active trip session found",
    "data": {
      "hasActiveTrip": false,
      "session": null
    }
  }
  ```

---

### C. Sinkronisasi Lokasi & Deteksi Kedatangan: `POST /api/v1/trip-sessions/{id}/location`
- **Request Body**:
  ```json
  {
    "latitude": -8.351234,
    "longitude": 116.082345,
    "accuracy": 12.5,
    "timestamp": "2026-09-12T14:30:00.000Z",
    "activityId": "uuid-activity-saat-ini",
    "arrivalDetected": true
  }
  ```
- **Catatan Penting**:
  - Jangan panggil endpoint ini setiap detik untuk menghemat baterai & kuota. Gunakan interval **10–15 detik** atau jika jarak tempuh berpindah minimal **25 meter**.
  - Saat jarak lokal user ke `currentActivity.latitude/longitude` berada di dalam `arrivalRadiusMeters` (<= 100m), **SEGERA** kirim request dengan `"arrivalDetected": true`.
- **Response**: Mengembalikan seluruh state trip terbaru (dengan status activity yang baru saja tercapai berubah jadi `COMPLETED` dan `currentActivity` otomatis bergeser ke tempat berikutnya).

---

### D. Tandai Selesai Manual (Fallback): `POST /api/v1/trip-sessions/{id}/activities/{activityId}/complete`
Jika user memilih tombol "Saya Sudah Sampai" secara manual pada kartu aktivitas.
- **Request Body** (opsional):
  ```json
  {
    "latitude": -8.3512,
    "longitude": 116.0823,
    "accuracy": 10.0
  }
  ```

---

### E. Mulai Aktivitas Tertentu: `POST /api/v1/trip-sessions/{id}/activities/{activityId}/start`
Jika user ingin menandai aktivitas sebagai sedang berjalan (`IN_PROGRESS`).
- **Request Body** (opsional):
  ```json
  {
    "latitude": -8.3512,
    "longitude": 116.0823
  }
  ```

---

### F. Melewati Aktivitas (Skip): `POST /api/v1/trip-sessions/{id}/activities/{activityId}/skip`
Jika user ingin melewati destinasi karena alasan tertentu (misal: cuaca buruk atau keterbatasan waktu). `currentActivityId` otomatis berpindah ke aktivitas belum selesai berikutnya.
- **Request Body** (opsional):
  ```json
  {
    "reason": "Hujan lebat di lokasi"
  }
  ```

---

### G. Menyelesaikan Seluruh Trip: `POST /api/v1/trip-sessions/{id}/finish`
Mengakhiri sesi perjalanan secara manual meskipun belum semua aktivitas tercapai.
- **Response**: Mengembalikan status session `COMPLETED`.

---

### H. Membatalkan Trip: `POST /api/v1/trip-sessions/{id}/cancel`
Membatalkan sesi navigasi perjalanan (`status: CANCELLED`).

---

## 4. Model Data Kotlin (DTO)

Gunakan model data berikut di project Android Anda (kompatibel dengan Moshi / KotlinX Serialization / Gson):

```kotlin
package com.lombokexplorer.data.model.trip

import com.google.gson.annotations.SerializedName

// Response Envelope
data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String,
    @SerializedName("data") val data: T
)

// Active Session Check Response
data class ActiveTripCheckResponse(
    @SerializedName("hasActiveTrip") val hasActiveTrip: Boolean,
    @SerializedName("session") val session: TripSessionDto?,
    @SerializedName("itinerary") val itinerary: TripItinerarySummaryDto?,
    @SerializedName("activities") val activities: List<TripActivityDto>?,
    @SerializedName("currentActivity") val currentActivity: TripActivityDto?,
    @SerializedName("nextActivities") val nextActivities: List<TripActivityDto>?,
    @SerializedName("route") val route: TripRouteDto?,
    @SerializedName("routes") val routes: List<TripRouteLegRecordDto>?,
    @SerializedName("progressPercentage") val progressPercentage: Int?
)

// Start Trip & Live Tracking State Response
data class StartTripResponse(
    @SerializedName("session") val session: TripSessionDto,
    @SerializedName("itinerary") val itinerary: TripItinerarySummaryDto,
    @SerializedName("activities") val activities: List<TripActivityDto>,
    @SerializedName("currentActivity") val currentActivity: TripActivityDto?,
    @SerializedName("nextActivities") val nextActivities: List<TripActivityDto>,
    @SerializedName("route") val route: TripRouteDto,
    @SerializedName("routes") val routes: List<TripRouteLegRecordDto>,
    @SerializedName("progressPercentage") val progressPercentage: Int
)

data class TripRouteLegRecordDto(
    @SerializedName("id") val id: String,
    @SerializedName("tripSessionId") val tripSessionId: String,
    @SerializedName("fromActivityId") val fromActivityId: String,
    @SerializedName("toActivityId") val toActivityId: String,
    @SerializedName("legOrder") val legOrder: Int,
    @SerializedName("distanceMeters") val distanceMeters: Double,
    @SerializedName("durationSeconds") val durationSeconds: Double,
    @SerializedName("geometry") val geometry: String // Encoded Polyline6 geometry per leg
)

data class TripSessionDto(
    @SerializedName("id") val id: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("itineraryId") val itineraryId: String,
    @SerializedName("status") val status: String, // ACTIVE, COMPLETED, CANCELLED, PAUSED
    @SerializedName("startedAt") val startedAt: String,
    @SerializedName("endedAt") val endedAt: String?,
    @SerializedName("currentActivityId") val currentActivityId: String?,
    @SerializedName("lastLatitude") val lastLatitude: Double?,
    @SerializedName("lastLongitude") val lastLongitude: Double?,
    @SerializedName("lastAccuracy") val lastAccuracy: Double?
)

data class TripItinerarySummaryDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("transportationMode") val transportationMode: String, // CAR, MOTORCYCLE, BICYCLE, WALKING
    @SerializedName("totalDays") val totalDays: Int,
    @SerializedName("totalDistanceKm") val totalDistanceKm: Double,
    @SerializedName("totalTravelTimeMinutes") val totalTravelTimeMinutes: Int
)

data class TripActivityDto(
    @SerializedName("id") val id: String, // Id dari ItineraryItem
    @SerializedName("progressId") val progressId: String,
    @SerializedName("title") val title: String,
    @SerializedName("itemType") val itemType: String, // DESTINATION, RESTAURANT, ACCOMMODATION, CUSTOM
    @SerializedName("destinationId") val destinationId: String?,
    @SerializedName("restaurantId") val restaurantId: String?,
    @SerializedName("accommodationId") val accommodationId: String?,
    @SerializedName("dayNumber") val dayNumber: Int,
    @SerializedName("orderIndex") val orderIndex: Int,
    @SerializedName("status") val status: String, // NOT_STARTED, IN_PROGRESS, COMPLETED, SKIPPED
    @SerializedName("latitude") val latitude: Double?,
    @SerializedName("longitude") val longitude: Double?,
    @SerializedName("arrivalRadiusMeters") val arrivalRadiusMeters: Double = 100.0,
    @SerializedName("startedAt") val startedAt: String?,
    @SerializedName("completedAt") val completedAt: String?,
    @SerializedName("arrivalDetectedAt") val arrivalDetectedAt: String?,
    @SerializedName("activityNotes") val activityNotes: String?,
    @SerializedName("estimatedDurationMinutes") val estimatedDurationMinutes: Int
)

data class TripRouteDto(
    @SerializedName("totalDistanceKm") val totalDistanceKm: Double,
    @SerializedName("totalDurationMinutes") val totalDurationMinutes: Int,
    @SerializedName("polyline") val polyline: String?, // Precision = 6
    @SerializedName("legs") val legs: List<TripRouteLegDto>
)

data class TripRouteLegDto(
    @SerializedName("fromActivityId") val fromActivityId: String?,
    @SerializedName("toActivityId") val toActivityId: String?,
    @SerializedName("distanceKm") val distanceKm: Double,
    @SerializedName("durationMinutes") val durationMinutes: Int,
    @SerializedName("polyline") val polyline: String?
)

// Request Bodies
data class StartTripRequest(
    @SerializedName("initialLatitude") val initialLatitude: Double? = null,
    @SerializedName("initialLongitude") val initialLongitude: Double? = null
)

data class SyncLocationRequest(
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("accuracy") val accuracy: Float? = null,
    @SerializedName("timestamp") val timestamp: String? = null,
    @SerializedName("activityId") val activityId: String? = null,
    @SerializedName("arrivalDetected") val arrivalDetected: Boolean? = null
)

data class CompleteActivityRequest(
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null,
    @SerializedName("accuracy") val accuracy: Float? = null
)
```

---

## 5. Retrofit API Interface

```kotlin
package com.lombokexplorer.data.api

import com.lombokexplorer.data.model.trip.*
import retrofit2.Response
import retrofit2.http.*

interface TripTrackingApi {

    @POST("api/v1/itineraries/{id}/start-trip")
    suspend fun startTrip(
        @Path("id") itineraryId: String,
        @Body request: StartTripRequest = StartTripRequest()
    ): Response<ApiResponse<StartTripResponse>>

    @GET("api/v1/trip-sessions/active")
    suspend fun getActiveTripSession(): Response<ApiResponse<ActiveTripCheckResponse>>

    @GET("api/v1/trip-sessions/{id}")
    suspend fun getTripSessionById(
        @Path("id") sessionId: String
    ): Response<ApiResponse<StartTripResponse>>

    @POST("api/v1/trip-sessions/{id}/location")
    suspend fun syncLocation(
        @Path("id") sessionId: String,
        @Body request: SyncLocationRequest
    ): Response<ApiResponse<StartTripResponse>>

    @POST("api/v1/trip-sessions/{id}/activities/{activityId}/complete")
    suspend fun completeActivity(
        @Path("id") sessionId: String,
        @Path("activityId") activityId: String,
        @Body request: CompleteActivityRequest = CompleteActivityRequest()
    ): Response<ApiResponse<StartTripResponse>>

    @POST("api/v1/trip-sessions/{id}/finish")
    suspend fun finishTrip(
        @Path("id") sessionId: String
    ): Response<ApiResponse<StartTripResponse>>

    @POST("api/v1/trip-sessions/{id}/cancel")
    suspend fun cancelTrip(
        @Path("id") sessionId: String
    ): Response<ApiResponse<StartTripResponse>>
}
```

---

## 6. Integrasi Mapbox Maps SDK (v10 / v11)

### A. Dependencies (`build.gradle.kts`)
```kotlin
dependencies {
    // Mapbox Maps SDK
    implementation("com.mapbox.maps:android:11.2.0")
    
    // Google Location Services (FusedLocationProviderClient)
    implementation("com.google.android.gms:play-services-location:21.2.0")
}
```

### B. Decoding Polyline6 & Rendering Rute
Polyline yang dikirim backend memiliki **precision 6**. Gunakan fungsi utilitas decoding Mapbox:

```kotlin
import com.mapbox.geojson.LineString
import com.mapbox.geojson.Point
import com.mapbox.geojson.utils.PolylineUtils
import com.mapbox.maps.extension.style.layers.addLayer
import com.mapbox.maps.extension.style.layers.generated.LineLayer
import com.mapbox.maps.extension.style.sources.addSource
import com.mapbox.maps.extension.style.sources.generated.GeoJsonSource
import com.mapbox.maps.extension.style.sources.getSourceAs

fun renderTripPolyline(mapboxMap: MapboxMap, encodedPolyline: String) {
    // PENTING: Gunakan precision = 6 sesuai format Mapbox Matrix backend
    val points: List<Point> = PolylineUtils.decode(encodedPolyline, 6)
    val lineString = LineString.fromLngLats(points)

    mapboxMap.getStyle { style ->
        val sourceId = "trip-route-source"
        val layerId = "trip-route-layer"

        var routeSource = style.getSourceAs<GeoJsonSource>(sourceId)
        if (routeSource == null) {
            routeSource = GeoJsonSource.Builder(sourceId)
                .geometry(lineString)
                .build()
            style.addSource(routeSource)

            val lineLayer = LineLayer(layerId, sourceId).apply {
                lineColor("#0284C7") // Primary brand color
                lineWidth(6.0)
                lineOpacity(0.85)
                lineJoin("round")
                lineCap("round")
            }
            style.addLayer(lineLayer)
        } else {
            routeSource.geometry(lineString)
        }
    }
}
```

### C. Visualisasi Marker Berdasarkan Status Aktivitas
Bagi marker menjadi 3 kategori status:
1. **`COMPLETED`**: Marker warna abu-abu / hijau dengan ikon centang (Checkmark).
2. **`IN_PROGRESS` (`currentActivity`)**: Marker warna biru dengan efek denyut (Pulse) atau ukuran lebih besar untuk menunjukkan tujuan saat ini.
3. **`NOT_STARTED`**: Pin nomor urut aktivitas berikutnya.

---

## 7. Foreground Location Service & Deteksi Kedatangan

Untuk memastikan pelacakan GPS tidak terhenti saat layar mati atau app di-minimize, gunakan **Foreground Service** dengan notifikasi persisten.

### A. Manifest Permissions (`AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<service
    android:name=".service.TripTrackingService"
    android:foregroundServiceType="location"
    android:exported="false" />
```

### B. Algoritma Deteksi Kedatangan & Throttling
Implementasikan kalkulasi jarak menggunakan `android.location.Location`:

```kotlin
class TripTrackingService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var currentSessionId: String? = null
    private var currentActivity: TripActivityDto? = null
    
    private var lastSyncedTime = 0L
    private var lastSyncedLocation: Location? = null

    // Konfigurasi Throttling Baterai
    private val SYNC_INTERVAL_MS = 12_000L // 12 detik
    private val MIN_DISTANCE_METERS = 25f   // Minimal pergerakan 25 meter

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            checkArrivalAndSync(location)
        }
    }

    private fun checkArrivalAndSync(userLocation: Location) {
        val target = currentActivity
        val sessionId = currentSessionId ?: return

        // 1. Cek Jarak Lokal ke Tujuan Aktif (Geofence lokal)
        var hasArrived = false
        if (target?.latitude != null && target.longitude != null) {
            val distance = FloatArray(1)
            Location.distanceBetween(
                userLocation.latitude,
                userLocation.longitude,
                target.latitude,
                target.longitude,
                distance
            )

            val distanceToTargetMeters = distance[0]
            val arrivalRadius = target.arrivalRadiusMeters.toFloat() // Default: 100m

            if (distanceToTargetMeters <= arrivalRadius) {
                hasArrived = true
            }
        }

        val currentTime = System.currentTimeMillis()
        val distanceMoved = lastSyncedLocation?.distanceTo(userLocation) ?: Float.MAX_VALUE

        // 2. Kriteria Kirim Sinyal ke Server:
        // Kirim SEGERA jika tiba di lokasi (hasArrived = true), ATAU interval waktu terpenuhi & ada pergerakan
        val shouldSync = hasArrived || 
            ((currentTime - lastSyncedTime >= SYNC_INTERVAL_MS) && distanceMoved >= MIN_DISTANCE_METERS)

        if (shouldSync) {
            lastSyncedTime = currentTime
            lastSyncedLocation = userLocation

            serviceScope.launch {
                try {
                    val request = SyncLocationRequest(
                        latitude = userLocation.latitude,
                        longitude = userLocation.longitude,
                        accuracy = userLocation.accuracy,
                        activityId = if (hasArrived) target?.id else null,
                        arrivalDetected = if (hasArrived) true else null
                    )

                    val response = api.syncLocation(sessionId, request)
                    if (response.isSuccessful && response.body()?.data != null) {
                        val updatedState = response.body()!!.data
                        
                        // Perbarui target saat ini ke aktivitas berikutnya
                        currentActivity = updatedState.currentActivity
                        
                        // Beritahu UI / ViewModel via StateFlow / EventBus
                        TripTrackingStateManager.updateState(updatedState)

                        if (hasArrived) {
                            showArrivalNotification(target?.title ?: "Tujuan")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("TripTracking", "Gagal sinkronisasi lokasi: ${e.message}")
                }
            }
        }
    }
}
```

---

## 8. Penanganan Perubahan Itinerary Selama Trip Aktif (Concurrent Edits)

Karena arsitektur backend **tidak mengunci** itinerary:
1. User dapat membuka tab lain dan mengedit daftar aktivitas (misal: menghapus salah satu destinasi atau mengubah urutan hari berikutnya).
2. Ketika user kembali ke layar peta navigasi:
   - ViewModel cukup memanggil `GET /api/v1/trip-sessions/active` atau `GET /api/v1/trip-sessions/{id}` pada event `onResume()`.
   - Backend akan mengembalikan daftar aktivitas dan `route.polyline` yang sudah otomatis dihitung ulang.
   - Peta akan melakukan re-render polyline dan marker terbaru tanpa menghentikan sesi navigasi yang sedang berjalan.

---

## 9. Checklist Pengujian Tim Mobile (QA Checklist)

| No | Kasus Uji (Test Case) | Expected Behavior |
|:---|:---|:---|
| 1 | Tekan "Mulai Perjalanan" pada Itinerary | API Start Trip dipanggil, navigasi layar penuh terbuka, rute ter-render, `currentActivity` ditandai. |
| 2 | Tekan kembali (Back) dan buka lagi | Muncul pop-up atau banner resume "Lanjutkan Perjalanan", state rute tidak hilang. |
| 3 | Matikan aplikasi (Force Close) lalu buka kembali | `GET /api/v1/trip-sessions/active` mengembalikan `hasActiveTrip: true`, app langsung menawarkan recovery ke sesi aktif. |
| 4 | Berjalan mendekati lokasi aktivitas (< 100m) | Otomatis terdeteksi kedatangan: toast "Tiba di [Lokasi]!", status berubah jadi `COMPLETED`, marker tercentang, dan kamera fokus ke destinasi berikutnya. |
| 5 | Edit itinerary saat sesi ACTIVE (tambah destinasi) | Sesi tetap aktif, saat kembali ke peta rute diperbarui mencakup destinasi baru. |
| 6 | Tekan "Selesaikan Perjalanan" | Panggil API `/finish`, sesi selesai (`COMPLETED`), foreground service otomatis di-stop. |
