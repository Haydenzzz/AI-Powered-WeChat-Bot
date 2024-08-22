import { Command } from 'commander'
import { WechatyBuilder, ScanStatus, log } from 'wechaty'
import inquirer from 'inquirer'
import qrTerminal from 'qrcode-terminal'
import schedule from 'node-schedule'
import axios from 'axios'
import { isHoliday } from 'chinese-workday'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defaultMessage } from './wechaty/sendMessage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 环境变量已经在 cli.js 中加载，这里不需要再次加载
const env = process.env
const { version, name } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
// 解析白名单
const ROOM_WHITELIST = env.ROOM_WHITELIST ? env.ROOM_WHITELIST.split(',').map(item => item.trim()) : [];
const ALIAS_WHITELIST = env.ALIAS_WHITELIST ? env.ALIAS_WHITELIST.split(',').map(item => item.trim()) : [];
const BOT_NAME = env.BOT_NAME;

console.log('Environment variables:', {
  BOT_NAME,
  ROOM_WHITELIST,
  ALIAS_WHITELIST,
  XUNFEI_API_SECRET: env.XUNFEI_API_SECRET ? '已设置' : '未设置'
});


// 扫码
function onScan(qrcode, status) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    qrTerminal.generate(qrcode, { small: true })
    const qrcodeImageUrl = ['https://api.qrserver.com/v1/create-qr-code/?data=', encodeURIComponent(qrcode)].join('')
    console.log('onScan:', qrcodeImageUrl, ScanStatus[status], status)
  } else {
    log.info('onScan: %s(%s)', ScanStatus[status], status)
  }
}

// 登录
function onLogin(user) {
  console.log(`${user} has logged in`)
  const date = new Date()
  console.log(`Current time:${date}`)
  console.log(`Automatic robot chat mode has been activated`)
  
  // 设置定时任务
  setupScheduledTasks()
}

// 登出
function onLogout(user) {
  console.log(`${user} has logged out`)
}

// 收到好友请求
async function onFriendShip(friendship) {
  const frienddShipRe = /chatgpt|chat/
  if (friendship.type() === 2) {
    if (frienddShipRe.test(friendship.hello())) {
      await friendship.accept()
    }
  }
}

// 消息发送
async function onMessage(msg) {
  await defaultMessage(msg, bot, serviceType, BOT_NAME, ROOM_WHITELIST, ALIAS_WHITELIST)
}

// 初始化机器人
const CHROME_BIN = env.CHROME_BIN ? { endpoint: env.CHROME_BIN } : {}
let serviceType = ''
export const bot = WechatyBuilder.build({
  name: 'WechatEveryDay',
  puppet: 'wechaty-puppet-wechat4u',
  puppetOptions: {
    uos: true,
    ...CHROME_BIN,
  },
})

bot.on('scan', onScan)
bot.on('login', onLogin)
bot.on('logout', onLogout)
bot.on('message', onMessage)
bot.on('friendship', onFriendShip)
bot.on('error', (e) => {
  console.error('❌ bot error handle: ', e)
})

// 启动微信机器人
function botStart() {
  bot
    .start()
    .then(() => console.log('Start to log in wechat...'))
    .catch((e) => console.error('❌ botStart error: ', e))
}

process.on('uncaughtException', (err) => {
  if (err.code === 'ERR_ASSERTION') {
    console.error('❌ uncaughtException 捕获到断言错误: ', err.message)
  } else {
    console.error('❌ uncaughtException 捕获到未处理的异常: ', err)
  }
})

// 控制启动
function handleStart(type) {
  serviceType = type
  console.log('🌸🌸🌸 / type: ', type)
  switch (type) {
    case 'ChatGPT':
      if (env.OPENAI_API_KEY) return botStart()
      console.log('❌ 请先配置.env文件中的 OPENAI_API_KEY')
      break
    case 'Kimi':
      if (env.KIMI_API_KEY) return botStart()
      console.log('❌ 请先配置.env文件中的 KIMI_API_KEY')
      break
    case 'Xunfei':
      if (env.XUNFEI_APP_ID && env.XUNFEI_API_KEY && env.XUNFEI_API_SECRET) {
        return botStart()
      }
      console.log('❌ 请先配置.env文件中的 XUNFEI_APP_ID，XUNFEI_API_KEY，XUNFEI_API_SECRET')
      break
    case 'deepseek-free':
      if (env.DEEPSEEK_FREE_URL && env.DEEPSEEK_FREE_TOKEN && env.DEEPSEEK_FREE_MODEL) {
        return botStart()
      }
      console.log('❌ 请先配置.env文件中的 DEEPSEEK_FREE_URL，DEEPSEEK_FREE_TOKEN，DEEPSEEK_FREE_MODEL')
      break
    default:
      console.log('❌ 服务类型错误, 目前支持： ChatGPT | Kimi | Xunfei | deepseek-free')
  }
}

export const serveList = [
  { name: 'ChatGPT', value: 'ChatGPT' },
  { name: 'Kimi', value: 'Kimi' },
  { name: 'Xunfei', value: 'Xunfei' },
  { name: 'deepseek-free', value: 'deepseek-free' },
]

const questions = [
  {
    type: 'list',
    name: 'serviceType',
    message: '请先选择服务类型',
    choices: serveList,
  },
]

function init() {
  if (env.SERVICE_TYPE) {
    if (serveList.find((item) => item.value === env.SERVICE_TYPE)) {
      handleStart(env.SERVICE_TYPE)
    } else {
      console.log('❌ 请正确配置.env文件中的 SERVICE_TYPE，或者删除该项')
    }
  } else {
    inquirer
      .prompt(questions)
      .then((res) => {
        handleStart(res.serviceType)
      })
      .catch((error) => {
        console.log('❌ inquirer error:', error)
      })
  }
}

// 获取最新文章信息
const getLatest8point1krArticle = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/latest-article');
    console.log('API 响应:', response.data)
    if (response.data && typeof response.data === 'object') {
      return response.data;
    } else {
      console.error('API 返回的数据格式不正确');
      return null;
    }
  } catch (error) {
    console.error('获取文章信息失败:', error);
    console.error('错误详情:', error.response ? error.response.data : '无响应数据');
    return null;
  }
};

// 获取群聊对象
const getChatRoom = async (name) => {
  return await bot.Room.find({ topic: name });
};

// 设置定时任务
function setupScheduledTasks() {
  const scheduleTime = env.SCHEDULE_TIME || '0 8 * * *'; // 默认每天早上8点
  // 创建定时任务
  schedule.scheduleJob(scheduleTime, async function() {
    const today = new Date();
    const isWorkday = !isHoliday(today);

    if (isWorkday) {
      console.log('今天是工作日。正在发送最新文章...');
      await sendLatestArticle();
    } else {
      console.log('今天不是工作日。跳过文章发送。');
    }
  });

  // 每分钟检查一次提醒
  schedule.scheduleJob('* * * * *', async function() {
    console.log('Checking reminders...');
    await checkReminders();
  });
}

async function checkReminders() {
  try {
    const response = await axios.get('http://localhost:5000/api/reminders/check');
    const reminders = response.data;
    console.log(`Found ${reminders.length} reminders to process.`);
    const now = new Date();
    const processedReminders = new Set();

    for (const reminder of reminders) {
      if (processedReminders.has(reminder.id)) {
        console.log(`Reminder ${reminder.id} already processed, skipping.`);
        continue;
      }

      const reminderTime = new Date(reminder.remind_time);
      const timeDiff = (reminderTime - now) / 1000; // 差异秒数

      // 如果提醒时间已经过去，或者在当前分钟内，就触发提醒
      if (timeDiff <= 0 || (timeDiff > 0 && timeDiff <= 60 && reminderTime.getMinutes() === now.getMinutes())) {
        await sendReminder(reminder);
        await axios.post('http://localhost:5000/api/reminders/complete', { id: reminder.id });
        console.log(`Reminder ${reminder.id} triggered at ${now.toLocaleString()} for scheduled time ${reminderTime.toLocaleString()}`);
        processedReminders.add(reminder.id);
      } else {
        console.log(`Reminder ${reminder.id} scheduled for ${reminderTime.toLocaleString()} (in ${Math.floor(timeDiff / 60)} minutes)`);
      }
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}

// 从服务器获取最新文章并发送
async function sendLatestArticle() {
  try {
    const article = await getLatest8point1krArticle();
    
    if (!article) {
      console.log('未获取到文章，取消发送');
      return;
    }

    console.log('获取到的文章:', article);

    // 从环境变量中获取目标用户名列表
    const targetUsers = env.TARGET_USER_NAMES ? env.TARGET_USER_NAMES.split(',').map(name => name.trim()) : [];
    const targetRooms = env.TARGET_ROOM_NAMES ? env.TARGET_ROOM_NAMES.split(',').map(name => name.trim()) : [];

    if (targetUsers.length === 0 && targetRooms.length === 0) {
      console.log('未配置目标用户或群聊，请在 .env 文件中设置 TARGET_USER_NAMES 或 TARGET_ROOM_NAMES');
      return;
    }

    // 组合所有信息成一条消息
    let message = '';
    
    if (article.title) {
      message += `${article.title}\n\n`;
    }
    
    if (article.summary) {
      message += `摘要：${article.summary}\n\n`;
    }
    
    if (article.url) {
      message += `阅读全文：${article.url}\n\n`;
    }
    
    if (article.publish_time) {
      message += `发布时间：${article.publish_time}`;
    }

    // 遍历每个目标用户并发送消息
    for (const userName of targetUsers) {
      const contact = await bot.Contact.find({name: userName});
      
      if (contact) {
        // 发送组合后的消息
        if (message) {
          await contact.say(message);
          console.log(`已发送完整消息给用户：${userName}`);
        } else {
          console.log('没有可发送的内容');
        }
      } else {
        console.log(`未找到用户：${userName}`);
      }
    }

    // 遍历每个目标群聊并发送消息
    for (const roomName of targetRooms) {
      const room = await getChatRoom(roomName);

      if (room) {
        // 发送组合后的消息
        if (message) {
          await room.say(message);
          console.log(`已发送完整消息给群聊：${roomName}`);
        } else {
          console.log('没有可发送的内容');
        }
      } else {
        console.log(`未找到群聊：${roomName}`);
      }
    }
  } catch (error) {
    console.error('获取或发送文章时出错：', error);
    console.error('错误堆栈：', error.stack);
  }
}

async function sendReminder(reminder) {
  const { chat_id, content, user_name } = reminder;
  try {
    if (chat_id.startsWith('room_')) {
      const roomName = chat_id.slice(5);
      const room = await bot.Room.find({ topic: roomName });
      if (room) {
        const contact = await room.member({ name: user_name });
        if (contact) {
          // 移除这里的 @，因为 room.say 已经会处理 @
          await room.say(`提醒：${content}`, contact);
        } else {
          await room.say(`提醒：${content} (发送给 ${user_name})`);
        }
        console.log(`Sent reminder to room: ${roomName}, user: ${user_name}`);
      } else {
        console.log(`Room not found: ${roomName}`);
      }
    } else {
      const contact = await bot.Contact.find({ name: user_name });
      if (contact) {
        await contact.say(`提醒：${content}`);
        console.log(`Sent reminder to user: ${user_name}`);
      } else {
        console.log(`User not found: ${user_name}`);
      }
    }
  } catch (error) {
    console.error('Error sending reminder:', error);
  }
}

const program = new Command(name)
program
  .alias('we')
  .description('🤖一个基于 WeChaty 结合AI服务实现的微信机器人。')
  .version(version, '-v, --version, -V')
  .option('-s, --serve <type>', '跳过交互，直接设置启动的服务类型')
  .action(function () {
    const { serve } = this.opts()
    if (!serve) return init()
    handleStart(serve)
  })
  .command('start')
  .option('-s, --serve <type>', '跳过交互，直接设置启动的服务类型', '')
  .action(() => init())

program.parse()