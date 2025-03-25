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

client
  .coinInfo()
  .then((response) => {
    const filteredData = response.data.filter((item) => {
      // 在这里编写你的过滤条件，例如：
      return item.coin === "ETH"; // 这是一个示例条件，根据实际情况进行修改
    });
    // 输出过滤后的数据
    // console.log(filteredData[0].networkList);
    let networkList = filteredData[0].networkList;
    for (let i = 0; i < networkList.length; i++) {
      console.log(networkList[i].network);
    }
  })
  .catch((error) => client.logger.error(error));
