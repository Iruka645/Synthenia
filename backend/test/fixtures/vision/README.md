# Vision fixtures

`tiny-png.base64` is a deterministic 1x1 PNG containing no user or screen data.
Tests decode it in memory and independently verify its PNG signature and dimensions.
The fixture is stored as text so the repository remains portable without a binary
generation step. It is never written to logs, temporary uploads, or test output.
