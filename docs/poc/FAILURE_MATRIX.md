# Failure Recovery Matrix

## Implemented Mitigations
- Network Timeout: OkHttp default timeouts.
- Client Rejection (403): Captured in StreamFailure.ClientRejected sealed class.
- Missing Audio Format: Captured in StreamFailure.NoAudioFormat.

## Runtime Verification
Since the test was not run, recovery behavior (e.g. falling back to ANDROID_VR) is **NOT PROVEN**.
