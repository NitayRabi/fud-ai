package com.apoorvdarshan.calorietracker.ui.home

import android.content.ContentResolver
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apoorvdarshan.calorietracker.models.MealIngredient
import com.apoorvdarshan.calorietracker.models.toMealIngredient
import com.apoorvdarshan.calorietracker.services.FoodImageStore
import com.apoorvdarshan.calorietracker.services.ai.FoodAnalysis
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal data class IngredientIntakeState(
    val busy: Boolean = false,
    val result: MealIngredient? = null,
    val error: String? = null
)

/** Keeps an ingredient request alive without retaining callbacks to a recreated sheet. */
internal class IngredientIntakeViewModel : ViewModel() {
    private val mutableState = MutableStateFlow(IngredientIntakeState())
    val state = mutableState.asStateFlow()
    private var request: Job? = null

    fun analyze(
        imageBytes: ByteArray?,
        imageStore: FoodImageStore,
        failureMessage: String,
        block: suspend () -> FoodAnalysis
    ) = start(imageStore, failureMessage, loadImage = { imageBytes }, analyze = { block() })

    /** Reads the picked photo on IO first; Photo Picker URIs may stream from the cloud. */
    fun analyzeImportedPhoto(
        resolver: ContentResolver,
        uri: Uri,
        imageStore: FoodImageStore,
        failureMessage: String,
        block: suspend (ByteArray) -> FoodAnalysis
    ) = start(
        imageStore,
        failureMessage,
        loadImage = {
            withContext(Dispatchers.IO) {
                runCatching { resolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
            }?.takeIf { it.isNotEmpty() } ?: throw IllegalStateException(failureMessage)
        },
        analyze = { bytes -> block(checkNotNull(bytes)) }
    )

    private fun start(
        imageStore: FoodImageStore,
        failureMessage: String,
        loadImage: suspend () -> ByteArray?,
        analyze: suspend (ByteArray?) -> FoodAnalysis
    ) {
        if (mutableState.value.busy || mutableState.value.result != null) return
        mutableState.value = IngredientIntakeState(busy = true)
        request = viewModelScope.launch {
            try {
                val imageBytes = loadImage()
                val ingredient = analyze(imageBytes).toMealIngredient()
                val filename = imageBytes?.let {
                    withContext(Dispatchers.IO) { imageStore.storeBytes(it, UUID.randomUUID()) }
                }
                mutableState.value = IngredientIntakeState(result = ingredient.copy(imageFilename = filename))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.value = IngredientIntakeState(
                    error = error.message?.takeIf { it.isNotBlank() } ?: failureMessage
                )
            }
        }
    }

    fun consumeResult() {
        mutableState.value = mutableState.value.copy(result = null)
    }

    fun dismissError() {
        mutableState.value = mutableState.value.copy(error = null)
    }

    fun discard() {
        request?.cancel()
        request = null
        mutableState.value = IngredientIntakeState()
    }
}
