import { xunfeiSendMsg } from './xunfei.js'

export async function getXunfeiReply(prompt, chatId) {
  console.log('🚀🚀🚀 / prompt', prompt)
  console.log('🚀🚀🚀 / chatId', chatId)
  let reply = await xunfeiSendMsg(prompt, chatId)

  if (typeof chatId != 'undefined' && chatId.startsWith('room_')) {
    reply = `@${chatId.substr(5)}\n ${reply}`
  }
  return `${reply}`
}