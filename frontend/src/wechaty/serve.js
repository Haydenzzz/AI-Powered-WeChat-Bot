import { getGptReply } from '../openai/index.js'
import { getKimiReply } from '../kimi/index.js'
import { getXunfeiReply } from '../xunfei/index.js'
import { getDeepSeekFreeReply } from '../deepseek-free/index.js'

export function getServe(serviceType) {
  switch (serviceType) {
    case 'ChatGPT':
      return (prompt, chatId) => getGptReply(prompt, chatId)
    case 'Kimi':
      return (prompt, chatId) => getKimiReply(prompt, chatId)
    case 'Xunfei':
      return (prompt, chatId) => getXunfeiReply(prompt, chatId)
    case 'deepseek-free':
      return (prompt, chatId) => getDeepSeekFreeReply(prompt, chatId)
    default:
      return (prompt, chatId) => getGptReply(prompt, chatId)
  }
}