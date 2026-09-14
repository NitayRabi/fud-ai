package com.apoorvdarshan.calorietracker.ui.components

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.apoorvdarshan.calorietracker.AppContainer
import com.apoorvdarshan.calorietracker.R
import com.apoorvdarshan.calorietracker.models.FudAILinks
import com.apoorvdarshan.calorietracker.ui.theme.AppColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private enum class PostUpdatePrompt { HOSTED_UPSELL, HOSTED_ANDROID_NOTE, MEET_DEVELOPER }

/**
 * One-time prompts for *existing* users the first time they open the app after
 * updating (iOS parity). Sequence: hosted-AI choice → meet the developer → arm the
 * Product Hunt launch reminder. Never stacks dialogs; each step advances from the
 * previous one's dismiss. Fresh installs never qualify — onboarding completion
 * marks every prompt as seen (see PreferencesStore.setOnboardingCompleted).
 *
 * Hosted billing is iPhone-first, so the Android CTA opens an honest "coming to
 * Android; BYOK stays free" note instead of a store flow.
 */
@Composable
fun PostUpdatePromptsHost(container: AppContainer, enabled: Boolean) {
    val prefs = container.prefs
    val scope = rememberCoroutineScope()
    var prompt by remember { mutableStateOf<PostUpdatePrompt?>(null) }

    suspend fun armProductHuntReminder(): Boolean =
        container.notifications.scheduleProductHuntLaunchReminderIfNeeded(prefs)

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) scope.launch { armProductHuntReminder() }
    }

    suspend fun finishFlow() {
        val needsPermission = armProductHuntReminder()
        if (needsPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    suspend fun continueToMeetDeveloper(delayMillis: Long) {
        if (prefs.hasSeenMeetDeveloperPrompt.first()) {
            finishFlow()
            return
        }
        delay(delayMillis)
        prefs.setHasSeenMeetDeveloperPrompt(true)
        prompt = PostUpdatePrompt.MEET_DEVELOPER
    }

    LaunchedEffect(enabled) {
        if (!enabled) return@LaunchedEffect
        // Let the first frame settle before interrupting.
        delay(2_500)
        if (!prefs.hasCompletedOnboarding.first()) return@LaunchedEffect
        if (!prefs.hasSeenHostedUpsellPrompt.first()) {
            prefs.setHasSeenHostedUpsellPrompt(true)
            prompt = PostUpdatePrompt.HOSTED_UPSELL
            return@LaunchedEffect
        }
        continueToMeetDeveloper(delayMillis = 0)
    }

    when (prompt) {
        PostUpdatePrompt.HOSTED_UPSELL -> HostedUpsellDialog(
            onLearnMore = { prompt = PostUpdatePrompt.HOSTED_ANDROID_NOTE },
            onKeepByok = {
                prompt = null
                scope.launch { continueToMeetDeveloper(delayMillis = 1_000) }
            }
        )
        PostUpdatePrompt.HOSTED_ANDROID_NOTE -> HostedAndroidNoteDialog(
            onDismiss = {
                prompt = null
                scope.launch { continueToMeetDeveloper(delayMillis = 1_000) }
            }
        )
        PostUpdatePrompt.MEET_DEVELOPER -> MeetDeveloperDialog(
            onDismiss = {
                prompt = null
                scope.launch { finishFlow() }
            }
        )
        null -> Unit
    }
}

@Composable
private fun HostedUpsellDialog(onLearnMore: () -> Unit, onKeepByok: () -> Unit) {
    FudGlassDialog(onDismissRequest = onKeepByok) {
        Text(
            text = stringResource(R.string.post_update_hosted_title),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = stringResource(R.string.post_update_hosted_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
        )
        FudGlassDialogActions(
            primaryText = stringResource(R.string.post_update_hosted_cta),
            onPrimary = onLearnMore,
            dismissText = stringResource(R.string.post_update_hosted_keep_byok),
            onDismiss = onKeepByok
        )
    }
}

@Composable
private fun HostedAndroidNoteDialog(onDismiss: () -> Unit) {
    FudGlassDialog(onDismissRequest = onDismiss) {
        Text(
            text = stringResource(R.string.post_update_hosted_android_title),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = stringResource(R.string.post_update_hosted_android_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
        )
        FudGlassDialogActions(
            primaryText = stringResource(R.string.post_update_hosted_android_got_it),
            onPrimary = onDismiss
        )
    }
}

@Composable
private fun MeetDeveloperDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    fun open(url: String) = context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

    FudGlassDialog(onDismissRequest = onDismiss) {
        Text(
            text = stringResource(R.string.post_update_meet_dev_title),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = stringResource(R.string.post_update_meet_dev_greeting),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = stringResource(R.string.post_update_meet_dev_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
        )
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            LinkRow(Icons.Filled.AlternateEmail, stringResource(R.string.about_follow_x)) { open(FudAILinks.X) }
            LinkRow(Icons.Filled.CameraAlt, stringResource(R.string.about_follow_instagram)) { open(FudAILinks.INSTAGRAM) }
            LinkRow(Icons.Filled.Forum, stringResource(R.string.about_join_discord)) { open(FudAILinks.DISCORD) }
            LinkRow(Icons.Filled.ThumbUp, stringResource(R.string.about_vote_ph)) { open(FudAILinks.PRODUCT_HUNT) }
        }
        FudGlassDialogActions(
            primaryText = stringResource(R.string.action_done),
            onPrimary = onDismiss
        )
    }
}

@Composable
private fun LinkRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = AppColors.Calorie, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}
