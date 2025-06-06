import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { available_event, available_eventId } from './available_event';
import type { bonus_score_history, bonus_score_historyId } from './bonus_score_history';
import type { delegate_staker, delegate_stakerId } from './delegate_staker';
import type { headers, headersId } from './headers';
import type { ordered_withdrawal, ordered_withdrawalId } from './ordered_withdrawal';
import type { posdao_epoch, posdao_epochId } from './posdao_epoch';
import type { posdao_epoch_node, posdao_epoch_nodeId } from './posdao_epoch_node';
import type { stake_delegators, stake_delegatorsId } from './stake_delegators';
import type { stake_history, stake_historyId } from './stake_history';

export interface nodeAttributes {
  pool_address: any;
  mining_address: any;
  mining_public_key: any;
  diamond_name?: string;
  ens_name?: string;
  added_block: number;
  bonus_score?: number;
}

export type nodePk = "pool_address";
export type nodeId = node[nodePk];
export type nodeOptionalAttributes = "diamond_name" | "ens_name" | "bonus_score";
export type nodeCreationAttributes = Optional<nodeAttributes, nodeOptionalAttributes>;

export class node extends Model<nodeAttributes, nodeCreationAttributes> implements nodeAttributes {
  pool_address!: any;
  mining_address!: any;
  mining_public_key!: any;
  diamond_name?: string;
  ens_name?: string;
  added_block!: number;
  bonus_score?: number;

  // node belongsTo headers via added_block
  added_block_header!: headers;
  getAdded_block_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setAdded_block_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createAdded_block_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // node hasMany available_event via node
  available_events!: available_event[];
  getAvailable_events!: Sequelize.HasManyGetAssociationsMixin<available_event>;
  setAvailable_events!: Sequelize.HasManySetAssociationsMixin<available_event, available_eventId>;
  addAvailable_event!: Sequelize.HasManyAddAssociationMixin<available_event, available_eventId>;
  addAvailable_events!: Sequelize.HasManyAddAssociationsMixin<available_event, available_eventId>;
  createAvailable_event!: Sequelize.HasManyCreateAssociationMixin<available_event>;
  removeAvailable_event!: Sequelize.HasManyRemoveAssociationMixin<available_event, available_eventId>;
  removeAvailable_events!: Sequelize.HasManyRemoveAssociationsMixin<available_event, available_eventId>;
  hasAvailable_event!: Sequelize.HasManyHasAssociationMixin<available_event, available_eventId>;
  hasAvailable_events!: Sequelize.HasManyHasAssociationsMixin<available_event, available_eventId>;
  countAvailable_events!: Sequelize.HasManyCountAssociationsMixin;
  // node hasMany bonus_score_history via node
  bonus_score_histories!: bonus_score_history[];
  getBonus_score_histories!: Sequelize.HasManyGetAssociationsMixin<bonus_score_history>;
  setBonus_score_histories!: Sequelize.HasManySetAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  addBonus_score_history!: Sequelize.HasManyAddAssociationMixin<bonus_score_history, bonus_score_historyId>;
  addBonus_score_histories!: Sequelize.HasManyAddAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  createBonus_score_history!: Sequelize.HasManyCreateAssociationMixin<bonus_score_history>;
  removeBonus_score_history!: Sequelize.HasManyRemoveAssociationMixin<bonus_score_history, bonus_score_historyId>;
  removeBonus_score_histories!: Sequelize.HasManyRemoveAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  hasBonus_score_history!: Sequelize.HasManyHasAssociationMixin<bonus_score_history, bonus_score_historyId>;
  hasBonus_score_histories!: Sequelize.HasManyHasAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  countBonus_score_histories!: Sequelize.HasManyCountAssociationsMixin;
  // node belongsToMany delegate_staker via pool_address and delegator
  delegator_delegate_stakers!: delegate_staker[];
  getDelegator_delegate_stakers!: Sequelize.BelongsToManyGetAssociationsMixin<delegate_staker>;
  setDelegator_delegate_stakers!: Sequelize.BelongsToManySetAssociationsMixin<delegate_staker, delegate_stakerId>;
  addDelegator_delegate_staker!: Sequelize.BelongsToManyAddAssociationMixin<delegate_staker, delegate_stakerId>;
  addDelegator_delegate_stakers!: Sequelize.BelongsToManyAddAssociationsMixin<delegate_staker, delegate_stakerId>;
  createDelegator_delegate_staker!: Sequelize.BelongsToManyCreateAssociationMixin<delegate_staker>;
  removeDelegator_delegate_staker!: Sequelize.BelongsToManyRemoveAssociationMixin<delegate_staker, delegate_stakerId>;
  removeDelegator_delegate_stakers!: Sequelize.BelongsToManyRemoveAssociationsMixin<delegate_staker, delegate_stakerId>;
  hasDelegator_delegate_staker!: Sequelize.BelongsToManyHasAssociationMixin<delegate_staker, delegate_stakerId>;
  hasDelegator_delegate_stakers!: Sequelize.BelongsToManyHasAssociationsMixin<delegate_staker, delegate_stakerId>;
  countDelegator_delegate_stakers!: Sequelize.BelongsToManyCountAssociationsMixin;
  // node belongsToMany headers via node and block
  block_headers!: headers[];
  getBlock_headers!: Sequelize.BelongsToManyGetAssociationsMixin<headers>;
  setBlock_headers!: Sequelize.BelongsToManySetAssociationsMixin<headers, headersId>;
  addBlock_header!: Sequelize.BelongsToManyAddAssociationMixin<headers, headersId>;
  addBlock_headers!: Sequelize.BelongsToManyAddAssociationsMixin<headers, headersId>;
  createBlock_header!: Sequelize.BelongsToManyCreateAssociationMixin<headers>;
  removeBlock_header!: Sequelize.BelongsToManyRemoveAssociationMixin<headers, headersId>;
  removeBlock_headers!: Sequelize.BelongsToManyRemoveAssociationsMixin<headers, headersId>;
  hasBlock_header!: Sequelize.BelongsToManyHasAssociationMixin<headers, headersId>;
  hasBlock_headers!: Sequelize.BelongsToManyHasAssociationsMixin<headers, headersId>;
  countBlock_headers!: Sequelize.BelongsToManyCountAssociationsMixin;
  // node belongsToMany headers via node and from_block
  from_block_headers!: headers[];
  getFrom_block_headers!: Sequelize.BelongsToManyGetAssociationsMixin<headers>;
  setFrom_block_headers!: Sequelize.BelongsToManySetAssociationsMixin<headers, headersId>;
  addFrom_block_header!: Sequelize.BelongsToManyAddAssociationMixin<headers, headersId>;
  addFrom_block_headers!: Sequelize.BelongsToManyAddAssociationsMixin<headers, headersId>;
  createFrom_block_header!: Sequelize.BelongsToManyCreateAssociationMixin<headers>;
  removeFrom_block_header!: Sequelize.BelongsToManyRemoveAssociationMixin<headers, headersId>;
  removeFrom_block_headers!: Sequelize.BelongsToManyRemoveAssociationsMixin<headers, headersId>;
  hasFrom_block_header!: Sequelize.BelongsToManyHasAssociationMixin<headers, headersId>;
  hasFrom_block_headers!: Sequelize.BelongsToManyHasAssociationsMixin<headers, headersId>;
  countFrom_block_headers!: Sequelize.BelongsToManyCountAssociationsMixin;
  // node hasMany ordered_withdrawal via from_pool_stakingAddress
  ordered_withdrawals!: ordered_withdrawal[];
  getOrdered_withdrawals!: Sequelize.HasManyGetAssociationsMixin<ordered_withdrawal>;
  setOrdered_withdrawals!: Sequelize.HasManySetAssociationsMixin<ordered_withdrawal, ordered_withdrawalId>;
  addOrdered_withdrawal!: Sequelize.HasManyAddAssociationMixin<ordered_withdrawal, ordered_withdrawalId>;
  addOrdered_withdrawals!: Sequelize.HasManyAddAssociationsMixin<ordered_withdrawal, ordered_withdrawalId>;
  createOrdered_withdrawal!: Sequelize.HasManyCreateAssociationMixin<ordered_withdrawal>;
  removeOrdered_withdrawal!: Sequelize.HasManyRemoveAssociationMixin<ordered_withdrawal, ordered_withdrawalId>;
  removeOrdered_withdrawals!: Sequelize.HasManyRemoveAssociationsMixin<ordered_withdrawal, ordered_withdrawalId>;
  hasOrdered_withdrawal!: Sequelize.HasManyHasAssociationMixin<ordered_withdrawal, ordered_withdrawalId>;
  hasOrdered_withdrawals!: Sequelize.HasManyHasAssociationsMixin<ordered_withdrawal, ordered_withdrawalId>;
  countOrdered_withdrawals!: Sequelize.HasManyCountAssociationsMixin;
  // node belongsToMany posdao_epoch via id_node and id_posdao_epoch
  id_posdao_epoch_posdao_epoch_posdao_epoch_nodes!: posdao_epoch[];
  getId_posdao_epoch_posdao_epoch_posdao_epoch_nodes!: Sequelize.BelongsToManyGetAssociationsMixin<posdao_epoch>;
  setId_posdao_epoch_posdao_epoch_posdao_epoch_nodes!: Sequelize.BelongsToManySetAssociationsMixin<posdao_epoch, posdao_epochId>;
  addId_posdao_epoch_posdao_epoch_posdao_epoch_node!: Sequelize.BelongsToManyAddAssociationMixin<posdao_epoch, posdao_epochId>;
  addId_posdao_epoch_posdao_epoch_posdao_epoch_nodes!: Sequelize.BelongsToManyAddAssociationsMixin<posdao_epoch, posdao_epochId>;
  createId_posdao_epoch_posdao_epoch_posdao_epoch_node!: Sequelize.BelongsToManyCreateAssociationMixin<posdao_epoch>;
  removeId_posdao_epoch_posdao_epoch_posdao_epoch_node!: Sequelize.BelongsToManyRemoveAssociationMixin<posdao_epoch, posdao_epochId>;
  removeId_posdao_epoch_posdao_epoch_posdao_epoch_nodes!: Sequelize.BelongsToManyRemoveAssociationsMixin<posdao_epoch, posdao_epochId>;
  hasId_posdao_epoch_posdao_epoch_posdao_epoch_node!: Sequelize.BelongsToManyHasAssociationMixin<posdao_epoch, posdao_epochId>;
  hasId_posdao_epoch_posdao_epoch_posdao_epoch_nodes!: Sequelize.BelongsToManyHasAssociationsMixin<posdao_epoch, posdao_epochId>;
  countId_posdao_epoch_posdao_epoch_posdao_epoch_nodes!: Sequelize.BelongsToManyCountAssociationsMixin;
  // node hasMany posdao_epoch_node via id_node
  posdao_epoch_nodes!: posdao_epoch_node[];
  getPosdao_epoch_nodes!: Sequelize.HasManyGetAssociationsMixin<posdao_epoch_node>;
  setPosdao_epoch_nodes!: Sequelize.HasManySetAssociationsMixin<posdao_epoch_node, posdao_epoch_nodeId>;
  addPosdao_epoch_node!: Sequelize.HasManyAddAssociationMixin<posdao_epoch_node, posdao_epoch_nodeId>;
  addPosdao_epoch_nodes!: Sequelize.HasManyAddAssociationsMixin<posdao_epoch_node, posdao_epoch_nodeId>;
  createPosdao_epoch_node!: Sequelize.HasManyCreateAssociationMixin<posdao_epoch_node>;
  removePosdao_epoch_node!: Sequelize.HasManyRemoveAssociationMixin<posdao_epoch_node, posdao_epoch_nodeId>;
  removePosdao_epoch_nodes!: Sequelize.HasManyRemoveAssociationsMixin<posdao_epoch_node, posdao_epoch_nodeId>;
  hasPosdao_epoch_node!: Sequelize.HasManyHasAssociationMixin<posdao_epoch_node, posdao_epoch_nodeId>;
  hasPosdao_epoch_nodes!: Sequelize.HasManyHasAssociationsMixin<posdao_epoch_node, posdao_epoch_nodeId>;
  countPosdao_epoch_nodes!: Sequelize.HasManyCountAssociationsMixin;
  // node hasMany stake_delegators via pool_address
  stake_delegators!: stake_delegators[];
  getStake_delegators!: Sequelize.HasManyGetAssociationsMixin<stake_delegators>;
  setStake_delegators!: Sequelize.HasManySetAssociationsMixin<stake_delegators, stake_delegatorsId>;
  addStake_delegator!: Sequelize.HasManyAddAssociationMixin<stake_delegators, stake_delegatorsId>;
  addStake_delegators!: Sequelize.HasManyAddAssociationsMixin<stake_delegators, stake_delegatorsId>;
  createStake_delegator!: Sequelize.HasManyCreateAssociationMixin<stake_delegators>;
  removeStake_delegator!: Sequelize.HasManyRemoveAssociationMixin<stake_delegators, stake_delegatorsId>;
  removeStake_delegators!: Sequelize.HasManyRemoveAssociationsMixin<stake_delegators, stake_delegatorsId>;
  hasStake_delegator!: Sequelize.HasManyHasAssociationMixin<stake_delegators, stake_delegatorsId>;
  hasStake_delegators!: Sequelize.HasManyHasAssociationsMixin<stake_delegators, stake_delegatorsId>;
  countStake_delegators!: Sequelize.HasManyCountAssociationsMixin;
  // node hasMany stake_history via node
  stake_histories!: stake_history[];
  getStake_histories!: Sequelize.HasManyGetAssociationsMixin<stake_history>;
  setStake_histories!: Sequelize.HasManySetAssociationsMixin<stake_history, stake_historyId>;
  addStake_history!: Sequelize.HasManyAddAssociationMixin<stake_history, stake_historyId>;
  addStake_histories!: Sequelize.HasManyAddAssociationsMixin<stake_history, stake_historyId>;
  createStake_history!: Sequelize.HasManyCreateAssociationMixin<stake_history>;
  removeStake_history!: Sequelize.HasManyRemoveAssociationMixin<stake_history, stake_historyId>;
  removeStake_histories!: Sequelize.HasManyRemoveAssociationsMixin<stake_history, stake_historyId>;
  hasStake_history!: Sequelize.HasManyHasAssociationMixin<stake_history, stake_historyId>;
  hasStake_histories!: Sequelize.HasManyHasAssociationsMixin<stake_history, stake_historyId>;
  countStake_histories!: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof node {
    return node.init({
    pool_address: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true
    },
    mining_address: {
      type: DataTypes.BLOB,
      allowNull: false
    },
    mining_public_key: {
      type: DataTypes.BLOB,
      allowNull: false
    },
    diamond_name: {
      type: DataTypes.STRING(512),
      allowNull: true
    },
    ens_name: {
      type: DataTypes.STRING(512),
      allowNull: true
    },
    added_block: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    },
    bonus_score: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'node',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "fki_fk_added_block",
        fields: [
          { name: "added_block" },
        ]
      },
      {
        name: "node_pkey",
        unique: true,
        fields: [
          { name: "pool_address" },
        ]
      },
    ]
  });
  }
}
