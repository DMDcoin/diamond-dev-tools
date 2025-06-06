import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { headers, headersId } from './headers';
import type { node, nodeId } from './node';

export interface stake_historyAttributes {
  from_block: number;
  to_block: number;
  stake_amount: number;
  node: any;
}

export type stake_historyPk = "from_block" | "to_block" | "node";
export type stake_historyId = stake_history[stake_historyPk];
export type stake_historyCreationAttributes = stake_historyAttributes;

export class stake_history extends Model<stake_historyAttributes, stake_historyCreationAttributes> implements stake_historyAttributes {
  from_block!: number;
  to_block!: number;
  stake_amount!: number;
  node!: any;

  // stake_history belongsTo headers via from_block
  from_block_header!: headers;
  getFrom_block_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setFrom_block_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createFrom_block_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // stake_history belongsTo headers via to_block
  to_block_header!: headers;
  getTo_block_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setTo_block_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createTo_block_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // stake_history belongsTo node via node
  node_node!: node;
  getNode_node!: Sequelize.BelongsToGetAssociationMixin<node>;
  setNode_node!: Sequelize.BelongsToSetAssociationMixin<node, nodeId>;
  createNode_node!: Sequelize.BelongsToCreateAssociationMixin<node>;

  static initModel(sequelize: Sequelize.Sequelize): typeof stake_history {
    return stake_history.init({
    from_block: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    },
    to_block: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    },
    stake_amount: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    node: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'node',
        key: 'pool_address'
      }
    }
  }, {
    sequelize,
    tableName: 'stake_history',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "stake_history_pkey",
        unique: true,
        fields: [
          { name: "from_block" },
          { name: "to_block" },
          { name: "node" },
        ]
      },
    ]
  });
  }
}
