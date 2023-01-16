const { Telegraf } = require('telegraf');
const axios = require('axios');
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply(`Start`));
bot.help((ctx) => ctx.reply(`help`));

bot.on('text', async(ctx) => { // вывод информации о пользователе
    if (ctx.message.text == "/echo") {
        ctx.reply(`Echo ${ctx.message.from.username} \n 
        сhat id = ${ctx.message.from.id} \n
        from ${ctx.from.first_name}`);
        return
    };

    if (ctx.message.text == "/bill") {
        ctx.reply("создание платежной ссылки....")
        payUrl = await makeBill(ctx.from.first_name);
        ctx.reply(payUrl);
        return
    }

    if (ctx.message.text == "/offer") {
        status = await checkOffer(ctx.from.first_name)
        ctx.reply(status);
        return
    }

});

const generateBillId = async() => { // создание уникального id транзакции
    const resp = await axios.get('https://www.uuidgenerator.net/api/version1');
    return resp.data
}

const makeAndSaveBillId = async(tgUserName) => { // сохранение id транзакции в firebase realtime database
    billid = await generateBillId();
    const response = await axios.post(
        `https://yourProject.firebasedatabase.app/${tgUserName}.json`, { "bill_id": billid }, {
            headers: {
                'content-Type': 'application/json',
                'accept': 'application/json',
            }
        }
    );
    return billid
}

function makeExpireDate() { // функция для создания даты истечения срока счета
    let date_ob = new Date();
    let year = date_ob.getFullYear();
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let date = ("0" + (date_ob.getDate() + 1)).slice(-2);
    return (year + "-" + month + "-" + date + "T12:59:00+03:00")
        //2023-01-13T09:01:00+03:00
}

const makeBill = async(userName) => { // создание транзакции
    date = makeExpireDate();
    billId = await makeAndSaveBillId(userName);
    const response = await axios.put(
        `https://api.qiwi.com/partner/bill/v1/bills/${billId}`,

        {
            'amount': {
                'currency': 'RUB',
                'value': '40.00'
            },
            'comment': 'Толстовка ART structura tg',
            'expirationDateTime': `${date}`,
            'customer': {
                'phone': '89992223212',
                'email': 'email@gmail.com',
                'account': '454678'
            },
        },

        {
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json',
                'Authorization': `Bearer ${process.env.BOT_SECRET_KEY}`
            }
        }
    );

    return response.data.payUrl;
}

const getBillIdFromDb = async(username) => { // получение id последней созданной транзакции пользователя
    const resp = await axios.get(`https://payments-5981b-default-rtdb.europe-west1.firebasedatabase.app/${username}.json`);
    //jsOBJ = JSON.parse(resp.data)
    var data = resp.data
    return data[Object.keys(data)[Object.keys(data).length - 1]].bill_id
}

const checkOffer = async(tgUserName) => { // проверка наличия оплаты
    billId = await getBillIdFromDb(tgUserName)
    const resp = await axios.get(`https://api.qiwi.com/partner/bill/v1/bills/${billId}`, {
        headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${process.env.BOT_SECRET_KEY}`
        }
    });
    return (resp.data.status.value + ' ' + billId)
}


module.exports.handler = async function(event, context) { // Yandex cloud functions handler
    const message = JSON.parse(event.body);
    await bot.handleUpdate(message);
    return {
        statusCode: 200,
        body: '',
    }
};