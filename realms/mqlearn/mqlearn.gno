// Package mqlearn is the MeQuest "Learn Gno" path: answer a lesson right and
// this realm calls mequest.Complete for you (push-verified quest).
package mqlearn

import (
	"strconv"
	"strings"

	"gno.land/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest"
)

type lesson struct {
	Q, A, Hint string
}

var (
	admin   address = "g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l"
	lessons         = []lesson{
		{"Realm functions that change state take a first parameter of which type?", "realm", "Look at func Claim(cur ...)."},
		{"Realm paths start with gno.land/? (p or r)", "r", "p is for pure packages."},
		{"Which CLI signs and sends transactions?", "gnokey", "gno + key."},
	}
	questOf = map[int]int{}            // lesson -> MeQuest quest id
	passed  = map[string]bool{}        // wallet:lesson
	solvers = map[int]int{}            // lesson -> count
)

// Answer checks your answer and, if right, completes the linked MeQuest quest.
func Answer(cur realm, n int, answer string) {
	if !cur.Previous().IsUserCall() {
		panic("call this directly from your wallet")
	}
	user := cur.Previous().Address()
	if n < 1 || n > len(lessons) {
		panic("no such lesson")
	}
	key := string(user) + ":" + strconv.Itoa(n)
	if passed[key] {
		panic("you already passed this lesson")
	}
	if n > 1 && !passed[string(user)+":"+strconv.Itoa(n-1)] {
		panic("pass lesson " + strconv.Itoa(n-1) + " first")
	}
	if strings.ToLower(strings.TrimSpace(answer)) != lessons[n-1].A {
		panic("not quite. hint: " + lessons[n-1].Hint)
	}
	passed[key] = true
	solvers[n]++
	if id := questOf[n]; id > 0 {
		mequest.Complete(cross(cur), id, user)
	}
}

// LinkQuest connects a lesson to a MeQuest push quest. Admin only.
func LinkQuest(cur realm, n int, questID int) {
	if cur.Previous().Address() != admin {
		panic("admin only")
	}
	if n < 1 || n > len(lessons) {
		panic("no such lesson")
	}
	questOf[n] = questID
}

func Passed(wallet address, n int) bool { return passed[string(wallet)+":"+strconv.Itoa(n)] }

func Render(path string) string {
	// api/<wallet>: lessons as JSON with this wallet's progress
	if strings.HasPrefix(path, "api/") {
		w := path[4:]
		out := []string{}
		for i, l := range lessons {
			n := i + 1
			out = append(out, "{\"n\":"+strconv.Itoa(n)+",\"q\":"+strconv.Quote(l.Q)+",\"hint\":"+strconv.Quote(l.Hint)+
				",\"quest\":"+strconv.Itoa(questOf[n])+",\"solvers\":"+strconv.Itoa(solvers[n])+
				",\"passed\":"+strconv.FormatBool(passed[w+":"+strconv.Itoa(n)])+"}")
		}
		return "[" + strings.Join(out, ",") + "]"
	}
	s := "# Learn Gno with MeQuest\n\nAnswer each lesson with `Answer(n, answer)`. Pass it and your MeQuest card is minted automatically.\n\n"
	for i, l := range lessons {
		n := i + 1
		s += "## Lesson " + strconv.Itoa(n) + "\n" + l.Q + "\n\n"
		if id := questOf[n]; id > 0 {
			s += "Reward: [MeQuest quest #" + strconv.Itoa(id) + "](/r/g1hwcp3aah5ehwq7zvz74c4x5nzewtgz2qmwjj0l/mequest:q/" + strconv.Itoa(id) + ") · "
		}
		s += strconv.Itoa(solvers[n]) + " passed\n\n"
	}
	return s
}
