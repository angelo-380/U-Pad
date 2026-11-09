package com.example.upad.utils

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember

data class PasswordValidationResult(
    val isValid: Boolean,
    val errorMessage: String = ""
)

object PasswordValidator {
    private val UPPERCASE_REGEX = Regex("[A-Z]")
    private val DIGIT_REGEX = Regex("[0-9]")
    private val SPECIAL_CHAR_REGEX = Regex("[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?~`]")

    fun validate(password: String): PasswordValidationResult {
        if (password.length < 8) {
            return PasswordValidationResult(
                isValid = false,
                errorMessage = "Password must be at least 8 characters long."
            )
        }
        if (!UPPERCASE_REGEX.containsMatchIn(password)) {
            return PasswordValidationResult(
                isValid = false,
                errorMessage = "Password must contain at least one uppercase letter (A-Z)."
            )
        }
        if (!DIGIT_REGEX.containsMatchIn(password)) {
            return PasswordValidationResult(
                isValid = false,
                errorMessage = "Password must contain at least one numeric digit (0-9)."
            )
        }
        if (!SPECIAL_CHAR_REGEX.containsMatchIn(password)) {
            return PasswordValidationResult(
                isValid = false,
                errorMessage = "Password must contain at least one special character (!@#$%^&*...)."
            )
        }
        // Disallow trivial sequence passwords
        if (password.lowercase().contains("123456") || password.lowercase().contains("password")) {
            return PasswordValidationResult(
                isValid = false,
                errorMessage = "Password cannot be a common predictable sequence."
            )
        }
        return PasswordValidationResult(isValid = true)
    }
}

/**
 * Ensures that rapid multiple button presses within [debounceIntervalMs]
 * are ignored, executing the action at most once per interval.
 */
@Composable
fun rememberDebouncedClick(
    debounceIntervalMs: Long = 900L,
    onClick: () -> Unit
): () -> Unit {
    val lastClickTimeState = remember { androidx.compose.runtime.mutableLongStateOf(0L) }
    return {
        val currentTime = SystemClock.elapsedRealtime()
        if (currentTime - lastClickTimeState.longValue >= debounceIntervalMs) {
            lastClickTimeState.longValue = currentTime
            onClick()
        }
    }
}
