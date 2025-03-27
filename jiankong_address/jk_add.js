import { Web3 } from 'web3';
import axios from 'axios';

// 配置
const BSC_RPC = 'https://bsc-dataseed.bnbchain.org/';
const TARGET_ADDRESS = '0x-address'.toLowerCase();
const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=858ae6d9-343f-4505-a625';

// 配置多个 RPC 节点
// 增加更多备用节点
const RPC_ENDPOINTS = [
    'https://bsc-dataseed.bnbchain.org/',
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
    'https://bsc-dataseed2.defibit.io/',
    'https://bsc-dataseed3.defibit.io/',
    'https://bsc-dataseed4.defibit.io/',
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/',
    'https://bsc-dataseed4.binance.org/',
    'https://endpoints.omniatech.io/v1/bsc/mainnet/public'
];

// 修改 initWeb3 函数，添加超时设置
async function initWeb3() {
    for (const rpc of RPC_ENDPOINTS) {
        try {
            const provider = new Web3.providers.HttpProvider(rpc, {
                timeout: 30000, // 30秒超时
                reconnect: {
                    auto: true,
                    delay: 5000, // 5秒后重试
                    maxAttempts: 5,
                    onTimeout: true
                }
            });
            const web3Instance = new Web3(provider);
            await web3Instance.eth.net.isListening();
            console.log(`成功连接到节点: ${rpc}`);
            return web3Instance;
        } catch (error) {
            console.log(`节点 ${rpc} 连接失败: ${error.message}，尝试下一个节点`);
        }
    }
    throw new Error('所有节点都无法连接');
}

// 修改初始化部分
// 添加全局变量
let web3;
let lastBlockChecked;

// 初始化 Web3 实例
try {
    web3 = await initWeb3();
    lastBlockChecked = Number(await web3.eth.getBlockNumber()) - 1;
    console.log(`初始区块高度: ${lastBlockChecked}`);
} catch (err) {
    console.error('无法连接到任何BSC节点:', err);
    process.exit(1);
}

// 在 checkNewBlocks 函数中添加重试机制
async function getBlockWithRetry(blockNum, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await web3.eth.getBlock(blockNum, true);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
            web3 = await initWeb3(); // 重新初始化连接
        }
    }
}

// 在 checkNewBlocks 函数中使用新的 getBlockWithRetry
async function checkNewBlocks() {
    try {
        const latestBlock = Number(await web3.eth.getBlockNumber());
        if (latestBlock > lastBlockChecked) {
            console.log(`检查新块: ${lastBlockChecked + 1} 到 ${latestBlock}`);
            
            for (let blockNum = lastBlockChecked + 1; blockNum <= latestBlock; blockNum++) {
                try {
                    const block = await getBlockWithRetry(blockNum);
                    if (!block || !block.transactions) continue;

                    for (const tx of block.transactions) {
                        const txFrom = tx.from ? tx.from.toLowerCase() : null;
                        const txTo = tx.to ? tx.to.toLowerCase() : null;

                        if (txFrom === TARGET_ADDRESS || txTo === TARGET_ADDRESS) {
                            const txHash = tx.hash;
                            const value = web3.utils.fromWei(tx.value.toString(), 'ether');
                            const action = txFrom === TARGET_ADDRESS ? '卖出' : '买入';
                            
                            // 获取更多交易详情
                            const txReceipt = await web3.eth.getTransactionReceipt(txHash);
                            const timestamp = (await web3.eth.getBlock(blockNum)).timestamp;
                            const date = new Date(timestamp * 1000);
                            
                            // 尝试获取代币信息
                            let tokenInfo = '';
                            if (txTo && txTo !== TARGET_ADDRESS) {
                                try {
                                    const tokenContract = new web3.eth.Contract([
                                        {
                                            "constant": true,
                                            "inputs": [],
                                            "name": "symbol",
                                            "outputs": [{"name": "", "type": "string"}],
                                            "type": "function"
                                        }
                                    ], txTo);
                                    const symbol = await tokenContract.methods.symbol().call();
                                    tokenInfo = `\n代币: ${symbol}\n合约地址: ${txTo}`;
                                } catch (e) {
                                    tokenInfo = '\n代币: Unknown\n合约地址: ' + txTo;
                                }
                            }

                            const gasUsed = txReceipt.gasUsed;
                            const gasPrice = web3.utils.fromWei(tx.gasPrice.toString(), 'gwei');
                            const gasCost = web3.utils.fromWei((BigInt(gasUsed) * BigInt(tx.gasPrice)).toString(), 'ether');

                            const message = `交易监控提醒！
时间: ${date.toLocaleString()}
行为: ${action}${tokenInfo}
数量: ${value} BNB
Gas消耗: ${gasUsed}
Gas价格: ${gasPrice} Gwei
Gas总成本: ${gasCost} BNB
交易哈希: ${txHash}`;

                            console.log(message);
                            await sendWechatMessage(message);
                        }
                    }
                } catch (blockError) {
                    console.error(`处理区块 ${blockNum} 时出错:`, blockError);
                    continue;
                }
            }
            lastBlockChecked = latestBlock;
        }
    } catch (error) {
        const errorMsg = `监控过程发生错误: ${error.message}`;
        console.error(errorMsg);
        await sendWechatMessage(errorMsg);
        await new Promise(resolve => setTimeout(resolve, 60000));
    }
}

// 发送消息到微信群
async function sendWechatMessage(message) {
  const payload = {
    msgtype: 'text',
    text: { content: message }
  };
  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.status === 200) {
      console.log('消息发送成功');
    } else {
      console.log('消息发送失败:', response.data);
    }
  } catch (error) {
    console.error('消息发送失败:', error.message);
  }
}

// 监控交易 (只保留这一个定义)
// 修改 monitorTransactions 函数
async function monitorTransactions() {
    setInterval(checkNewBlocks, 10000);
    await checkNewBlocks();
}

// 启动监控
console.log(`开始监控地址: ${TARGET_ADDRESS}`);
monitorTransactions().catch(error => {
    console.error('监控程序发生致命错误:', error);
    process.exit(1);
});
