const { Spot } = require("@binance/connector");
const fs = require("fs");


//币安获得的apikey
const apiKey =
  "";
const apiSecret =
  "";
const client = new Spot(apiKey, apiSecret, {
  proxy: {
    protocol: "http",
    host: "127.0.0.1",
    port: 7890,
  },
});
// 读取本地txt文件内容，里面是address，每行一个地址
fs.readFile("1.txt", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const lines = data.split("\n");
  let index = 0;
  console.log("此次转账的钱包总数是 ===  " + lines.length);
  function outputLinesWithDelay() {
    let time = generateDelayTime();
   // let time = 1000;
    console.log("当前延迟时间是 ===  " + time / 1000 + "秒");
    if (index < lines.length - 1) {
      setTimeout(() => {
        outputLinesWithDelay();
        let coinNumber = generateCoinNumber();
	//  coinNumber = 0.21;
        let num = index + 1;
        console.log(
          "执行第" +
            num +
            "次转账，当前转账地址是: " +
            lines[index] +
            "     转账金额是: " +
            coinNumber
        );
        withdraw(lines[index], coinNumber);
        index++;
      }, time);
    }
  }
  outputLinesWithDelay();
});

//生成随机数（延时用）1000为1秒钟  提币间隔是2500秒-10000秒（随机间隔）
function generateDelayTime() {
  const min = 5000 * 50;
  const max = 10000 * 100;
  const randomNum = (Math.random() * (max - min) + min).toFixed(0);
  return parseFloat(randomNum);
}

//生成随机数（转账用）  转的金额区间  当前提币金额是 0.2-0.3之间，精确到小数点后面3位数
function generateCoinNumber() {
  const min = 0.2;
  const max = 0.3;
  const randomNum = (Math.random() * (max - min) + min).toFixed(3);
  return parseFloat(randomNum);
}

//提币代码
function withdraw(address, coinNumber) {
  client
    .withdraw(
      "SOL", //  你需要提币的币种
      address, // withdraw address
      coinNumber, // amount
      {
        network: "SOL",   //提币的网络
        walletType: 0,
        transactionFeeFlag: true, //gas是币安账户出，还是接收转账的钱包地址出
      }
    )
    .then((response) => client.logger.log(response.data))
    .catch((error) => client.logger.error(error));
}
