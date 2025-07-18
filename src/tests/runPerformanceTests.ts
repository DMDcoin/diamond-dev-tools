import { ConfigManager } from "../configManager";
import { runPerformanceTests } from "./performanceTest";




const web3 = ConfigManager.getWeb3();
runPerformanceTests(web3);

