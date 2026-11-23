#!/usr/bin/env bash
# Posts the MeQuest Season 1 starter set (17 cards) and links the Learn Gno realm.
# Usage: seed.sh <key-name> <owner g1 address> <rpc> <chain-id> [gnokey home]
set -euo pipefail
KEY=$1; OWNER=$2; RPC=$3; CHAIN=$4; HOME_DIR=${5:-$HOME/.gnokey}
GNOKEY=${GNOKEY:-gnokey}
MQ=gno.land/r/$OWNER/mequest
LEARN=gno.land/r/$OWNER/mqlearn
DAYS=${DAYS:-38}

call() { # pkg func send args...
  local pkg=$1 fn=$2 send=$3; shift 3
  local a=(); for x in "$@"; do a+=(-args "$x"); done
  printf '%s\n' "${PASS:-x}" | $GNOKEY maketx call -pkgpath "$pkg" -func "$fn" ${send:+-send "$send"} "${a[@]}" \
    -gas-fee 1000000ugnot -gas-wanted 30000000 -broadcast -chainid "$CHAIN" -remote "$RPC" \
    -home "$HOME_DIR" -insecure-password-stdin "$KEY" 2>&1 | grep -E 'OK!|Error|Data:' | head -2
}
# quest: title desc art rarity kind arg pay max ugnot-total
quest() { echo "+ $1"; call $MQ CreateQuest "$9ugnot" "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$8" "$DAYS"; }

# Common (8) · 5 GNOT pools
quest "Create an Adena wallet"        "Hold any GNOT in your wallet. Your first card."                    wallet    1 hold     1        fixed 50 5000000
quest "Get test GNOT from the faucet" "Hold at least 1 GNOT. Grab it free at faucet.gno.land."           faucet    1 hold     1000000  fixed 50 5000000
quest "Do your first daily check-in"  "Check in once on your passport. Come back tomorrow for a streak." checkin   1 checkin  1        fixed 50 5000000
quest "Register your username"        "Claim a name on the gno.land users realm so people see @you."     name      1 name     ""       fixed 50 5000000
quest "Be an early bird"              "Only the first 100 wallets to join Season 1 get this."           bird      1 early    100      fixed 50 5000000
quest "Invite a friend"               "Share your invite link. You earn when your friend gets a card."  recruit   1 invites  1        fixed 50 5000000
quest "Post your passport on X"       "Post your MeQuest passport with your code. The project approves." butterfly 1 manual   ""       fixed 50 5000000
quest "Pass the Learn Gno lessons"    "Answer 3 lessons on the mqlearn realm. It reports you itself."   guest     1 push     "$LEARN" fixed 50 5000000
# Rare (5) · 5 GNOT pools
quest "Quest from 3 projects"         "Earn cards from three different Gno projects."                   explorer  2 projects 3        fixed 20 5000000
quest "Check in 7 days in a row"      "Miss a day and the streak restarts."                             week      2 checkin  7        fixed 20 5000000
quest "Post a funded quest"           "Lock GNOT into a quest of your own on the Post page."           maker     2 posted   1        fixed 20 5000000
quest "Deploy your first realm"       "Deploy a realm under your own address that calls MeQuest."       realm     2 myrealm  ""       fixed 20 5000000
quest "Collect 10 cards"              "For the people who were here first."                             founder   2 cards    10       fixed 20 5000000
# Epic (3) · split pools, shared fairly after the season
quest "Bring a squad of 5"            "Five friends you invited each earn a card."                      squad     3 invites  5        split 10 5000000
quest "Finish the starter path"       "Own all five starter-path cards."                                builder   3 card     "1,2,4,8,12" split 10 5000000
quest "Check in 30 days in a row"     "A full month without missing a day."                             unbreak   3 checkin  30       split 10 5000000
# Legendary (1) · given to the season top 3
quest "Finish Season 1 in the top 3"  "Given by MeQuest when the season clock hits zero."              champ     4 grant    ""       fixed 3  3000000

echo "+ link Learn Gno lesson 3 -> quest 8"
call $LEARN LinkQuest "" 3 8
