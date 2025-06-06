import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { available_event, available_eventId } from './available_event';
import type { bonus_score_history, bonus_score_historyId } from './bonus_score_history';
import type { node, nodeId } from './node';
import type { ordered_withdrawal, ordered_withdrawalId } from './ordered_withdrawal';
import type { pending_validator_state_event, pending_validator_state_eventId } from './pending_validator_state_event';
import type { posdao_epoch, posdao_epochCreationAttributes, posdao_epochId } from './posdao_epoch';
import type { stake_history, stake_historyId } from './stake_history';

export interface headersAttributes {
  block_number: number;
  block_hash: string;
  extra_data: string;
  block_time: Date;
  block_duration: number;
  transaction_count: number;
  txs_per_sec: number;
  posdao_hbbft_epoch?: number;
  reinsert_pot?: number;
  delta_pot?: number;
  reward_contract_total?: number;
  unclaimed_rewards?: number;
  governance_pot?: number;
  claiming_pot?: number;
}

export type headersPk = "block_number";
export type headersId = headers[headersPk];
export type headersOptionalAttributes = "posdao_hbbft_epoch" | "reinsert_pot" | "delta_pot" | "reward_contract_total" | "unclaimed_rewards" | "governance_pot" | "claiming_pot";
export type headersCreationAttributes = Optional<headersAttributes, headersOptionalAttributes>;

export class headers extends Model<headersAttributes, headersCreationAttributes> implements headersAttributes {
  block_number!: number;
  block_hash!: string;
  extra_data!: string;
  block_time!: Date;
  block_duration!: number;
  transaction_count!: number;
  txs_per_sec!: number;
  posdao_hbbft_epoch?: number;
  reinsert_pot?: number;
  delta_pot?: number;
  reward_contract_total?: number;
  unclaimed_rewards?: number;
  governance_pot?: number;
  claiming_pot?: number;

  // headers hasMany available_event via block
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
  // headers hasMany bonus_score_history via from_block
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
  // headers hasMany bonus_score_history via to_block
  to_block_bonus_score_histories!: bonus_score_history[];
  getTo_block_bonus_score_histories!: Sequelize.HasManyGetAssociationsMixin<bonus_score_history>;
  setTo_block_bonus_score_histories!: Sequelize.HasManySetAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  addTo_block_bonus_score_history!: Sequelize.HasManyAddAssociationMixin<bonus_score_history, bonus_score_historyId>;
  addTo_block_bonus_score_histories!: Sequelize.HasManyAddAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  createTo_block_bonus_score_history!: Sequelize.HasManyCreateAssociationMixin<bonus_score_history>;
  removeTo_block_bonus_score_history!: Sequelize.HasManyRemoveAssociationMixin<bonus_score_history, bonus_score_historyId>;
  removeTo_block_bonus_score_histories!: Sequelize.HasManyRemoveAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  hasTo_block_bonus_score_history!: Sequelize.HasManyHasAssociationMixin<bonus_score_history, bonus_score_historyId>;
  hasTo_block_bonus_score_histories!: Sequelize.HasManyHasAssociationsMixin<bonus_score_history, bonus_score_historyId>;
  countTo_block_bonus_score_histories!: Sequelize.HasManyCountAssociationsMixin;
  // headers belongsToMany node via block and node
  node_nodes!: node[];
  getNode_nodes!: Sequelize.BelongsToManyGetAssociationsMixin<node>;
  setNode_nodes!: Sequelize.BelongsToManySetAssociationsMixin<node, nodeId>;
  addNode_node!: Sequelize.BelongsToManyAddAssociationMixin<node, nodeId>;
  addNode_nodes!: Sequelize.BelongsToManyAddAssociationsMixin<node, nodeId>;
  createNode_node!: Sequelize.BelongsToManyCreateAssociationMixin<node>;
  removeNode_node!: Sequelize.BelongsToManyRemoveAssociationMixin<node, nodeId>;
  removeNode_nodes!: Sequelize.BelongsToManyRemoveAssociationsMixin<node, nodeId>;
  hasNode_node!: Sequelize.BelongsToManyHasAssociationMixin<node, nodeId>;
  hasNode_nodes!: Sequelize.BelongsToManyHasAssociationsMixin<node, nodeId>;
  countNode_nodes!: Sequelize.BelongsToManyCountAssociationsMixin;
  // headers belongsToMany node via from_block and node
  node_node_bonus_score_histories!: node[];
  getNode_node_bonus_score_histories!: Sequelize.BelongsToManyGetAssociationsMixin<node>;
  setNode_node_bonus_score_histories!: Sequelize.BelongsToManySetAssociationsMixin<node, nodeId>;
  addNode_node_bonus_score_history!: Sequelize.BelongsToManyAddAssociationMixin<node, nodeId>;
  addNode_node_bonus_score_histories!: Sequelize.BelongsToManyAddAssociationsMixin<node, nodeId>;
  createNode_node_bonus_score_history!: Sequelize.BelongsToManyCreateAssociationMixin<node>;
  removeNode_node_bonus_score_history!: Sequelize.BelongsToManyRemoveAssociationMixin<node, nodeId>;
  removeNode_node_bonus_score_histories!: Sequelize.BelongsToManyRemoveAssociationsMixin<node, nodeId>;
  hasNode_node_bonus_score_history!: Sequelize.BelongsToManyHasAssociationMixin<node, nodeId>;
  hasNode_node_bonus_score_histories!: Sequelize.BelongsToManyHasAssociationsMixin<node, nodeId>;
  countNode_node_bonus_score_histories!: Sequelize.BelongsToManyCountAssociationsMixin;
  // headers hasMany node via added_block
  nodes!: node[];
  getNodes!: Sequelize.HasManyGetAssociationsMixin<node>;
  setNodes!: Sequelize.HasManySetAssociationsMixin<node, nodeId>;
  addNode!: Sequelize.HasManyAddAssociationMixin<node, nodeId>;
  addNodes!: Sequelize.HasManyAddAssociationsMixin<node, nodeId>;
  createNode!: Sequelize.HasManyCreateAssociationMixin<node>;
  removeNode!: Sequelize.HasManyRemoveAssociationMixin<node, nodeId>;
  removeNodes!: Sequelize.HasManyRemoveAssociationsMixin<node, nodeId>;
  hasNode!: Sequelize.HasManyHasAssociationMixin<node, nodeId>;
  hasNodes!: Sequelize.HasManyHasAssociationsMixin<node, nodeId>;
  countNodes!: Sequelize.HasManyCountAssociationsMixin;
  // headers hasMany ordered_withdrawal via claimed_on_block
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
  // headers hasMany pending_validator_state_event via on_enter_block_number
  pending_validator_state_events!: pending_validator_state_event[];
  getPending_validator_state_events!: Sequelize.HasManyGetAssociationsMixin<pending_validator_state_event>;
  setPending_validator_state_events!: Sequelize.HasManySetAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  addPending_validator_state_event!: Sequelize.HasManyAddAssociationMixin<pending_validator_state_event, pending_validator_state_eventId>;
  addPending_validator_state_events!: Sequelize.HasManyAddAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  createPending_validator_state_event!: Sequelize.HasManyCreateAssociationMixin<pending_validator_state_event>;
  removePending_validator_state_event!: Sequelize.HasManyRemoveAssociationMixin<pending_validator_state_event, pending_validator_state_eventId>;
  removePending_validator_state_events!: Sequelize.HasManyRemoveAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  hasPending_validator_state_event!: Sequelize.HasManyHasAssociationMixin<pending_validator_state_event, pending_validator_state_eventId>;
  hasPending_validator_state_events!: Sequelize.HasManyHasAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  countPending_validator_state_events!: Sequelize.HasManyCountAssociationsMixin;
  // headers hasMany pending_validator_state_event via on_exit_block_number
  on_exit_block_number_pending_validator_state_events!: pending_validator_state_event[];
  getOn_exit_block_number_pending_validator_state_events!: Sequelize.HasManyGetAssociationsMixin<pending_validator_state_event>;
  setOn_exit_block_number_pending_validator_state_events!: Sequelize.HasManySetAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  addOn_exit_block_number_pending_validator_state_event!: Sequelize.HasManyAddAssociationMixin<pending_validator_state_event, pending_validator_state_eventId>;
  addOn_exit_block_number_pending_validator_state_events!: Sequelize.HasManyAddAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  createOn_exit_block_number_pending_validator_state_event!: Sequelize.HasManyCreateAssociationMixin<pending_validator_state_event>;
  removeOn_exit_block_number_pending_validator_state_event!: Sequelize.HasManyRemoveAssociationMixin<pending_validator_state_event, pending_validator_state_eventId>;
  removeOn_exit_block_number_pending_validator_state_events!: Sequelize.HasManyRemoveAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  hasOn_exit_block_number_pending_validator_state_event!: Sequelize.HasManyHasAssociationMixin<pending_validator_state_event, pending_validator_state_eventId>;
  hasOn_exit_block_number_pending_validator_state_events!: Sequelize.HasManyHasAssociationsMixin<pending_validator_state_event, pending_validator_state_eventId>;
  countOn_exit_block_number_pending_validator_state_events!: Sequelize.HasManyCountAssociationsMixin;
  // headers hasOne posdao_epoch via block_end
  posdao_epoch!: posdao_epoch;
  getPosdao_epoch!: Sequelize.HasOneGetAssociationMixin<posdao_epoch>;
  setPosdao_epoch!: Sequelize.HasOneSetAssociationMixin<posdao_epoch, posdao_epochId>;
  createPosdao_epoch!: Sequelize.HasOneCreateAssociationMixin<posdao_epoch>;
  // headers hasOne posdao_epoch via block_start
  block_start_posdao_epoch!: posdao_epoch;
  getBlock_start_posdao_epoch!: Sequelize.HasOneGetAssociationMixin<posdao_epoch>;
  setBlock_start_posdao_epoch!: Sequelize.HasOneSetAssociationMixin<posdao_epoch, posdao_epochId>;
  createBlock_start_posdao_epoch!: Sequelize.HasOneCreateAssociationMixin<posdao_epoch>;
  // headers hasMany stake_history via from_block
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
  // headers hasMany stake_history via to_block
  to_block_stake_histories!: stake_history[];
  getTo_block_stake_histories!: Sequelize.HasManyGetAssociationsMixin<stake_history>;
  setTo_block_stake_histories!: Sequelize.HasManySetAssociationsMixin<stake_history, stake_historyId>;
  addTo_block_stake_history!: Sequelize.HasManyAddAssociationMixin<stake_history, stake_historyId>;
  addTo_block_stake_histories!: Sequelize.HasManyAddAssociationsMixin<stake_history, stake_historyId>;
  createTo_block_stake_history!: Sequelize.HasManyCreateAssociationMixin<stake_history>;
  removeTo_block_stake_history!: Sequelize.HasManyRemoveAssociationMixin<stake_history, stake_historyId>;
  removeTo_block_stake_histories!: Sequelize.HasManyRemoveAssociationsMixin<stake_history, stake_historyId>;
  hasTo_block_stake_history!: Sequelize.HasManyHasAssociationMixin<stake_history, stake_historyId>;
  hasTo_block_stake_histories!: Sequelize.HasManyHasAssociationsMixin<stake_history, stake_historyId>;
  countTo_block_stake_histories!: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof headers {
    return headers.init({
    block_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    block_hash: {
      type: DataTypes.CHAR(64),
      allowNull: false
    },
    extra_data: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    block_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    block_duration: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    transaction_count: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    txs_per_sec: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    posdao_hbbft_epoch: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    reinsert_pot: {
      type: DataTypes.DECIMAL,
      allowNull: true
    },
    delta_pot: {
      type: DataTypes.DECIMAL,
      allowNull: true
    },
    reward_contract_total: {
      type: DataTypes.DECIMAL,
      allowNull: true
    },
    unclaimed_rewards: {
      type: DataTypes.DECIMAL,
      allowNull: true
    },
    governance_pot: {
      type: DataTypes.DECIMAL,
      allowNull: true
    },
    claiming_pot: {
      type: DataTypes.DECIMAL,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'headers',
    schema: 'public',
    timestamps: false
  });
  }
}
