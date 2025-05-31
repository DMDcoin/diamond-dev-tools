import Web3 from "web3";
import { sleep } from "../utils/time";



export async function awaitTransactions(web3: Web3, blockBeforeTxSend: number, transactionHashes: Array<string>, logging: boolean = false): Promise<number> {

  let lastAnalysedBlock = blockBeforeTxSend;
  const totalTxs = transactionHashes.length;
  let txsConfirmed = 0;

  while (transactionHashes.length > 0) {
    await sleep(30);
    // console.log("awaiting confirmation of txs: ", transactions.length);
    let currentBlock = await web3.eth.getBlockNumber();

    for (let blockToAnalyse = lastAnalysedBlock + 1; blockToAnalyse <= currentBlock; blockToAnalyse++) {
      
      const block = await web3.eth.getBlock(blockToAnalyse);

      
      const transactions = block.transactions.sort();
      
      console.log(`transactions in Block#  ${blockToAnalyse} : ${transactions.length}`);

      if (logging) {

        console.log('interested transactions:',transactionHashes);
        console.log('transactions in Block:',transactions);
      }
      // transactions.forEach(x => console.log);

      const txCountBeforeFilter = transactionHashes.length;
      transactionHashes = transactionHashes.filter(x => !transactions.includes(x));
      const txCountAfterFilter = transactionHashes.length;
      const txCountConfirmed = txCountBeforeFilter - txCountAfterFilter;
      txsConfirmed += txCountConfirmed;
      console.log(`block ${blockToAnalyse} proccessed. confirmed txs this block: ${txCountConfirmed}. ${txsConfirmed}/${totalTxs} (${(txsConfirmed * 100 / totalTxs).toPrecision(3)} %)  transactions left: ${transactionHashes.length}`);

      
      if (transactionHashes.length === 0) {
        console.log('all transactions confirmed.');
        break;
      } else {
        console.log(`missing hashes: `, transactionHashes.length);
      }

    }

    lastAnalysedBlock = currentBlock;
  }

  console.log('all transactions confirmed at block:', lastAnalysedBlock);

  return lastAnalysedBlock;
}