import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { delegate_reward, delegate_rewardId } from './delegate_reward';
import type { node, nodeId } from './node';
import type { posdao_epoch, posdao_epochId } from './posdao_epoch';
import type { stake_delegators, stake_delegatorsId } from './stake_delegators';

export interface delegate_stakerAttributes {
  id: any;
}

export type delegate_stakerPk = "id";
export type delegate_stakerId = delegate_staker[delegate_stakerPk];
export type delegate_stakerCreationAttributes = delegate_stakerAttributes;

export class delegate_staker extends Model<delegate_stakerAttributes, delegate_stakerCreationAttributes> implements delegate_stakerAttributes {
  id!: any;

  // delegate_staker hasMany delegate_reward via id_delegator
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
  // delegate_staker belongsToMany node via delegator and pool_address
  pool_address_nodes!: node[];
  getPool_address_nodes!: Sequelize.BelongsToManyGetAssociationsMixin<node>;
  setPool_address_nodes!: Sequelize.BelongsToManySetAssociationsMixin<node, nodeId>;
  addPool_address_node!: Sequelize.BelongsToManyAddAssociationMixin<node, nodeId>;
  addPool_address_nodes!: Sequelize.BelongsToManyAddAssociationsMixin<node, nodeId>;
  createPool_address_node!: Sequelize.BelongsToManyCreateAssociationMixin<node>;
  removePool_address_node!: Sequelize.BelongsToManyRemoveAssociationMixin<node, nodeId>;
  removePool_address_nodes!: Sequelize.BelongsToManyRemoveAssociationsMixin<node, nodeId>;
  hasPool_address_node!: Sequelize.BelongsToManyHasAssociationMixin<node, nodeId>;
  hasPool_address_nodes!: Sequelize.BelongsToManyHasAssociationsMixin<node, nodeId>;
  countPool_address_nodes!: Sequelize.BelongsToManyCountAssociationsMixin;
  // delegate_staker belongsToMany posdao_epoch via id_delegator and id_posdao_epoch
  id_posdao_epoch_posdao_epoches!: posdao_epoch[];
  getId_posdao_epoch_posdao_epoches!: Sequelize.BelongsToManyGetAssociationsMixin<posdao_epoch>;
  setId_posdao_epoch_posdao_epoches!: Sequelize.BelongsToManySetAssociationsMixin<posdao_epoch, posdao_epochId>;
  addId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToManyAddAssociationMixin<posdao_epoch, posdao_epochId>;
  addId_posdao_epoch_posdao_epoches!: Sequelize.BelongsToManyAddAssociationsMixin<posdao_epoch, posdao_epochId>;
  createId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToManyCreateAssociationMixin<posdao_epoch>;
  removeId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToManyRemoveAssociationMixin<posdao_epoch, posdao_epochId>;
  removeId_posdao_epoch_posdao_epoches!: Sequelize.BelongsToManyRemoveAssociationsMixin<posdao_epoch, posdao_epochId>;
  hasId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToManyHasAssociationMixin<posdao_epoch, posdao_epochId>;
  hasId_posdao_epoch_posdao_epoches!: Sequelize.BelongsToManyHasAssociationsMixin<posdao_epoch, posdao_epochId>;
  countId_posdao_epoch_posdao_epoches!: Sequelize.BelongsToManyCountAssociationsMixin;
  // delegate_staker hasMany stake_delegators via delegator
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

  static initModel(sequelize: Sequelize.Sequelize): typeof delegate_staker {
    return delegate_staker.init({
    id: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    tableName: 'delegate_staker',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "PK_Delegate_Staker",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
