# Insight Hub Analytics

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml`.

Required GitHub repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Repository setting required:
- In **Settings → Pages**, set source to **GitHub Actions**.

Supabase Auth configuration required:
- Add the final GitHub Pages URL (for example `https://shelenie.github.io/insight-hub-analytics/`) to allowed redirect URLs.

Manual live checks after each deployment:
- magic link login
- Google login
- protected routes after refresh
- Ads OAuth start buttons
- AI helper
- scheduled sync
- Telegram retry/alert actions
