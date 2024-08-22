import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function saveMessage(chatId, role, content) {
  try {
    console.log(`Attempting to save message: chatId=${chatId}, role=${role}, content=${content}`);
    const response = await axios.post(`${API_URL}/chat_history`, { 
      chat_id: chatId, 
      role, 
      content
    });
    console.log('Save message response:', response.data);
    if (response.data.status !== 'success') {
      console.error('Failed to save message:', response.data);
    }
    return response.data;
  } catch (error) {
    console.error('Error saving message:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getRecentMessages(chatId) {
  try {
    console.log(`Getting recent messages for chatId: ${chatId}`);
    const response = await axios.get(`${API_URL}/chat_history/${chatId}`);
    console.log('Get recent messages response:', response.data);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error getting recent messages:', error.response ? error.response.data : error.message);
    return [];
  }
}

async function saveReminder(chatId, content, remindTime, userName) {
  try {
    console.log(`Saving reminder: chatId=${chatId}, content=${content}, remindTime=${remindTime}, userName=${userName}`);
    const response = await axios.post(`${API_URL}/reminders`, {
      chat_id: chatId,
      content: content,
      remind_time: remindTime.toISOString(),
      user_name: userName
    });
    console.log('Save reminder API response:', response.data);
    if (response.data.status !== 'success') {
      throw new Error(`Failed to save reminder: ${response.data.message}`);
    }
    return response.data;
  } catch (error) {
    console.error('Error saving reminder:', error.response ? error.response.data : error);
    throw error;
  }
}

async function saveAccount(chatId, userName, accountName, balance) {
  try {
    console.log(`Saving account: chatId=${chatId}, userName=${userName}, accountName=${accountName}, balance=${balance}`);
    const response = await axios.post(`${API_URL}/accounts`, {
      chat_id: chatId,
      user_name: userName,
      account_name: accountName,
      balance: balance
    });
    console.log('Save account response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error saving account:', error.response ? error.response.data : error);
    throw error;
  }
}

async function getNetWorth(chatId, userName) {
  try {
    console.log(`Getting net worth for chatId: ${chatId}, userName: ${userName}`);
    const response = await axios.get(`${API_URL}/accounts/net-worth`, { params: { chat_id: chatId, user_name: userName } });
    console.log('Get net worth response:', response.data);
    return response.data.net_worth;
  } catch (error) {
    console.error('Error getting net worth:', error.response ? error.response.data : error);
    throw error;
  }
}

async function getLatestAccountBalances(chatId, userName) {
  try {
    console.log(`Getting latest account balances for chatId: ${chatId}, userName: ${userName}`);
    const response = await axios.get(`${API_URL}/accounts/latest-balances`, { params: { chat_id: chatId, user_name: userName } });
    console.log('Get latest account balances response:', response.data);
    return response.data.balances;
  } catch (error) {
    console.error('Error getting latest account balances:', error.response ? error.response.data : error);
    throw error;
  }
}

export { saveMessage, getRecentMessages, saveReminder, saveAccount, getNetWorth, getLatestAccountBalances };