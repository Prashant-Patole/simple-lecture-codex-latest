# Project Instructions

## Supabase Edge Functions

- Any change to a file under `supabase/functions/<function-name>/` MUST be automatically deployed live to Supabase Cloud project `oxwhqvsoelqqsblmqkxx` before finishing the task.
- Deployment command:
  `npx supabase functions deploy <function-name> --project-ref oxwhqvsoelqqsblmqkxx --no-verify-jwt`
- Use the `SUPABASE_ACCESS_TOKEN` environment variable.
- Preserve the function's `verify_jwt` setting from `supabase/config.toml`.
- Confirm deployment success in the final turn summary.
