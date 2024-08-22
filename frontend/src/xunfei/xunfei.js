import CryptoJS from 'crypto-js';
import WebSocket from 'ws';
const appID = process.env.XUNFEI_APP_ID;
const apiKey = process.env.XUNFEI_API_KEY;
const apiSecret = process.env.XUNFEI_API_SECRET;
const httpUrl = new URL('https://spark-api.xf-yun.com/v4.0/chat');

let modelDomain = '4.0Ultra';

// 认证函数，生成websocket连接的URL
function authenticate() {
  return new Promise((resolve, reject) => {
    let url = 'wss://' + httpUrl.host + httpUrl.pathname;
    let host = 'localhost:8080';
    let date = new Date().toGMTString();
    let algorithm = 'hmac-sha256';
    let headers = 'host date request-line';
    let signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${httpUrl.pathname} HTTP/1.1`;
    let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret || '');
    let signature = CryptoJS.enc.Base64.stringify(signatureSha);
    let authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    let authorization = btoa(authorizationOrigin);
    url = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
    resolve(url);
  });
}

export async function xunfeiSendMsg(inputVal, chatId, systemMessage, recentMessages = []) {
  try {
    console.log(`xunfeiSendMsg called with chatId: ${chatId}`);
    if (!chatId) {
      console.error('Error: chatId is undefined');
      return 'Sorry, there was an error processing your request.';
    }
    
    // 构建聊天历史，包括系统消息
    let chatHistory = [
      systemMessage,
      ...recentMessages
    ];

    // 添加当前用户的输入
    chatHistory.push({ role: 'user', content: inputVal });

    // 确保对话历史长度不超过限制
    while (calculateTokensLength(chatHistory) > 8000) {
      if (chatHistory.length > 2) {
        chatHistory.splice(2, 2); // 移除最老的一对用户-助手对话
      } else {
        break;
      }
    }

    let myUrl = await authenticate();
    let socket = new WebSocket(String(myUrl));
    let total_res = '';
    let isComplete = false;

    let messagePromise = new Promise((resolve, reject) => {
      socket.addEventListener('open', (event) => {
        let params = {
          header: {
            app_id: appID,
            uid: 'fd3f47e4-d',
          },
          parameter: {
            chat: {
              domain: modelDomain,
              temperature: 0.5,
              max_tokens: 8192,
            }
          },
          payload: {
            message: {
              text: chatHistory
            }
          }
        };

        console.log('Sending to Xunfei API:', JSON.stringify(params, null, 2));
        socket.send(JSON.stringify(params));
      });

      socket.addEventListener('message', (event) => {
        let data = JSON.parse(String(event.data));
        console.log('Received data from Xunfei:', data);
        if (data.header.code !== 0) {
          console.log('socket出错了', data.header.code, ':', data.header.message);
          socket.close();
          reject('Error: ' + data.header.message);
        } else if (data.header.code === 0) {
          if (data.payload.choices.text && data.payload.choices.text[0]) {
            total_res += data.payload.choices.text[0].content;
          }
          if (data.header.status === 2) {
            isComplete = true;
            setTimeout(() => {
              socket.close();
            }, 1000);
          }
        }
      });

      socket.addEventListener('close', (event) => {
        console.log('socket 连接关闭');
        if (isComplete) {
          resolve(total_res);
        } else {
          reject('Response was not complete');
        }
      });

      socket.addEventListener('error', (event) => {
        console.log('socket连接错误', event);
        reject('Error: ' + event.message);
      });
    });

    let response = await messagePromise;
    console.log(`Raw response received for chatId ${chatId}:`, response);
    
    return response;
  } catch (error) {
    console.error('Error in xunfeiSendMsg:', error);
    return 'Sorry, there was an error processing your request.';
  }
}

// 计算内容的tokens长度（简单方法，每个字符算一个token）
function calculateTokensLength(chatHistory) {
  return chatHistory.reduce((acc, curr) => acc + (curr.content ? curr.content.length : 0), 0);
}

export async function analyzeIntent(inputVal, chatId, recentMessages) {
  const currentTime = new Date();
  const systemMessage = {
    role: 'system',
    content: `你是智能助手Hayden，是Hayden自研开发的（若需要使用地点信息，默认深圳）。你能够理解用户的各种需求，包括设置提醒、记账、查询资产和普通对话。请按以下格式分析用户的意图：

1. 提醒意图：
   {"intent": "reminder", "details": {"content": "提醒内容", "time": "提醒时间（ISO 8601格式）"}}

2. 记账意图：
   {"intent": "bookkeeping", "details": {"start": true}}

3. 查询资产意图：
   {"intent": "asset_query", "details": {"query": true}}

4. 普通对话：
   {"intent": "normal", "details": {"response": "你的回复内容"}}

请务必在每次回复的开头包含正确格式的JSON意图标注。这是非常重要的。

在分析完意图后，请直接给出你的回复，不要有额外的解释。如果无法确定意图，请将intent设置为"normal"。

当前时间是 ${currentTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}。请基于这个时间计算提醒时间，不要使用固定的日期。例如，如果用户说"3分钟后提醒我"，你应该返回当前时间加3分钟后的时间，格式为ISO 8601。确保返回的时间总是在未来，并且使用中国标准时间（UTC+8）。`
  };

  try {
    console.log(`Analyzing intent for input: ${inputVal}`);
    const response = await xunfeiSendMsg(inputVal, chatId, systemMessage, recentMessages);
    console.log("Raw AI response:", response);

    // 尝试解析整个响应
    try {
      // 移除可能存在的 Markdown 代码块标记和多余的换行符
      const cleanedResponse = response.replace(/```json\n?|```\n?/g, '').trim();
      // 尝试匹配 JSON 部分
      const jsonMatch = cleanedResponse.match(/^\{.*\}/s);
      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        console.log("Extracted JSON string:", jsonString);
        const intentJson = JSON.parse(jsonString);
        const textPart = cleanedResponse.replace(jsonMatch[0], '').trim();

        console.log("Parsed intent JSON:", intentJson);

        if (intentJson && intentJson.intent) {
          // 如果是提醒意图，直接使用 AI 返回的时间（已经是中国时间）
          if (intentJson.intent === 'reminder') {
            const reminderTime = new Date(intentJson.details.time);
            console.log("Reminder time (China time):", reminderTime);
            
            // 确保reminderTime是有效的日期
            if (isNaN(reminderTime.getTime())) {
              console.error('Invalid reminder time:', intentJson.details.time);
              throw new Error('Invalid reminder time');
            }
            
            // 计算时间差并生成人性化的描述
            const timeDiff = reminderTime.getTime() - currentTime.getTime();
            let timeDescription;
            if (timeDiff < 60 * 60 * 1000) {
              const minutes = Math.round(timeDiff / (60 * 1000));
              timeDescription = `${minutes}分钟后`;
            } else if (timeDiff < 24 * 60 * 60 * 1000) {
              const hours = Math.round(timeDiff / (60 * 60 * 1000));
              timeDescription = `${hours}小时后`;
            } else {
              const days = Math.round(timeDiff / (24 * 60 * 60 * 1000));
              timeDescription = `${days}天后`;
            }
            
            // 格式化本地时间字符串
            const localTimeString = reminderTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
            
            const replyMessage = `好的，我会在${timeDescription}（${localTimeString}）提醒你${intentJson.details.content}`;
            
            return {
              type: intentJson.intent,
              details: intentJson.details,
              content: response,
              reply: replyMessage
            };
          }
          return {
            type: intentJson.intent,
            details: intentJson.details,
            content: response,
            reply: textPart || intentJson.details.response || "好的，我已经理解了您的意图。"
          };
        }
      } else {
        console.error("No JSON found in response");
        throw new Error("No JSON found in response");
      }
    } catch (error) {
      console.error("Failed to parse response as JSON:", error);
      // 如果解析失败，尝试提取有用的信息
      const fallbackResponse = extractFallbackResponse(response);
      return {
        type: 'normal',
        details: { response: fallbackResponse },
        content: response,
        reply: fallbackResponse
      };
    }

    // 如果没有匹配到JSON或者JSON解析失败，默认为普通对话
    console.log("No specific intent detected, treating as normal conversation");
    return {
      type: 'normal',
      details: { response: response },
      content: response,
      reply: response
    };
  } catch (error) {
    console.error('Error analyzing intent:', error);
    return { type: 'error', content: error.message, reply: "抱歉，我在处理您的请求时遇到了问题。能否请您重新表述一下？" };
  }
}

function extractFallbackResponse(response) {
  // 尝试提取有用的信息，去除JSON格式
  const cleanedResponse = response.replace(/\{.*?\}/s, '').trim();
  return cleanedResponse || "抱歉，我无法理解您的请求。能否请您重新表述一下？";
}

export async function analyzeAccountInfo(inputVal) {
  try {
    console.log(`Analyzing account info for input: ${inputVal}`);
    // 预处理输入，在中文和数字之间添加空格
    const processedInput = inputVal.replace(/([^\d\s])(\d)/g, '$1 $2').replace(/(\d)([^\d\s])/g, '$1 $2');
    const systemMessage = {
      role: 'system',
      content: `你是一个判断账户为正负资产并提炼关键信息的助手。请提炼用户输入内容，并按以下格式输出：
      {"intent": "account_info", "details": {"accountName": "账户名称", "balance": 金额, "isPositiveAsset": true/false}}
      其中，isPositiveAsset表示是否为正资产（如微信、支付宝、储蓄账户等），false表示负资产（如信用卡债务、白条等）。
      请务必在回复中只包含这个JSON格式的数据，不要包含任何其他文字。确保JSON格式正确，所有属性都正确填写。`
    };

    const response = await xunfeiSendMsg(processedInput, 'account_analysis', systemMessage);
    console.log("Raw account info response:", response);

    // 移除可能存在的 Markdown 代码块标记、多余的换行符和其他非JSON文本
    const cleanedResponse = response.replace(/```json\n?|```\n?/g, '').replace(/^[^{]*|[^}]*$/g, '').trim();
    
    console.log("Cleaned response:", cleanedResponse);

    let accountInfo = JSON.parse(cleanedResponse);
    console.log("Parsed account info:", accountInfo);
    
    if (accountInfo.intent === 'account_info') {
      // 确保所有必要的字段都存在
      if (!accountInfo.details.accountName || accountInfo.details.balance === undefined || accountInfo.details.isPositiveAsset === undefined) {
        throw new Error('缺少必要的账户信息字段');
      }
      
      return {
        type: 'account_info',
        accountName: accountInfo.details.accountName,
        balance: parseFloat(accountInfo.details.balance).toFixed(2),
        isPositiveAsset: accountInfo.details.isPositiveAsset,
      };
    } else {
      throw new Error('无效的账户信息格式');
    }
  } catch (error) {
    console.error('Error analyzing account info:', error);
    return { type: 'error', content: error.message };
  }
}

export default xunfeiSendMsg;