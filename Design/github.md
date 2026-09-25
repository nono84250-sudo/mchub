repo: nono84250-sudo/mchub
branch: master

## Last sync
date: 2026-09-23T13:33:38Z
### Updated in this project
- Site nav: single "Log in" button (Nav.tsx); manage sidebar icons Layout / ChartBar (ManageSidebar.tsx)
- Dashboard 03: left nav Servers / Notifications / News (DashboardNav.tsx)
- Download 00b: macOS & Linux shown as "Coming soon" (download/page.tsx)
- Launcher bootstrap: centered title, no window controls, "Starting…" instead of fake update check (launcher/src/index.html)

## Sync history
date: 2026-09-23T08:10:42Z
- Read site/src/app/dashboard, DashboardNav.tsx, i18n fr.json
date: 2026-09-21T22:03:12Z
commit: c7ed3a0a58c6

## Screen map
| Screen | Repo files |
| --- | --- |
| Home (public site) | site/src/app/page.tsx, site/src/components/Nav.tsx |
| Download | site/src/app/download/page.tsx |
| Login / Signup | site/src/app/login, site/src/app/signup, AuthShell.tsx, LoginForm.tsx, SignupForm.tsx |
| Onboarding (list your server) | site/src/components/NewServerWizard.tsx, ServerForm.tsx |
| Home / Dashboard | site/src/app/dashboard/page.tsx, DashboardNav.tsx |
| Search (directory) | site/src/app/servers/page.tsx, ServerCard.tsx, ServerStatus.tsx |
| Settings / Reports (manage console) | site/src/app/manage/[id]/settings/page.tsx, ManageSidebar.tsx, ManageActions.tsx |
| Profile | site/src/app/account/page.tsx, AccountForm.tsx |
| Launcher — Bootstrap | launcher/src/index.html (#bootstrap) |
| Launcher — Login gate | launcher/src/index.html (#gate) |
| Launcher — Server list / detail | launcher/src/index.html (#app, #sidebar, #list, #detail, #playbar) |
| Launcher — Settings (+ Debug) | launcher/src/index.html (#settings-panel), debug-console.html |
| Admin dashboard | no repo counterpart yet (User.role not in schema) |
