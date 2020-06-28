// const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const { token, chatId } = require('./config');
const jackspotAbi = require('./jackspot-abi.json');
const { getWeb3, isSwitchFinish } = require('./web3switch');
const sleep = require('ko-sleep');
// replace the value below with the Telegram token you receive from @BotFather
// Create a bot that uses 'polling' to fetch new updates
// const bot = new TelegramBot(token, { polling: true });

// * * * * * *
// second minute hour day month dayOfWeek
// const robotSchedules = () => {
//     // update: The settlement robot calls this function daily to update the capital pool and settle the pending refund.
//     schedule.scheduleJob('0 0 0 * * *', async () => {
//         let msg = await getJacksPotInfos();
//         console.log(msg);
//         await bot.sendMessage(chatId, msg);
//     });
// }

// robotSchedules();

let messageModel = `



万维链DApp简报之Jack's Pot
                -- $DATE$ 

      --最新情况--
奖金池:       $PRIZE_POOL$ WAN
总资金池:     $TOTAL_POOL$ WAN
当前人数:     $TOTAL_PLAYER$
号码覆盖:     $TOTAL_TICKETS$

      --上局结果--
中奖号码:     $WIN_NUMBER$
奖金:         $PAID_PRIZE$ WAN
中奖人数:     $WINNERS$

欢迎使用轻钱包参与Jack's Pot无损彩票，赢取大额奖金
https://wanchain.org/getstarted

`

let messageModel2 = `
Hello, everyone! 
It's my honor to introduce the latest status of Wandora Box DApp on Wanchain.

---- Price Predication Product Wandora Box ----
Wandora Box had $WANDORA_AMOUNT$ wan trade in last 24 hours.
( Welcome join us to play in Wan Wallet DApps or in website https://wandora.finnexus.app/ )
-----------------------------------------------`;

const jacksPotSC = "0x76b074d91f546914c6765ef81cbdc6f9c7da5685";

async function getJacksPotInfos() {
    let ret = {};

    while (true) {
        if (isSwitchFinish()) {
            break;
        }
        await sleep(100);
    }
    ret.date = new Date().toISOString().split('T')[0];

    let web3 = getWeb3();
    let sc = new web3.eth.Contract(jackspotAbi, jacksPotSC);


    let funcs = [];
    funcs.push(sc.methods.poolInfo().call());
    funcs.push(sc.getPastEvents('Buy', { fromBlock: 8865321 }));
    funcs.push(sc.getPastEvents('LotteryResult', { fromBlock: 8865321 }));

    const [poolInfo, buyEvents, settleEvents] = await Promise.all(funcs);

    let totalPool = (Number(web3.utils.fromWei(poolInfo.delegatePool)) + Number(web3.utils.fromWei(poolInfo.demandDepositPool)) + Number(web3.utils.fromWei(poolInfo.prizePool))).toFixed(1);
    let pricePool = Number(web3.utils.fromWei(poolInfo.prizePool)).toFixed(1);
    ret.totalPool = totalPool;
    ret.prizePool = pricePool;

    let winCode = 0;
    let winCount = 0;

    winCount = Number(settleEvents[settleEvents.length - 1].returnValues.amounts[0]) > 0 ? settleEvents[settleEvents.length - 1].returnValues.amounts.length : 0;
    winCode = settleEvents[settleEvents.length - 1].returnValues.winnerCode;
    let paid_prize = Number(web3.utils.fromWei(settleEvents[settleEvents.length - 1].returnValues.prizePool)).toFixed(1);
    
    ret.winCode = winCode;
    ret.winCount = winCount;
    ret.paidPrize = paid_prize;


    let playerData = [];
    funcs = [];
    for (let i=0; i<buyEvents.length; i++) {
      funcs.push(sc.methods.getUserCodeList(buyEvents[i].returnValues.user).call());
    }

    let users = await Promise.all(funcs);

    let addresses = [];
    let tickets = [];
    let tmpTickets = [];
    for (let i=0; i<buyEvents.length; i++) {
      let totalStakeAmount = 0;
      for (let m=0; m<users[i].amounts.length; m++) {
        totalStakeAmount += Number(web3.utils.fromWei(users[i].amounts[m]));
      }

      let one = {
        address: buyEvents[i].returnValues.user.toLowerCase(),
        ticketsCount: users[i].codes.length,
        totalStakeAmount,
        key: i
      };

      if (Number(one.ticketsCount) > 0 && Number(one.totalStakeAmount) > 0 && !addresses.includes(one.address)) {
        playerData.push(one);
        addresses.push(one.address);
        for (let m=0; m<users[i].codes.length; m++) {
          if (!tmpTickets.includes(users[i].codes[m])) {
            tmpTickets.push(users[i].codes[m]);
            tickets.push({
              ticket:Number(users[i].codes[m]),
              count:1,
              stake: Number(web3.utils.fromWei(users[i].amounts[m]))
            });
          } else {
            let id = tmpTickets.indexOf(users[i].codes[m]);
            tickets[id].count++;
            tickets[id].stake += Number(web3.utils.fromWei(users[i].amounts[m]));
          }
        }
      }
    }

    ret.tickets = tickets.length;
    ret.players = playerData.length;

    return ret;
}

getJacksPotInfos();

module.exports = {
  getJacksPotInfos
};