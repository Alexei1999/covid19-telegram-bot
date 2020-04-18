const Telegraf = require('telegraf')
const cheerio = require('cheerio')
const got = require('got')
const fs = require('fs')
const { flag } = require('country-emoji');
const yaml = require('js-yaml');

let fileContents = fs.readFileSync(__dirname + '/tokens.yaml', 'utf8');
let data = yaml.safeLoad(fileContents);

let token = data.key
let url = 'https://en.wikipedia.org/wiki/Template:2019%E2%80%9320_coronavirus_pandemic_data'
const bot = new Telegraf(token)

let monitors = []
const bound = 3
let silent = false
let hot = true
let ban = 1
let log = 0

class Monitor {
    constructor(ctx, country = data.country) {
        this.chatId = ctx.message.chat.id
        console.log(`target country - ${country}`)
        try{
            if (monitors.map(s => s.target).includes(country)){
                !silent && bot.telegram.sendMessage(this.chatId,`${country} is already being monitored`)
                console.log(`already have ${country}`)
                return
            }
            this.target = country
            fs.writeFileSync('./log.txt','')
            this.writeLog('constructor',[`target-${this.target}`])
            let time = Date.now() + this.wait();
            bot.telegram.sendMessage(this.chatId, `monitoring of ${this.target} established\nfirst request at ${this.getTime(time)}`)
        }
        catch(e){
            console.log('I was banned on telegram?')
            console.log(e)
        }
        
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
        
        let time = Date.now() + target;
        (!hot || !this.last || ++log%6==0) && console.log(`next request at ${this.getTime(time)}`)
        this.timer = setTimeout(() => { this.check() }, target)
        this.writeLog('wait',[`next request-${this.getTime(time)}`])
        return target
    }
    async check() {
        let data = await this.fetchData();
        (!this.last || data[0] != this.last[0] || data[1] != this.last[1] || data[2] != this.last[2] || data[3] != this.last[3]) && this.update(data)
        this.wait()
        this.writeLog('check',[`data-${!!data}`])
    }
    async fetchData() {
        (!hot || ++log%6==0) && console.log('fetching...')
        try {
            const $ = await got(url).then(res => cheerio.load(res.body))
            this.writeLog('fetchData',[`cheerio-${!!$}`])
            return $(`tr:contains("${this.target}")`).first().text().split('\n').filter(s => s).concat(Date.now())
        }
        catch (e) {
            console.log('I was banned on site?')
            console.log(e.message)
        }
    }
    async update(data) {
        console.group('updated!')
        console.log(data)
        
        if (this.last && data[1] != this.last[1]) {
            hot = false
            console.log('disable hot')
            setTimeout(() => { hot = true; console.log('enable hot') }, 1000*3600*12)
        }
        let date = new Date(data[5]);
        date = this.last ? `${date.toDateString()}` : 'last update '
        
        fs.appendFileSync('./history.txt', data.join('|') + '\n')
        let message = `${flag(data[0])}  ${date}\n😷${data[1]}${this.insertDiff(data, this.last, 1)}  💀${data[2]}${this.insertDiff(data, this.last, 2)}  ❤️${data[3]}${this.insertDiff(data, this.last, 3)}`
        try{
            bot.telegram.sendMessage(this.chatId, message, [{ disable_notification: true }])
        }
        catch(e){
            console.log('I was banned on telegram?')
            console.log(e)
        }
        this.last = data
        ban = 1
        silent = false
        this.writeLog('update',[`data-${data[1]}`])
        console.groupEnd()
        
    }
    insertDiff(a, b, n) {
        if (!a || !b || a[n] == b[n]) return ''
        let c = a[n] > b[n] ? '+' : ''
        return `(${c}${a[n].replace(',', '') - b[n].replace(',', '')})`
    }
    getTime(time){
        return `${new Date(time).getHours()}:${new Date(time).getMinutes()}`
    }
    writeLog(name, str, def = true){
        def = def ? `log-${log}|hot-${hot}|ban-${ban}|silent-${silent}|last-${!!this.last && this.last[1]}` : ''
        fs.appendFileSync('./log.txt', `${name+Array(13-name.length).join(' ')} : ${Date.now()}|${def}|${str.join('|')}\n`)
    }
    stop() {
        clearTimeout(this.timer)
    }
}

function checkMonitors(){
    console.log('checking monitors...')
    monitors.forEach(s => {if (s.timer) console.log(`${s.target} has been removed`)})
    monitors = monitors.filter(s => s.timer)
    log = 0;

    let logs = fs.readFileSync('./log.txt').toString().split('\n').length
    if (logs>10000) fs.writeFileSync('./log.txt','')
    fs.appendFileSync('./log.txt', `checkMonitors : ${Date.now()}|removed-${true}|monitors-${monitors.length}|logs-${logs}\n`)
}

bot.start((ctx) => {
    console.log('monitoring request received...')
    if (monitors.length < bound)


        monitors.push(new Monitor(ctx))
    else {
        console.log('more then 3 monitors')
        try{
            !silent && bot.telegram.sendMessage(ctx.message.chat.id, `denied`)
        }
        catch(e){
            console.log('I was banned on telegram?')
            console.log(e)
        }
        ban++
        if (!silent && ban >= bound) {
            console.log('go silent...')
            silent = true
        }
        fs.appendFileSync('./log.txt', `onStart : ${Date.now()}|ban-${ban}|silent-${silent}|monitors-${monitors.length}|\n`)
    }
})
bot.command('logs',(ctx) => {
    let data = fs.readFileSync('./log.txt').toString().split('\n').reverse().filter((el,i)=>i<10&&el.length!=0).reverse()
    data.forEach(s => bot.telegram.sendMessage(ctx.message.chat.id, s.split('|').map(k => k.split('-').join(' - ')).join('\n')))
})
bot.launch().then(() => {
    console.log('Bot started listening...')
    setInterval(() => checkMonitors(),1000*3600*5)
})