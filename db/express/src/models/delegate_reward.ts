import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { delegate_staker, delegate_stakerId } from './delegate_staker';
import type { posdao_epoch, posdao_epochId } from './posdao_epoch';

export interface delegate_rewardAttributes {
  id_node: any;
  id_posdao_epoch: number;
  id_delegator: any;
  is_claimed?: boolean;
  reward_amount: number;
}

export type delegate_rewardPk = "id_node" | "id_posdao_epoch" | "id_delegator";
export type delegate_rewardId = delegate_reward[delegate_rewardPk];
export type delegate_rewardOptionalAttributes = "is_claimed";
export type delegate_rewardCreationAttributes = Optional<delegate_rewardAttributes, delegate_rewardOptionalAttributes>;

export class delegate_reward extends Model<delegate_rewardAttributes, delegate_rewardCreationAttributes> implements delegate_rewardAttributes {
  id_node!: any;
  id_posdao_epoch!: number;
  id_delegator!: any;
  is_claimed?: boolean;
  reward_amount!: number;

  // delegate_reward belongsTo delegate_staker via id_delegator
  id_delegator_delegate_staker!: delegate_staker;
  getId_delegator_delegate_staker!: Sequelize.BelongsToGetAssociationMixin<delegate_staker>;
  setId_delegator_delegate_staker!: Sequelize.BelongsToSetAssociationMixin<delegate_staker, delegate_stakerId>;
  createId_delegator_delegate_staker!: Sequelize.BelongsToCreateAssociationMixin<delegate_staker>;
  // delegate_reward belongsTo posdao_epoch via id_posdao_epoch
  id_posdao_epoch_posdao_epoch!: posdao_epoch;
  getId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToGetAssociationMixin<posdao_epoch>;
  setId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToSetAssociationMixin<posdao_epoch, posdao_epochId>;
  createId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToCreateAssociationMixin<posdao_epoch>;

  static initModel(sequelize: Sequelize.Sequelize): typeof delegate_reward {
    return delegate_reward.init({
    id_node: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      unique: "U_delegate_reward"
    },
    id_posdao_epoch: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'posdao_epoch',
        key: 'id'
      },
      unique: "U_delegate_reward"
    },
    id_delegator: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'delegate_staker',
        key: 'id'
      },
      unique: "U_delegate_reward"
    },
    is_claimed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    reward_amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'delegate_reward',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "U_delegate_reward",
        unique: true,
        fields: [
          { name: "id_node" },
          { name: "id_posdao_epoch" },
          { name: "id_delegator" },
        ]
      },
      {
        name: "fki_fk_posdao_epoch",
        fields: [
          { name: "id_posdao_epoch" },
        ]
      },
      {
        name: "pk_delegate_reward",
        unique: true,
        fields: [
          { name: "id_node" },
          { name: "id_delegator" },
          { name: "id_posdao_epoch" },
        ]
      },
    ]
  });
  }
}
