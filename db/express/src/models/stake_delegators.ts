import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { delegate_staker, delegate_stakerId } from './delegate_staker';
import type { node, nodeId } from './node';

export interface stake_delegatorsAttributes {
  pool_address: any;
  delegator: any;
  total_delegated: number;
}

export type stake_delegatorsPk = "pool_address" | "delegator";
export type stake_delegatorsId = stake_delegators[stake_delegatorsPk];
export type stake_delegatorsCreationAttributes = stake_delegatorsAttributes;

export class stake_delegators extends Model<stake_delegatorsAttributes, stake_delegatorsCreationAttributes> implements stake_delegatorsAttributes {
  pool_address!: any;
  delegator!: any;
  total_delegated!: number;

  // stake_delegators belongsTo delegate_staker via delegator
  delegator_delegate_staker!: delegate_staker;
  getDelegator_delegate_staker!: Sequelize.BelongsToGetAssociationMixin<delegate_staker>;
  setDelegator_delegate_staker!: Sequelize.BelongsToSetAssociationMixin<delegate_staker, delegate_stakerId>;
  createDelegator_delegate_staker!: Sequelize.BelongsToCreateAssociationMixin<delegate_staker>;
  // stake_delegators belongsTo node via pool_address
  pool_address_node!: node;
  getPool_address_node!: Sequelize.BelongsToGetAssociationMixin<node>;
  setPool_address_node!: Sequelize.BelongsToSetAssociationMixin<node, nodeId>;
  createPool_address_node!: Sequelize.BelongsToCreateAssociationMixin<node>;

  static initModel(sequelize: Sequelize.Sequelize): typeof stake_delegators {
    return stake_delegators.init({
    pool_address: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'node',
        key: 'pool_address'
      }
    },
    delegator: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'delegate_staker',
        key: 'id'
      }
    },
    total_delegated: {
      type: DataTypes.DECIMAL,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'stake_delegators',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "stake_delegators_pkey",
        unique: true,
        fields: [
          { name: "pool_address" },
          { name: "delegator" },
        ]
      },
    ]
  });
  }
}
