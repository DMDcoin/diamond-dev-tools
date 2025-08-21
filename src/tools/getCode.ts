import { ConfigManager } from "../configManager";



async function getCode() {

    const web3 = ConfigManager.getWeb3();
    const code = await web3.eth.getCode("0xc4d938Dfb3F2d832b12af9FDD881361Ab8f4Ef81");
    console.log(code);
}



getCode();