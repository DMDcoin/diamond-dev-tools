import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface stake_transactionAttributes {
  id: number;
  block_number: number;
  block_timestamp: number;
  action_type: string;
  pool_address: any;
  staker_address?: any;
  to_pool_address?: any;
  caller_address?: any;
  amount: string;
  staking_epoch?: number;
  is_delegator_stake: boolean;
  created_at?: Date;
}

export type stake_transactionPk = "id";
export type stake_transactionId = stake_transaction[stake_transactionPk];
export type stake_transactionOptionalAttributes =
  | "id"
  | "staker_address"
  | "to_pool_address"
  | "caller_address"
  | "staking_epoch"
  | "is_delegator_stake"
  | "created_at";
export type stake_transactionCreationAttributes = Optional<
  stake_transactionAttributes,
  stake_transactionOptionalAttributes
>;

export class stake_transaction
  extends Model<stake_transactionAttributes, stake_transactionCreationAttributes>
  implements stake_transactionAttributes
{
  id!: number;
  block_number!: number;
  block_timestamp!: number;
  action_type!: string;
  pool_address!: any;
  staker_address?: any;
  to_pool_address?: any;
  caller_address?: any;
  amount!: string;
  staking_epoch?: number;
  is_delegator_stake!: boolean;
  created_at?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof stake_transaction {
    return stake_transaction.init(
      {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
        },
        block_number: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        block_timestamp: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        action_type: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },
        pool_address: {
          type: DataTypes.BLOB,
          allowNull: false,
        },
        staker_address: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        to_pool_address: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        caller_address: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        amount: {
          type: DataTypes.DECIMAL,
          allowNull: false,
        },
        staking_epoch: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        is_delegator_stake: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'stake_transactions',
        schema: 'public',
        timestamps: false,
        indexes: [
          { name: 'stake_transactions_pkey', unique: true, fields: [{ name: 'id' }] },
          { name: 'idx_stake_tx_staker', fields: [{ name: 'staker_address' }] },
          { name: 'idx_stake_tx_pool', fields: [{ name: 'pool_address' }] },
          { name: 'idx_stake_tx_block_number', fields: [{ name: 'block_number' }] },
        ],
      }
    );
  }
}
