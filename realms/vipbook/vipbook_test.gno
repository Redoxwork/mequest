package vipbook

import (
	"chain"
	"strings"
	"testing"

	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
	"gno.land/p/nt/urequire/v0"

	"gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest"
	"gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mqlearn"
)

var (
	admin = address("g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l")
	alice = testutils.TestAddress("alice")
	bob   = testutils.TestAddress("bob")
	mq    = chain.PackageAddress("gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest")
)

// Full journey: learn 3 lessons -> push-verified Rare card + GNOT -> sign VIP book.
func TestJourney(cur realm, t *testing.T) {
	// admin funds a Rare push quest owned by mqlearn: 3 winners x 1 GNOT
	testing.SetRealm(testing.NewUserRealm(admin))
	testing.SetOriginCaller(admin)
	testing.SetOriginSend(chain.Coins{{"ugnot", 3_000_000}})
	testing.IssueCoins(mq, chain.Coins{{"ugnot", 3_000_000}})
	id := mequest.CreateQuest(cross(cur), "Learn Gno: graduate", "Pass all 3 lessons", "wallet", mequest.Rare,
		mequest.KindPush, "gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mqlearn", mequest.PayFixed, 3, 14)
	testing.SetOriginSend(nil)
	mqlearn.LinkQuest(cross(cur), 3, id)

	// bob can't sign without a Rare card
	testing.SetRealm(testing.NewUserRealm(bob))
	testing.SetOriginCaller(bob)
	uassert.AbortsContains(t, cur, "VIP only", func() { Sign(cross(cur), "let me in") })
	// bob can't skip lessons or claim the push quest himself
	uassert.AbortsContains(t, cur, "lesson 2 first", func() { mqlearn.Answer(cross(cur), 3, "gnokey") })
	uassert.AbortsContains(t, cur, "partner app", func() { mequest.Claim(cross(cur), id) })

	// alice learns
	testing.SetRealm(testing.NewUserRealm(alice))
	testing.SetOriginCaller(alice)
	uassert.AbortsContains(t, cur, "hint", func() { mqlearn.Answer(cross(cur), 1, "string") })
	urequire.NotPanics(t, cur, func() { mqlearn.Answer(cross(cur), 1, "Realm") })
	urequire.NotPanics(t, cur, func() { mqlearn.Answer(cross(cur), 2, "r") })
	urequire.NotPanics(t, cur, func() { mqlearn.Answer(cross(cur), 3, "gnokey") })
	uassert.True(t, mequest.HasCard(alice, id))
	uassert.True(t, mequest.HasRarity(alice, mequest.Rare))

	// and gets into the VIP book
	urequire.NotPanics(t, cur, func() { Sign(cross(cur), "gm from a certified Explorer") })
	uassert.AbortsContains(t, cur, "already signed", func() { Sign(cross(cur), "again") })
	uassert.True(t, strings.Contains(Render(""), "Explorer"))
	println("JSON " + Render("api"))
	println("JSON " + mqlearn.Render("api/"+string(alice)))
	println(mqlearn.Render(""))
	println(mequest.Render("p/" + string(alice)))
}
