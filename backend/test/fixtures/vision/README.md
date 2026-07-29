# Vision fixtures

These are deterministic 1x1 synthetic fixtures containing no user or screen data.
The PNG is the existing complete 1x1 RGBA fixture. JPEG and WebP were generated
from a 1x1 white RGB image with a deterministic local Pillow encoder, then stored
as base64 text. Tests decode them only in memory and validate their container
structure, dimensions, and MIME agreement; they are never written to logs,
temporary uploads, or test output.

| File | Format | Dimensions | SHA-256 of decoded bytes |
| --- | --- | ---: | --- |
| `tiny-png.base64` | PNG | 1x1 | `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460` |
| `tiny-jpeg.base64` | JPEG | 1x1 | `9dacf9b93ef343cb1b10d45dcd84959c4448a68d0859d818cc3decfb7dbf619f` |
| `tiny-webp.base64` | WebP | 1x1 | `52dc24c0429ea6ccc5b579a6da8bb79bf41e471fe5108a62009f3c2e195551c0` |
