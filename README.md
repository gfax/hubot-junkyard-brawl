<p align="center">
  <img src="https://raw.githubusercontent.com/gfax/junkyard-brawl/master/logo.jpg" alt="Junkyard Brawl">
</p>

[![Build Status](https://travis-ci.org/gfax/hubot-junkyard-brawl.svg?branch=master)](https://travis-ci.org/gfax/hubot-junkyard-brawl)
[![dependencies Status](https://david-dm.org/gfax/hubot-junkyard-brawl/status.svg)](https://david-dm.org/gfax/hubot-junkyard-brawl)

Hubot script for playing Junkyard Brawl on your favorite chat protocol.

## Installation

```bash
# Install via Yarn - https://yarnpkg.com/lang/en/
yarn add hubot-junkyard-brawl
# Install via npm
npm install --save hubot-junkyard-brawl
```

## Usage

- `hubot junkyard` - create a new game
- `jo[in]` - join an existing game
- `start` - start a game (once 2 or more players join)
- `stop` - stop a game
- `di[scard] 1 2 3` - discard cards 1,2 and 3
- `pl[ay] 1 2 3` - play cards 1, 2 and 3
- `pa[ss]` - pass the chance to respond to an opponent
- `st[atus]` - print your cards and health in a private message
- `rm/remove me` - remove yourself from a game
- `remove <player>` - remove another player (if you are the game manager)
- `transfer <player>` - transfer management to another player

Usage can also be accessed from the bot by typing `<hubot> help junkyard`

## Development and testing

Start hubot from the command line and it will load up the plugin to run tests on:

```bash
npm start
```

You can also lint the code using eslint:

```bash
npm run test
```
