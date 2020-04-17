const Telegraf = require('telegraf')
const cheerio = require('cheerio')
const got = require('got')
const fs = require('fs')
const { flag } = require('country-emoji');

let token = '1117097700:AAFuPFJhtcYCk8JgF0JN7IgkHgBohEXQZ5w'
let url = 'https://en.wikipedia.org/wiki/Template:2019%E2%80%9320_coronavirus_pandemic_data'
const bot = new Telegraf(token)

class Monitor {
    constructor(ctx, country = 'Belarus') {
        this.target = country
        this.chatId = ctx.message.chat.id
        console.log(`Target country - ${this.target}`)
        this.wait()
    }
    wait() {
        let target = new Date()
        let year = target.getFullYear()
        let month = target.getMonth()
        let day = target.getDate()
        target = new Date(year, month, day).setHours(target.getHours() + 1) - Date.now()
        console.log(`next step in ${target}ms`)
        this.timer = setTimeout(() => { this.check() }, target)
    }
    async check() {
        let data = await this.fetchData()
        data == this.last || this.update(data)

        this.wait()
    }
    async fetchData() {
        console.log('fetching...')
        try {
            const $ = await got(url).then(res => cheerio.load(res.body))
            return $(`tr:contains("${target}")`).first().text().split('\n').filter(s => s).concat(Date.now())
        }
        catch (e) {
            console.log(e.message)
        }
    }
    async update(data) {
        console.log('sending message...')
        data.push(new Date(data.pop()))
        let message = `${flag(data[0])} 😷${data[1]}${this.last ? '(+' + (data[1] - this.last[1]) + ')' : ''} 💀${data[2]} ❤️${data[3]} | updated: ${data[5]}`

        fs.appendFileSync('./log.txt', dara.join('|') + '\n')
        bot.telegram.sendMessage(this.chatId, message, [{ disable_notification: true }])
        this.last = data
    }
    stop() {
        clearTimeout(this.timer)
    }
}

bot.start((ctx) => {
    console.log('Started monitoring...')
    new Monitor(ctx)
})
bot.launch()