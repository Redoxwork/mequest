# MeQuest

**Quests that verify themselves.**

MeQuest is a quest board on [gno.land](https://gno.land). Every quest is checked by public Gno code. You do the thing, tap **Check me**, and the realm runs the check against your wallet. If it passes, you're paid in GNOT from a locked pool and get a numbered, soulbound card. You don't need screenshots, a moderator, or trust.

- **Live site:** https://redoxwork.github.io/mequest/
- **Realm:** [`gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest`](https://onyx.testnets.gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest) on the **onyx-1** testnet
- Built for the **Gnome Tavern** hackathon. It's testnet only, so GNOT here has no real value.

---

## Why

Most quest platforms pay for screenshots and trust a moderator to check them. That gets farmed by bots and slows down honest users. On Gno, every realm can read other realms, so most quests can be checked by code instead:

| Quest | The check, in Gno |
|---|---|
| Register a username | `users.ResolveAddress(addr) != nil` |
| Hold 1 GNOT | `banker.GetCoin(addr, "ugnot") >= 1000000` |
| Check in 7 days in a row | `StreakOf(addr) >= 7` |
| Finish the starter path | `HasCard(addr, 1) && HasCard(addr, 2) && ...` |
| Deploy your first realm | caller realm path starts with `gno.land/r/<your address>/` |

The rule is public, so anyone can read exactly why a wallet got paid or didn't.

## How it works

1. **A project posts a quest** and sends GNOT with the transaction. The pool is locked in the MeQuest realm's own address. Nobody can withdraw it early, the project included.
2. **A player taps Check me.** The site calls `CanClaim(addr, id)`, a free read-only dry run, and shows the proof log line by line.
3. **The player claims.** `Claim(id)` runs the same check on-chain. If it passes, the reward is paid and a card is minted to the wallet. If it fails, nothing moves.
4. **Every outcome leaves a receipt.** Each payout or rejection is stored with the check that ran and the block it landed in (see **Case files** on the site).
5. **When the quest ends,** unclaimed GNOT can only go back to the wallet that funded it.

### Five ways a quest gets verified

- **Auto-verified:** MeQuest runs a built-in check: `hold`, `name`, `card` (quest chains), `checkin` (streaks), `early` (first N wallets), `invites`, `projects`, `cards`, `posted`.
- **Partner realm (push):** a partner realm calls `mequest.Complete(cross(cur), id, user)`. Only that exact realm path is accepted. `mqlearn` is the live example.
- **Your own realm:** `ProveRealm` only accepts calls from a realm under `gno.land/r/<your address>/`, which proves you deployed it.
- **Social:** the player submits a post link with their code, and the project approves or rejects it with `Review`.
- **Grant:** given by the quest funder, for example to the season's top 3.

### Fair play built in

- One win per wallet per quest, and at most 10 claims per wallet per day.
- Calls must come straight from a wallet, not through another realm, so bots can't farm through contracts.
- Fixed pools close when the slots run out.
- Legendary quests can only be posted by approved projects, and claiming one needs an Epic card first.
- The admin can revoke a card from a cheating wallet.

## Cards

Every quest drops one fixed card. There are no random packs and nothing to buy. Cards are **soulbound** (you can't transfer them), numbered (`Rare #037/500`) and stamped **S1**.

| Rarity | Cards in Season 1 | Supply cap | Points |
|---|---|---|---|
| Common | 8 | unlimited | 10 |
| Rare | 5 | 500 | 50 |
| Epic | 3 | 100 | 200 |
| Legendary | 1 | 10 | 1000 |

Points rank the Season 1 leaderboard. Your best card sets your passport title: Rookie, Explorer, Pathfinder, or Legend.

**Other apps can gate on MeQuest cards in one line:**

```go
import "gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest"

if !mequest.HasRarity(caller, mequest.Rare) {
    panic("VIP only")
}
```

`vipbook` is a guestbook that does exactly this.

## Repo layout

```
realms/
  mequest/    core realm: quests, escrow pools, checks, cards, receipts, JSON views
  mqlearn/    "Learn Gno" quiz; passing lesson 3 completes a MeQuest quest (push model)
  vipbook/    guestbook only Rare+ card holders can sign (gating demo)
docs/         the website (static; served by GitHub Pages)
scripts/
  seed.sh     posts the Season 1 starter set (17 quests) with gnokey
```

### Realm API (main calls)

| Call | Who | What |
|---|---|---|
| `CreateQuest(title, desc, art, rarity, kind, arg, pay, max, days)` + GNOT | project | locks a pool and opens a quest |
| `CanClaim(addr, id) string` | anyone (read-only) | `"ok"` or the exact reason it would fail |
| `Claim(id)` | player | runs the check, pays, mints the card |
| `Submit(id, proof)` / `Review(id, addr, ok)` | player / funder | social quests |
| `Complete(id, addr)` | partner realm | push-verified quests |
| `ProveRealm(id)` | player's own realm | first-realm quest |
| `CheckIn()` / `SetInviter(addr)` | player | streaks and invites |
| `Refund(id)` / `Settle(id)` | funder / anyone | return unclaimed GNOT, or split pay after expiry |
| `HasCard`, `HasRarity`, `BestRarity`, `PointsOf` | any realm | read a wallet's cards |

The website reads everything through `Render("api/...")` JSON views over the public RPC (`vm/qrender`). It has no backend.

## Run it yourself

Tests use Gno `v1.8.0-rc.1`, the version onyx-1 runs:

```sh
cd realms
gno test ./...
```

Local chain with the realms loaded:

```sh
cd realms
gnodev local -paths gno.land/r/<addr>/mequest,gno.land/r/<addr>/mqlearn,gno.land/r/<addr>/vipbook
```

Seed the starter quests:

```sh
scripts/seed.sh <gnokey-key-name> <owner-address> https://rpc.onyx.testnets.gno.land:443 onyx-1
```

Run the site locally: serve `docs/` with any static server (for example `python3 -m http.server`) and edit `docs/config.js` to point at your RPC and realm paths. To claim you need the [Adena](https://www.adena.app/) wallet on a desktop browser. On a phone the site is view-only.

## Built with

Gno and gno.land (onyx-1), the Adena wallet, plain JavaScript with [morphdom](https://github.com/patrick-steele-idem/morphdom) for the site, and the card art and brand by the author.

---

MeQuest is an independent community project. It is not run by or affiliated with gno.land or NewTendermint.
