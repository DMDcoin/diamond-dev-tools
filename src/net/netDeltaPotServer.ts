import { ConfigManager } from "../configManager";
import { ContractManager } from "../contractManager";
import { generateNthAddressFromSeed } from "../utils";
import { toNumber } from "../utils/numberUtils";
import { sleep } from "../utils/time";




async function runDeltaPotServer() {

    console.log("this serves the delta pot with all the balance that is on the transfer address.");
    console.log("this signals also the official start of the DMD V4 Blockchain.");
    
    const web3 = ConfigManager.getWeb3();

    let config = ConfigManager.getConfig();

    // the first 30 accounts are used by this util, we transfer it to account 100
    // so we have plenty of space.
    const keyPair = generateNthAddressFromSeed(config.mnemonic, 100);
    const addedAccount = web3.eth.accounts.wallet.add(keyPair);
    
    //ConfigManager.insertWallets(web3, 101);

    
    const balance = BigInt(await web3.eth.getBalance(keyPair.address));
    //console.log("total wallets: ", web3.eth.accounts.wallet.length);
    
    console.log("current Balance of " + keyPair.address + ": ", balance, " = ", web3.utils.fromWei(balance.toString(10), "ether"), " DMD");

    const gasPrice = await web3.eth.getGasPrice();
    console.log('gas price:', gasPrice);

    console.log("waiting to transfer balance until we reach 25 Nodes.");


    const contractManger = ContractManager.get();

    const staking = await contractManger.getStakingHbbft();
    let lastCheckedEpoch = -1; 
    // send backfuncction
    // web3.eth.sendTransaction({from: keyPair.address, to: "0x1451ee0347795eCE1Be5c9629F2E5cDf07d7531c",value: (balance - 21000n * 1000000000n).toString(10), gas: "21000"});
    
    
    while (true) {


        const currentEpoch = toNumber(await staking.methods.stakingEpoch().call()); 

        if (currentEpoch != lastCheckedEpoch) {

            lastCheckedEpoch = currentEpoch;

            const validators = await contractManger.getValidators();
            console.log(new Date().toUTCString(), " : epoch: ", currentEpoch, " validators: ",validators.length);

            //if (validators.length == 22) {
            if (validators.length == 25) {
                console.log("reached 25 validators, transferring balance to contract.");

                
                const rewardContract = await contractManger.getRewardHbbft();
                const estimatedGas  = await rewardContract.methods.addToDeltaPot().estimateGas({ from: keyPair.address, gasPrice: "1000000000",  value: web3.utils.toWei('123456789012345678901234567890', 'wei')}) + 8831 /** got problem with signing. */;
                const totalDelta = await web3.eth.getBalance(keyPair.address); 
                console.log('estimated gas:', estimatedGas);
                console.log('current delta:', totalDelta);
            
                
            
                const expectedCosts = web3.utils.toBN(estimatedGas).mul(web3.utils.toBN(gasPrice));
                console.log(expectedCosts.toString());
            
                const amountToTransfer = web3.utils.toBN(totalDelta).sub(expectedCosts);
                
                console.log('funding delta pot with:', amountToTransfer.toString(10));
            

                console.log("address:", rewardContract.options.address);

                const txConfig = { from: keyPair.address, to: rewardContract.options.address ,gasPrice: "1000000000",  gas: estimatedGas, value: amountToTransfer.toString(10), data: await rewardContract.methods.addToDeltaPot().encodeABI() };

                console.log("txConfig:", txConfig);


                const signedTx = await addedAccount.signTransaction(txConfig);
                console.log("signed: ", signedTx);

                const fundingTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction!);

                console.log("transaction hash:",  fundingTx.transactionHash);
                return;
            }
        }

        await sleep(5000);
    }

    // const coinsToKeep = BigInt(await web3.utils.toWei("100", "ether"));
    // const coinsToTransfer = balance - coinsToKeep;

    // console.log("coinsToTransfer", coinsToTransfer);
    // let coinsToTransferFormated = coinsToTransfer.toString(16);
    // console.log("coinsToTransferFormated", coinsToTransferFormated);
    // await web3.eth.sendTransaction({from: web3.eth.defaultAccount!, to: keyPair.address, value: "0x" + coinsToTransferFormated, gas: "21000"});

}


runDeltaPotServer();