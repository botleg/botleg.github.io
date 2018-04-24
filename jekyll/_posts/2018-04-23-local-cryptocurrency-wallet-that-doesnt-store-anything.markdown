---
summary: Create a command-line wallet that stores cryptocurrencies, like bitcoin and ethereum, with just a 12 word phrase
title: Local Cryptocurrency Wallet that doesn't store anything
layout: post
categories: crypto
gh: https://github.com/botleg/cryptonym
bg: "background:#22C1C3;background-image:linear-gradient(160deg, #22C1C3, #FDBB2D);background-image:-moz-linear-gradient(160deg, #22C1C3, #FDBB2D);background-image:-webkit-linear-gradient(160deg, #22C1C3, #FDBB2D);background-image:-o-linear-gradient(160deg, #22C1C3, #FDBB2D);background-image:-ms-linear-gradient(160deg, #22C1C3, #FDBB2D);"
date: 2018-04-24
tags: cryptocurrency blockchain bitcoin wallet ethereum litecoin stellar erc20 somn golem lumen streamr bitcoin-cash bip44 javascript node.js
---
> A cryptocurrency (or crypto currency) is a digital asset designed to work as a medium of exchange that uses cryptography to secure its transactions, to control the creation of additional units, and to verify the transfer of assets.

You may have a variety of crypto-currencies stored in different places like exchanges or wallet. In this article, we will create our own command-line wallet that stores bitcoin, ethereum, bitcoin cash, litecoin, erc20 tokens, stellar, etc. This will be a local wallet that doesn't share any private information with the internet. It also doesn't store anything on disc.

All you need to have is a 12 word phrase that lets you generate the public and private keys for your accounts. This supports HD wallets that lets you create a new address for every transaction. I'll talk more about HD wallets next. This application only lets you receive coins and check balance. To send money, you need to export the private keys from this application and use it in dedicated wallets. This application is called __Cryptonym__ and the code can be found [here](https://github.com/botleg/cryptonym).


HD Wallet
---------

With HD (Hierarchical Deterministic) wallet, you can generate as many address and private/public keys as you want from a single phrase. All you need is a [mnemonic phrase](https://en.bitcoin.it/wiki/Mnemonic_phrase), from which we will generate the seed. From the seed, we can generate the multiple private/public keys and address. The cool thing about HD wallets is that we can create the keys for not only bitcoin, but also for a range of other coins.

From the seed, you can generate the keys using a derivation path. The derivation path has the following format,

{% highlight text %}
m / purpose' / coin_type' / account' / change / address_index
{% endhighlight %}

To know more about this format, check [here](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#path-levels). For example, value for `coin_type` is __0__ for __bitcoin__ and __60__ for __ethereum__. We will increment the `address_index` to get new addresses. To know more about the working of HD wallets, check [here](https://bitcoinmagazine.com/articles/deterministic-wallets-advantages-flaw-1385450276/).


Application Overview
--------------------

This will be a [Node.js](https://nodejs.org/) application that you can run in the command line terminal. So, the only dependency for this is Node.js with version __>= 9.0__. The code for the application can be found in [github](https://github.com/botleg/cryptonym). Once the repository is cloned, dependencies can be installed with `npm install`. To run this as a standalone application, you can use `npm link` command. This will create a symlink for this application (app.js) in the global package folder. This lets you access the application with `cryptonym` command. To know more about __npm link__, check [here](https://docs.npmjs.com/cli/link).

So, the commands to setup and run the wallet are as follows,

{% highlight bash %}
git clone git@github.com:hanzeljesheen/cryptonym.git
cd cryptonym
npm install
npm link
cryptonym
{% endhighlight %}

The entrypoint to the application is `app.js` and it looks like this,

{% highlight js %}
#!/usr/bin/env node
'use strict'

const bip39 = require('bip39')
const chalk = require('chalk')
const clear = require('cli-clear')
const inquirer = require('inquirer')
const Prompt = require('./utils/prompt');

(async () => {
  const prompt = new Prompt(inquirer)
  const mnemonic = await prompt.simple('Mnemonic Phrase (leave empty to generate one)')

  if (mnemonic.trim() === '') {
    console.log(`Mnemonic Phrase ${chalk.green(bip39.generateMnemonic())}`)
    console.log(`Save this phrase in a safe place and use it from now on. ${chalk.red('This phrase will never be generated again.')}`)
    process.exit(0)
  }

  if (!bip39.validateMnemonic(mnemonic)) {
    console.log(chalk.red.bold('✗ Invalid Mnemonic Phrase'))
    process.exit(1)
  }

  clear()
  console.log(chalk.bold.blue('CRYPTONYM\n'))

  const seed = bip39.mnemonicToSeed(mnemonic)
  const coin = await prompt.list('Select Coin', [ 'Bitcoin', 'Bitcoin Cash', 'Ether', 'Golem', 'Litecoin', 'Request Token', 'SONM', 'Stellar Lumen', 'Streamr DATAcoin' ])
  const lib = require(`./coins/${coin.replace(/\s+/g, '-').toLowerCase()}`)

  await lib(seed, prompt)
})()
{% endhighlight %}

First, we'll ask the user to enter their `mnemonic phrase`. For our purpose, we use and accept a __12 word phrase__. This is __never__ saved in the application or disc. So, it has to entered for every execution. If the user doesn't have a mnemonic phrase, one will be generated. This has to be saved offline (in a paper) and can be used in the subsequent executions. Once the phrase is verified, the seed is generated from this. The seed is used along with the derivation path to generate all the keys and addresses. We will then provide a list of coins that the user can choose. Currently, the following coins are supported,

* [Bitcoin](https://bitcoin.org/)
* [Bitcoin Cash](https://www.bitcoincash.org/)
* [Ether](https://www.ethereum.org/)
* [Golem](https://golem.network/)
* [Litecoin](https://litecoin.org/)
* [Request Token](https://request.network/)
* [SONM](https://sonm.io/)
* [Stellar Lumen](https://www.stellar.org/)
* [Streamr DATAcoin](https://www.streamr.com/)

There is a utility function for each coin which will be triggered based on the user choice.


Working of HD Wallet
--------------------

With the help of HD wallets, we can create as many keys and address as we want. However, only the bitcoin and its forks (litecoin and bitcoin cash) will let you transfer coins from more than one account with just one transaction. For other coins, you need to use multiple transactions to move money out from different accounts. So, we will generate a new address for each transaction in the case of bitcoin and its forks. For other coins, we will just use a single address.

The utility function for __bitcoin__ is present in `coins/bitcoin.js` and its utility class is in `utils/btc.js`. The utility function looks like this, 

{% highlight js %}
'use strict'
const bitcoin = require('bitcoinjs-lib')
const chalk = require('chalk')
const BTC = require('../utils/btc')

module.exports = async (seed, prompt) => {
  const root = bitcoin.HDNode.fromSeedBuffer(seed)
  const coin = new BTC(root)
  const option = await prompt.list('Menu', [ 'View Balance', 'Generate New Address', 'Show Extended Private Key', 'Exit' ])

  switch (option) {
    case 'View Balance':
      console.log('checking...')
      const res = await coin.balance()
      const balance = res[0] / 100000000

      console.log(`Total Balance ${chalk.green(balance + ' BTC')}`)
      console.log(`Number of Transcations ${chalk.green(res[1])}`)
      break

    case 'Generate New Address':
      console.log('generating...')
      const address = await coin.generate()
      console.log(`Bitcoin Address ${chalk.green(address)}`)
      break

    case 'Show Extended Private Key':
      const key = coin.privates()
      console.log(`Extended Private Key ${chalk.green(key)}`)
      break
  }
}
{% endhighlight %}

From the seed, a `root HD node` is created and is passed over to a new `BTC` class instance. There are three options available under bitcoin,

View Balance
============

This will let you check the balance across all the addresses generated from the seed. The function `balance` from the __BTC__ class instance will give the total balance and the number of transactions made by all the accounts. The function looks like this,

{% highlight js %}
async balance () {
  let address = null
  let balance = 0
  let transcations = 0
  let data = null

  for (let item of [0, 1]) {
    let index = 0

    do {
      address = this.root.derivePath(`m/44’/0’/0’/${item}/${index}`).getAddress()
      data = await this.check(address)

      balance += data.balance
      transcations += data.transcations
      index++
    } while (data.transcations)
  }

  return [ balance, transcations ]
}

async check (address) {
  const res = await axios(`https://blockchain.info/balance?active=${address}`)

  if (address in res.data) {
    return {
      balance: res.data[address]['final_balance'],
      transcations: res.data[address]['n_tx']
    }
  }
}
{% endhighlight %}

To check the balance, we will generate an address and then check if there are any transactions made with that address. If so, we will add the balance of that address and generate the next one. This goes on till we find the address with no transactions. We need to do this for both external and change accounts.

The `purpose` value of the derivation path is __44__ as it's used for [BIP-44 HD Wallet](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki). The `coin_type` value for bitcoin is __0__. We are generating the addresses for the first account, so the value of `account` is __0__. The derivation path therefore starts with `m/44'/0'/0'`. The value for `change` is __0__ for __external__ and __1__ for __change__ addresses. We will then increment the value of `address_index` from __0__ to generate the addresses till we get one with no transactions.

To get the balance and the number of transactions made, an API call is made to [blockchain.info](https://blockchain.info). We are only passing the public address to the internet. None of the private data gets online.

Generate New Address
====================

This will generate an address that you can share with people to receive coins from them. With the implementation of HD wallet, you can generate a new address for every transaction. The function `generate` from the __BTC__ class instance will give the new address. The function look like this,

{% highlight js %}
async generate () {
  let address = null
  let data = null
  let index = 0

  do {
    address = this.root.derivePath(`m/44'/0'/0'/0/${index}`).getAddress()
    data = await this.check(address)
    index++
  } while (data.transcations)

  return address
}
{% endhighlight %}

This works similar to the `View Balance` action. You need to generate an address and check the number of transactions made with it. This continues till you get an address that has no transactions. To share with people, you only use the __external__ address, so the value for `change` is __0__.

Show Extended Private Key
=========================

This application doesn't let you send coins from your accounts outside. For this, you need to export the `extended private key` and import it in a dedicated wallet like [Electrum](https://electrum.org/#home). The function `privates` from the __BTC__ class instance will give the extended private key. It looks like this,

{% highlight js %}
privates () {
  return this.root.derivePath(`m/44'/0'/0'`).toBase58()
}
{% endhighlight %}

As discussed above the derivation path for the __first bitcoin account__ is `m/44'/0'/0'`. It is exported in `Base58` format. This can now be imported into bitcoin wallets.

The forks of __Bitcoin__, like __Litecoin__ and __Bitcoin Cash__, also work in same way. We will generate a new address for each transaction and generate the balance in similar fashion. The only change is in the endpoint that the API calls are made to.


ERC20 Tokens
------------

Ethereum blockchain uses ether as the default token/coin. In addition to this, you can create and use other tokens with the ethereum blockchain. This is done using `ERC20 Smart Contracts` and the such coins are called __ERC20 tokens__. Each of these token has a corresponding contract with a hex address. For example, the contract for __Golem__ is `0xa74476443119A942dE498590Fe1f2454d7D4aC0d`. You can use the same address to store ether and any ERC20 tokens. With HD wallet, you can generate multiple ethereum keys and addresses. The value for `coin_type` is 60 for ethereum. However, unlike bitcoin, you can't transfer from more than one account in one transaction. So, we'll just have a single address for each of the ERC20 tokens.

For each of the token, we have a utility function that gets triggered. The function for __Golem__ is at `coins/golem.js` and looks like this,

{% highlight js %}
'use strict'
const ERC20 = require('../utils/erc20')

module.exports = async (seed, prompt) => {
  const token = new ERC20(seed, '0xa74476443119A942dE498590Fe1f2454d7D4aC0d')
  await token.menu(prompt)
}
{% endhighlight %}

In this case, an object of the `ERC20` class, which is found in `utils/erc20.js`, is created with the __seed__ and __contract hex__. In the case of `ether`, the contract hex is left blank as it's the default token for the ethereum network. Once, the object is created, the `menu` function is called. The `ECR20` class looks like this,

{% highlight js %}
'use strict'
const bitcoin = require('bitcoinjs-lib')
const chalk = require('chalk')
const ethUtil = require('ethereumjs-util')
const open = require('open')

class ERC20 {
  constructor (seed, contract = null) {
    const account = this.hash(contract)
    const root = bitcoin.HDNode.fromSeedBuffer(seed)
    const key = root.derivePath(`m/44’/60’/${account}’/0/0`)
    const pvt = key.keyPair.d.toBuffer()
    const buffer = ethUtil.privateToAddress(pvt)

    this.address = ethUtil.toChecksumAddress(buffer.toString('hex'))
    this.contract = contract
    this.pvt = pvt

    console.log(`Ethereum Address ${chalk.green(this.address)}\n`)
  }

  hash (str) {
    let hash = 0
    if (!str) {
      str = '0x0000000000000000000000000000000000000000'
    }

    for (let char of str) {
      hash = ((hash << 5) - hash) + char.charCodeAt()
      hash = hash & hash
    }

    return hash
  }

  async menu (prompt) {
    const option = await prompt.list('Menu', [ 'View Balance', 'Show Private Key', 'Exit' ])

    switch (option) {
      case 'View Balance':
        if (this.contract) {
          open(`https://etherscan.io/token/${this.contract}?a=${this.address}`)
        } else {
          open(`https://etherscan.io/address/${this.address}`)
        }
        break

      case 'Show Private Key':
        console.log('Private Key ' + chalk.green(ethUtil.addHexPrefix(this.pvt.toString('hex'))))
        break
    }
  }
}

module.exports = ERC20
{% endhighlight %}

When an object of `ERC20` class is created, we will generate the public address for that token. A hash function is applied to the __contract hex__ to obtain the account number. This will ensure that a unique account is used for each token, which will give different addresses. In the case of __ether__, which doesn't have a __contract hex__, hash of `0x0000000000000000000000000000000000000000` is used to determine its account.

From the seed, a root node is created. In the derivation path, the value for `coin_type` is 60 for ethereum network. The `account` value is obtained from the hash value calculated just now. The concept of change address don't really apply here, so we use the __external__ address. So, the value of the `change` is __0__. Since we use only one account, the `address_index` value is set to 0. So the derivation path is `m/44'/60'/${account}'/0/0`. With this derivation path, we can obtain the address and public key for the token. For ethereum network, both address and the private key are in __hex__ format. The public address is displayed now. This can be used to receive tokens.

The `menu` function of the `ERC20` class provides the following two options,

View Balance
============

To view the balance, we use [etherscan.io](https://etherscan.io/). In the case of ether, you only have to pass the address. For other tokens, you need to pass over the address and the contract. This link is then opened up in the browser.

Show Private Key
================

In the `constructor`, we had created derived the path of the account from the seed. From this, we can generate the private key. This is also exported in __hex__ format. This private key can now be imported into dedicated ethereum wallets like [MyEtherWallet](https://www.myetherwallet.com/) or [MetaMask](https://metamask.io/) to send tokens out of this account.


Conclusion
----------

There is a HD wallet npm package for [Stellar Lumen](https://www.stellar.org/). So, I've included it as well into this. I welcome and request all contributions to this project to support more coins and add more functionality. Do check out the repository [here](https://github.com/botleg/cryptonym).
