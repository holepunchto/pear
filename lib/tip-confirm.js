'use strict'

// The answer check for the tip prompt, deliberately kept out of cmd/tip.js so it can be
// tested without a platform or a wallet. This is the line that decides whether money moves,
// so it is the one piece here worth pinning down.
//
// Tipping always spends — a dry run stops before the prompt — so the answer must be the
// word, exactly, case-sensitively. No default, no prefix match, so neither a stray
// keystroke nor a bare Enter can send anything.
const SEND_WORD = 'SEND'

function confirms(answer) {
  return String(answer ?? '').trim() === SEND_WORD
}

module.exports = { confirms, SEND_WORD }
