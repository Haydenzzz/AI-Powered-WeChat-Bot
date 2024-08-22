import dotenv from 'dotenv'
import { getServe } from './serve.js'
import { saveMessage, getRecentMessages, saveReminder, saveAccount, getNetWorth, getLatestAccountBalances } from './database.js'
import { analyzeIntent, analyzeAccountInfo } from '../xunfei/xunfei.js'

let isBookkeepingMode = {};

async function defaultMessage(msg, bot, ServiceType = 'Xunfei', botName, roomWhiteList, aliasWhiteList) {
  console.log('Received parameters:', { ServiceType, botName, roomWhiteList, aliasWhiteList });
  
  try {
    const contact = msg.talker()
    const content = msg.text()
    const room = msg.room()
    const roomName = await room?.topic()
    const alias = await contact.alias() || await contact.name()
    const isText = msg.type() === bot.Message.Type.Text
    const isRoomInWhitelist = room && Array.isArray(roomWhiteList) && roomWhiteList.includes(roomName)
    const isAliasInWhitelist = Array.isArray(aliasWhiteList) && aliasWhiteList.includes(alias)
    const isBotSelf = botName === alias

    console.log('Message details:', { roomName, alias, isText, isRoomInWhitelist, isAliasInWhitelist, isBotSelf });

    if (isBotSelf || !isText) return

    console.log(`Message received. Room: ${roomName}, Contact: ${alias}`);

    let chatId;
    let response;

    if (room) {
      // 群聊消息
      if (isRoomInWhitelist) {
        chatId = `room_${roomName}`
        console.log(`Whitelisted room message detected: ${chatId}`);
        
        // 检查消息是否@了机器人
        const isMentioned = await msg.mentionSelf()
        if (!isMentioned) {
          console.log('Bot not mentioned in room. Ignoring.');
          return;
        }

        // 提取去除@机器人后的实际问题内容
        const question = await msg.mentionText()
        console.log('User question:', question)
        
        response = await processMessage(question, chatId, alias);
        
        // 在群聊中回复，确保只@一次
        console.log('Sending response to room:', response);
        await room.say(response, contact);
      } else {
        console.log('Message from non-whitelisted room. Ignoring.');
      }
    } else if (isAliasInWhitelist) {
      // 私聊消息
      chatId = `user_${alias}`
      console.log(`Whitelisted user message detected: ${chatId}`);
      console.log('User message:', content)

      response = await processMessage(content, chatId, alias);
    
      // 私聊回复
      console.log('Sending response to user:', response);
      await contact.say(response)
    } else {
      console.log(`Message not processed. From non-whitelisted contact: ${alias}`);
    }
  } catch (e) {
    console.error('Error in defaultMessage:', e)
  }
}

async function processMessage(content, chatId, alias) {
  const recentMessages = await getRecentMessages(chatId);
  await saveMessage(chatId, 'user', content);

  if (isBookkeepingMode[chatId]) {
    return await handleBookkeepingMode(content, chatId, alias);
  } else {
    const intent = await analyzeIntent(content, chatId, recentMessages);
    console.log('Analyzed intent:', JSON.stringify(intent, null, 2));
    
    let response;
    try {
      switch (intent.type) {
        case 'reminder':
          response = await handleReminder(intent, chatId, alias);
          break;
        case 'bookkeeping':
          isBookkeepingMode[chatId] = true;
          response = "好的，让我们开始记账。请输入您的账户信息，格式为'账户名称 金额'。您可以一次输入多个账户，用换行符、分号或顿号分隔。例如：\n支付宝 1000\n信用卡 -500\n或者：支付宝 1000；信用卡 -500\n输入完成后，请回复'确认'结束记账。";
          break;
        case 'asset_query':
          response = await handleAssetQuery(chatId, alias);
          break;
        case 'normal':
          console.log('Normal conversation detected');
          response = intent.reply || intent.content;
          break;
        case 'error':
          console.log('Error in intent detection');
          response = "抱歉，我在处理您的请求时遇到了一些问题。请稍后再试。";
          break;
        default:
          console.log('Unknown intent type, treating as normal conversation');
          response = intent.reply || intent.content || "抱歉，我没有理解您的意图。能请您重新表述一下吗？";
      }
    } catch (error) {
      console.error('Error processing intent:', error);
      response = "抱歉，我在处理您的请求时遇到了问题。能否请您重新表述一下？";
    }

    // 保存完整的意图分析结果，包括 JSON 意图标注
    await saveMessage(chatId, 'assistant', intent.content);
    return response;
  }
}

async function handleReminder(intent, chatId, alias) {
  console.log(`Reminder intent detected. Content: ${intent.details.content}, Time: ${intent.details.time}`);
  try {
    console.log('Attempting to save reminder...');
    let reminderTime = new Date(intent.details.time);
    const now = new Date();
    
    console.log('Original reminder time (UTC):', reminderTime.toISOString());
    console.log('Current time (UTC):', now.toISOString());

    // 计算时间差并生成人性化的描述
    const timeDiff = reminderTime.getTime() - now.getTime();
    let timeDescription;
    if (timeDiff < 0) {
      console.error('Reminder time is in the past');
      timeDescription = '立即';
    } else if (timeDiff < 60 * 60 * 1000) {
      const minutes = Math.round(timeDiff / (60 * 1000));
      timeDescription = `${minutes}分钟后`;
    } else if (timeDiff < 24 * 60 * 60 * 1000) {
      const hours = Math.round(timeDiff / (60 * 60 * 1000));
      timeDescription = `${hours}小时后`;
    } else {
      const days = Math.round(timeDiff / (24 * 60 * 60 * 1000));
      timeDescription = `${days}天后`;
    }
    
    const reminderResponse = await saveReminder(chatId, intent.details.content, reminderTime, alias);
    console.log('Save reminder response:', JSON.stringify(reminderResponse, null, 2));
    
    if (reminderResponse && reminderResponse.status === 'success') {
      const localTimeString = reminderTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const response = `好的，我会在${timeDescription}（${localTimeString}）提醒你${intent.details.content}`;
      console.log(`Reminder set successfully: ${response}`);
      return response;
    } else {
      throw new Error('Failed to save reminder');
    }
  } catch (error) {
    console.error('Failed to save reminder:', error);
    return "抱歉，我在设置提醒时遇到了问题。请稍后再试。";
  }
}

async function handleBookkeepingMode(content, chatId, alias) {
  if (content.includes('确认') || content.includes('完成') || content.includes('结束')) {
    isBookkeepingMode[chatId] = false;
    const netWorth = await getNetWorth(chatId, alias);
    const latestBalances = await getLatestAccountBalances(chatId, alias);
    let balanceDetails = latestBalances.map(account => `${account.account_name}: ${account.balance.toFixed(2)}元`).join('\n');
    return `记账完成。\n当前账户余额：\n${balanceDetails}\n\n总净资产：${netWorth.toFixed(2)}元。`;
  } else {
    const accountEntries = content.split(/[；、\n]/);
    let responseMessages = [];

    for (let entry of accountEntries) {
      entry = entry.trim();
      if (entry) {
        const accountInfo = await analyzeAccountInfo(entry);
        if (accountInfo.type === 'account_info') {
          const balance = accountInfo.isPositiveAsset ? Math.abs(accountInfo.balance) : -Math.abs(accountInfo.balance);
          await saveAccount(chatId, alias, accountInfo.accountName, balance);
          responseMessages.push(`已记录账户 ${accountInfo.accountName}，余额 ${Math.abs(accountInfo.balance)}元。`);
        } else {
          responseMessages.push(`无法解析账户信息：${entry}`);
        }
      }
    }

    if (responseMessages.length > 0) {
      return responseMessages.join('\n') + '\n请继续输入其他账户，或回复"确认"完成记账。';
    } else {
      return "抱歉，我没有理解您的输入。请按照'账户名称 金额'的格式输入，例如'支付宝 1000'或'信用卡 -500'。您可以一次输入多个账户，用换行符、分号或顿号分隔。";
    }
  }
}

async function handleAssetQuery(chatId, alias) {
  const netWorth = await getNetWorth(chatId, alias);
  const latestBalances = await getLatestAccountBalances(chatId, alias);
  let balanceDetails = latestBalances.map(account => `${account.account_name}: ${account.balance.toFixed(2)}元`).join('\n');
  return `您的当前资产情况如下：\n\n${balanceDetails}\n\n总净资产：${netWorth.toFixed(2)}元。`;
}

export { defaultMessage };

// 分片长度
const SINGLE_MESSAGE_MAX_SIZE = 500

/**
 * 发送
 * @param talker 发送哪个  room为群聊类 text为单人
 * @param msg
 * @returns {Promise<void>}
 */
async function trySay(talker, msg) {
  const messages = []
  let message = msg
  while (message.length > SINGLE_MESSAGE_MAX_SIZE) {
    messages.push(message.slice(0, SINGLE_MESSAGE_MAX_SIZE))
    message = message.slice(SINGLE_MESSAGE_MAX_SIZE)
  }
  messages.push(message)
  for (const msg of messages) {
    await talker.say(msg)
  }
}

/**
 * 分组消息
 * @param text
 * @returns {Promise<*>}
 */
async function splitMessage(text) {
  let realText = text
  const item = text.split('- - - - - - - - - - - - - - -')
  if (item.length > 1) {
    realText = item[item.length - 1]
  }
  return realText
}