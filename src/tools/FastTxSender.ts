

import request from "request";
import { Dictionary } from "underscore";
import Web3 from "web3";
import { Account, SignedTransaction } from "web3-core";
import { TransactionConfig } from "web3-eth";
import { ConfigManager } from "../configManager";
import { awaitTransactions } from "./awaitTransactions";
import axios from "axios";



// a fast tx sender that can work in 3 stages to patch work transactions
// signing and sending are different steps to be able to make "fast send" performance tests.
// sending is done by the direct JSON RPC Interface instead of the slow Web3 Interface.
// 1. signing
// 2. sending
// 3. waiting for receipt
export class FastTxSender {

  rawTransactions: string[] = [];
  transactionHashes: string[] = [];
  transactionSentState: boolean[] = [];

  // holds the latest nonces for each used account.
  nonces: Dictionary<number> = {};

  accounts_is_initialized = false;
  accounts: Dictionary<Account> = {};

  blockBeforeSent: number = Number.NaN;

  rpcJsonHttpEndpoint: string = 'http://localhost:8540';

  public constructor(public web3: Web3) {

    // get rpcJsonHttpEndpoint from web3
    // if (web3.currentProvider && web3.currentProvider['host'] {
    //   this.rpcJsonHttpEndpoint = web3.currentProvider.host;
    // }

    this.rpcJsonHttpEndpoint = ConfigManager.getNetworkConfig().rpc;
  }

  private ensureAccountsIsInitialized() {

    // 
    if (!this.accounts_is_initialized) {

      this.accounts = {};
      for (let i = 0; i < this.web3.eth.accounts.wallet.length; i++) {
        let wallet = this.web3.eth.accounts.wallet[i];
        this.accounts[wallet.address] = wallet;
      }

      this.accounts_is_initialized = true;
    }
  }

  // adds transaction to the pool of transactions being sent.
  // first call will initialize the account pool and might be slow for large wallets.
  /// @returns transaction hash - there is a known issue with the transaction hash being different from the one reported by the network in some cases.
  public async addTransaction(txConfig: TransactionConfig): Promise<string> {

    let signedTransaction = await this.signTransaction(txConfig);
    if (!signedTransaction.transactionHash) {
      throw Error("No transaction hash.");
    }
    // this.transactionHashes.push(signedTransaction.transactionHash!.toLocaleLowerCase());
    this.rawTransactions.push(signedTransaction.rawTransaction!);
    this.transactionSentState.push(false);

    return signedTransaction.transactionHash!;
  }



  private async signTransaction(txConfig: TransactionConfig): Promise<SignedTransaction> {

    if (!txConfig.from) {
      throw Error('txConfig.from is not set');
    }

    this.ensureAccountsIsInitialized();

    if (!this.accounts[txConfig.from]) {

      this.accounts_is_initialized = false;
      // reinitialize accounts
      this.ensureAccountsIsInitialized();

      if (!this.accounts[txConfig.from]) {
        throw Error(`txConfig.from is not in the wallet: ${txConfig.from}`);
      }
    }

    if (typeof txConfig.from === 'number') {
      throw Error('number as from address not supported.');
    }

    let account = this.accounts[txConfig.from];

    let nextNonce = Number.NaN;

    if (txConfig.from in this.nonces) {
      // if we have a nonce stored in nonces, we continue from there.
      nextNonce = this.nonces[txConfig.from] + 1;
    }
    else {
      // if we don't have a nonce, we get it from the network.
      nextNonce = await this.web3.eth.getTransactionCount(txConfig.from);
    }

    this.nonces[txConfig.from] = nextNonce;

    txConfig.nonce = nextNonce;
    let signedTransaction = await account.signTransaction(txConfig);

    if (!signedTransaction.rawTransaction) {
      throw Error("rawTransaction not received.");
    }

    if (!signedTransaction.transactionHash) {
      throw Error("No transaction hash.");
    }

    return signedTransaction;
  }

  public async sendSingleTx(txConfig: TransactionConfig) {

    await this.addTransaction(txConfig);
    let last_index = this.transactionHashes.length - 1;

    //await this.sendTx();

    if (Number.isNaN(this.blockBeforeSent)) {
      this.blockBeforeSent = await this.web3.eth.getBlockNumber();
    }

    this.sendSingleTxRaw(this.rawTransactions[last_index]);
  }

  private async sendSingleTxRaw(raw_tx: string) {

    // let tx_hash = await this.addTransaction(txConfig);
    // await this.sendTx();

    let rpc_cmd =
    {
      method: 'eth_sendRawTransaction',
      params: [raw_tx],
      jsonrpc: "2.0",
      id: 666
    }

    // curl --data '{"method":"eth_sendRawTransaction","params":["0xd46e8dd67c5d32be8d46e8dd67c5d32be8058bb8eb970870f072445675058bb8eb970870f072445675"],"id":1,"jsonrpc":"2.0"}' -H "Content-Type: application/json" -X POST localhost:8545
    var headersOpt = {
      "content-type": "application/json",
    };

    // todo: extend functionaly that it supports others than localhost.
    let sendAddress = this.rpcJsonHttpEndpoint;

    let self = this;
    let resquest = request.post(
      sendAddress, // todo: distribute transactions here to different nodes.
      {
        json: rpc_cmd,
        headers: headersOpt
      },
      function (error, response, body) {
        if (error) {
          //Trying to close the socket (to prevent socket hang up errors)
          //**Doesn't help**
          console.log('got error:', error);
          return;
        }
        if (response) {

          
          // console.log('got reponse:', response.statusCode);
          //console.log('got reponse body:', response.body);

          let txHash = response.body.result;
          self.transactionHashes.push(txHash);
        }
      });

  }

  // sends all stored transactions.
  public async sendTxs() {

    if (this.rawTransactions.length === 0) {
      throw Error("addTransaction must be called and awaited in preparation to sendTxs.");
    }

    if (Number.isNaN(this.blockBeforeSent)) {
      this.blockBeforeSent = await this.web3.eth.getBlockNumber();
    }

    let i = 0;
    for (let raw of this.rawTransactions) {
      if (!this.transactionSentState[i]) {
        this.sendSingleTxRaw(raw);
      }
      i++;
    }

    return i;
  }

  // waits for completion for all added transaction. 
  public async awaitTxs() {

    if (Number.isNaN(this.blockBeforeSent)) {
      throw new Error("sendTxs() must be called before awaitTxs() can be called.");
    }

    console.log("awaiting transactions to be mined: ", this.transactionHashes.length);

    await awaitTransactions(this.web3, this.blockBeforeSent, this.transactionHashes);

    // clean up this FastTxSender instance, so it can be reused.
    this.reset();
  }

  public reset(reset_accounts = false) {
    this.rawTransactions = [];
    this.transactionHashes = [];
    this.transactionSentState = [];
    this.blockBeforeSent = Number.NaN;
    // reset nonces as well, it's not that expensive to get them again.
    this.nonces = {};

    // if no accounts get added, we do not need to reset them.
    // that is usually the case.
    if (reset_accounts) {
      this.accounts = {};
      this.accounts_is_initialized = false
    }
  }
}
