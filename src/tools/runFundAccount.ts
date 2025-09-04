import { ConfigManager } from "../configManager";


async function run() {

  const web3 = ConfigManager.getWeb3();
  
  ConfigManager.insertWallets(web3, 1);
  console.log("using address:", web3.eth.defaultAccount);
  await web3.eth.sendTransaction({from: web3.eth.defaultAccount!, to: "0xc67515fE9467c6781AE39dAa1628a75EB869bb02", value: web3.utils.toWei("1", "ether"), gas: 21000 });
  //await web3.eth.sendTransaction({from: "0xaF6719D1762D14e35a1dFb742B1d77D757391237", to: "0xC969dc0b07acE3e99d6C2636e26D80086a90b847", nonce: 1, value: web3.utils.toWei("1", "finney"), gas: 21000 });
}

run();