require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs").promises;

async function readFileLines(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
  } catch (error) {
    console.error(`读取文件 ${filePath} 失败:`, error.message);
    throw error;
  }
}

async function transferAllETH(fromPrivateKey, toAddress, index) {
  const rpcUrl = "https://mainnet.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(fromPrivateKey, provider);

  try {
    const balance = await provider.getBalance(wallet.address);
    console.log(`\n[转账对 ${index + 1}]`);
    console.log("从钱包地址:", wallet.address);
    console.log("转到地址:", toAddress);
    console.log("原始余额:", ethers.formatEther(balance), "ETH");

    if (balance === BigInt(0)) {
      console.log("钱包余额为0，跳过转账");
      return;
    }

    const gasPrice = await provider.getFeeData();
    const gasLimit = 21000;

    const estimatedGasCost = gasPrice.maxFeePerGas * BigInt(gasLimit);
    const gasCostWithBuffer = (estimatedGasCost * BigInt(110)) / BigInt(100);

    const transferAmount = balance - gasCostWithBuffer;

    console.log("预估gas成本:", ethers.formatEther(estimatedGasCost), "ETH");
    console.log(
      "带buffer的gas成本:",
      ethers.formatEther(gasCostWithBuffer),
      "ETH"
    );
    console.log("计划转账金额:", ethers.formatEther(transferAmount), "ETH");

    if (transferAmount <= 0) {
      throw new Error("余额不足支付gas费");
    }

    const tx = {
      to: toAddress,
      value: transferAmount,
      gasLimit: gasLimit,
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
    };

    const transaction = await wallet.sendTransaction(tx);
    console.log("交易已发送，交易哈希:", transaction.hash);

    const receipt = await transaction.wait();
    console.log("交易已确认，区块号:", receipt.blockNumber);
    return true;
  } catch (error) {
    console.error(`转账对 ${index + 1} 失败:`, error.message);
    return false;
  }
}

// 添加一个生成随机延迟的函数
function getRandomDelay() {
  const min = 100; // 最小延迟100秒
  const max = 1000; // 最大延迟1000秒
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000; // 转换为毫秒
}

async function batchTransfer() {
  try {
    const sourcePrivateKeys = await readFileLines("./source.txt");
    const targetAddresses = await readFileLines("./target.txt");

    if (sourcePrivateKeys.length !== targetAddresses.length) {
      throw new Error("源私钥文件和目标地址文件的行数不匹配！");
    }

    console.log(`总共发现 ${sourcePrivateKeys.length} 个转账任务`);

    const results = {
      success: 0,
      failed: 0,
      total: sourcePrivateKeys.length,
    };

    // 创建转账任务数组
    const transferTasks = sourcePrivateKeys.map((privateKey, index) => {
      return async () => {
        try {
          // 执行转账
          const success = await transferAllETH(
            privateKey,
            targetAddresses[index],
            index
          );

          if (success) {
            results.success++;
          } else {
            results.failed++;
          }

          // 如果不是最后一个转账，添加随机延迟
          if (index < sourcePrivateKeys.length - 1) {
            const delay = getRandomDelay();
            const delaySeconds = delay / 1000;
            console.log(`\n等待 ${delaySeconds} 秒后执行下一个转账...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error(`任务 ${index + 1} 执行失败:`, error.message);
          results.failed++;
        }
      };
    });

    // 串行执行所有任务
    for (const task of transferTasks) {
      await task();
    }

    // 打印最终结果
    console.log("\n批量转账完成！");
    console.log(`总任务数: ${results.total}`);
    console.log(`成功: ${results.success}`);
    console.log(`失败: ${results.failed}`);
  } catch (error) {
    console.error("批量转账过程中发生错误:", error.message);
  }
}

// 执行批量转账
batchTransfer()
  .then(() => console.log("批量转账程序执行完毕"))
  .catch((error) => console.error("程序执行失败:", error));
