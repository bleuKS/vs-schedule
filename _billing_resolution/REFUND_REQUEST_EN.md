Subject: Request for one-time goodwill credit — unexpected Console auto-recharge charges (org: Vibeseoul)

To: usersupport@anthropic.com  (or via https://support.anthropic.com → Submit a request → Billing)

---

Hello Anthropic Support,

I'm a Claude **Max 20x** subscriber (account: vibeseoul.ks@gmail.com; Developer Console organization: **Vibeseoul**). I'd like to request a one-time goodwill review of recent Developer Console "Auto-recharge credits" charges.

**What happened**
I run a set of internal automation agents (Claude Agent SDK / headless `claude`) for my small business. My intent was for these to run under my Max subscription, not the pay-as-you-go Developer Console.

On June 15 I migrated these agents from API-key (Console) billing to my Max subscription via OAuth. The migration failed because the headless CLI had no valid OAuth session — every call returned "Not logged in · Please run /login" — so the agents **silently fell back to API-key (Console) billing**. I did not realize this fallback was still active. A few days later, after expanding the agent set, Console auto-recharge began triggering repeated ~$95 charges.

**Charges in question**
- 2026-06-11 — $95.17 — receipt 2360-4350-5141
- 2026-06-20 — $95.46 — receipt 2083-0588-9035
- 2026-06-21 — $95.14 — receipt 2896-3783-3273
- 2026-06-21 — $95.27 — receipt 2651-6807-8943
(For context, an earlier charge on 2026-05-27, $113.09, receipt 2230-2067-2178.)

**What I've already done to fix it**
- Disabled/paused the API key
- Turned off auto-reload and set a spend limit
- Rotating all keys (including two that had been accidentally committed and are being revoked)
- Migrating all agents to subscription/OAuth so Console usage returns to ~$0

I'm not disputing that the usage occurred. But as an active Max subscriber whose agents were intended to run under that subscription — and given the silent API-key fallback and that I remediated immediately on discovery — I'd be very grateful if you could review these recent auto-recharge charges for a one-time goodwill credit.

I'm happy to provide my Console Usage screenshots (per-key/per-model, June 20–22) and any receipt PDFs you need.

Thank you for your time,
KS (Choi)
Vibeseoul
vibeseoul.ks@gmail.com

---
NOTE (본인용, 발송 전 삭제):
- 보내기 전 Console Usage 스크린샷(6/20~22) 첨부.
- 조치 4·6·7이 끝났으면 "What I've already done"을 완료 시제로 다듬기.
- 만약 Usage에서 모르는 사용/낯선 키가 보이면, 이 메일 대신 "unauthorized use of a leaked API key" 로 톤을 바꿔 신고 → 환불 가능성 ↑.
