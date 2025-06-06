import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { headers, headersId } from './headers';
import type { node, nodeId } from './node';
import type { posdao_epoch, posdao_epochId } from './posdao_epoch';

export interface ordered_withdrawalAttributes {
  id: number;
  amount: number;
  block_number?: number;
  staking_epoch?: number;
  from_pool_stakingAddress?: any;
  staker?: any;
  claimed_on_block?: number;
}

export type ordered_withdrawalPk = "id";
export type ordered_withdrawalId = ordered_withdrawal[ordered_withdrawalPk];
export type ordered_withdrawalOptionalAttributes = "id" | "block_number" | "staking_epoch" | "from_pool_stakingAddress" | "staker" | "claimed_on_block";
export type ordered_withdrawalCreationAttributes = Optional<ordered_withdrawalAttributes, ordered_withdrawalOptionalAttributes>;

export class ordered_withdrawal extends Model<ordered_withdrawalAttributes, ordered_withdrawalCreationAttributes> implements ordered_withdrawalAttributes {
  id!: number;
  amount!: number;
  block_number?: number;
  staking_epoch?: number;
  from_pool_stakingAddress?: any;
  staker?: any;
  claimed_on_block?: number;

  // ordered_withdrawal belongsTo headers via claimed_on_block
  claimed_on_block_header!: headers;
  getClaimed_on_block_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setClaimed_on_block_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createClaimed_on_block_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // ordered_withdrawal belongsTo node via from_pool_stakingAddress
  from_pool_stakingAddress_node!: node;
  getFrom_pool_stakingAddress_node!: Sequelize.BelongsToGetAssociationMixin<node>;
  setFrom_pool_stakingAddress_node!: Sequelize.BelongsToSetAssociationMixin<node, nodeId>;
  createFrom_pool_stakingAddress_node!: Sequelize.BelongsToCreateAssociationMixin<node>;
  // ordered_withdrawal belongsTo posdao_epoch via staking_epoch
  staking_epoch_posdao_epoch!: posdao_epoch;
  getStaking_epoch_posdao_epoch!: Sequelize.BelongsToGetAssociationMixin<posdao_epoch>;
  setStaking_epoch_posdao_epoch!: Sequelize.BelongsToSetAssociationMixin<posdao_epoch, posdao_epochId>;
  createStaking_epoch_posdao_epoch!: Sequelize.BelongsToCreateAssociationMixin<posdao_epoch>;

  static initModel(sequelize: Sequelize.Sequelize): typeof ordered_withdrawal {
    return ordered_withdrawal.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    block_number: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    staking_epoch: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'posdao_epoch',
        key: 'id'
      }
    },
    from_pool_stakingAddress: {
      type: DataTypes.BLOB,
      allowNull: true,
      references: {
        model: 'node',
        key: 'pool_address'
      }
    },
    staker: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    claimed_on_block: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    }
  }, {
    sequelize,
    tableName: 'ordered_withdrawal',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "pk_ordered_withdraw",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  }
}
