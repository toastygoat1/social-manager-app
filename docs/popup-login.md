Implement Google OAuth login using POPUP WINDOW flow (NOT redirect flow).

Requirements:
- When user clicks "Login with Google", open a NEW SEPARATE BROWSER WINDOW (popup) 
  using window.open() with specific width/height dimensions
- The popup must NOT be a tab, it must be a floating window
- Use postMessage API to communicate between the popup window and the parent window
- The parent window listens for a message from the popup containing the auth result
- After successful auth, the popup closes itself (window.close())
- The parent window then handles the session/token WITHOUT page reload

Technical implementation:
1. Parent page: opens popup with window.open(authUrl, 'googleAuth', 'width=500,height=600')
2. Parent page: adds event listener for window.addEventListener('message', handler)
3. Callback/redirect page (loaded inside popup): after OAuth completes, sends 
   result to parent with window.opener.postMessage(data, origin) then closes itself
4. Parent handles the postMessage data to set auth state

Do NOT use:
- window.location.href redirect
- window.location.replace
- router.push to external URL
- Full page navigation for the OAuth flow

TechStack: 

- Next.js for the frontend dashboard
- NestJS with Fastify for the backend API
- Prisma for database access
- Supabase for Auth, Postgres, and Storage
- Redis + BullMQ for scheduling and background jobs
- Docker for containerized development/production environments
- pnpm + Turbo for monorepo management

but you are the frontend, dont use the backend TechStack and work on the folder /apps/web for frontend