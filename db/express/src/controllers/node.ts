import {bonus_score_history, stake_history} from "../models/init-models";
import {Op, QueryTypes, Sequelize} from "sequelize";

const listBonusScore = async (req:any, res:any )=>{
    const { address } = req.params;
    const { includeReasons } = req.query;
    
    // Build the query with optional reason join
    const queryOptions: any = {
        attributes: [
            'from_block',
            'to_block',
            'bonus_score'
        ],
        where: Sequelize.where(
            Sequelize.literal(`'0x' || encode(node, 'hex')`),
            Op.eq,
            Sequelize.fn('lower', Sequelize.literal(`'${address}'`))
        ),
        order: [['from_block', 'ASC']]
    };
    
    // Include reasons if requested
    if (includeReasons === 'true') {
        queryOptions.attributes.push(
            [Sequelize.literal(`(
                SELECT reason 
                FROM bonus_score_change_reasons bscr 
                WHERE bscr.node_pool_address = bonus_score_history.node 
                AND bscr.block_number = bonus_score_history.from_block
            )`), 'reason'],
            [Sequelize.literal(`(
                SELECT score_change 
                FROM bonus_score_change_reasons bscr 
                WHERE bscr.node_pool_address = bonus_score_history.node 
                AND bscr.block_number = bonus_score_history.from_block
            )`), 'score_change'],
            [Sequelize.literal(`(
                SELECT epoch 
                FROM bonus_score_change_reasons bscr 
                WHERE bscr.node_pool_address = bonus_score_history.node 
                AND bscr.block_number = bonus_score_history.from_block
            )`), 'epoch']
        );
    }
    
    const result = await bonus_score_history.findAndCountAll(queryOptions);

    res.json({
        data: result?.rows || [],
        count: result?.count ?? 0
    })
}

const listBonusScoreReasons = async (req:any, res:any )=>{
    const { address } = req.params;
    
    try {
        // Use raw query to access bonus_score_change_reasons table
        const results: any = await bonus_score_history.sequelize!.query(`
            SELECT 
                block_number,
                epoch,
                score_change,
                previous_score,
                new_score,
                reason
            FROM bonus_score_change_reasons
            WHERE '0x' || encode(node_pool_address, 'hex') = lower($1)
            ORDER BY block_number ASC
        `, {
            bind: [address],
            type: QueryTypes.SELECT
        });

        res.json({
            data: results || [],
            count: Array.isArray(results) ? results.length : 0
        });
    } catch (error) {
        console.error('Error fetching bonus score reasons:', error);
        res.status(500).json({
            error: 'Failed to fetch bonus score change reasons',
            data: [],
            count: 0
        });
    }
}

const listStakeHistory = async (req:any, res:any )=>{
    const { address } = req.params;
    const result = await stake_history.findAndCountAll({
        attributes: [
            'from_block',
            'to_block',
            'stake_amount'
        ],
        where: Sequelize.where(
            Sequelize.literal(`'0x' || encode(node, 'hex')`),
            Op.eq,
            Sequelize.fn('lower', Sequelize.literal(`'${address}'`))
        ),
        order: [['from_block', 'ASC']]
    });

    res.json({
        data: result?.rows || [],
        count: result?.count ?? 0
    })
}

export default {
    listBonusScore: listBonusScore,
    listStakeHistory: listStakeHistory,
    listBonusScoreReasons: listBonusScoreReasons,
}
