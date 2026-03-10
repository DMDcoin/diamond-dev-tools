import Web3 from 'web3';
import { Request, Response } from 'express';

// Contract addresses
const STAKING_ADDRESS = '0x1100000000000000000000000000000000000001';
const CLAIMING_POT_ADDRESS = '0xf3bf614C0EA1D14D998BcDb49Ad1F8f57332Bb42';
const BLOCK_REWARD_ADDRESS = '0x2000000000000000000000000000000000000001';
const DAO_LOWMAJORITY_ADDRESS = '0xDA0DA0DA0da0dA0Da0DA00da0DA0DA00000DeCaF';
const DAO_HIGHMAJORITY_ADDRESS = '0xDA0da0da0Da0Da0Da0DA00DA0da0da0DA0DA0dA0';

// TODO: Replace with actual ABI definitions
const BLOCK_REWARD_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "deltaPot",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "reinsertPot",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

const DAO_HIGHMAJORITY_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "governancePot",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

// Initialize Web3 with RPC endpoint
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const web3 = new Web3(RPC_URL);

/**
 * Returns the maximum total supply of coins
 * Always returns: 4380000
 */
const getMaxCoins = async (req: Request, res: Response) => {
    try {
        const maxCoins = 4380000;
        res.set('Content-Type', 'text/plain');
        res.send(maxCoins.toString());
    } catch (error) {
        console.error('Error in getMaxCoins:', error);
        res.status(500).send('Error retrieving max coins');
    }
};

/**
 * Returns the circulating supply
 * Calculation: maxcoins - delta - reinsert
 */
const getCirculating = async (req: Request, res: Response) => {
    try {
        const maxCoins = 4380000;
        
        // Get BlockReward contract instance
        const blockRewardContract = new web3.eth.Contract(
            BLOCK_REWARD_ABI as any,
            BLOCK_REWARD_ADDRESS as string
        );
        
        // Get pot values
        const deltaPotWei = await blockRewardContract.methods.deltaPot().call();
        const reinsertPotWei = await blockRewardContract.methods.reinsertPot().call();
        
        // Convert from Wei to Ether
        const deltaPot = parseFloat(web3.utils.fromWei(deltaPotWei as string, 'ether'));
        const reinsertPot = parseFloat(web3.utils.fromWei(reinsertPotWei as string, 'ether'));
        
        // Calculate circulating supply
        const circulating = maxCoins - deltaPot - reinsertPot;
        
        res.set('Content-Type', 'text/plain');
        res.send(circulating.toString());
    } catch (error) {
        console.error('Error in getCirculating:', error);
        res.status(500).send('Error retrieving circulating supply');
    }
};

/**
 * Returns the delta pot value
 */
const getDeltaPot = async (req: Request, res: Response) => {
    try {        
        // Get BlockReward contract instance
        const blockRewardContract = new web3.eth.Contract(
            BLOCK_REWARD_ABI as any,
            BLOCK_REWARD_ADDRESS as string
        );
        
        // Get delta pot value
        const deltaPotWei = await blockRewardContract.methods.deltaPot().call();
        const deltaPot = parseFloat(web3.utils.fromWei(deltaPotWei as string, 'ether'));
        
        res.set('Content-Type', 'text/plain');
        res.send(deltaPot.toString());
    } catch (error) {
        console.error('Error in getDeltaPot:', error);
        res.status(500).send('Error retrieving delta pot');
    }
};

/**
 * Returns the reinsert pot value
 */
const getReinsertPot = async (req: Request, res: Response) => {
    try {
        // Get BlockReward contract instance
        const blockRewardContract = new web3.eth.Contract(
            BLOCK_REWARD_ABI as any,
            BLOCK_REWARD_ADDRESS as string
        );
        
        // Get reinsert pot value
        const reinsertPotWei = await blockRewardContract.methods.reinsertPot().call();
        const reinsertPot = parseFloat(web3.utils.fromWei(reinsertPotWei as string, 'ether'));
        
        res.set('Content-Type', 'text/plain');
        res.send(reinsertPot.toString());
    } catch (error) {
        console.error('Error in getReinsertPot:', error);
        res.status(500).send('Error retrieving reinsert pot');
    }
};

/**
 * Returns the claiming pot value
 */
const getClaimingPot = async (req: Request, res: Response) => {
    try {
        const claimingPotWei = await web3.eth.getBalance(CLAIMING_POT_ADDRESS);
        const claimingPot = parseFloat(web3.utils.fromWei(claimingPotWei, 'ether'));
        res.set('Content-Type', 'text/plain');
        res.send(claimingPot.toString());
    } catch (error) {
        console.error('Error in getClaimingPot:', error);
        res.status(500).send('Error retrieving claiming pot');
    }
};

/**
 * Returns the DAO governance pot value
 */
const getDaoPot = async (req: Request, res: Response) => {
    try {
        // Get Dao contract instance
        const highMajorityContract = new web3.eth.Contract(
            DAO_HIGHMAJORITY_ABI as any,
            (DAO_HIGHMAJORITY_ADDRESS as string).toLowerCase()
        );

        const highMajorityWei =  await highMajorityContract.methods.governancePot().call();
        const highMajorityPot = parseFloat(web3.utils.fromWei(highMajorityWei, 'ether'));

        const lowMajorityWei = await web3.eth.getBalance(DAO_LOWMAJORITY_ADDRESS);
        const lowMajorityPot = parseFloat(web3.utils.fromWei(lowMajorityWei, 'ether'));

        const totalDaoPot = highMajorityPot + lowMajorityPot;

        res.set('Content-Type', 'text/plain');
        res.send(totalDaoPot.toString());
    } catch (error) {
        console.error('Error in getDaoPot:', error);
        res.status(500).send('Error retrieving DAO pot');
    }
};

/**
 * Returns the staking pot value
 */
const getStakingPot = async (req: Request, res: Response) => {
    try {
        const stakingPotWei = await web3.eth.getBalance(STAKING_ADDRESS);
        const stakingPot = parseFloat(web3.utils.fromWei(stakingPotWei, 'ether'));

        res.set('Content-Type', 'text/plain');
        res.send(stakingPot.toString());
    } catch (error) {
        console.error('Error in getStakingPot:', error);
        res.status(500).send('Error retrieving staking pot');
    }
};

/**
 * Returns the rewards pot value
 * Calculation: delta + reinsert
 */
const getRewardsPot = async (req: Request, res: Response) => {
    try {
        // Get BlockReward contract instance
        const blockRewardContract = new web3.eth.Contract(
            BLOCK_REWARD_ABI as any,
            BLOCK_REWARD_ADDRESS as string
        );
        
        // Get pot values
        const deltaPotWei = await blockRewardContract.methods.deltaPot().call();
        const reinsertPotWei = await blockRewardContract.methods.reinsertPot().call();
        
        // Convert from Wei to Ether
        const deltaPot = parseFloat(web3.utils.fromWei(deltaPotWei as string, 'ether'));
        const reinsertPot = parseFloat(web3.utils.fromWei(reinsertPotWei as string, 'ether'));

        const rewardsPot = deltaPot + reinsertPot;

        res.set('Content-Type', 'text/plain');
        res.send(rewardsPot.toString());
    } catch (error) {
        console.error('Error in getRewardsPot:', error);
        res.status(500).send('Error retrieving rewards pot');
    }
};

export default {
    getMaxCoins,
    getCirculating,
    getDeltaPot,
    getReinsertPot,
    getClaimingPot,
    getDaoPot,
    getStakingPot,
    getRewardsPot
};
