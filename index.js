// Description:
//   Play Junkyard Brawl on your favorite chat protocol
//
// Commands:
//   hubot junkyard - start a game of Junkyard Brawl, play 3 2 1 - play your 3rd, 2nd, and 1st card, discard 3 2 1 - discard your 3rd, 2nd, and 1st card, pass - pass (in response to being attacked), remove <player> - drop a player from the game (must be game manager to do so), transfer <player> - assign a new game manager
//
// Author:
//   gfax

const JunkyardBrawl = require('junkyard-brawl')
const ircColors = require('irc-colors')
const Language = require('junkyard-brawl/src/language')
const phrases = require('./phrases.json')

// Get phrases document for translations
const lang = process.env.HUBOT_JUNKYARD_BRAWL_LANG || 'en'

// Regexes we may re-defined
const createRegex = /\bjunkyard$/i
const discardRegex = /^di(s(card)?)?\b.+/i
const joinRegex = /^jo(in)?$/i
const passRegex = /^pa(ss)?$/i
const playRegex = /^pl(ay)?\b.+/i
const removeRegex = /^(rm)|(rem(ove)?)\b.+/i
const statusRegex = /^st((at)?us)?$/i
const startRegex = /^start$/i
const stopRegex = /^stop$/i
const transferRegex = /^tr(ansfer)?\b.+/i

// Game instances, scoped to each room
const games = {}

module.exports = (robot) => {
  robot.respond(createRegex, createGame)
  robot.hear(discardRegex, discard)
  robot.hear(joinRegex, addPlayer)
  robot.hear(passRegex, pass)
  robot.hear(playRegex, play)
  robot.hear(removeRegex, removePlayer)
  robot.hear(statusRegex, status)
  robot.hear(startRegex, startGame)
  robot.hear(stopRegex, stopGame)
  robot.hear(transferRegex, transfer)

  // Override card formatting
  if (robot.adapterName === 'irc') {
    Language.printCards = printCardsIrc
  } else if (robot.adapterName === 'slack') {
    Language.printCards = printCardsSlack
  }

  function createGame(response) {
    const { message: { user, room } } = response
    const game = getGame(response)
    if (game) {
      response.send(getPhrase('already-started'))
      return
    }

    setGame(response, new JunkyardBrawl(
      user.id,
      user.name,
      generateAnnounceCallback(room || user.id),
      generateWhisperCallback(),
      lang
    ))

    setTimeout(() => {
      announce(response, 'advertise')
    }, 800)
  }

  function addPlayer(response) {
    const { message: { user } } = response
    const game = getGame(response)
    if (game) {
      game.addPlayer(user.id, user.name)
      if (!game.started && game.players.length === 2) {
        announce(response, 'ready')
      }
    }
  }

  function announce(response, key) {
    const { message: { user, room } } = response
    const phrase = getPhrase(key)
    if (room) {
      robot.messageRoom(room, phrase)
    } else {
      robot.messageRoom(user.id, phrase)
    }
  }

  function discard(response) {
    const { message: { user } } = response
    const game = getGame(response)
    if (game) {
      const [, ...text] = response.message.text.split(' ')
      game.discard(user.id, text.join(' '), text[text.length - 1])
    }
  }

  // Take the filthy user text and make sense of it
  function formatRequest(text, game) {
    const array = text.toLowerCase().split(' ')
    let player = null
    const cardRequest = array.filter((el) => {
      const found = game.players.find((plyr) => {
        return el === plyr.name.toLowerCase() || el === plyr.id.toLowerCase()
      })
      player = player || found
      // Filter this element from the card request
      return !found && !isNaN(parseInt(el))
    }).join(' ')
    return [cardRequest, player]
  }

  function generateAnnounceCallback(room) {
    return (code, message, messageProps) => {
      const game = games[room]
      if (game) {
        if (code === 'game:no-survivors' || code === 'game:winner') {
          games[room] = null
        }
        if (code === 'game:stopped') {
          games[room] = null
        }
      }
      robot.messageRoom(room, message)
    }
  }

  function generateWhisperCallback() {
    return (playerId, code, message) => {
      robot.messageRoom(playerId, message)
    }
  }

  // Find the game instance the player is trying to play (if any)
  function getGame(response) {
    const { message: { user, room } } = response
    return games[room] || games[user.id]
  }

  function getPhrase(key) {
    if (!phrases[key]) {
      throw new Error(`Invalid phrase: ${key}`)
    }
    return phrases[key][lang]
  }

  function pass(response) {
    const { message: { user } } = response
    const game = getGame(response)
    if (game) {
      game.pass(user.id)
    }
  }

  function play(response) {
    const { message: { user } } = response
    const game = getGame(response)
    if (game) {
      const [cardRequest, target] = formatRequest(response.message.text, game)
      game.play(user.id, cardRequest, target)
    }
  }

  // indexed = false - Earthquake, Block, Grab...
  // indexed = true - 1) Earthquake 2) Block 3) Grab...
  function printCardsIrc(cards, language, indexed = false) {
    const colors = {
      attack: ircColors.bold.yellow.bgblack,
      counter: ircColors.bold.green.bgblack,
      disaster: ircColors.bold.red.bgblack,
      support: ircColors.bold.blue.bgblack,
      unstoppable: ircColors.bold.olive.bgblack
    }
    // Ensure parameter is an array, even when one card is passed in
    const cardsToPrint = Array.isArray(cards) ? cards : [cards]
    if (!cardsToPrint.length) {
      return Language.getPhrase('player:no-cards', language)()
    }
    if (indexed) {
      return cardsToPrint.map((card, idx) => {
        const cardName = Language.getPhrase(`card:${card.id}`, language)()
        return `${idx + 1}) ${colors[card.type](cardName)}`
      }).join(' ')
    }
    return cardsToPrint.map((card) => {
      return colors[card.type](Language.getPhrase(`card:${card.id}`, language)())
    }).join(', ')
  }

  // indexed = false - Earthquake, Block, Grab...
  // indexed = true - (1. :thunder_cloud_and_rain: Earthquake) (2. :raised_hand: Block) (3. :warning: Grab...)
  function printCardsSlack(cards, language, indexed = false) {
    const emojis = {
      attack: text => `:fist: ${text}`,
      counter: text => `:raised_hand: ${text}`,
      disaster: text => `:thunder_cloud_and_rain: ${text}`,
      support: text => `:pill: ${text}`,
      unstoppable: text => `:warning: ${text}`
    }
    // Ensure parameter is an array, even when one card is passed in
    const cardsToPrint = Array.isArray(cards) ? cards : [cards]
    if (!cardsToPrint.length) {
      return Language.getPhrase('player:no-cards', language)()
    }
    if (indexed) {
      return cardsToPrint.map((card, idx) => {
        const cardName = `*${Language.getPhrase(`card:${card.id}`, language)()}*`
        return `(${idx + 1}. ${emojis[card.type](cardName)})`
      }).join(' ')
    }
    return cardsToPrint.map((card) => {
      const cardName = Language.getPhrase(`card:${card.id}`, language)()
      return emojis[card.type](`*${cardName}*`)
    }).join(', ')
  }

  function removePlayer(response) {
    const { message: { user, text } } = response
    const game = getGame(response)
    if (game) {
      const [, target] = formatRequest(text, game)
      if (target) {
        if (user.id !== game.manager.id && user.id !== target.id) {
          whisper(user, 'cannot-remove')
          return
        }
        game.removePlayer(target)
      } else if (text.match(/\bme\b/i)) {
        // Remove thyself
        game.removePlayer(user.id)
      }
    }
  }

  // Store the game in the public channel as well as the user
  // room so that the user can give input from a private chat.
  function setGame(response, val) {
    const { message: { user, room } } = response
    if (room) {
      games[room] = val
      return
    }
    games[user.id] = val
  }

  function status(response) {
    const { message: { user } } = response
    const game = getGame(response)
    if (game) {
      game.whisperStats(user.id)
    }
  }

  function startGame(response) {
    const game = getGame(response)
    if (game) {
      game.start()
    }
  }

  function stopGame(response) {
    const { message: { user } } = response
    const game = getGame(response)
    if (game) {
      if (game.manager.id !== user.id) {
        whisper(user, 'cannot-stop')
        return
      }
      game.stop()
      setGame(response, null)
    }
  }

  function transfer(response) {
    const { message: { user, text } } = response
    const game = getGame(response)
    if (game) {
      if (game.manager.id !== user.id) {
        whisper(user, 'cannot-transfer')
        return
      }
      const [, target] = formatRequest(text.remove(transferRegex), game)
      if (target) {
        game.transferManagement(target)
      }
    }
  }

  function whisper(user, key) {
    robot.messageRoom(user.id, getPhrase(key))
  }

}
