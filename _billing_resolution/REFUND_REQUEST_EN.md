Subject: Request for one-time goodwill refund — Console auto-recharge charges from a billing misconfiguration (org: Vibeseoul)

To: usersupport@anthropic.com  (or via https://support.anthropic.com → Submit a request → Billing)

---

Hello Anthropic Support,

I'm a Claude **Max 20x** subscriber (account: vibeseoul.ks@gmail.com; Developer Console organization: **Vibeseoul**). I'd like to request a one-time goodwill refund of three Developer Console "Auto-recharge credits" charges that resulted from a billing misconfiguration on my side.

**Charges in question (total: US$285.87)**
| Invoice date (UTC) | Amount | Receipt # |
|---|---|---|
| 2026-06-20 | US$95.46 | 2083-0588-9035 |
| 2026-06-21 | US$95.14 | 2896-3783-3273 |
| 2026-06-22 | US$95.27 | 2651-6807-8943 |

**What happened**
I run a set of internal automation agents (Claude Agent SDK / headless `claude`) for my small business. These were intended to run under my Max subscription, not the pay-as-you-go Developer Console.

On June 15 I migrated these agents from API-key (Console) billing to my Max subscription via OAuth. The migration failed because the headless CLI had no valid OAuth session — every call returned "Not logged in · Please run /login" — so my configuration **silently rolled back to API-key (Console) billing**. I did not realize the Console path was still active. Over the following days the agents kept running on the Console key, which triggered the three ~US$95 auto-recharge charges above on June 20–22.

**Remediation already completed**
- Paused/disabled the API key on the Console
- Turned off auto-reload and set a spend limit
- Rotating all keys (including two that had been accidentally committed, now being revoked)
- Migrating all agents to subscription/OAuth so Console usage returns to ~US$0

I understand the usage technically occurred. But as an active Max subscriber whose agents were meant to run under that subscription, given the silent fallback after a failed OAuth migration and that I corrected everything immediately upon discovery, I'd be very grateful for a one-time goodwill refund of these three charges (US$285.87).

I'm happy to provide Console Usage screenshots (per-key/per-model, June 20–22) and the invoice PDFs on request.

Thank you for your consideration,
KS (Choi)
Vibeseoul
vibeseoul.ks@gmail.com

---
NOTE (본인용 — 발송 전 삭제):
- Console → Settings → Usage 의 6/20~22 (키별·모델별) 스크린샷 첨부.
- 위 "Remediation"의 키 재발급·구독 이전이 끝났으면 그대로, 진행 중이면 "in progress"로 한 줄 조정.
