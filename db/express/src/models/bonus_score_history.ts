import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { headers, headersId } from './headers';
import type { node, nodeId } from './node';

export interface bonus_score_historyAttributes {
  from_block: number;
  to_block?: number;
  node: any;
  bonus_score: number;
}

export type bonus_score_historyPk = "from_block" | "node";
export type bonus_score_historyId = bonus_score_history[bonus_score_historyPk];
export type bonus_score_historyOptionalAttributes = "to_block";
export type bonus_score_historyCreationAttributes = Optional<bonus_score_historyAttributes, bonus_score_historyOptionalAttributes>;

export class bonus_score_history extends Model<bonus_score_historyAttributes, bonus_score_historyCreationAttributes> implements bonus_score_historyAttributes {
  from_block!: number;
  to_block?: number;
  node!: any;
  bonus_score!: number;

  // bonus_score_history belongsTo headers via from_block
  from_block_header!: headers;
  getFrom_block_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setFrom_block_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createFrom_block_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // bonus_score_history belongsTo headers via to_block
  to_block_header!: headers;
  getTo_block_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setTo_block_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createTo_block_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // bonus_score_history belongsTo node via node
  node_node!: node;
  getNode_node!: Sequelize.BelongsToGetAssociationMixin<node>;
  setNode_node!: Sequelize.BelongsToSetAssociationMixin<node, nodeId>;
  createNode_node!: Sequelize.BelongsToCreateAssociationMixin<node>;

  static initModel(sequelize: Sequelize.Sequelize): typeof bonus_score_history {
    return bonus_score_history.init({
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
      allowNull: true,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    },
    node: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'node',
        key: 'pool_address'
      }
    },
    bonus_score: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'bonus_score_history',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "PK_BONUS_SCORE_HISTORY",
        unique: true,
        fields: [
          { name: "node" },
          { name: "from_block" },
        ]
      },
    ]
  });
  }
}
