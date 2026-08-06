# Supabase Edge Functions Deployment Rule

- Whenever any edit or change is made to files under `supabase/functions/<function-name>/`, the updated function MUST be automatically deployed live to Supabase Cloud project `oxwhqvsoelqqsblmqkxx`.
- Deployment command:
  ```powershell
  npx supabase functions deploy <function-name> --project-ref oxwhqvsoelqqsblmqkxx --no-verify-jwt
  ```
- Always use the saved `SUPABASE_ACCESS_TOKEN` environment variable.
- Always verify that the deployment succeeds and report the deployment status to the user.
