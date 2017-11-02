// Description:
//   Play Junkyard Brawl on your favorite chat protocol
//
// Commands:
//   hubot junkyard - start a game of Junkyard Brawl
//   play 3 2 1 - play your 3rd, 2nd, and 1st card
//   discard 3 2 1 - discard your 3rd, 2nd, and 1st card
//   pass - pass (in response to being attacked)
//   remove <player> - drop a player from the game (must be game manager to do so)
//   transfer <player> - assign a new game manager
//
// Author:
//   gfax

const JunkyardBrawl = require('junkyard-brawl')
const find = require('lodash.find')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

// Get phrases document for translations
const file = fs.readFileSync(path.join(__dirname, 'phrases.yml'), 'utf8')
const phrases = yaml.safeLoad(file)
const lang = 'en'

const games = {}

module.exports = (robot) => {
  robot.hear(/!junkyard$/i, createGame)
  robot.respond(/^junkyard$/i, createGame)
  robot.hear(/^jo(in)?$/i, addPlayer)
  robot.hear(/^remove/i, removePlayer)
  robot.hear(/^start/i, startGame)

  function createGame(response) {
    console.log(response.message)
    const { message: { user, room } } = response
    if (games[room]) {
      response.send(getPhrase('game:already-started'))
      return
    }

    const game = new JunkyardBrawl(
      user.id,
      user.name,
      generateAnnounceCallback(room),
      generateWhisperCallback(),
      lang
    )
    games[room] = game
    announce(room, 'game:advertise', true)
  }

  function addPlayer(response) {
    const { message: { user, room } } = response
    const game = games[room]
    if (game) {
      game.addPlayer(user.id, user.name)
      if (!game.started && game.players.length === 2) {
        announce(room, 'game:ready')
      }
    }
  }

  function announce(room, key, roomOnly = false) {
    const game = games[room]
    const phrase = getPhrase(key)
    robot.messageRoom(room, phrase)
    if (roomOnly === false) {
      game.players.forEach(player => robot.messageRoom(player.id, phrase))
    }
  }

  function generateAnnounceCallback(room) {
    return (code, message) => {
      const game = games[room]
      if (game) {
        game.players.forEach(player => robot.messageRoom(player.id, message))
      }
      robot.messageRoom(room, message)
    }
  }

  function generateWhisperCallback() {
    return (userId, code, message) => {
      robot.messageRoom(userId, message)
    }
  }

  function getPhrase(key) {
    if (!phrases[key]) {
      throw new Error(`Invalid phrase: ${key}`)
    }
    return phrases[key][lang]
  }

  function removePlayer(response) {
    const { message: { user, room } } = response
    const game = games[room]
    if (game) {
      if (game.manager.id !== user.id) {
        whisper(user.id, 'game:cannot-remove')
        return
      }
      const [, target] = response.message.text.split(' ')
      // Remove thyself
      if (target && target.toLowerCase() === 'me') {
        game.removePlayer(user.id)
      }
      // Look up the player by name since
      // game.getPlayer() relies on the user id
      const player = find(game.players, { name: target })
      if (player) {
        game.removePlayer(player)
      }
    }
  }

  function startGame(response) {
    const game = games[response.message.room]
    if (game && !game.started) {
      game.start()
    }
  }

  function whisper(userId, key) {
    robot.messageRoom(userId, getPhrase(key))
  }

}
