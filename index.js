const Telegraf = require('telegraf')
const cheerio = require('cheerio')
const got = require('got')
const fs = require('fs')
const { flag } = require('country-emoji');

let token = '1117097700:AAFuPFJhtcYCk8JgF0JN7IgkHgBohEXQZ5w'
let url = 'https://en.wikipedia.org/wiki/Template:2019%E2%80%9320_coronavirus_pandemic_data'
const bot = new Telegraf(token)

let monitors = []
const bound = 3
let silent = false
let hot = true
let ban = 1

class Monitor {
    constructor(ctx, country = 'Belarus') {
        this.chatId = ctx.message.chat.id
        console.log(`target country - ${country}`)
        if (monitors.map(s => s.target).includes(country)){
            !silent && bot.telegram.sendMessage(this.chatId,`${country} is already being monitored`)
            console.log(`already have ${country}`)
            return
        }
        this.target = country
        let time = this.wait();
        bot.telegram.sendMessage(this.chatId, `establish monitoring of the ${this.target}\nnext request in ${new Date(time).getHours()}:${new Date(time).getMinutes()}`)
    }
    wait() {
        let target = new Date()
        let year = target.getFullYear()
        let month = target.getMonth()
        let day = target.getDate()
        let hours = target.getHours() 
        if (hot)
            target = new Date(year, month, day, hours).setMinutes(target.getMinutes() + 10) - Date.now();
        else
            target = new Date(year, month, day).setHours(hours + 1) - Date.now();
        (!hot || !this.last) && console.log(`next step in ${target}ms`);
        this.timer = setTimeout(() => { this.check() }, target)
        return target
    }
    async check() {
        let data = await this.fetchData();
        (!this.last || data[0] != this.last[0]) && this.update(data)
        this.wait()
    }
    async fetchData() {
        !hot && console.log('fetching...')
        try {
            const $ = await got(url).then(res => cheerio.load(res.body))
            return $(`tr:contains("${this.target}")`).first().text().split('\n').filter(s => s).concat(Date.now())
        }
        catch (e) {
            console.log('I was banned?')
            console.log(e.message)
        }
    }

    async update(data) {
        console.group('updated!')
        console.log(data)

        if (this.last) {
            hot = false
            console.log('disable hot')
            setTimeout(() => { hot = true; console.log('enable hot') }, 1000*3600*12)
        }
        let date = new Date(data[5]);
        date = this.last ? `${date.toDateString()}` : 'last update '

        fs.appendFileSync('./log.txt', data.join('|') + '\n')
        let message = `${flag(data[0])}  ${date}\n😷${data[1]}${insertDiff(data, this.last, 1)}  💀${data[2]}${insertDiff(data, this.last, 2)}  ❤️${data[3]}${insertDiff(data, this.last, 3)}`

        bot.telegram.sendMessage(this.chatId, message, [{ disable_notification: true }])
        this.last = data
        ban = 1
        silent = false

        console.groupEnd()
        function insertDiff(a, b, n) {
            if (!a || !b || a[n] == b[n]) return ''
            let c = a[n] > b[n] ? '+' : ''
            return `(${c}${a[n].replace(',', '') - b[n].replace(',', '')})`
        }
    }
    stop() {
        clearTimeout(this.timer)
    }
}

function checkMonitors(){
    console.log('checking monitors...')
    monitors.forEach(s => {if (s.timer) console.log(`${s.target} has been removed`)})
    monitors = monitors.filter(s => s.timer)
}

bot.start((ctx) => {
    console.log('monitoring request...')
    if (monitors.length < bound)
        monitors.push(new Monitor(ctx))
    else {
        console.log('more then 3 monitors')
        !silent && bot.telegram.sendMessage(ctx.message.chat.id, `denied`)
        ban++
        if (!silent && ban >= bound) {
            console.log('go silent...')
            silent = true
        }
    }
})
bot.launch().then(() => {
    console.log('Bot started listening...')
    setInterval(() => checkMonitors(),1000*3600*5)
})