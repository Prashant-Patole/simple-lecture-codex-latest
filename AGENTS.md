# Project Instructions

## Supabase Edge Functions

- Any change to a file under `supabase/functions/<function-name>/` must be deployed to the linked Supabase project before the task is considered complete.
- Deploy each changed function explicitly with `supabase functions deploy <function-name> --project-ref oxwhqvsoelqqsblmqkxx`.
- Preserve the function's `verify_jwt` setting from `supabase/config.toml`.
- After deployment, verify that the live function version and `updated_at` changed successfully.
- If deployment cannot be completed, clearly report that the repository code and the live function are out of sync.
