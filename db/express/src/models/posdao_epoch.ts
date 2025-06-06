import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { delegate_reward, delegate_rewardId } from './delegate_reward';
import type { delegate_staker, delegate_stakerId } from './delegate_staker';
import type { headers, headersId } from './headers';
import type { node, nodeId } from './node';
import type { ordered_withdrawal, ordered_withdrawalId } from './ordered_withdrawal';
import type { posdao_epoch_node, posdao_epoch_nodeId } from './posdao_epoch_node';

export interface posdao_epochAttributes {
  id: number;
  block_start: number;
  block_end?: number;
}

export type posdao_epochPk = "id";
export type posdao_epochId = posdao_epoch[posdao_epochPk];
export type posdao_epochOptionalAttributes = "block_end";
export type posdao_epochCreationAttributes = Optional<posdao_epochAttributes, posdao_epochOptionalAttributes>;

export class posdao_epoch extends Model<posdao_epochAttributes, posdao_epochCreationAttributes> implements posdao_epochAttributes {
  id!: number;
  block_start!: number;
  block_end?: number;

  // posdao_epoch belongsTo headers via block_end
  block_end_header!: headers;
  getBlock_end_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setBlock_end_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createBlock_end_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // posdao_epoch belongsTo headers via block_start
  block_start_header!: headers;
  getBlock_start_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setBlock_start_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createBlock_start_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // posdao_epoch hasMany delegate_reward via id_posdao_epoch
  delegate_rewards!: delegate_reward[];
  getDelegate_rewards!: Sequelize.HasManyGetAssociationsMixin<delegate_reward>;
  setDelegate_rewards!: Sequelize.HasManySetAssociationsMixin<delegate_reward, delegate_rewardId>;
  addDelegate_reward!: Sequelize.HasManyAddAssociationMixin<delegate_reward, delegate_rewardId>;
  addDelegate_rewards!: Sequelize.HasManyAddAssociationsMixin<delegate_reward, delegate_rewardId>;
  createDelegate_reward!: Sequelize.HasManyCreateAssociationMixin<delegate_reward>;
  removeDelegate_reward!: Sequelize.HasManyRemoveAssociationMixin<delegate_reward, delegate_rewardId>;
  removeDelegate_rewards!: Sequelize.HasManyRemoveAssociationsMixin<delegate_reward, delegate_rewardId>;
  hasDelegate_reward!: Sequelize.HasManyHasAssociationMixin<delegate_reward, delegate_rewardId>;
  hasDelegate_rewards!: Sequelize.HasManyHasAssociationsMixin<delegate_reward, delegate_rewardId>;
  countDelegate_rewards!: Sequelize.HasManyCountAssociationsMixin;
  // posdao_epoch belongsToMany delegate_staker via id_posdao_epoch and id_delegator
  id_delegator_delegate_stakers!: delegate_staker[];
  getId_delegator_delegate_stakers!: Sequelize.BelongsToManyGetAssociationsMixin<delegate_staker>;
  setId_delegator_delegate_stakers!: Sequelize.BelongsToManySetAssociationsMixin<delegate_staker, delegate_stakerId>;
  addId_delegator_delegate_staker!: Sequelize.BelongsToManyAddAssociationMixin<delegate_staker, delegate_stakerId>;
  addId_delegator_delegate_stakers!: Sequelize.BelongsToManyAddAssociationsMixin<delegate_staker, delegate_stakerId>;
  createId_delegator_delegate_staker!: Sequelize.BelongsToManyCreateAssociationMixin<delegate_staker>;
  removeId_delegator_delegate_staker!: Sequelize.BelongsToManyRemoveAssociationMixin<delegate_staker, delegate_stakerId>;
  removeId_delegator_delegate_stakers!: Sequelize.BelongsToManyRemoveAssociationsMixin<delegate_staker, delegate_stakerId>;
  hasId_delegator_delegate_staker!: Sequelize.BelongsToManyHasAssociationMixin<delegate_staker, delegate_stakerId>;
  hasId_delegator_delegate_stakers!: Sequelize.BelongsToManyHasAssociationsMixin<delegate_staker, delegate_stakerId>;
  countId_delegator_delegate_stakers!: Sequelize.BelongsToManyCountAssociationsMixin;
  // posdao_epoch belongsToMany node via id_posdao_epoch and id_node
  id_node_nodes!: node[];
  getId_node_nodes!: Sequelize.BelongsToManyGetAssociationsMixin<node>;
  setId_node_nodes!: Sequelize.BelongsToManySetAssociationsMixin<node, nodeId>;
  addId_node_node!: Sequelize.BelongsToManyAddAssociationMixin<node, nodeId>;
  addId_node_nodes!: Sequelize.BelongsToManyAddAssociationsMixin<node, nodeId>;
  createId_node_node!: Sequelize.BelongsToManyCreateAssociationMixin<node>;
  removeId_node_node!: Sequelize.BelongsToManyRemoveAssociationMixin<node, nodeId>;
  removeId_node_nodes!: Sequelize.BelongsToManyRemoveAssociationsMixin<node, nodeId>;
  hasId_node_node!: Sequelize.BelongsToManyHasAssociationMixin<node, nodeId>;
  hasId_node_nodes!: Sequelize.BelongsToManyHasAssociationsMixin<node, nodeId>;
  countId_node_nodes!: Sequelize.BelongsToManyCountAssociationsMixin;
  // posdao_epoch hasMany ordered_withdrawal via staking_epoch
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
  // posdao_epoch hasMany posdao_epoch_node via id_posdao_epoch
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

  static initModel(sequelize: Sequelize.Sequelize): typeof posdao_epoch {
    return posdao_epoch.init({
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    block_start: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'headers',
        key: 'block_number'
      },
      unique: "uc_block_start"
    },
    block_end: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'headers',
        key: 'block_number'
      },
      unique: "uc_block_end"
    }
  }, {
    sequelize,
    tableName: 'posdao_epoch',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "fki_fk_block_end",
        fields: [
          { name: "block_end" },
        ]
      },
      {
        name: "fki_fk_block_start",
        fields: [
          { name: "block_start" },
        ]
      },
      {
        name: "pk_posdao_epoch_id",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "uc_block_end",
        unique: true,
        fields: [
          { name: "block_end" },
        ]
      },
      {
        name: "uc_block_start",
        unique: true,
        fields: [
          { name: "block_start" },
        ]
      },
    ]
  });
  }
}
