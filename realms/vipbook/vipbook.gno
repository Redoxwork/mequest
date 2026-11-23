// Package vipbook is a guestbook only MeQuest Rare+ card holders can sign.
// It shows any realm can gate on MeQuest cards in one line.
package vipbook

import (
	"strconv"
	"strings"
	"time"

	"gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest"
)

type entry struct {
	Who  address
	Rank int
	Msg  string
	At   int64
}

var (
	book   []entry
	signed = map[address]bool{}
	ranks  = []string{"Newcomer", "Rookie", "Explorer", "Pathfinder", "Legend"}
)

// Sign leaves a message in the VIP book. Needs a Rare MeQuest card or better.
func Sign(cur realm, msg string) {
	if !cur.Previous().IsUserCall() {
		panic("call this directly from your wallet")
	}
	who := cur.Previous().Address()
	if !mequest.HasRarity(who, mequest.Rare) {
		panic("VIP only: earn a Rare MeQuest card or better first")
	}
	if signed[who] {
		panic("you already signed")
	}
	msg = strings.TrimSpace(msg)
	if msg == "" || len(msg) > 140 {
		panic("message must be 1-140 chars")
	}
	signed[who] = true
	book = append(book, entry{who, mequest.BestRarity(who), msg, time.Now().Unix()})
}

func Render(path string) string {
	if path == "api" {
		out := []string{}
		for i := len(book) - 1; i >= 0; i-- {
			e := book[i]
			out = append(out, "{\"addr\":"+strconv.Quote(string(e.Who))+",\"rank\":"+strconv.Quote(ranks[e.Rank])+
				",\"msg\":"+strconv.Quote(e.Msg)+",\"at\":"+strconv.FormatInt(e.At, 10)+"}")
		}
		return "[" + strings.Join(out, ",") + "]"
	}
	s := "# VIP Guestbook\n\nOnly wallets holding a **Rare** MeQuest card or better can sign.\nGate check: `mequest.HasRarity(wallet, mequest.Rare)`\n\n"
	if len(book) == 0 {
		return s + "_No VIPs yet._\n"
	}
	for i := len(book) - 1; i >= 0; i-- {
		e := book[i]
		w := string(e.Who)
		s += "- **" + ranks[e.Rank] + "** " + w[:7] + "…" + w[len(w)-4:] + ": " + e.Msg + "\n"
	}
	return s
}
